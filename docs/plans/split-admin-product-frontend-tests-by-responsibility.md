# 管理商品フロント結合テスト責務分割計画

## 1. 背景と目的

`src/features/admin/AdminProducts.frontend.test.tsx` は、管理商品一覧・作成と商品編集・在庫更新を1ファイルで検証している。15件のテストが475行に集まり、一覧画面と編集画面で異なるcomponent、通信、非同期制御を同じsetupの下で扱っている。

本リファクタリングでは、既存のテストケース、scenario ID、MSW境界、操作順、assertionを維持したまま、現在の2つの`describe`に対応する責務別ファイルへ分割する。両責務で同一なadmin・product fixture、provider構築、一覧response生成だけをfeature内のtest helperへ移す。

本計画の承認後に実装を開始する。計画作成時点ではテストコードを変更しない。

## 2. 現状調査

- 分割前の `AdminProducts.frontend.test.tsx` は475行、15件である。
- `describe('管理商品一覧・作成')` は8件を持つ。
  - 一覧・編集導線、空状態、loading、network error、500、再試行。
  - `ADMIN-002` のfield error、HTTP未送信、focus。
  - `ADMIN-001` の作成中の重複操作防止と作成後の一覧反映。
  - 未認証・customerの管理画面アクセス制御。
- `describe('管理商品編集・在庫')` は7件を持つ。
  - 変更fieldだけの商品情報更新。
  - 在庫更新後のversion共有と未送信入力保持。
  - `ADMIN-004`、`ADMIN-005` の409競合回復。
  - mutation前・mutation中に開始した古いGETによるcache巻き戻し防止。
  - 409回復中の401によるログイン導線への復帰。
- 全15件が同じ固定admin、固定product、`QueryClientProvider`、`SessionProvider`、一覧response生成を利用する。
- customer fixtureは一覧・作成側の認可テストだけが使う。
- `adminProductsQueryKey` と `waitFor` は編集・在庫側の古いGET検証だけが使う。
- 分割前の `pnpm exec vitest run --project frontend src/features/admin/AdminProducts.frontend.test.tsx` は1ファイル・15件すべて成功している。
- `vitest.config.ts` のfrontend projectは `src/**/*.frontend.test.{ts,tsx}` を収集するため、helper名に `.frontend.test` を含めない。
- `docs/TEST_SCENARIOS.md` では管理画面の入力検証と409表示をFront結合が担当する。今回scenarioの追加・削除・主担当変更はない。

## 3. 解決する問題

- 一覧・作成と編集・在庫で異なるcomponentとAPI操作が同じファイルにあり、変更対象に対応するテストを探す範囲が広い。
- 編集・在庫だけが必要とするquery keyとcache検証が、一覧・作成のsetupと同じimport領域に混在している。
- 単純に全setupを2ファイルへ複製すると、provider構成やfixture変更時に2箇所を同期する必要がある。
- 反対にMSW handlerや非同期gateまで共通helperへ移すと、各テストが再現する通信条件をテスト本体から追いにくくなる。

## 4. 採用する方針

- `AdminProducts.frontend.test.tsx` を削除し、既存15件を次の2ファイルへ移動する。
  - `AdminProductListCreate.frontend.test.tsx`: 現在の「管理商品一覧・作成」8件。
  - `AdminProductEditStock.frontend.test.tsx`: 現在の「管理商品編集・在庫」7件。
- `admin-product-frontend-test-helpers.tsx` を追加し、次だけをexportする。
  - `admin`: query key検証にも使う固定管理者。
  - `product`: 両責務で使う固定管理商品。
  - `renderWithProviders`: testごとに新しい `QueryClient` を作り、既存と同じprovider treeでcomponentを描画する。
  - `listResponse`: 商品配列を既存と同じ `{ items }` JSON responseへ変換する。
- `adminState` は `renderWithProviders` の既定値としてhelper内部に残し、exportしない。
- `AdminProductsPage` とcustomer fixtureは一覧・作成側に残す。
- `AdminProductEditPage`、`adminProductsQueryKey`、`waitFor` は編集・在庫側だけで使う。
- MSW handler、request count、request body、deferred gateは各テストファイルに残す。
- 各testの名称、scenario ID、MSW URL/status/body、操作順、gate解放順、assertionを変更しない。
- test数は分割前後とも15件とし、8件・7件の対応を維持する。
- application code、fixture本体、Vitest設定、共通frontend setup、package scripts、設計文書、新規依存は変更しない。

## 5. 採用しない方針

- scenario IDごとの細分化や、正常・異常別の追加分割は行わない。現在の2つのcomponent責務よりファイル数が先行するためである。
- MSW handler builder、deferred Promise factory、query cache検証helperは追加しない。シナリオ固有の前提をその場で読める状態を維持する。
- `src/test` の全feature共通render helperへ拡張しない。今回一致を確認したのは管理商品テストのprovider treeだけである。
- test名へ未記載のscenario IDを追加しない。今回はテスト仕様の整理ではなく配置変更に限定するためである。
- application component、公開API、business rule、DB、UI、styleを変更しない。
- 新しいpackageは導入しない。

