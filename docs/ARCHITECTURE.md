# ARCHITECTURE

## 1. 目的と設計方針

この文書は、ECテストサンドボックスの実装境界、依存方向、データモデル、HTTPインターフェースを定義する。

設計上の優先順位は次のとおりとする。

1. テストレベルごとの境界が明示されていること
2. ビジネスルールをUIやHTTP変換から独立して検証できること
3. PostgreSQL固有の制約、トランザクション、競合を実DBで検証できること
4. 小規模なコードベースで責務を追跡できること
5. 将来のためだけの抽象化を作らないこと

## 2. 技術スタック

- Next.js App Router
- React / TypeScript
- PostgreSQL
- Drizzle ORM / Drizzle Kit
- Zod
- Vitest
- Testing Library
- MSW
- Playwright
- Storybook
- GitHub Actions
- pnpm 11

バージョンは導入時点で互いに互換性のある安定版を固定し、根拠なく追従更新しない。

## 3. システム境界

```text
Server Component
        |
        v
server-only feature facade ---> Feature use cases / domain rules ---> Drizzle ---> PostgreSQL

Client Component ---> TanStack Query ---> API client ---> JSON Route Handler
                                                        |
                                                        v
                                            Feature use cases / domain rules
                                                        |
                                                        v
                                                    Drizzle ---> PostgreSQL
```

- 読取専用の初期表示はServer Componentからserver-only facadeを通して取得する。
- Cookieセッションの初期状態もRoot Layoutから認証用server-only facadeを通して解決し、ブラウザ起動後のAPI取得に依存しない。
- Server Componentから自分自身のRoute Handlerをfetchしない。余分なHTTP往復とbuild時のserver依存を作らず、同じfeature use caseを直接再利用する。
- 注文履歴・注文詳細・注文完了もServer Componentから注文用server-only facadeを通して取得する。注文のJSON GET APIはHTTP契約として提供するが、これらの画面自身からは呼び出さない。
- ブラウザで再取得・更新・競合制御が必要なserver stateだけ、TanStack Queryと共通APIクライアントからJSON Route Handlerを呼び出す。
- API通信を`useEffect`で開始・管理しない。
- Server表示の実データ結合はE2E、Client通信のHTTP境界はMSWを使うフロントエンド結合テストで確認する。
- Route Handlerは入力検証、認証・認可、ユースケース呼び出し、HTTPレスポンスへの変換を担当する。
- ユースケースはビジネスルール、トランザクション、競合制御を担当する。
- Drizzleのschemaと機能単位のクエリがPostgreSQLアクセスを担当する。
- ReactコンポーネントからDrizzleを直接呼ばない。
- Route Handlerに金額計算や状態遷移のルールを書かない。

Server Actionsを主要なアプリケーション境界にはしない。公開APIとClient Componentの通信はJSON Route Handlerへ統一し、Server Componentの読取はserver-only facadeへ統一する。Client側のserver state管理が必要になるまでTanStack Queryを導入しない。

## 4. 推奨ディレクトリ構成

```text
src/
  app/
    api/                 # Route Handlers
    admin/               # 管理者ページ
    products/            # 商品一覧・詳細
    cart/                # カート・注文確認
    orders/              # 注文完了・履歴
  features/
    auth/
    products/            # 表示、Client状態、server-only facade/use case
    cart/
    coupons/
    orders/
    admin/
  components/            # 機能に依存しない小さなUI
  contracts/             # API client・Route Handler・MSWで共有するZod API契約
  lib/
    api-client/          # ブラウザから使うJSON APIクライアント
  server/
    db/                  # Drizzle schema、接続、migration/seed補助
    auth/                # Cookieセッション解決
tests/
  backend/               # 実PostgreSQLを使う結合テスト
  e2e/                   # Playwright E2E
  vrt/                   # VRT設定・基準画像
```

機能固有のコンポーネント、schema、ユースケース、クエリ、テストは `features/<feature>` に寄せる。`lib` や `components` への移動は複数機能での利用が発生してから行う。

汎用Repositoryインターフェース、DIコンテナ、CQRS、イベントバス、独自フレームワークは導入しない。テストのためだけに本番コードへ抽象層を追加せず、時刻など決定性に必要な依存だけを関数引数として渡す。

