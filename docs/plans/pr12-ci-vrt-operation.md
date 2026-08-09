# PR12 CI・VRT運用完成の実装計画

## 1. 背景と目的

`docs/DEVELOPMENT_PLAN.md` のPR分割案にあるPR12だけを対象に、4つのCIジョブ、`VRT-001`〜`VRT-008`、Playwright成果物、VRT基準画像更新手順、mainの必須check運用を完成させる。

GitHub上のPull Request #12は、開発計画上のPR11「注文状態管理」を取り込んだPRである。本計画のPR12は開発計画上の番号であり、実装は最新の `origin/main` から別ブランチを作成して行う。

本計画の承認後に実装を開始する。計画作成時点では、本計画ファイル以外のアプリケーションコード、テスト、設定、GitHubリポジトリ設定を変更しない。

## 2. 現状調査

- 2026-08-09に `origin/main` を取得し、GitHub Pull Request #12を取り込んだ `14c095e` まで更新済みである。現在の `feature/pr11-admin-order-management` のHEAD `af4b536` は `origin/main` の祖先で、workspaceは本計画作成前にcleanである。
- `.github/workflows/ci.yml` には `static-and-unit`、`backend-integration`、`storybook-vrt`、`e2e` の4ジョブが既に分離されている。mainの直近CI run `31314815303` では4ジョブすべてが成功している。
- 直近CI runのartifactは0件である。Playwright設定はE2EとVRTの両方で `trace: 'retain-on-failure'` と `retries: 0` を使用しているが、runner終了後に `playwright-report` と `test-results` が残らない。
- `VRT-001`〜`VRT-008` の64枚の基準画像はすべて存在し、`TEST_SCENARIOS.md` が定義する状態とviewportの件数に一致する。
- VRTはPlaywright 1.61.1の固定Linux container、Chromium 1 project、1 worker、差分0 pixelで実行されている。Storybookはリポジトリ内fontと画像を使用し、storyは固定fixtureを使用している。
- 各VRT specはreduced motion、font待機、caret非表示、animation無効化を個別に設定している。画像待機は商品・カートだけにあり、同じ撮影責務が6ファイルへ重複しているため、今後のstory追加時に決定性の設定漏れが起きうる。
- `playwright.config.ts` は購入導線をChromium / Firefox / WebKit、商品管理と注文管理を3ブラウザ、モバイル購入をMobile Chromiumで実行する。browser projectごとのfixture分離、1 worker、固定sleepなし、retry 0は既に実装済みである。
- `README.md` には固定Linux containerでの基準画像更新手順と一括更新禁止がある。一方、コマンド一覧に `pnpm test:vrt:update` がなく、失敗artifactの確認方法と4ジョブすべてを必須checkにする手順が不足している。
- GitHub APIでmainのbranch protectionを確認したところ404で、mainは未保護である。4ジョブは実行されているが、merge前の必須checkとしては強制されていない。
- `.only`、理由のあるものを含む `.skip`、Playwrightのretry増加、VRTの許容差拡大、外部画像・外部font依存は検出されていない。アプリの通信先として新しい外部network依存を追加する必要はない。

## 3. 解決する問題

- E2EまたはVRTがCIで失敗しても、HTML report、trace、VRTのactual・diff画像をrun終了後に取得できない。
- VRTの撮影前処理がspecごとに分散し、font・画像・motion・caretの固定条件を全storyへ一律に適用できない。
- VRT更新時に「どの画像を確認し、PRへ何を記載し、更新してはいけない条件は何か」という確認手順と、CI失敗時のartifact確認手順が1つの運用手順として完結していない。
- 4つの責任境界はCI job名として存在するが、mainのmerge条件になっていない。

## 4. 採用する方針

