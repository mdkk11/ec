# Server HTTP境界の共通処理リファクタリング計画

## 1. 背景と目的

JSON Route Handler周辺では、`Cache-Control: no-store` を付けたJSONレスポンス、共通APIエラーbody、request bodyのJSON解析、Zodのfield error変換が、商品、カート、注文、管理商品、管理注文、セッションに個別実装されている。

本リファクタリングでは、HTTP境界の機械的に同一な処理だけを `src/server/http` へ集約する。機能固有の認証・認可、service errorからHTTP status/codeへの変換、利用者向け文言、成功response schemaは各featureまたはRoute Handlerへ残し、API仕様とテスト境界を変更せずに重複と修正漏れの可能性を減らす。

本計画の承認後に実装を開始する。計画作成時点ではアプリケーションコードとテストを変更しない。

## 2. 現状調査

- 作業ツリーは計画作成前にcleanである。
- `pnpm lint`、`pnpm typecheck`、`pnpm test:unit`（77件）、`pnpm test:frontend`（89件）は計画作成前に成功している。
- `src/features/cart/server/cart-http.ts`、`src/features/orders/server/order-http.ts`、`src/features/admin/server/admin-product-http.ts`、`src/features/admin/server/admin-order-http.ts` は、それぞれ同じ形の次の処理を持つ。
  - `Cache-Control: no-store` header定義
  - `{ code, message, fieldErrors? }` のエラーresponse生成
  - `request.json()` の失敗を400 `VALIDATION_ERROR`へ変換
  - Zod issueの先頭pathを `Record<string, string[]>` へ変換
  - Zod schemaで成功bodyを検証してJSON responseを生成
- `src/app/api/session/route.ts` にも同じエラーresponse、JSON解析、Zod issue変換がインライン実装されている。
- `src/features/products/server/product-http.ts` はno-store headerとAPIエラーresponseだけを提供しており、共通処理へ置換するとfeature固有の責務が残らない。
- 認可処理は `requireCustomerRequest` と `requireAdminRequest` を呼ぶfeature別関数に分かれ、機能ごとに401・403の文言と返却データが異なる。
- `CartServiceError`、`OrderServiceError`、`AdminProductServiceError`、`AdminOrderServiceError` のstatus/code対応も機能ごとに異なる。
- Backend結合テストは、カートの不正JSON・Zod field error、各APIのno-store header、商品response schema違反、認証・認可、想定内エラーを実Route Handlerから実PostgreSQLまで検証している。

## 3. 解決する問題

- 同じJSON/Zod変換の修正が複数ファイルに必要で、API間に挙動差が生じやすい。
- `fieldErrors` の空objectを含めるか省略するかなど、同じAPIエラー契約に対する細部の実装がfeatureごとに分散している。
- no-store headerとAPIエラーbodyの組み立てが各feature名付き関数として重複し、Route Handlerの本来の処理を追う際のノイズになっている。
- 商品用HTTP moduleは共通処理だけを包んでおり、feature固有の責務を持たない。

## 4. 採用する方針

- `src/server/http/json.ts` を追加し、次の3責務だけを配置する。
  - `noStoreJsonResponse`: bodyとstatusから `Cache-Control: no-store` 付きJSON responseを返す。
  - `apiErrorResponse`: `ApiError` 型の `{ code, message, fieldErrors? }` を `noStoreJsonResponse` で返す。
  - `parseJsonRequest`: `Request` と `ZodType` を受け、JSON構文不正とschema不正を400 `VALIDATION_ERROR`へ変換し、成功時はparse済みdataを返す。
- Zod issueから `fieldErrors` を作る処理は `parseJsonRequest` 内部の非export関数にする。先頭pathが文字列のissueだけを集約し、対象issueがない場合は `fieldErrors` 自体を省略する。
- JSON bodyが `null` などobjectでない場合、Zodは空pathのissueを返す。現在のカート・セッションはこの場合に `fieldErrors: {}` を返すが、ARCHITECTUREの「入力項目に紐づくエラーがある場合だけ含める」という契約に合わせ、共通化後は `fieldErrors` を省略する。この限定的な契約修正をBackend結合テストで固定する。
- 成功responseのZod schemaはfeature側に残す。`cartSuccessResponse`、`orderSuccessResponse`、管理系success responseは既存schemaでbodyをparseした後、`noStoreJsonResponse`を呼ぶ。
- カート、注文、管理商品、管理注文の認可関数とroute/service error変換はfeature側に残す。共通helperへservice error class、status対応表、認可文言を渡す設計にはしない。
- 商品Route Handlerは共通helperを直接利用し、feature固有の処理がなくなる `src/features/products/server/product-http.ts` を削除する。
- セッションRoute Handlerは `parseJsonRequest`、`apiErrorResponse`、`noStoreJsonResponse` を利用する。Cookieの設定・失効、認証失敗、例外ログは現状のRoute Handlerに残す。
- objectでないJSON bodyに対する空の `fieldErrors` 省略を除き、各Route Handlerのstatus、code、message、fieldErrors、Cookie、no-store header、成功body schemaを変更しない。
- 共通helper自体のために新しいテストレベルやシナリオIDを追加しない。HTTP変換は既存方針どおりBackend結合テストを主な確認手段とし、既存テストで不足する共通契約だけを既存テストケースへ最小限追記する。