日付・時刻処理には `src/lib/date-time/temporal.ts` から再exportする `@js-temporal/polyfill` の `Temporal` を使用する。UTCの瞬間は `Temporal.Instant` で扱い、API・DB境界ではISO 8601 UTC文字列へ変換する。domain関数は現在時刻を内部取得せず、評価時刻を `Temporal.Instant` として受け取る。

## 5. データモデル

### `users`

| 列 | 概要 |
| --- | --- |
| `id` | UUID主キー |
| `email` | 一意、正規化済み |
| `password_hash` | パスワードハッシュ |
| `role` | `customer` / `admin` |
| `created_at` | 作成日時 |

### `sessions`

| 列 | 概要 |
| --- | --- |
| `id` | UUID主キー |
| `token_hash` | Cookieに保存した生トークンのSHA-256ハッシュ、一意 |
| `user_id` | 利用者への外部キー |
| `expires_at` | 有効期限 |
| `created_at` | 作成日時 |

メールアドレスは前後空白を除去して小文字へ正規化し、正規化済みの値だけをDBへ保存する。パスワードは16 byte salt、64 byte key、`N=16384`、`r=8`、`p=1` のscrypt hashとして保存し、比較にはconstant-time APIを使用する。未知emailでも固定dummy hashを検証し、認証失敗の応答を統一する。

ログイン時に32 byteの暗号学的乱数をbase64url形式の生トークンとして発行する。Cookie `mockshop_session` には生トークン、DBにはSHA-256ハッシュだけを保存し、検索時も受信トークンをハッシュ化して照合する。Cookieは `Path=/`、`HttpOnly`、`SameSite=Lax`、`Max-Age=604800` とし、`NODE_ENV=production` では `Secure` を付与する。HTTPで起動するローカルE2E serverだけは、`E2E_HTTP_SERVER=true`、`NEXT_DIST_DIR=.next-e2e`、同一の `DATABASE_URL` / `E2E_DATABASE_URL`、loopback上の `mockshop_e2e` DBがすべて一致する場合に限り `Secure` を解除する。条件不一致ではsession発行を失敗させ、本番用DBで解除できないようにする。ログアウト時はDB行を削除し、同じPath・属性でCookieを失効させる。期限切れセッションの定期削除ジョブは対象外とする。

### `products`

| 列 | 概要 |
| --- | --- |
| `id` | UUID主キー |
| `name` | 商品名 |
| `description` | 商品説明 |
| `price` | 0以上の整数円 |
| `image_path` | ローカルfixtureまたは管理対象画像へのパス |
| `is_published` | 公開状態 |
| `stock` | 0以上の整数 |
| `version` | 楽観ロック用整数 |
| `created_at`, `updated_at` | 作成・更新日時 |

DBのCHECK制約で `price >= 0`、`stock >= 0`、`version >= 1` を保証する。

### `carts`

| 列 | 概要 |
| --- | --- |
| `id` | UUID主キー |
| `user_id` | 利用者への一意な外部キー |
| `coupon_id` | 適用中クーポン、nullable |
| `version` | カート内容の更新リビジョン、1以上 |
| `created_at`, `updated_at` | 作成・更新日時 |

明細追加・数量変更・削除、クーポン適用・解除、注文後のclearで内容が変わったときに `version` を1増やす。同じ数量への更新、同じ有効クーポンの再適用、クーポン未適用時の解除はno-opとし、versionを維持する。

### `cart_items`

| 列 | 概要 |
| --- | --- |
| `id` | UUID主キー |
| `cart_id` | カートへの外部キー |
| `product_id` | 商品への外部キー |
| `quantity` | 1以上の整数 |

`cart_id` と `product_id` の組み合わせを一意にし、同一商品の行を重複させない。DBのCHECK制約で `quantity >= 1` を保証する。

### `coupons`

| 列 | 概要 |
| --- | --- |
| `id` | UUID主キー |
| `code` | 大文字へ正規化した一意コード |
| `discount_percent` | 1〜100の整数 |
| `minimum_subtotal` | 0以上の整数円 |
| `starts_at`, `ends_at` | UTCの利用期間、`starts_at < ends_at` |
| `is_active` | 有効状態 |
| `created_at`, `updated_at` | 作成・更新日時 |