- 既存の4ジョブ構成、package script、テストレベル、Playwright project matrixは維持する。ジョブの再分割やmatrix化は行わない。
- `storybook-vrt` と `e2e` のテストstepが失敗した場合だけ、`actions/upload-artifact@v7` で `playwright-report` と `test-results` を保存する。artifact名はjobと `${{ github.run_attempt }}` を含め、同じrunの再実行でも衝突させない。保存期間は障害調査に十分な7日間とする。
- artifactへはPlaywright HTML report、`trace.zip`、VRTのactual・diff画像を含める。成功runでは保存せず、Storybook static buildや全成功テストの成果物を常時保存しない。
- `tests/vrt/capture-story.ts` に、viewport設定、reduced motion、story表示、root表示待機、`document.fonts.ready`、全画像のload/error待機、スクリーンショット取得を集約する。6つのVRT specはシナリオ列挙だけを担当する。
- `playwright.vrt.config.ts` でlight color schemeと固定localeを明示し、スクリーンショット差分閾値、Chromium、1 worker、retry 0の既存設定を維持する。storyの表示日時は既存の固定fixtureと明示timezone変換を使い、system現在時刻のmockや乱数生成を追加しない。
- PR12はUIを変更しないため基準画像を更新しない。共通撮影helperへの移行後も既存64枚と一致することを `pnpm test:vrt` で確認し、差分が出た場合は原因を修正して画像更新で吸収しない。
- `README.md` をPhase 8完了後の説明へ更新し、コマンド一覧へ `pnpm test:vrt:update` を追加する。固定Linuxでの検証・更新、対象画像だけのレビュー、PRのScreenshots記載、失敗artifactのdownloadとHTML report・trace確認、更新禁止条件を一続きの手順にする。
- mainのbranch protectionへ `static-and-unit`、`backend-integration`、`storybook-vrt`、`e2e` をrequired status checksとして設定し、strict modeでbase branchの最新状態に対する成功を要求する。review必須化、signed commit、linear history、push制限などPR12で要求されていない規則は追加しない。
- branch protectionはPR差分としてversion管理できないため、4ジョブが成功することを確認できる状態でGitHub設定へ適用し、GitHub APIのread-backで4件とstrict modeを確認する。READMEには同じ設定を再現・監査する手順を残す。

参考にする一次情報:

- GitHub Actions workflow artifacts: <https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts>
- `actions/upload-artifact` の入力と保持期間: <https://github.com/actions/upload-artifact>
- Playwright Trace Viewerと `retain-on-failure`: <https://playwright.dev/docs/trace-viewer>
- GitHub required status checks: <https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches>

## 5. 採用しない方針

- 新しいnpm package、VRT SaaS、外部storage、通知service、coverage serviceは追加しない。
- VitestへJUnit reporterを追加せず、単体・フロントエンド結合・バックエンド結合の失敗は既存のjob logで特定する。
- Playwrightのretryを増やさず、`.skip`、固定sleep、許容pixel差、個別テストの閾値緩和でflakeを隠さない。
- 64枚の基準画像を一括再生成せず、PR12では画像fileを変更しない。
- E2Eのbrowser matrix、fixture、DB reset、アプリ機能、business rule、migrationは変更しない。
- branch protection全体を管理するworkflow、GitHub token、repository secretを追加しない。

## 6. 変更対象

- `.github/workflows/ci.yml`
  - `storybook-vrt` と `e2e` へ失敗時artifact upload stepを追加し、HTML report、trace、actual・diff画像を7日間保持する。
- `playwright.vrt.config.ts`
  - VRTのlight color schemeとlocaleを固定し、既存の差分閾値、Chromium、1 worker、retry 0を維持する。
- `tests/vrt/capture-story.ts`
  - Storybook VRTの共通撮影前処理とスクリーンショット条件を定義する。
- `tests/vrt/products.vrt.spec.ts`
- `tests/vrt/cart.vrt.spec.ts`
- `tests/vrt/coupon.vrt.spec.ts`
- `tests/vrt/order-history.vrt.spec.ts`
- `tests/vrt/admin-products.vrt.spec.ts`
- `tests/vrt/admin-orders.vrt.spec.ts`
  - 各specは `VRT-001`〜`VRT-008` のstory・viewport列挙を維持し、共通helperを使用する。
- `README.md`
  - Phase 8、全package command、VRT検証・更新・レビュー、失敗artifact、4つのrequired checkの設定・監査手順を記載する。
- GitHub repository setting `main` branch protection
  - 4つのrequired status checksとstrict modeを設定する。リポジトリfileの変更ではないため、適用後にAPIで状態を確認する。

`PRODUCT.md`、`ARCHITECTURE.md`、`TEST_SCENARIOS.md` はbusiness rule、API、シナリオ割当を変更しないため更新しない。`TEST_STRATEGY.md` と `DEVELOPMENT_PLAN.md` の既存方針も変更せず、その実装と運用手順を完成させる。

## 7. 実装手順

### 計画作成段階

1. 本計画を `docs/plans/pr12-ci-vrt-operation.md` へ保存する。
2. 計画file以外を変更せず、ユーザーへ内容確認を依頼する。
3. 計画fileの承認後に以下の実装段階へ進む。

### 実装段階