## 5. 採用しない方針

- Route Handler全体を包むhigher-order function、汎用controller、middleware、独自HTTP frameworkは作らない。
- 認証・認可処理を1つのconfig駆動helperへ統合しない。
- service errorとHTTP status/codeの対応を共通mapへ移さない。
- feature固有の成功response関数やZod response schemaを削除しない。
- API client、Zod契約、DB schema、business rule、UIは変更しない。
- APIの文言、status、codeや、空の `fieldErrors` 省略以外のエラー形式変更は混ぜない。
- 新しいpackageは導入しない。

## 6. 変更対象

- `src/server/http/json.ts`
  - no-store JSON response、共通APIエラーresponse、JSON/Zod request解析を追加する。
- `src/features/cart/server/cart-http.ts`
  - 重複するheader、error response、request解析、field error変換を削除する。
  - カート固有の認可、service error変換、例外ログ、成功schema検証を維持し、共通helperを呼ぶ。
- `src/features/orders/server/order-http.ts`
  - 重複するHTTP primitiveを削除し、注文固有の認可、service error変換、例外ログ、成功schema検証を維持する。
- `src/features/admin/server/admin-product-http.ts`
  - 重複するHTTP primitiveを削除し、admin認可、商品service error変換、例外ログ、成功schema検証を維持する。
- `src/features/admin/server/admin-order-http.ts`
  - 重複するHTTP primitiveを削除し、admin認可、注文service error変換、例外ログ、成功schema検証を維持する。
- `src/features/products/server/product-http.ts`
  - feature固有の責務が残らないため削除する。
- `src/app/api/session/route.ts`
  - インラインのerror response、JSON解析、validation error変換、no-store response生成を共通helperへ置換する。
- `src/app/api/products/route.ts`、`src/app/api/products/[productId]/route.ts`
  - 削除する商品HTTP moduleの代わりに共通helperを使用し、既存response schemaによる成功body検証を維持する。
- `src/app/api/cart/items/route.ts`、`src/app/api/cart/items/[itemId]/route.ts`、`src/app/api/cart/coupon/route.ts`
  - request解析とパラメータ入力エラーresponseのimport先を共通helperへ変更する。
- `src/app/api/orders/route.ts`、`src/app/api/orders/[orderId]/route.ts`
  - request解析と注文ID入力エラーresponseのimport先を共通helperへ変更する。
- `src/app/api/admin/products/route.ts`、`src/app/api/admin/products/[productId]/route.ts`、`src/app/api/admin/products/[productId]/stock/route.ts`
  - request解析と商品ID入力エラーresponseのimport先を共通helperへ変更する。
- `src/app/api/admin/orders/[orderId]/status/route.ts`
  - request解析と注文ID入力エラーresponseのimport先を共通helperへ変更する。
- 既存Backend結合テスト
  - 共通化前後で400 error bodyとno-store headerが変わらないことを、既存の代表ケースで確認する。
  - カートとセッションへ `null` JSONを送り、400 `VALIDATION_ERROR` が空の `fieldErrors` を含まないことを固定する。

`docs/PRODUCT.md`、`docs/ARCHITECTURE.md`、`docs/TEST_STRATEGY.md`、`docs/TEST_SCENARIOS.md`、READMEは変更しない。公開API、依存方向、テスト責任、利用手順に変更がないためである。

## 7. 実装手順

