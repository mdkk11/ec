# カートのフロント結合テスト責務分割計画

## 1. 背景と目的

`src/features/cart/Cart.frontend.test.tsx` は、カート画面の取得・明細操作、注文確定、クーポン操作、商品詳細からのカート追加を1ファイルで検証している。34件のテストが1,118行に集まり、変更対象の責務に対応するテストとsetupを見つけにくい。

本リファクタリングでは、既存のテストケース、scenario ID、MSW境界、assertionを維持したまま、利用者が操作する責務ごとに4つのフロント結合テストファイルへ分割する。全責務で同一なprovider構築とcart response生成だけをfeature内のtest helperへ移し、router mock、利用者切替、各MSW handlerは必要なテストファイルに残す。

本計画の承認後に実装を開始する。計画作成時点ではテストコードを変更しない。

## 2. 現状調査

- 作業ブランチは最新 `origin/main` から作成した `feature/refactor-cart-frontend-tests` で、計画作成前の作業ツリーはcleanである。
- `Cart.frontend.test.tsx` は1,118行、34件で、次の4責務を持つ。
  - カート画面の取得状態、空状態、明細削除、数量更新、issue回復、customer専用認可: 8件
  - 注文確定の二重送信、409回復、401、失敗、利用者切替・unmount時の遅延response: 12件
  - クーポン適用・解除、原因別エラー、操作queue、古いresponse、再試行、期限切れissue: 12件
  - 商品詳細の追加成功と在庫切れ: 2件
- 分割前の `pnpm exec vitest run --project frontend src/features/cart/Cart.frontend.test.tsx` は1ファイル・34件すべて成功している。
- 全テストが同じ `QueryClientProvider`、`SessionProvider`、`CartOperationProvider` のtreeを組み立てる `renderWithProviders` と、`{ cart }` responseを返す `cartResponse` を利用する。
- `customer` と `authenticatedState` はproviderの既定sessionとcart query keyの検証に使う。
- `CustomerSwitcher` と `secondCustomer` は注文確定中の利用者切替テストだけが使う。
- `router.push` の呼び出し検証と `beforeEach` のmock clearは注文確定テストだけが必要である。ただし `CartPage` 自体が `useRouter` を呼ぶため、カート画面・明細、注文確定、クーポンの各ファイルには `next/navigation` mockが必要である。
- `ProductCartAction` の2件は `useRouter` を使わないが、sessionと `CartOperationProvider` を含むprovider treeは必要である。
- `vitest.config.ts` のfrontend projectは `src/**/*.frontend.test.{ts,tsx}` を対象にする。helper名を `.frontend.test` にしなければ、helper自体は独立したtest fileとして収集されない。
- `docs/TEST_SCENARIOS.md` ではカート画面・操作、クーポン、注文確定のUI状態をFront結合が担当する。今回scenarioの追加・削除・主担当変更はない。

## 3. 解決する問題

- 1つのテストファイルに4責務のcomponent、fixture、mockが集まり、対象機能の変更時に読む範囲が広い。
- 注文確定だけが必要とするrouter spyと利用者切替fixtureが、カート明細やクーポンのテストsetupと混在している。
- 商品詳細の `ProductCartAction` とカート画面の `CartPage` が同じdescribe階層の外側setupを共有し、component境界がファイル名から分からない。
- 単純に全setupを各ファイルへ複製すると、provider構成やAPI response shapeの変更時に4箇所を修正することになる。
- 反対にrouter mockやMSW handlerまで共通helperへ移すと、テストごとの前提とrequest/responseが見えにくくなる。

## 4. 採用する方針

- `Cart.frontend.test.tsx` を削除し、既存34件を次の4ファイルへ移動する。
  - `CartPage.frontend.test.tsx`: カート取得・表示・明細操作・認可の8件。
  - `CartCheckout.frontend.test.tsx`: 注文確定と遅延response制御の12件。
  - `CartCoupon.frontend.test.tsx`: クーポン適用・解除とoperation queueの12件。
  - `ProductCartAction.frontend.test.tsx`: 商品詳細からの追加操作の2件。