## 6. 変更対象

- `src/features/admin/AdminProducts.frontend.test.tsx`
  - 既存15件を責務別ファイルへ移した後に削除する。
- `src/features/admin/admin-product-frontend-test-helpers.tsx`
  - 固定admin・product、provider付きrender、一覧response生成を追加する。
- `src/features/admin/AdminProductListCreate.frontend.test.tsx`
  - 現在の先頭describeにある一覧・作成・認可の8件を移す。
- `src/features/admin/AdminProductEditStock.frontend.test.tsx`
  - 現在の後半describeにある編集・在庫・競合・cache制御の7件を移す。

`docs/PRODUCT.md`、`docs/ARCHITECTURE.md`、`docs/TEST_STRATEGY.md`、`docs/TEST_SCENARIOS.md`、`vitest.config.ts`、`src/test/setup-frontend.ts` は変更しない。商品管理のルール、テスト責任、収集規則、MSW境界に変更がないためである。

## 7. 実装手順

1. 実装開始時にbranch、stack、worktreeを確認し、計画書以外の利用者変更がないことを確認する。
2. `admin-product-frontend-test-helpers.tsx` を追加し、現行ファイルのadmin、admin state、product、provider付きrender、一覧response生成を挙動変更なしで移す。
3. `AdminProductListCreate.frontend.test.tsx` を追加し、先頭describeの8件と認可用customer fixtureを移す。`AdminProductsPage` とcustomerをこの責務だけで使う。
4. `AdminProductEditStock.frontend.test.tsx` を追加し、後半describeの7件を移す。`AdminProductEditPage`、query key、cache検証をこの責務だけに置く。
5. 全15件が8件・7件で移ったことをtest名とscenario IDで照合し、元の `AdminProducts.frontend.test.tsx` を削除する。
6. `rg` で旧ファイル名、provider treeの不要な複製、責務外importが残っていないことを確認する。
7. 対象admin Front結合、全Front結合、lint、typecheck、buildを実行し、分割前と同じ15件および全体の成功を確認する。
8. 単一stack layerの最終HEADへ、計画書だけを含む `docs: 管理商品フロント結合テストの分割計画を追加` と、旧テスト削除・新テスト2ファイル・helper追加だけを含む `test: 管理商品のフロント結合テストを責務別に分割` の2コミットを積み、単一Draft PRを作成する。

## 8. テスト・検証方法

- 対象テスト
  - `pnpm exec vitest run --project frontend src/features/admin/AdminProductListCreate.frontend.test.tsx src/features/admin/AdminProductEditStock.frontend.test.tsx`
  - 新しい2ファイルだけが収集され、2 files / 15 tests、内訳8件・7件ですべて成功することを確認する。
- 全Front結合
  - `pnpm test:frontend`
- 静的確認
  - `pnpm lint`
  - `pnpm typecheck`
  - `git diff --check`
  - test名とscenario IDを分割前の一覧と照合し、欠落・重複・意図しない変更がないことを確認する。
- build
  - `pnpm build`
- 単体、Backend結合、E2E、Storybook、VRTは実行しない。application code、API、DB、代表導線、表示、styleを変更せず、既存Front結合テストの配置だけを変更するためである。

## 9. リスク

- test移動時に1件を欠落または重複させる可能性がある。分割前の15件を8件・7件へ対応付け、test名、scenario ID、実行件数で確認する。
- provider helperが同じ `QueryClient` を再利用するとtest間でcacheが漏れる。現行どおりrenderごとに新しいclientを生成する。
- gateを使う非同期テストの移動時にrelease順やawaitを変えるとrace検証が弱くなる。test bodyは整形を除いて機械的に移動する。
- helper名がfrontend testのinclude patternへ一致すると空のtest fileとして収集される。`.frontend.test` を含まない名前にする。
- fixtureやMSW handlerを過剰に共通化すると前提が見えにくくなる。両責務で同じ固定値とprovider構築だけをhelperへ置く。
- import整理と同時にtest名や期待文言まで変更すると純粋な再編ではなくなる。差分確認ではtest bodyの内容変更がないことを重点確認する。

## 10. 未確定事項

なし。

## 11. 完了条件

- `AdminProducts.frontend.test.tsx` が削除され、既存15件が責務別の2ファイルへ8件・7件で分割されている。
- provider付きrender、両責務で共有する固定admin・product、一覧response生成がfeature内helperの1箇所にあり、renderごとに新しい `QueryClient` を使う。customer fixtureは一覧・作成側だけにある。
- MSW handler、request記録、deferred gate、cache検証が必要な責務のtest fileだけに置かれている。
- test名、scenario ID、MSW URL/status/body、操作順、gate解放順、assertionに意図しない変更がない。
- application code、公開API、business rule、DB、migration、UI、Vitest設定、設計文書、新規依存に変更がない。
- 対象admin Front結合15件、全Front結合、lint、typecheck、buildが成功する。
