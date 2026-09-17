# Playwright 1.63・開発依存更新の実装計画

## 1. 背景と目的

Dependabot Pull Request #52 は `@playwright/test` を 1.63.0 へ更新した一方、GitHub Actions の実行コンテナを 1.62.1 のままにしたため、VRT 95件とE2E 24件がブラウザ起動前に失敗した。その後 #52 は自動クローズされ、同じ開発依存グループを更新する #53 が作成されたが、先に取り込まれた ESLint 10更新と `package.json` / `pnpm-lock.yaml` が競合している。

最新の `main` から作成した `feature/playwright-1-63-dependency-update` で、#53 が提案する12件の開発依存更新を適用し、Playwright package・CIコンテナ・現行運用文書を1.63.0へ同期する。依存更新に必要な設定変更と検証だけを含む新しいPull Requestを作成し、競合中の #53 は新PRで置き換える。

本計画の承認後に実装を開始する。計画作成時点では、本計画ファイル以外のpackage、lockfile、CI設定、運用文書を変更しない。

## 2. 現状調査

- 2026-09-17時点の `origin/main` は Pull Request #47、#50、#51を取り込み、`pnpm/setup` 2.1.0、ESLint 10.9.1、Next.js 16.3.4、Zod 4.5.4を使用している。
- Open中の Dependabot Pull Request #53 は12件の開発依存を更新するが、ESLint 10更新前のlockfileを基にしており、GitHub上で `CONFLICTING` / `DIRTY` である。CIは開始されていない。
- `package.json` は `@playwright/test` 1.62.1、Storybook 10.5.10、`@typescript-eslint/parser` 8.68.0、Knip 6.32.3、Lefthook 2.1.10、Oxfmt 0.65.0、Oxlint 1.80.0、tsx 4.23.12などをexact versionで固定している。
- `.github/workflows/ci.yml` の `storybook-vrt` と `e2e` はどちらも `mcr.microsoft.com/playwright:v1.62.1-noble` を使用する。Playwright packageだけを1.63.0へ更新すると、1.63.0用browser executableを1.62.1コンテナ内で見つけられず失敗する。
- Playwright v1.63.0は2026-09-04 22:40 UTCに公開済みで、公式Docker文書とMCRに `mcr.microsoft.com/playwright:v1.63.0-noble` が存在する。イメージのamd64 config作成時刻は2026-09-04 23:42 UTCである。
- `docs/TEST_STRATEGY.md` と `README.md` はVRTの固定Linux環境を1.61.1と記載しており、現在のCI 1.62.1とも一致していない。過去の意思決定を記録する `docs/plans/*` 内の1.61.1表記は履歴として変更しない。
- business rule、API契約、DB schema、UIを変更する必要はない。
- Playwright 1.63.0 NobleでVRTを実行した結果、管理商品フォーム8件だけでtextarea右下のChromiumネイティブresizeハンドルが1px変化し、各20pxまたは36pxの差分が発生した。その他87件は既存基準画像と一致した。

## 3. 解決する問題

- Playwright packageとCIコンテナのversion不一致により、ブラウザを起動できずE2EとVRTを実行できない。
- Dependabot PR #53が最新 `main` と競合し、既に取り込まれたESLint 10と新しいlockfileを両立できていない。
- READMEとテスト戦略に記載された固定コンテナversionが実際のCIと一致せず、VRT基準画像更新手順をそのまま実行すると異なるbrowser環境を使用する。
- Storybook、Playwright、lint・format・dead-code検査toolの更新後も、既存の静的検査、テスト、buildが同じ責任境界で成功することを確認する必要がある。

## 4. 採用する方針

- 最新 `origin/main` を基点にし、既存のESLint 10.9.1、Next.js 16.3.4、Zod 4.5.4を維持する。競合中のDependabot branchをrebaseして再利用しない。
- Dependabot PR #53が提示した次の12件だけをexact versionで更新する。
  - `@playwright/test`: 1.62.1 → 1.63.0
  - `@storybook/addon-a11y`: 10.5.10 → 10.6.0
  - `@storybook/nextjs-vite`: 10.5.10 → 10.6.0
  - `@testing-library/user-event`: 14.6.6 → 14.6.7
  - `@typescript-eslint/parser`: 8.68.0 → 8.70.0
  - `eslint-plugin-storybook`: 10.5.10 → 10.6.0
  - `knip`: 6.32.3 → 6.35.1
  - `lefthook`: 2.1.10 → 2.1.12
  - `oxfmt`: 0.65.0 → 0.67.0
  - `oxlint`: 1.80.0 → 1.82.0
  - `storybook`: 10.5.10 → 10.6.0
  - `tsx`: 4.23.12 → 4.23.13
