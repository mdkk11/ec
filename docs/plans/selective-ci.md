# 差分影響範囲によるCI・E2E選択実行の実装計画

## 1. 背景と目的

Pull Requestごとに `static-and-unit`、`backend-integration`、`storybook-vrt`、`e2e` の4ジョブを常時実行しているため、文書だけの変更や特定テストレベルだけの変更でもPostgreSQL、Storybook、Playwrightを含む全環境を起動している。

PRの変更ファイルから影響するテスト責任領域を保守的に選び、安全に無関係と判断できるジョブだけをskipする。さらにE2Eジョブが必要な場合は、import依存グラフと明示mapから影響するPlaywright specを選ぶ。現在の待ち時間とrunner消費を減らしつつ、spec増加後も同じ仕組みを拡張できる状態にする。

既存の4 required check名、テストレベルの責任境界、判定不能時の全実行、`main` pushでの全実行を安全条件として維持する。

## 2. 現状調査

### 調査済みの事実

- `main` のCIは `.github/workflows/ci.yml` 1本で、PRと`main` pushの両方に対して4ジョブを常時実行する。
- mainのbranch protectionは `static-and-unit`、`backend-integration`、`storybook-vrt`、`e2e` をrequired checkとし、`strict: true` である。
- GitHub公式仕様では、workflow-levelの `paths` でworkflowをskipするとrequired checkがPendingのまま残る場合がある。一方、job-levelの `if` でskipしたjobはSuccessとして報告される。
- GitHub公式仕様では、`needs`先が失敗またはskipすると依存jobも既定でskipされる。判定jobの失敗でrequired checkが素通りしないよう、required job側はliteralの `'false'` が得られた場合だけskipするfail-safe条件が必要である。
- `vitest --changed` は静的importから関連test fileを選べるが、migration、fixture、Playwright、VRTを含むリポジトリ全体の選択器にはならない。
- `mdkk11/test-my-docs` の現行workflowには差分選択実行がなかった。
- 参考実装の `mdkk11/fsd-frontend-template` は、`fetch-depth: 0`、three-dot diff、`dependency-cruiser`の逆依存closure、route map、E2E mapからLighthouse URLとE2E specを選ぶ。広域変更や依存グラフ生成失敗ではPR baselineへfallbackし、選択理由をStep Summaryとartifactへ残す。
- このリポジトリには9 E2E specがあり、Playwright project展開後は23 testになる。Playwright projectごとにspecとfixtureを分離しており、選択したspec pathをPlaywrightへ渡せば対応projectだけを実行できる。
- E2Eはproduction codeを直接importしないため、依存グラフだけでspecを選べない。page、Route Handler、featureとspecの対応を明示mapで補う必要がある。
- `tests/e2e/app-shell.spec.ts` と `product-browsing.spec.ts` は画像loadとlocal assetを検証しているため、`public/**` はVRTだけでなくE2Eの責任でもある。
- 現在 `dependency-cruiser` は未導入で、npm registry上の調査時点の最新版は `18.2.0` である。

### 参照資料