### `orders`

| 列 | 概要 |
| --- | --- |
| `id` | UUID主キー兼注文番号 |
| `user_id` | 購入者への外部キー |
| `status` | `received` / `processing` / `shipped` / `completed` / `cancelled` |
| `subtotal` | 割引前小計 |
| `coupon_code` | 適用コードのスナップショット、nullable |
| `discount_percent` | 適用割引率のスナップショット、nullable |
| `discount_amount` | 割引額 |
| `total` | 注文合計 |
| `version` | 楽観ロック用整数 |
| `cancelled_at` | 取消日時、nullable |
| `created_at`, `updated_at` | 作成・更新日時 |

### `order_items`

| 列 | 概要 |
| --- | --- |
| `id` | UUID主キー |
| `order_id` | 注文への外部キー |
| `product_id` | 元商品への外部キー |
| `product_name` | 注文時の商品名 |
| `unit_price` | 注文時単価 |
| `quantity` | 注文数量 |
| `line_total` | 注文時の行小計 |

過去注文の表示にはスナップショット列を使用し、現在の商品名・価格へ再結合して上書きしない。

## 6. JSON API

初期APIは次の責務に限定する。パスパラメータのIDはUUID、日時はISO 8601 UTC、金額は整数で表現する。

商品APIは未認証で利用できる。カート・注文APIは `customer` 専用、`/api/admin/*` は `admin` 専用とし、認証済みでもロールが異なる場合は403 `FORBIDDEN` を返す。

### セッション

| Method | Path | 認証 | 概要 |
| --- | --- | --- | --- |
| `POST` | `/api/session` | 不要 | メールアドレスとパスワードでログイン |
| `GET` | `/api/session` | 不要 | 現在の利用者を返す。未認証は401 |
| `DELETE` | `/api/session` | 必要 | 現在のセッションを削除してログアウト |

### 商品

| Method | Path | 認証 | 概要 |
| --- | --- | --- | --- |
| `GET` | `/api/products` | 不要 | 公開商品一覧 |
| `GET` | `/api/products/:productId` | 不要 | 公開商品詳細 |

公開商品一覧は `created_at DESC, id ASC` の固定順で返す。利用者が指定する並び替えparameterは設けない。

### カートとクーポン

| Method | Path | 認証 | 概要 |
| --- | --- | --- | --- |
| `GET` | `/api/cart` | 必要 | 現在のカートと計算済み合計 |
| `POST` | `/api/cart/items` | 必要 | 商品追加 |
| `PATCH` | `/api/cart/items/:itemId` | 必要 | 数量更新 |
| `DELETE` | `/api/cart/items/:itemId` | 必要 | 商品削除 |
| `PUT` | `/api/cart/coupon` | 必要 | コードを検証して適用 |
| `DELETE` | `/api/cart/coupon` | 必要 | 適用中クーポンを解除 |

### 注文

| Method | Path | 認証 | 概要 |
| --- | --- | --- | --- |
| `POST` | `/api/orders` | 必要 | 現在のカートから注文確定 |
| `GET` | `/api/orders` | 必要 | 自分の注文履歴 |
| `GET` | `/api/orders/:orderId` | 必要 | 自分の注文詳細 |

`POST /api/orders` は、直前の `GET /api/cart` で受け取った `checkoutToken` を必須とする。tokenはサーバーがカートversion、商品ID・数量・商品名・単価・公開状態、適用クーポンの全条件、小計・割引額・合計を、固定したkey順・商品ID昇順・UTC日時で正規化し、SHA-256で生成する不透明な文字列とする。在庫数はtokenへ含めず、token自体もDBへ保存しない。注文トランザクションで同じ材料から再計算し、不一致の場合は注文を保存せず409 `CHECKOUT_CHANGED` を返す。

ブラウザの注文APIクライアントは注文確定のPOSTだけを使用する。注文履歴・詳細・完了画面はserver-only facadeから同じ注文ユースケースを直接呼び、履歴は `created_at DESC, id DESC`、明細は商品ID昇順で決定的に取得する。

### 管理