- `.github/workflows/ci.yml` の `storybook-vrt` と `e2e` のコンテナを `mcr.microsoft.com/playwright:v1.63.0-noble` に揃える。可変tagや `latest` は使わない。
- `docs/TEST_STRATEGY.md` と `README.md` の現行VRT運用手順を1.63.0へ更新し、package、CI、手動基準画像更新のversionを一致させる。
- `pnpm-lock.yaml` はpnpm 11で再生成し、既存のESLint 10解決結果を維持する。lockfileを手作業で編集しない。
- Playwright 1.63.0のChromiumでネイティブresizeハンドルだけが変化した管理商品フォーム8件のVRT基準画像を、1.63.0 Noble環境の出力へ更新する。application CSS、pixel許容値、retryは変更しない。
- 新しいテストは追加しない。変更対象はtool versionと実行環境だけであり、既存の全品質検査を回帰確認として使用する。
- Pull Request作成後、4つのrequired checkが成功するまで確認する。新PR作成後に #53へ置き換え先をコメントし、重複PRとしてクローズする。

## 5. 採用しない方針

- Playwrightだけを更新してStorybook・lint toolなどのDependabotグループ更新を一部放置しない。ユーザーが依頼したversion upと #53 の更新単位を維持する。
- CI内で `playwright install` を追加してversion不一致を隠さない。既存の固定公式イメージをpackage versionへ合わせる。
- `mcr.microsoft.com/playwright:latest`、`noble` だけのtag、canary imageは使用しない。
- 原因未確認のVRT基準画像や、差分がない87件を一括更新しない。pixel許容値、retry、worker数、browser matrixも変更しない。
- application code、business rule、API、DB、fixture、テストシナリオを変更しない。
- 過去の実装計画に記録された当時のPlaywright version表記は書き換えない。
- 追加のdependency updater、compatibility wrapper、version同期scriptは導入しない。

## 6. 変更対象

- `package.json`
  - 12件の開発依存を上記のexact versionへ更新する。
- `pnpm-lock.yaml`
  - pnpm 11で12件の直接依存と必要な推移依存を解決し直す。ESLint 10.9.1を維持する。
- `.github/workflows/ci.yml`
  - `storybook-vrt` と `e2e` のPlaywright imageを1.63.0 Nobleへ更新する。
- `docs/TEST_STRATEGY.md`
  - CI・VRT基準画像更新に使う固定Linux imageを1.63.0へ更新する。
- `README.md`
  - VRT運用説明とDocker実行例を1.63.0へ更新する。
- `tests/vrt/__screenshots__/admin-products.vrt.spec.ts/`
  - Chromiumネイティブresizeハンドルの変化が確認された管理商品フォーム8件の基準画像だけを更新する。
- `docs/plans/playwright-1-63-dependency-update.md`
  - 本計画を記録する。

`docs/PRODUCT.md`、`docs/ARCHITECTURE.md`、`docs/TEST_SCENARIOS.md`、`docs/DEVELOPMENT_PLAN.md`、`DESIGN.md` はbusiness rule、architecture、scenario割当、開発順序、UIを変更しないため更新しない。

## 7. 実装手順

### 計画作成段階

1. 最新 `origin/main` から `feature/playwright-1-63-dependency-update` を作成する。
2. 本計画を `docs/plans/playwright-1-63-dependency-update.md` に保存する。
3. 本計画以外の差分がないことを確認し、ユーザーの承認を待つ。

### 実装段階

1. `package.json` の12件を指定versionへ更新し、ESLint、Next.js、Zodを含む他の直接依存を変更しない。
2. pnpm 11で `pnpm-lock.yaml` を更新し、`pnpm install --frozen-lockfile` が成功することと、lockfileのroot importerが `package.json` と一致することを確認する。
3. `.github/workflows/ci.yml` の2つのPlaywright containerを1.63.0 Nobleへ更新し、`rg` でactiveなworkflowに1.62.1が残っていないことを確認する。
4. `docs/TEST_STRATEGY.md` と `README.md` の現行手順を1.63.0へ更新し、READMEのDocker commandがCIと同じimageを使うことを確認する。
5. formatを変更しない検査、lint parity、dead-code検査、typecheck、単体・フロントエンド結合・バックエンド結合、Next.js build、Storybook buildを実行する。
6. Playwright 1.63.0 Noble環境でVRTとE2Eを実行する。VRT差分は原因を調査し、Chromiumネイティブresizeハンドルの1px変化だけだった管理商品フォーム8件を更新したうえで、既存browser matrixとretry 0を維持して全件成功することを確認する。
7. 全差分を確認し、目的単位でコミットする。依存・CI・現行運用文書はversion同期という1目的のため `chore` 1コミットとし、計画fileも同じPRに含める。
8. branchをpushし、日本語のPRタイトル・所定templateの本文で `main` 向けPull Requestを作成する。PR本文へ更新version、Playwright同期理由、実行結果、UI変更なしを記載する。
9. Pull Requestの `static-and-unit`、`backend-integration`、`storybook-vrt`、`e2e` を確認する。全check成功後、Dependabot PR #53へ新PRのURLをコメントして重複としてクローズする。