1. 実装開始時に `git status --short` と対象ファイルの差分を確認し、計画以外の利用者変更がないことを確認する。
2. `src/server/http/json.ts` に3つの共通helperを追加する。`parseJsonRequest` の戻り値は `{ ok: true, data } | { ok: false, response }` とし、既存Route Handlerのearly return構造を維持する。
3. カートと注文のHTTP moduleを共通helperへ置換する。認可結果、service errorのstatus/code、console error、success response schemaが変わっていないことを差分で確認する。
4. 管理商品と管理注文のHTTP moduleを同じ共通helperへ置換する。401、403、404、409のfeature固有変換は元のmoduleに残す。
5. 商品Route Handlerを共通helperへ接続し、不要になった `product-http.ts` を削除する。商品一覧・詳細の成功bodyは従来どおりZod schemaでparseしてから返す。
6. セッションRoute Handlerを共通helperへ接続する。ログイン成功・現在session取得・logoutのCookie操作と、認証失敗時にCookieを発行しない挙動を維持する。
7. bodyを解析するRoute Handlerと、path parameter validation errorを返すRoute Handlerのimportを共通helperへ変更する。
8. カートとセッションのBackend結合テストへ `null` JSONのケースを追加し、400 `VALIDATION_ERROR` と `fieldErrors` の省略を固定する。既存代表ケースでは400 error responseにも `Cache-Control: no-store` が付くことを確認する。HTTPを扱う新しい単体テストは追加しない。
9. lint、typecheck、単体、フロントエンド結合、Backend結合、E2E、アプリbuildを実行し、`git diff` でAPI文言・status・code・schemaに意図しない変更がないことを確認する。

## 8. テスト・検証方法

- 静的確認
  - `pnpm lint`
  - `pnpm typecheck`
  - `rg` でfeature別の重複header定義、JSON parse helper、validation field error helperが残っていないことを確認する。
- 単体・フロントエンド結合
  - `pnpm test:unit`
  - `pnpm test:frontend`
  - API契約型とAPI client、MSW経由の画面表示に回帰がないことを確認する。
- Backend結合
  - `pnpm db:prepare:test`
  - `pnpm test:backend`
  - カートの不正JSONがfieldErrorsなしの400 `VALIDATION_ERROR`になることを確認する。
  - カートのschema不正がfieldErrors付きの400 `VALIDATION_ERROR`になることを確認する。
  - カートとセッションへ `null` JSONを送り、空のfieldErrorsを含まない400 `VALIDATION_ERROR`になることを確認する。
  - 商品、カート、注文、管理商品、管理注文の成功responseがno-store headerと既存schemaを維持することを確認する。
  - sessionの成功、認証失敗、未認証、logoutでstatus、body、Cookie属性が変わらないことを確認する。
  - 各featureの401、403、404、409、500変換が既存テストどおりであることを確認する。
- ブラウザ・表示確認
  - `pnpm test:e2e`
  - 共通HTTP helperが全Route Handlerの実ブラウザ導線で機能し、ログイン、購入、管理操作に回帰がないことを確認する。
  - UIとCSSを変更しないためVRTは実行せず、基準画像も更新しない。
- build
  - `pnpm build`

## 9. リスク

- 共通helperへの置換時にfeature固有のstatusやmessageまで統一するとAPI仕様が変わる。共通化対象をresponse構築とJSON/Zod解析に限定し、service error変換は各featureに残す。
- success responseでZod parseを共通化の過程で省略すると `API-001` の防御が失われる。featureごとのsuccess response関数またはRoute Handlerで、既存response schemaを必ずparseしてから返す。
- objectでないJSON bodyでは、カート・セッションの `fieldErrors: {}` が省略へ変わる。ARCHITECTUREの既存契約へ合わせた意図的な修正として、両APIのBackend結合テストで固定する。
- セッションresponseは返却後にCookieを設定するため、共通helperの戻り値をCookie変更可能な `NextResponse` として維持する。
- `product-http.ts` 削除後に商品Route Handlerがno-store headerを付け忘れる可能性がある。商品一覧・詳細の既存header assertionとBackend結合テストを必須確認にする。
- 多数のRoute Handlerでimportが変わるため、未使用importや置換漏れが起きやすい。`pnpm lint`、`pnpm typecheck`、重複検索で機械的に確認する。

## 10. 未確定事項

なし。

## 11. 完了条件

- no-store JSON response、APIエラーresponse、JSON/Zod request解析が `src/server/http/json.ts` の1箇所に集約されている。
- 認証・認可、service error変換、利用者向け文言、成功response schemaはfeatureごとの責務として維持されている。
- `src/features/products/server/product-http.ts` が削除され、商品一覧・詳細が共通helper経由でも既存schemaとno-store headerを維持している。
- objectでないJSON bodyに対する空の `fieldErrors` 省略を除き、全APIのstatus、code、message、fieldErrors、Cookie、success bodyに意図しない仕様変更がない。
- 新規依存、business rule変更、DB変更、migration、UI変更、VRT基準画像更新がない。
- lint、typecheck、単体、フロントエンド結合、Backend結合、E2E、アプリbuildが成功する。