- `cart-frontend-test-helpers.tsx` を追加し、次だけをexportする。
  - `customer`: cart query keyとadmin state作成に使う固定customer。
  - `renderWithProviders`: testごとに新しい `QueryClient` を作り、既存と同じ3 providerでcomponentを描画する。
  - `cartResponse`: `CartDto` を既存と同じ `{ cart }` JSON responseへ変換する。
- `authenticatedState` は `renderWithProviders` の既定値としてhelper内部に残し、exportしない。
- `CustomerSwitcher` と `secondCustomer` は `CartCheckout.frontend.test.tsx` に残す。
- `orderFixture` と `useSession` のimportは注文確定テストだけへ移す。
- coupon fixtureは `CartCoupon.frontend.test.tsx`、empty/stock conflict fixtureは利用する責務のファイルだけへimportする。
- `next/navigation` mockは `CartPage` を描画する3ファイルへ局所的に置く。注文確定では既存のhoisted `router` と `beforeEach` を維持し、他2ファイルは呼び出しをassertしないno-op spyだけを持つ。
- `itemUnitPrice` は数量更新テストだけが使うため `CartPage.frontend.test.tsx` に残す。
- 各testの名称、scenario ID、MSW handler、操作順、assertion、gate解放順を変更しない。
- test数は分割前後とも34件とし、ファイル分割による追加・削除を行わない。
- application code、test fixture本体、Vitest設定、共通frontend setup、package scripts、設計文書のscenario定義は変更しない。

## 5. 採用しない方針

- テストをscenario IDごとに1ファイルへ細分化しない。setupが増え、責務よりファイル数が先行するためである。
- 34件を維持するためのmanifest、test case registry、独自runnerは追加しない。
- MSW handler builder、deferred Promise factory、router mock factoryを新設しない。各テストの条件をその場で読める現状を維持する。
- `src/test` の全feature共通render helperへ拡張しない。今回一致が確認できるのはcart featureのprovider treeだけである。
- application componentのexportや責務をテスト分割のために変更しない。
- test名、scenario ID、期待文言、role/label/text assertionを整理名目で書き換えない。
- 新しいpackageは導入しない。

## 6. 変更対象

- `src/features/cart/Cart.frontend.test.tsx`
  - 既存34件を新しい責務別ファイルへ移した後に削除する。
- `src/features/cart/cart-frontend-test-helpers.tsx`
  - customer、既定session、provider付きrender、cart response生成を追加する。
- `src/features/cart/CartPage.frontend.test.tsx`
  - API-002、CART-003〜010のうち画面取得・明細操作・issue回復、AUTH-010に該当する計8件を、現行の「カート画面」先頭部分から移す。
- `src/features/cart/CartCheckout.frontend.test.tsx`
  - ORDER-002/003/006/007/013/014と、注文APIの401・5xx・不正response・network失敗、利用者切替・unmount時の遅延成功に関する12件を移す。
- `src/features/cart/CartCoupon.frontend.test.tsx`
  - COUPON-001〜007、009と、queue順序・古いresponse・適用/解除再試行に関する12件を移す。
- `src/features/cart/ProductCartAction.frontend.test.tsx`
  - CART-014、CART-015の2件を移す。

`docs/TEST_SCENARIOS.md`、`docs/TEST_STRATEGY.md`、`vitest.config.ts`、`src/test/setup-frontend.ts` は変更しない。テスト責任、収集規則、MSW境界、共通setupに変更がないためである。

## 7. 実装手順