## 8. テスト・検証方法

- 依存・lockfile
  - `pnpm install --frozen-lockfile`
  - `pnpm list --depth 0`
  - `pnpm exec playwright --version` が1.63.0を返すことを確認する。
  - `pnpm exec eslint --version` が既存の10.9.1を維持することを確認する。
- 静的検査
  - `pnpm format`
  - `pnpm lint`
  - `pnpm lint:parity`
  - `pnpm knip`
  - `pnpm typecheck`
- 非DBテスト
  - `pnpm test:unit`
  - `pnpm test:frontend`
- Backend結合
  - `pnpm db:up`
  - `pnpm db:prepare:test`
  - `pnpm test:backend`
- build
  - `pnpm build`
  - `pnpm build-storybook`
- Playwright
  - CIと同じ `mcr.microsoft.com/playwright:v1.63.0-noble` で `pnpm test:vrt` を実行し、更新後のVRT基準画像で95件が成功することを確認する。
  - `pnpm test:e2e` を実行し、Chromium / Firefox / WebKit / Mobile Chromiumの既存projectが成功することを確認する。
  - Pull Request上の `storybook-vrt` と `e2e` が1.63.0 Noble containerで成功することを最終確認にする。
- 差分監査
  - `git diff --check`
  - `git diff origin/main...HEAD --stat`
  - `git diff origin/main...HEAD --name-only`
  - VRT snapshotの差分が確認済みの管理商品フォーム8枚だけであり、application code、migration、fixture、retry、worker数、test skipに差分がないことを確認する。

## 9. リスク

- Storybook 10.6.0やPlaywright 1.63.0で出力・browser renderingが変わると、VRT差分が発生しうる。実際に発生した8件は新旧画像の異なる20pxまたは36pxがすべてtextarea右下の8px四方に収まることを確認し、Chromiumネイティブresizeハンドルが1px変化しただけと特定した。該当8枚以外は更新しない。
- Oxfmt、Oxlint、Knipの更新で新しい診断が追加される可能性がある。設定緩和や除外追加を先に行わず、実際の診断が正当かを確認し、必要ならこのPRの目的内で最小修正する。application code修正が広がる場合は実装を止めて計画変更を相談する。
- grouped updateの推移依存差分は大きくなる。root importerと直接依存versionを先に確認し、無関係なdirect dependency更新が混入していないことをlockfile差分で確認する。
- Docker imageとpackageのversionを再び片側だけ更新すると、browser executable不一致が再発する。CI、README、TEST_STRATEGYを同じPRで1.63.0へ揃える。
- 新PR作成前に `main` が更新されるとstrict required checksで再検証が必要になる。push前に `origin/main` との差分とmergeabilityを確認し、必要なら最新mainを取り込んで全checkを再実行する。

## 10. 未確定事項

なし。

## 11. 完了条件

- 12件の開発依存が指定versionへ更新され、既存のESLint 10.9.1、Next.js 16.3.4、Zod 4.5.4を維持する。
- `@playwright/test`、GitHub Actionsの2つのPlaywright container、README、TEST_STRATEGYが1.63.0 Nobleで一致する。
- `pnpm-lock.yaml` がpnpm 11で再生成され、frozen installが成功する。
- format、lint、lint parity、Knip、typecheck、単体、フロントエンド結合、バックエンド結合、Next.js build、Storybook buildが成功する。
- Chromiumネイティブresizeハンドルの変化が確認された管理商品フォーム8枚だけを更新し、VRT 95件とE2E 24件がPlaywright 1.63.0 Nobleで成功する。
- application code、business rule、API、DB、migration、fixture、test scenario、retry、worker数、browser matrixを変更しない。
- 日本語タイトル・所定本文の新しいPull Requestを作成し、4つのrequired checkが成功する。
- 競合中のDependabot Pull Request #53が新PRへのリンク付きでクローズされ、重複するopen PRが残らない。