| Method | Path | 認証 | 概要 |
| --- | --- | --- | --- |
| `GET` | `/api/admin/products` | admin | 公開・非公開を含む商品一覧 |
| `POST` | `/api/admin/products` | admin | 商品作成 |
| `PATCH` | `/api/admin/products/:productId` | admin | 商品情報・公開状態更新 |
| `PATCH` | `/api/admin/products/:productId/stock` | admin | 在庫数更新 |
| `GET` | `/api/admin/orders` | admin | 注文一覧 |
| `PATCH` | `/api/admin/orders/:orderId/status` | admin | 状態更新または取消 |

在庫、商品、注文状態の更新リクエストは `expectedVersion` を必須とする。レスポンスは更新後の `version` を含む。

クーポンを作成・更新する管理APIは設けない。クーポンデータはmigration、seed、テストfixtureで用意する。

### API契約

リクエスト・成功レスポンス・エラーレスポンスのZod schemaは `src/contracts` に配置し、APIクライアント、Route Handler、MSW handlerが同じschemaと推論型を利用する。server専用moduleを `src/contracts` からimportしない。

一覧レスポンスはすべて `{ items: T[] }` で包む。作成は201、取得・更新は200、ログアウトは204を成功statusとする。カート内の削除操作は再計算後のカートを200で返す。

主要DTOは次の形へ固定する。

```ts
type Role = 'customer' | 'admin'
type OrderStatus =
  | 'received'
  | 'processing'
  | 'shipped'
  | 'completed'
  | 'cancelled'

type UserDto = {
  id: string
  email: string
  role: Role
}

type ProductDto = {
  id: string
  name: string
  description: string
  price: number
  imagePath: string
  availability: 'in_stock' | 'out_of_stock'
}

type AdminProductDto = ProductDto & {
  isPublished: boolean
  stock: number
  version: number
}

type CartItemDto = {
  id: string
  productId: string
  name: string
  unitPrice: number
  quantity: number
  lineTotal: number
  availability: 'available' | 'out_of_stock' | 'unpublished'
}

type AppliedCouponDto = {
  code: string
  discountPercent: number
  minimumSubtotal: number
  startsAt: string
  endsAt: string
}

type CheckoutIssueDto = {
  code:
    | 'PRODUCT_UNAVAILABLE'
    | 'STOCK_CONFLICT'
    | 'COUPON_INACTIVE'
    | 'COUPON_NOT_STARTED'
    | 'COUPON_EXPIRED'
    | 'COUPON_MINIMUM_NOT_MET'
  itemId?: string
}

type CartDto = {
  id: string
  version: number
  items: CartItemDto[]
  coupon: AppliedCouponDto | null
  subtotal: number
  discountAmount: number
  total: number
  issues: CheckoutIssueDto[]
  checkoutToken: string | null
}

type OrderItemDto = {
  productId: string
  productName: string
  unitPrice: number
  quantity: number
  lineTotal: number
}

type OrderDto = {
  id: string
  status: OrderStatus
  items: OrderItemDto[]
  subtotal: number
  couponCode: string | null
  discountPercent: number | null
  discountAmount: number
  total: number
  version: number
  createdAt: string
}
```

`CartDto.checkoutToken` は、カートが空、利用不可商品を含む、数量が在庫を超える、クーポンが無効のいずれかなら `null` とする。クーポンissueは原因別codeを返す。画面は `issues` を解消し、最新のtokenを取得するまで注文を送信できない。商品が再公開された場合、次のカート取得で `PRODUCT_UNAVAILABLE` は解消する。

各endpointのbodyと成功レスポンスは次へ固定する。