1. 実装開始時に `git status --short` とbranchを確認し、計画書以外の利用者変更がないことを確認する。
2. `cart-frontend-test-helpers.tsx` を追加し、現行 `Cart.frontend.test.tsx` のcustomer、authenticated state、provider付きrender、cart response生成を挙動変更なしで移す。
3. `CartPage.frontend.test.tsx` を追加し、カート取得・表示・明細操作・認可の8件を移す。`CartPage` 用router mockと数量単価helperはこのファイルに置く。
4. `CartCheckout.frontend.test.tsx` を追加し、注文確定の12件を移す。hoisted router、`beforeEach`、利用者切替component、order fixtureはこのファイルに限定する。
5. `CartCoupon.frontend.test.tsx` を追加し、クーポンの12件を移す。coupon fixtureとno-op router mockはこのファイルに限定する。
6. `ProductCartAction.frontend.test.tsx` を追加し、商品追加の2件を移す。`CartPage` とrouter mockはimportしない。
7. 全34件が新しい4ファイルへ移ったことをtest名とscenario IDで照合し、元の `Cart.frontend.test.tsx` を削除する。
8. `rg` で旧ファイル名、重複したprovider構築、責務外importが残っていないことを確認する。
9. 対象cartテスト、全Front結合、lint、typecheck、buildを実行し、分割前と同じ34件および全体の成功を確認する。

## 8. テスト・検証方法

- 対象テスト
  - `pnpm exec vitest run --project frontend src/features/cart`
  - 新しい4ファイルが収集され、合計34件すべて成功することを確認する。
  - test名とscenario IDを分割前の一覧と照合し、追加・削除・重複がないことを確認する。
- 全Front結合
  - `pnpm test:frontend`
  - ファイル分割後も他featureを含むFront結合全体が成功することを確認する。
- 静的確認
  - `pnpm lint`
  - `pnpm typecheck`
  - `git diff --check`
  - `rg` でprovider treeがhelper以外へ複製されていないこと、注文fixture・coupon fixture・router spyが担当外ファイルへ混入していないことを確認する。
- build
  - `pnpm build`
- 単体、Backend結合、E2E、Storybook、VRTは実行しない。application code、API、DB、代表導線、表示・styleを変更せず、既存Front結合テストの配置だけを変更するためである。

## 9. リスク

- test移動時に1件を欠落または重複させる可能性がある。分割前の34件を責務別に8・12・12・2件へ対応付け、対象実行の件数で確認する。
- `vi.mock` はfile単位でhoistされるため、router mockをshared helperへ隠すとimport順へ依存する可能性がある。`CartPage` をimportする各test fileで直接宣言する。
- router spyを全ファイルで共有するとfile並列実行時に呼び出し履歴が混ざる可能性がある。`router.push` をassertする注文確定ファイルだけが専用のhoisted spyを持つ。
- provider helperが同じ `QueryClient` を再利用するとtest間でcart cacheが漏れる。現行どおりrenderごとに新しいclientを生成する。
- gateを使う非同期テストの移動時にrelease順やawaitを変えるとraceの検証条件が弱くなる。test bodyは整形を除いて機械的に移動する。
- helperのファイル名がfrontend test include patternへ一致するとtest file数が増える。`.frontend.test` を含まない `cart-frontend-test-helpers.tsx` とする。
- import整理の際にscenario名や期待文言まで変更すると純粋な再編ではなくなる。差分確認ではtest bodyの内容変更がないことを重点確認する。

## 10. 未確定事項

なし。

## 11. 完了条件

- `Cart.frontend.test.tsx` が削除され、既存34件が責務別の4ファイルへ8・12・12・2件で分割されている。
- provider付きrenderとcart response生成がfeature内helperの1箇所にあり、renderごとに新しいQueryClientを使う。
- router mock、利用者切替、order fixture、coupon fixtureが必要な責務のtest fileだけに置かれている。
- test名、scenario ID、MSW handler、操作順、assertionに意図しない変更がない。
- application code、公開API、business rule、DB、migration、UI、Vitest設定、新規依存に変更がない。
- 対象cart Front結合34件、全Front結合、lint、typecheck、buildが成功する。