1. `origin/main` を取得し、`feature/pr12-ci-vrt-operation` を最新 `origin/main` から作成する。計画fileを新ブランチへ引き継ぎ、PR12と無関係なworkspace差分がないことを確認する。
2. `tests/vrt/capture-story.ts` を追加し、6つのVRT specから重複したviewport・media・font・画像待機・screenshot処理を移す。既存のシナリオ名、story ID、viewport、snapshot pathは変更しない。
3. `playwright.vrt.config.ts` にVRT環境のlight color schemeとlocaleを固定する。pixel許容値、browser、worker数、retryは変更しない。
4. 固定Linux containerで `pnpm test:vrt` を実行し、既存64枚が無変更で成功することを確認する。失敗時はhelperまたは環境固定を修正し、`test:vrt:update` は実行しない。
5. `.github/workflows/ci.yml` の `storybook-vrt` と `e2e` へ、`if: failure()` で `playwright-report` と `test-results` を保存するartifact stepを追加する。job別・run attempt別の名前、7日保持、file不在時の警告を設定する。
6. `README.md` のコマンド一覧、Phase 8到達状況、VRT検証・基準画像更新・レビュー・失敗調査、required check設定手順を更新する。
7. 全品質コマンドとCIを実行し、4ジョブ名、64枚のVRT、全browser project、artifact pathにずれがないことを確認する。
8. GitHubのmain branch protectionへ4つのrequired status checksとstrict modeを設定し、APIで設定値を再取得してREADMEの手順と一致することを確認する。

## 8. テスト・検証方法

- 静的・非DB
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test:unit`
  - `pnpm test:frontend`
- Backend結合
  - `pnpm db:prepare:test`
  - `pnpm test:backend`
- E2E
  - `pnpm test:e2e`
  - Chromium / Firefox / WebKitの購入導線、3ブラウザの管理導線、Mobile Chromiumが既存projectのまま成功することを確認する。
  - `playwright-report` と `test-results` に失敗時のtraceが出力される既存設定を確認し、CI artifact stepのpathと一致させる。
- VRT
  - 固定Linux containerで `pnpm test:vrt`
  - `VRT-001`〜`VRT-008` の64 testが成功し、`git diff -- tests/vrt/__screenshots__` が空であることを確認する。
  - 各specが共通helperを使用し、font・画像待機、reduced motion、caret・animation固定を外せない構造になっていることを確認する。
- build
  - `pnpm build`
  - `pnpm build-storybook`
- CI・artifact
  - Pull Request上で `static-and-unit`、`backend-integration`、`storybook-vrt`、`e2e` が独立して成功することを確認する。
  - artifact uploadは失敗時だけ実行されるため、workflow YAMLの条件、artifact名、path、保持期間を差分レビューし、成功runに不要なartifactが作られないことを確認する。Playwright自体の失敗はHTML report・trace・VRT差分を `playwright-report` / `test-results` へ出力する既存設定で保証する。
- branch protection
  - GitHub APIでmainのrequired checkが4件だけであること、名前がworkflow job名と一致すること、strict modeが有効であることを確認する。
  - mainへ直接pushする試験は行わず、次のPull Requestで4checkがmerge条件として表示されることを確認する。
- 差分監査
  - `.only`、`.skip`、retry増加、固定sleep、外部network URL、新規依存、基準画像差分がないことを `rg`、`git diff`、lockfile差分で確認する。

## 9. リスク

- `upload-artifact` のpathを誤ると、テスト失敗時に調査資料が残らない。Playwright既定出力の `playwright-report` と `test-results` をjobごとに同じworkspaceからuploadし、file不在はwarningとしてjob logへ残す。
- workflow runを再実行すると同名artifactが衝突しうる。artifact名へ `${{ github.run_attempt }}` を含める。
- VRT helperへの移行でsnapshot file名や保存先を変えると64枚すべてが差分になる。test title、snapshot argument、`snapshotPathTemplate` は変更しない。
- fontだけを待って画像を待たないstoryが今後追加されると、decode前の撮影でflakeになる。共通helperですべての画像のload/error完了を待つ。
- mainをstrict required checksにすると、base更新後に再実行が必要となりCI回数が増える。最新mainとの不整合をmerge前に検出することを優先し、job skip条件やpath filterは追加しない。
- branch protectionはrepository外部状態であり、PR差分だけでは再現できない。READMEへ手順を残し、適用後のAPI read-backを完了条件に含める。

## 10. 未確定事項

なし。

## 11. 完了条件

- `static-and-unit`、`backend-integration`、`storybook-vrt`、`e2e` が独立した責任境界で成功する。
- `VRT-001`〜`VRT-008` の64枚が固定Linux Chromiumで既存基準画像と一致し、PR12で基準画像を変更しない。
- VRT撮影でfont、画像、motion、caret、locale、color schemeが一貫して固定される。
- E2E / VRT失敗時にHTML report、Playwright trace、VRT actual・diff画像をGitHub Actions artifactから7日間取得できる設定になる。
- READMEだけでVRTの検証、意図的な基準画像更新、レビュー、失敗調査、更新禁止条件、required check設定を再現できる。
- mainで4つのrequired status checksとstrict modeが有効になり、API read-backで確認できる。
- `.only`、`.skip`、retry増加、固定sleep、外部network依存、新規package、migration、business rule変更を追加しない。
- lint、typecheck、全テスト、Next.js build、Storybook buildが成功する。