| Endpoint | Request body | Success response |
| --- | --- | --- |
| `POST /api/session` | `{ email, password }` | `{ user: UserDto }` |
| `GET /api/session` | なし | `{ user: UserDto }` |
| `DELETE /api/session` | なし | 204 bodyなし |
| `GET /api/products` | なし | `{ items: ProductDto[] }` |
| `GET /api/products/:id` | なし | `{ product: ProductDto }` |
| `GET /api/cart` | なし | `{ cart: CartDto }` |
| `POST /api/cart/items` | `{ productId, quantity }` | `{ cart: CartDto }` |
| `PATCH /api/cart/items/:id` | `{ quantity }` | `{ cart: CartDto }` |
| `DELETE /api/cart/items/:id` | なし | `{ cart: CartDto }` |
| `PUT /api/cart/coupon` | `{ code }` | `{ cart: CartDto }` |
| `DELETE /api/cart/coupon` | なし | `{ cart: CartDto }` |
| `POST /api/orders` | `{ checkoutToken }` | `{ order: OrderDto }` |
| `GET /api/orders` | なし | `{ items: OrderDto[] }` |
| `GET /api/orders/:id` | なし | `{ order: OrderDto }` |
| `GET /api/admin/products` | なし | `{ items: AdminProductDto[] }` |
| `POST /api/admin/products` | `{ name, description, price, imagePath, isPublished, stock }` | `{ product: AdminProductDto }` |
| `PATCH /api/admin/products/:id` | `{ name?, description?, price?, imagePath?, isPublished?, expectedVersion }` | `{ product: AdminProductDto }` |
| `PATCH /api/admin/products/:id/stock` | `{ stock, expectedVersion }` | `{ product: AdminProductDto }` |
| `GET /api/admin/orders` | なし | `{ items: OrderDto[] }` |
| `PATCH /api/admin/orders/:id/status` | `{ status, expectedVersion }` | `{ order: OrderDto }` |

商品PATCHは `expectedVersion` 以外に最低1フィールドを必須とする。公開APIの `ProductDto` は正確な在庫数やversionを公開しない。注文履歴は `createdAt DESC, id DESC` で返す。

## 7. 入出力とエラー

- Route Handlerの入力はZodで検証する。
- APIクライアントが使うレスポンスschemaもZodで定義し、不正なレスポンスを成功扱いしない。
- domainの金額計算・状態遷移関数はHTTPステータスに依存しない。
- 想定内エラーは次の形式へ統一する。

```json
{
  "code": "STOCK_CONFLICT",
  "message": "在庫が変更されました。最新のカートを確認してください。",
  "fieldErrors": {
    "quantity": ["注文可能な数量を超えています。"]
  }
}
```

`fieldErrors` は入力項目に紐づくエラーがある場合だけ含める。`code` はUI分岐とテストで使用し、`message` だけに依存しない。

| HTTP | 用途 | 代表的なcode |
| ---: | --- | --- |
| 400 | JSON/Zod入力不正、カート数量超過、空カート、クーポン適用時の条件不成立 | `VALIDATION_ERROR`, `QUANTITY_EXCEEDS_STOCK`, `EMPTY_CART`, `COUPON_INACTIVE`, `COUPON_NOT_STARTED`, `COUPON_EXPIRED`, `COUPON_MINIMUM_NOT_MET` |
| 401 | 未認証、認証失敗、セッション失効 | `UNAUTHENTICATED`, `INVALID_CREDENTIALS` |
| 403 | ロール不足 | `FORBIDDEN` |
| 404 | 商品・カート明細・注文・クーポンが存在しない、または所有対象でない | `PRODUCT_NOT_FOUND`, `CART_ITEM_NOT_FOUND`, `ORDER_NOT_FOUND`, `COUPON_NOT_FOUND` |
| 409 | 注文内容・在庫・バージョン・注文状態の競合 | `CHECKOUT_CHANGED`, `STOCK_CONFLICT`, `VERSION_CONFLICT`, `INVALID_STATUS_TRANSITION` |
| 500 | 想定外のサーバーエラー | `INTERNAL_ERROR` |

想定外エラーの詳細やスタックトレースをクライアントへ返さない。

`PUT /api/cart/coupon` では不存在を404、無効・開始前・期限切れ・最低購入額未達を400で返す。すでに注文確認を表示した後、`POST /api/orders` で商品構成・価格・公開状態・クーポン条件が変化していた場合は、個別のクーポンエラーではなく409 `CHECKOUT_CHANGED` を返す。カート上の商品が非公開の場合は自動削除せず `PRODUCT_UNAVAILABLE` issueとして返す。

クーポンコードは前後空白を除去して大文字へ正規化する。新しいコードの適用に失敗した場合は現在の `coupon_id`、cart version、計算結果を変更しない。同じ有効クーポンの再適用は200で現在のカートを返すno-opとする。空カートも小計0円として通常条件を評価する。