- GitHub Docs: [Using conditions to control job execution](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-jobs-with-conditions)
- GitHub Docs: [Troubleshooting required status checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks)
- GitHub Docs: [Workflow syntax for GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- Vitest: [Command Line Interface / changed](https://vitest.dev/guide/cli)
- 参考実装: [`mdkk11/fsd-frontend-template`](https://github.com/mdkk11/fsd-frontend-template)
- 大規模リポジトリの参考: [Sentryの差分判定workflow](https://github.com/getsentry/sentry/actions/runs/22774537227/workflow?pr=110096)

## 3. 解決する問題

- 文書だけのPRでも依存install、PostgreSQL service、Storybook build、3ブラウザE2Eがすべて実行される。
- Backend、VRT、E2E専用testだけの変更でも無関係なテスト責任領域を実行する。
- workflow-level path filterでは、現在のrequired check契約を壊さず安全にskipできない。
- path-to-job対応をYAMLへ直接散らすと自動テストできず、将来のディレクトリ変更で過少実行を検出しにくい。
- E2Eジョブを選べても、現在は9 specをすべて実行する。今後specが増えるほどroute・feature局所変更の待ち時間が増える。
- import依存だけではHTTP経由のRoute Handler、DB、asset、Playwright specとの関係を表現できない。
- 差分判定jobが失敗した場合に通常の `needs` だけで接続すると、4 required jobsが連鎖skipされる危険がある。

## 4. 採用する方針

### 4.1 二段階の選択

1. **job選択**: 依存packageを必要としないNode.js scriptで、PR差分から既存4ジョブのrun/skipを決める。
2. **E2E spec選択**: `e2e` jobが選ばれたPRだけ、依存install後に`dependency-cruiser`と明示mapで実行specを決める。

これにより、docs-only PRの判定前に `pnpm install` するコストを発生させない。選択単位を増やしても、required checkは既存4ジョブのままとする。

### 4.2 イベントと差分契約

- PRでは `github.event.pull_request.base.sha` と `head.sha` を環境変数でscriptへ渡し、その固定SHA間をthree-dot diffする。可変なbranch refやshell展開へ直接埋め込まない。
- checkoutは `fetch-depth: 0` を使い、base/head objectを取得する。
- renameで実装側の旧pathを落とさないよう、`git diff --no-renames --name-only -z "$BASE_SHA...$HEAD_SHA"` を使う。renameをdelete＋addとして分類する。
- `main` pushでは差分選択を行わず、4ジョブとE2E全specを実行する。
- workflow自体へ `paths` / `paths-ignore` は設定しない。

### 4.3 job選択器

- `scripts/impact/select-ci-jobs.mjs` をNode.js 24のES moduleとして追加する。
- 純粋なpath分類関数と、Git差分・GitHub outputを扱うCLI境界を分ける。
- ローカルとtestでは環境変数で変更file一覧を直接渡せるようにする。
- `static_and_unit`、`backend_integration`、`storybook_vrt`、`e2e` のliteral `'true'` / `'false'` に加え、`e2e_mode=skip|select|full` とその理由、変更file、分類理由、fallback理由を出力する。
- booleanは `$GITHUB_OUTPUT`、判定内容は `$GITHUB_STEP_SUMMARY` へ書く。
- 分類不能、空差分、diff失敗は4ジョブすべてtrue、`e2e_mode=full` にして正常終了する。stage 1がfullと判断した理由をstage 2で再推定しない。

### 4.4 保守的なjob matrix

安全に無関係と判断できる場合だけskipし、複数分類は和集合を実行する。

| 変更分類 | static-and-unit | backend-integration | storybook-vrt | e2e |
| --- | --- | --- | --- | --- |
| `docs/**`、`README.md`、`AGENTS.md`、`DESIGN.md`、`CONTEXT.md`だけ | skip | skip | skip | skip |
| `src/**/*.unit.test.*`、`src/**/*.frontend.test.*` | run | skip | skip | skip |
| `tests/backend/**` | run | run | skip | skip |
| `tests/vrt/**`、`.storybook/**`、`src/**/*.stories.*` | run | skip | run | skip |
| `tests/e2e/**` | run | skip | skip | run |
| `src/app/api/**`、`src/server/**`、`src/features/**/server/**`、`scripts/db/**`、`drizzle/**` | run | run | skip | run |
| `src/app/**`のUI、`src/components/**`、UIコンポーネント | run | skip | run | run |
| `src/contracts/**`、共有domain・日時処理 | run | run | run | run |
| `public/**`の表示asset | skip | skip | run | run |
| package、lockfile、共通config、CI workflow、impact選択器・map | run | run | run | run |
| 分類不能、空差分、diff取得失敗 | run | run | run | run |
| `main` push | run | run | run | run |

test file、story、server directoryなど狭い規則を先に評価し、広い `src/features/**` 規則で上書きしない。非UIの共有feature logicと `src/test/**` は全実行側へ倒す。docsなどE2Eに安全に無関係なpathは `safe-ignore`、graphまたはmapで責任を追えるpathは `select`、E2E関連の分類不能・共有・high-risk pathは `full` とし、mixed diffでは `full` を最優先する。

### 4.5 E2E依存グラフと明示map

- `dependency-cruiser@18.2.0` をexact devDependencyとして追加する。
- `.dependency-cruiser.cjs` は `tsconfig.json` の `@/` alias、relative import、TypeScript/JavaScript extensionを解決し、`src/app` と `src` の内部依存を収集する。`node_modules`、build、coverage、Storybook出力と、意図的に追跡しないCSS・asset edgeを明示除外する。
- `scripts/impact/select-affected-e2e.mjs` はdependency graphを `.impact/dependency-graph.json` へ出力し、変更fileから逆依存closureを作る。
- `config/impact/e2e-map.json` に、各specの対象page entry、Route Handler entry、feature slice、常時smoke指定をまとめる。Lighthouseがないためroute mapとE2E mapを別fileへ重複させない。選択器は `tests/e2e/*.spec.ts` の発見集合と有効なmap spec集合の完全一致、spec重複なし、entry/sliceの存在、各specが `playwright.config.ts` の少なくとも1 projectへ収集されることを検証する。
- mapは少なくとも次のspecを表現する。

| E2E spec | 主なroute / feature |
| --- | --- |
| `app-shell.spec.ts` | `/`、root layout、header/footer、home、auth controls、asset |
| `authentication.spec.ts` | `/login`、session API、auth/session |
| `product-browsing.spec.ts` | `/`、`/products`、`/products/[productId]`、products/categories、asset |
| `cart.spec.ts` | `/login`、商品詳細、`/cart`、cart API、products/cart |
| `purchase.spec.ts` | login、商品詳細、cart、coupon、orders、注文完了・履歴 |
| `mobile-purchase.spec.ts` | purchaseと同じ主要導線のmobile project |
| `stock-conflict.spec.ts` | 商品詳細、cart、stock更新、checkout競合 |
| `admin-products.spec.ts` | login、`/admin/products/**`、admin product API、公開商品確認 |
| `admin-orders.spec.ts` | login、`/admin/orders`、admin order API |

- spec自体の変更では必ずそのspecを選ぶ。
- dependency closureまたは明示slice/entryが一致したspecを選ぶ。E2E関連の各変更pathを `safe-ignore`、`graph-or-map-covered`、`high-risk-or-unmatched` のいずれかへ分類し、1件でも `high-risk-or-unmatched` があれば全specへfallbackする。
- `app-shell.spec.ts` を通常のE2E選択時のsmoke baselineとして常に含める。
- `src/app/layout.tsx`、`src/app/globals.css`、`src/app/providers.tsx`、`src/components/layout/**`、`src/contracts/**`、`src/server/db/**`、`drizzle/**`、`scripts/db/**`、`public/**`、`tests/e2e/global-setup.ts`、`tests/e2e/update-product-stock.ts`、`playwright.config.ts`、`.node-version`、`package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、`next.config.ts`、`postcss.config.mjs`、`tsconfig.json`、`.github/workflows/**`、`.dependency-cruiser.cjs`、`config/impact/**`、`scripts/impact/**` はhigh-riskとして全specを選ぶ。この具体path集合を実装とtestの単一source of truthにする。
- graph commandの異常終了だけでなく、内部 `@/`・relative source edgeの `couldNotResolve`、予期しない `followable: false`、module重複・欠落、invalid JSONも不完全graphとして全specへfallbackする。CSS・assetなど意図的に除外するedgeだけをallow list化する。
- graph生成失敗、map不整合、影響route/specが0件、E2E関連pathの分類不能は全specへfallbackする。
- 選択結果は `.impact/e2e-selection.json`、`GITHUB_ENV`、`GITHUB_STEP_SUMMARY` へ出す。変更file、impacted module、選択spec、理由、fallback理由を含める。

### 4.6 選択specの実行

- package commandは `ci:impact:select = node scripts/impact/select-affected-e2e.mjs`、`test:e2e:selected = NODE_ENV=test node scripts/impact/run-selected-e2e.mjs` とする。
- `scripts/impact/run-selected-e2e.mjs` が選択結果を読み、full modeでは既存 `pnpm test:e2e`、selected modeでは `pnpm exec playwright test <spec...>` を一度だけ実行する。自分自身の `test:e2e:selected` を再帰呼出ししない。
- 既存 `playwright.config.ts`、global setup、専用DB、production build、projectごとのfixture分離は変更しない。
- spec pathはmap由来のリポジトリ内pathだけを配列引数として `spawnSync` へ渡し、shell文字列へ連結しない。selection missing/invalidはfull、child statusがnullならfailureとする。追加CLI引数はv1では受け渡さず、`--list`確認はrunnerのspawn関数testまたはPlaywright直接呼出しで行う。
- `.impact` を `.gitignore` へ追加し、CIでは選択artifactを7日保存する。

### 4.7 workflow fail-safe

- `.github/workflows/ci.yml` に軽量な `changes` jobを追加し、4 boolean outputに加えて `e2e_mode` と理由を公開する。
- `changes` jobはjob選択器のNode標準testを実行してから実際の差分を分類し、`e2e_mode` と理由もoutputにする。
- 既存4ジョブは `needs: changes` とjob-level条件を持つ。
- 各条件は `always() && !cancelled()` を使い、`changes.result != 'success'` または対応outputがliteral `'false'` **以外**ならrunする。output未設定、空文字、大小文字違い、不正値はrunへ倒す。
- `static-and-unit` でもjob選択器とE2E選択器のNode標準testを実行し、選択ロジック破損をrequired checkのfailureにする。
- `e2e` jobはstage 1の `e2e_mode=full` ならE2E selectorを通さず全specを実行し、`select` の場合だけ依存graph選択を行う。selection stepへIDを付けて `continue-on-error: true` とし、異常終了、selection JSON missing/invalidではrunnerをfull modeで必ず起動する。fallback実行後はselector異常を明示するguard stepをfailureにし、選択機構の破損をgreenにしない。
- 4 job IDと表示名、branch protection設定は変更しない。

## 5. 採用しない方針

- workflow-levelの `paths` / `paths-ignore` はrequired checkがPendingになるため採用しない。
- `dorny/paths-filter` は自動テストするjob matrixとの二重管理になるため追加しない。
- Lighthouse、performance URL、動的route sample URLはこのリポジトリの要求ではないため追加しない。
- Vitest `--changed` によるunit/frontend/backendの個別test file選択とVRT spec選択は初期導入に含めない。
- AST変更行解析、runtime tracing、flake学習、CI時間収集基盤は追加しない。
- 4ジョブを単一gate checkへ集約しない。
- `main` pushを選択実行にしない。
- 将来用の空map entryや未実装spec placeholderは追加しない。

## 6. 変更対象

- `.github/workflows/ci.yml`: `changes` job、4 required jobの条件、impact selection、選択artifactを追加する。
- `.dependency-cruiser.cjs`: `src/app` / `src` の依存グラフ設定を追加する。
- `config/impact/e2e-map.json`: 現在存在するE2E specだけのentry/slice/spec対応を追加する。
- `scripts/impact/select-ci-jobs.mjs`: dependency-freeなjob分類を実装する。
- `scripts/impact/select-ci-jobs.test.mjs`: job matrix、rename、mixed diff、`e2e_mode`伝播、fallback、CLI outputを検証する。
- `scripts/impact/select-affected-e2e.mjs`: graph、逆依存closure、map照合、fallback、summaryを実装する。
- `scripts/impact/select-affected-e2e.test.mjs`: fixture graph/mapによるspec選択、map完全性、未解決内部edge、high-risk、mixed diff、0件、graph/map failureを検証する。
- `scripts/impact/run-selected-e2e.mjs`: full/selected Playwright実行を実装する。
- `.gitignore`: `.impact` を除外する。
- `package.json` / `pnpm-lock.yaml`: `dependency-cruiser@18.2.0` と再現用scriptを追加する。
- `AGENTS.md` / `README.md`: 新規package command、PR/main、job/spec選択、fallback、Step Summary、artifactの確認方法を記載する。
- `docs/TEST_STRATEGY.md`: job matrixとE2E spec選択の責任境界を記載する。
- `docs/DEVELOPMENT_PLAN.md`: Phase 8のskip表現を安全なCI選択と矛盾しないよう更新する。
- `docs/plans/selective-ci.md`: 本計画を同じPRへ含める。

追加するpackage script名と実体は次に限定する。

- `ci:impact:select`: `node scripts/impact/select-affected-e2e.mjs`
- `test:e2e:selected`: `NODE_ENV=test node scripts/impact/run-selected-e2e.mjs`

job分類testは依存install前にも使うためpackage scriptにせず、workflowから `node --test` で直接実行する。

## 7. 実装手順

判定器、workflow、map、運用文書が揃って初めて安全に有効になるため、1つのPR layer `feature/selective-ci` とする。未使用mapや選択器だけをmainへ置く分割はしない。

1. 最新 `main` から `gh stack init feature/selective-ci` で1層stackを作成し、本計画以外の差分がないことを確認する。
2. dependency-freeなjob選択器とNode標準testを実装する。null区切りdiff、renameのdelete/add分類、path正規化、literal output、`e2e_mode`、unknown/full fallbackを確定する。`docs+UI` はselect、`unknown runtime+UI` と `deleted source+known UI` はfullになるmixed fixtureを含める。
3. `dependency-cruiser@18.2.0` と設定を追加し、現在の `src/app` page・Route Handlerからfeature/serverまでのgraphが生成できることを確認する。`@/` とrelative internal edgeの未解決が0であることを検証し、不完全graphを選択に使用しない。
4. 現在存在する9 E2E specについて `config/impact/e2e-map.json` を作る。`tests/e2e/*.spec.ts`との完全一致、重複なし、各entry/sliceの存在、各specを収集するPlaywright projectの存在を検証する。
5. E2E選択器、fixture graphを使うNode標準test、selected runnerを実装する。stage 1 fullを伝播し、stage 2でもE2E関連pathをsafe/covered/high-riskへ分類する。graph/map/unresolved/0件失敗とhigh-riskは全spec、通常変更はsmoke＋impacted specとする。
6. `.github/workflows/ci.yml` へ `changes` jobと4 required jobのfail-safe条件を追加する。E2E jobはfull historyをcheckoutし、PRのselect modeだけimpact selectionを行う。selector step異常時も全E2Eを実行し、その後guardをfailureにする。`main`とstage 1 full modeは直接全E2Eを使う。
7. `.impact` ignore、package scripts、`AGENTS.md`、`README.md`、`TEST_STRATEGY.md`、`DEVELOPMENT_PLAN.md` を実装と同期する。
8. ローカル検証と差分監査を行い、1つの意図的なcommitとして作成する。
9. `gh stack submit --auto` でdraft PRを作成し、リポジトリ指定形式の日本語PR本文へ更新する。このPR自身はworkflow・package・impact選択器変更というhigh-risk差分なので、4ジョブとE2E全specが実行されることを確認する。
10. boundedな `babysit-pr` one-shotでCI、mergeability、review feedbackを確認し、必要な修正後に再検証する。
11. Reviewer Guideと必要最小限の `[SHIP:NOTE]` を現在headへ同期し、独立final audit後にready for reviewへ移す。mergeは行わない。

## 8. テスト・検証方法

### 8.1 job選択器

- `node --test scripts/impact/select-ci-jobs.test.mjs`
- docs-only、unit/frontend、Backend、VRT、E2E、server、UI、contract、asset、migration、config、複数pathの和集合を表どおり検証する。
- `src/server/x.ts` → `docs/x.md`、UI→docs、docs→sourceのrenameを旧新両pathとして分類する。
- `docs+UI` は `e2e_mode=select`、`unknown runtime+UI` と `deleted source+known UI` は `full` にする。safe-ignore pathがcovered pathの選択効果を消さず、E2E関連unmatched pathが1件でもあればfullにする。
- unknown、空差分、diff失敗、full-runを4ジョブtrue・`e2e_mode=full` にする。
- 一時 `GITHUB_OUTPUT` / `GITHUB_STEP_SUMMARY` にliteral `'true'` / `'false'`、`skip|select|full`、理由が追記されることを確認する。

### 8.2 E2E選択器

- `node --test scripts/impact/select-affected-e2e.test.mjs`
- fixture graphでhome、auth、products、cart、orders、admin products、admin ordersの局所変更がsmoke＋対応specを選ぶ。
- page componentから共有dependencyへの逆依存closureを検証する。
- Route Handler、feature slice、spec自体の変更を明示mapから選ぶ。
- `src/app/layout.tsx`、`src/app/globals.css`、`src/components/layout/**`、`src/contracts/**`、`src/server/db/**`、`drizzle/**`、`scripts/db/**`、`tests/e2e/global-setup.ts`、`playwright.config.ts`、`.node-version`、pnpm/Next/TS/workflow/impact filesを全specにする。
- `tests/e2e/*.spec.ts` とmap集合の不一致、重複spec、存在しないentry/slice、Playwright projectに収集されないspecを全spec fallbackかvalidation failureにする。
- graph command failure、JSON不正、内部alias/relative edgeの未解決、module欠落・重複、0件を全specへfallbackする。CSS・assetのallow済みedgeは未解決扱いしない。
- `pnpm ci:impact:select` を現在の実graphに対して複数の `IMPACT_CHANGED_FILES` fixtureで実行し、selection JSONとStep Summaryを確認する。
- `pnpm exec playwright test tests/e2e/authentication.spec.ts --list` と全mapped specの `--list` でproject filteringとmap収集を確認する。runnerのspawn関数testでもselected/fullの引数、missing selection、child status null、非再帰を検証する。
- `IMPACT_CHANGED_FILES=<局所変更>` でselectionを作り、準備済みE2E DBに対して `pnpm test:e2e:selected` をselected modeで1回実行し、global setup、DB reset/seed、Next build/startを含む実経路を確認する。

### 8.3 リポジトリ品質

workflow、package、共通選択器は全領域に影響するため、実装PRでは次をすべて実行する。

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:frontend`
- `pnpm db:prepare:test && pnpm test:backend`
- `pnpm test:e2e`
- 固定Linux containerで `pnpm test:vrt`
- `pnpm build`
- `pnpm build-storybook`

DB、browser、固定Linux環境を用意できず未実施となる項目は理由と未確認範囲をPRへ記載する。VRT基準画像は更新しない。

### 8.4 workflowとGitHub

- 4 job IDとoutput参照名が変わっていないことを確認する。
- 各required jobの条件が `changes.result != 'success' || output != 'false'` で、missing/empty/invalid output時にrunすることを差分レビューする。
- stage 1の `e2e_mode=full` がE2E jobへ伝播し、selectの場合だけstage 2を実行することを確認する。
- `changes` jobのtest failureでは4 required jobsがrunし、`static-and-unit`内の同testがrequired failureを返す設計を確認する。
- E2E selector stepを意図的にnonzeroにするfixtureでは、全E2E runnerが実行された後にguard stepがjobをfailureにするworkflow条件を確認する。
- draft PRのStep Summaryと `.impact` artifactで変更file、impacted module、選択job/spec、fallback理由を確認する。
- 実装PRはhigh-risk差分なので4 required jobsとE2E全specが成功することを確認する。
- `gh api repos/mdkk11/ec/branches/main/protection/required_status_checks --jq '{strict, contexts, checks}'` で既存4件と `strict: true` を確認する。
- docs-onlyの実job skipと通常変更のselected E2Eは、本PRのdiff自体がhigh-riskなので本PR上では観測できない。自動testとGitHub公式契約を受入根拠とし、導入後最初の該当PRでStep SummaryとSuccess/skippedを運用確認する。

## 9. リスク

- path/map漏れは必要なテストのskipにつながる。stage 1の `e2e_mode` を伝播し、stage 2でもE2E関連pathを全件分類してunknown、high-risk、graph/map/0件失敗を全実行へ倒す。
- dependency graphはHTTP、DB、CSS、asset依存を完全には表現せず、command成功でも未解決internal edgeを含み得る。Route Handler entry、feature slice、具体的high-risk path、smoke baseline、unresolved edge検査で補う。
- `changes` jobの失敗が連鎖skipを起こし得る。literal `'false'` だけをskip条件にし、選択器testをrequired jobでも実行する。
- `dependency-cruiser`追加によりinstallとlockfile保守が増える。E2E job内だけでgraph生成し、他3ジョブの選択判定には使わない。
- E2E specを減らしてもDB準備とNext.js buildは残るため、現在の9 specでは短縮幅が小さい可能性がある。将来spec増加に備える目的を含み、初回PRの効果を過大に説明しない。
- mapはroute/feature変更時に保守が必要になる。filesystem上の全specとの完全一致、entry/slice存在、Playwright project収集を検証し、現在存在するspec以外のplaceholderを作らない。
- 実装PRでは全実行しかGitHub上で観測できない。selector testと導入後の最初の通常PRで運用確認する限界を明記する。

## 10. 未確定事項

- なし。ユーザーはjob単位選択に加え、将来に備えてdependency graphと明示mapによるE2E spec選択を今回導入する方針を確認済みである。

## 11. 完了条件

- PR差分から4責任領域を選び、安全に無関係なjobだけをjob-level条件でskipできる。
- E2E job内でdependency graphと明示mapからsmoke＋影響specだけを実行できる。
- workflow-level path filterを使わず、既存4 required check名とbranch protectionを維持する。
- `main` push、unknown、empty、diff/graph/map/selection failure、未解決internal edge、high-risk変更では必要な範囲を全実行する。selector異常終了時も全E2Eを実行したうえでCIをfailureにする。
- rename旧新path、mixed diff、job matrix、`e2e_mode`伝播、逆依存closure、map完全性、spec選択、fallback、CLI outputがNode標準testで検証される。
- Step Summaryとartifactから変更file、impacted module、選択job/spec、fallback理由を追跡できる。
- lint、typecheck、全テスト、build、Storybook buildの実施結果または未実施理由がPRへ記録される。
- CI、review、Reviewer Guide、独立final auditが同じPR headに対して完了し、人間がreview・mergeできる状態になる。自動mergeは行わない。