カート追加・数量更新時に現在庫を超える数量は400 `QUANTITY_EXCEEDS_STOCK` とする。非公開・未存在商品を追加した場合は404 `PRODUCT_NOT_FOUND`、存在しない、または他利用者が所有するcart itemの更新・削除は404 `CART_ITEM_NOT_FOUND` とする。409 `STOCK_CONFLICT` は、確認後に在庫が変化した注文確定時の競合へ限定する。

他利用者が所有する注文への `GET /api/orders/:id` は、存在情報を漏らさないため404 `ORDER_NOT_FOUND` とする。管理機能へのロール不足は403 `FORBIDDEN` とする。

## 8. トランザクションと競合制御

### 注文確定

注文ユースケースは1トランザクション内で次を行う。

1. 対象カート行を `FOR UPDATE` でロックする。同一カートへの注文はここで直列化する。
2. カート明細を読み、空ならrollbackして400 `EMPTY_CART` を返す。
3. 対象商品行を商品ID昇順で `FOR UPDATE`、適用クーポン行を `FOR SHARE` でロックする。順序を固定してdeadlockを避ける。
4. 公開状態、最新価格、最新クーポン条件を検証し、最新の `checkoutToken` を再計算する。リクエストと不一致、商品非公開、クーポン失効のいずれかならrollbackして409 `CHECKOUT_CHANGED` を返す。
5. 各商品の最新在庫を検証する。1件でも不足していればrollbackして409 `STOCK_CONFLICT` を返す。
6. 各商品を `stock = stock - quantity, version = version + 1` で更新する。
7. 注文と注文明細のスナップショットを保存する。
8. カート明細とクーポン適用をクリアし、カートの `version` を1増やす。

同じカートへの同時リクエストは、先行1件だけが注文を作成する。後続リクエストはロック取得後に空カートを読み、400 `EMPTY_CART` となる。別利用者が最後の在庫を同時に注文した場合は、成功1件、409 `STOCK_CONFLICT` 1件、在庫0、失敗注文なしとなる。ネットワーク再送を同じ成功レスポンスへ変換するidempotency keyは今回導入しない。

### 取消

取消ユースケースは注文の現在状態と `expectedVersion` を条件に `cancelled` へ更新し、同じトランザクションで商品行を商品ID昇順にロックして、各商品を `stock = stock + quantity, version = version + 1` で更新する。状態更新に失敗した場合は在庫も商品versionも変更しない。

### 管理更新

管理更新は `WHERE id = ? AND version = expectedVersion` の条件付き更新を行い、成功時は `version = version + 1` とする。更新件数0件なら対象の有無を確認し、未存在は404、存在するがversion不一致なら409とする。注文減算・取消復元も商品versionを進めるため、それ以前に開いた管理画面の在庫更新は409になる。

## 9. テスト・開発環境

- ローカル開発用と自動テスト用のPostgreSQL接続先を分離する。
- migrationは開発・CI・E2Eで同じファイルを適用する。
- seedは開発用とE2E用を分け、E2E用は固定ID・固定時刻相当の決定的データを生成する。
- テスト専用HTTPリセットAPIは作らない。
- Playwrightのglobal setupからDB reset・migration・E2E seedのスクリプトを実行する。
- 外部画像URLへ依存せず、テスト用画像をリポジトリ内で管理する。
- 時刻依存のdomain関数には基準時刻を引数で渡し、単体テストで境界値を固定する。

## 10. セキュリティ上の最小要件

- パスワードを安全な一方向ハッシュで保存する。
- セッションCookieをJavaScriptから読めないようにする。
- 更新系Route Handlerで認証とロールを毎回検証する。
- 注文詳細はURLのIDだけを信用せず、ログイン利用者の所有権を条件に取得する。
- Zod検証後の値だけをユースケースへ渡す。
- Drizzleのパラメータ化されたクエリを利用する。

CSRF対策の追加方式やレート制限など、本番公開に必要な包括的セキュリティ設計は対象外だが、同一生成元のJSON APIと `SameSite=Lax` Cookieを前提にする。
