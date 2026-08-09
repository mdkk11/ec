# PR11 管理者の注文状態管理の実装計画

## 1. 背景と目的

`docs/DEVELOPMENT_PLAN.md` のPR11だけを対象に、管理者向け注文一覧、注文状態更新、取消時の在庫復元、`expectedVersion` による競合制御を完成させる。

本計画の承認後に実装を開始する。計画作成時点ではアプリケーションコード、テスト、設定を変更しない。

## 2. 現状調査

- ローカル `main` は `09b482a` で、`origin/main` はPR10の商品・在庫管理を含む `fb63d18` までfast-forward可能な状態である。実装は `origin/main` を起点に `feature/pr11-admin-order-management` ブランチを作成して行う。
- `orders` には `status`、`version`、`cancelledAt`、`updatedAt` があり、`order_items` と `products` に取消処理で必要な列と制約が存在するためmigrationは不要である。
- `OrderDto`、注文状態のZod schema、購入者向け注文取得処理は存在する。管理注文一覧、状態更新request schema、状態遷移の純粋関数は未実装である。
- PR10で `requireAdminRequest`、管理APIのHTTP変換、TanStack Queryを使う管理画面、競合後の明示確認、3ブラウザに分離した管理者fixtureが導入済みであり、PR11でも同じ境界を再利用できる。
- E2E seedにはブラウザ別管理者が存在するが、管理者が状態更新するブラウザ別注文fixtureは存在しない。
- `UNIT-ORDER-001`・`002`、`ADMIN-006`〜`011`・`013`、`E2E-006`、`VRT-008` は未実装である。
- 既存の未追跡 `.agents/skills/explained-code-review-workspace/` は変更しない。

## 3. 解決する問題

- 管理者が注文一覧を取得し、許可された状態へ更新するAPIと画面がない。
- PRODUCTで定義した5遷移を一箇所で判定する純粋なルールがない。
- 取消時に注文状態、取消日時、商品在庫、商品versionを原子的に更新する処理がない。
- 古い `expectedVersion` や禁止遷移で、先行更新を上書きせず409を返す境界がない。
- 管理注文画面の空、読込中、取得失敗、更新中、競合と再確認の状態がない。
- 取消による商品version更新後に、PR10の商品管理画面から古い在庫値を上書きできないことが未検証である。

## 4. 採用する方針

- `/admin/orders` に注文一覧と各注文の状態更新操作を配置する。新しい詳細画面は追加しない。
- `src/features/orders/order-status-transition.ts` に許可遷移と表示可能な次状態を返す純粋関数を置き、単体テスト、管理ユースケース、UIで共有する。
- 既存 `OrderDto`、`orderResponseSchema`、`orderListResponseSchema` を管理一覧・更新成功レスポンスにも使用し、管理注文専用の重複schemaや購入者メールなどの追加DTOは作らない。
- `GET /api/admin/orders` は注文を `createdAt DESC, id DESC`、各明細を商品ID昇順で返す。
- `PATCH /api/admin/orders/:orderId/status` は `{ status, expectedVersion }` をZodで検証し、更新後の `{ order: OrderDto }` を返す。
- 通常遷移は `id`、現在状態、`expectedVersion` を条件に注文状態と `version = version + 1` を同じUPDATEで更新する。
- 取消は単一transactionで注文を条件付き更新し、注文明細の商品行を商品ID昇順でロックしてから、各商品を `stock = stock + quantity, version = version + 1` と同じUPDATEで変更する。途中失敗時は注文状態、取消日時、在庫、商品versionをすべてrollbackする。
- エラー判定は注文未存在の404 `ORDER_NOT_FOUND`、version不一致の409 `VERSION_CONFLICT`、version一致かつ禁止遷移の409 `INVALID_STATUS_TRANSITION` の順に固定する。事前確認後の並行更新で条件付きUPDATEが0件になった場合も、再取得したversionの不一致を409 `VERSION_CONFLICT` とする。
- 管理画面は既存 `SessionProvider` の状態で未認証とcustomerを先に拒否し、adminの場合だけTanStack Queryから管理APIを呼ぶ。
- 一覧queryへ `AbortSignal` を渡す。更新前に進行中の一覧queryをcancelし、成功時はレスポンスでquery cacheを直接置換する。同じ注文の更新中は操作を無効化して二重送信を防ぐ。
- 409時は選択した遷移先を自動送信せず、一覧を再取得して最新状態を表示する。利用者が「最新状態を確認」を明示操作した後だけ、現在状態で許可される遷移を選び直せるようにする。
- 管理者headerには既存の「商品管理」と並べて「注文管理」リンクを表示する。

## 5. 採用しない方針

- migration、新規package、新しい状態管理、汎用Repository、DI containerは追加しない。
- 注文詳細編集、注文検索・絞り込み・並び替え、返金、通知、監査ログは追加しない。
- customer向け注文APIや注文履歴画面を管理更新のために流用しない。
- 禁止遷移や競合を自動補正・自動再送しない。
- 取消済み注文の再取消、完了注文の取消、同じ状態への更新を許可しない。
- E2Eで全遷移や同時取消を重複検証せず、代表導線だけを扱う。

## 6. 変更対象

- `src/contracts/order.ts`、`src/contracts/order.unit.test.ts`
  - 既存の注文response schemaを再利用し、状態更新request schemaだけを追加して状態・`expectedVersion` の境界を検証する。
- `src/features/orders/order-status-transition.ts` と単体テスト
  - PRODUCTの5遷移だけを許可し、同一・逆方向・取消後を拒否する。
- `src/features/admin/server/admin-order-service.ts`
  - 管理注文一覧取得、通常状態更新、取消transaction、404・409判定を実装する。
- `src/features/admin/server/admin-order-http.ts`
  - `requireAdminRequest`、JSON/Zod検証、成功schema、想定内エラーのHTTP変換を実装する。
- `src/app/api/admin/orders/route.ts`
  - 管理注文一覧GETを公開する。
- `src/app/api/admin/orders/[orderId]/status/route.ts`
  - 状態更新PATCHを公開し、Route Handlerで評価時刻を `Temporal.Instant` としてユースケースへ渡す。
- `src/lib/api-client/admin-order.ts`、`src/features/admin/admin-order-query.ts`
  - 管理注文一覧取得・状態更新と、注文単位でquery cacheを置換する最小helperを追加する。
- `src/features/admin/AdminOrdersPage.tsx`、`AdminOrderTable.tsx`、fixture、Storybook story、フロントエンド結合テスト
  - 認可、正常、空、loading、取得失敗、更新中、禁止遷移、409、最新状態の明示確認を実装・検証する。
- `src/app/admin/orders/page.tsx`、`src/features/auth/SessionControls.tsx`
  - 管理注文ページとheader導線を追加する。
- `tests/backend/admin-order.backend.test.ts`
  - `ADMIN-006`〜`010`・`013`、認証・認可、入力不正、未存在、rollbackを実PostgreSQLで検証する。
- `src/server/db/seed.ts`、`tests/e2e/admin-orders.spec.ts`
  - Chromium / Firefox / WebKitごとの固定購入者・商品・受付注文を追加し、`E2E-006` を実行する。
- `playwright.config.ts`
  - `E2E-006` をChromium / Firefox / WebKitの各admin-orders projectで実行対象にする。
- `tests/vrt/admin-orders.vrt.spec.ts` と基準画像
  - `VRT-008` の通常、空、更新中、競合を768px・1440pxで固定fixtureから撮影する。
- `README.md`
  - 管理注文画面、許可遷移、競合時の再確認、取消時の在庫復元を追記する。

## 7. 実装手順

1. `origin/main` から `feature/pr11-admin-order-management` を作成し、本計画と既存の未追跡ファイル以外に差分がないことを確認する。
2. 注文状態更新のZod契約と純粋な遷移関数を追加し、`UNIT-ORDER-001`・`002` を単体テストで固定する。
3. 管理注文一覧と状態更新ユースケースを追加する。未存在、version不一致、禁止遷移の順で事前確認し、通常更新の条件付きUPDATEと、取消transactionの注文更新・商品ロック・在庫/version復元を実装する。事前確認後に条件付きUPDATEが0件となった競合はversionを再取得して `VERSION_CONFLICT` とする。
4. 管理注文HTTP変換と2つのRoute Handlerを追加し、401・403・400・404・409・500を既存APIエラー形式へ揃える。
5. APIクライアント、query key/cache helper、管理注文画面を追加し、認可状態、取得状態、更新中、競合後の再取得と明示確認を接続する。
6. headerの注文管理導線とREADMEを更新する。
7. 単体、フロントエンド結合、バックエンド結合テストを追加する。取消失敗時のrollbackと同時取消の在庫一回復元を実接続で確認する。
8. ブラウザ別注文fixtureと `E2E-006` を追加し、各browser projectが独立した注文を更新するようにする。
9. `AdminOrderTable` storyと `VRT-008` を追加し、固定Linux環境で基準画像を生成・確認する。
10. 全品質コマンドを実行し、差分とシナリオIDの対応を確認する。

## 8. テスト・検証方法

- 単体
  - `UNIT-ORDER-001`: `received → processing`、`processing → shipped`、`shipped → completed`、`received → cancelled`、`processing → cancelled` だけを許可する。
  - `UNIT-ORDER-002`: 同一状態、逆方向、`completed`・`cancelled` からの変更を拒否する。
  - 状態更新requestが不正状態、0以下・小数の `expectedVersion` を拒否する。
- フロントエンド結合
  - adminの正常一覧、空、loading、500、network error、再試行をMSWで検証する。
  - `ADMIN-008`: 禁止遷移を操作候補へ出さず、サーバー409でも状態を自動変更しない。
  - `ADMIN-011`: 更新中の操作抑止と `aria-live`、競合後の最新状態取得、明示確認まで再送不可を検証する。
  - 未認証・customerでは管理注文APIを呼ばない。
  - 更新成功後に遅い一覧GETを完了させても、cacheの状態・versionが巻き戻らないことを検証する。
- バックエンド結合
  - `ADMIN-006`・`007`: 許可された5遷移とversion増分。
  - `ADMIN-008`: 禁止遷移で状態・version・在庫が不変。
  - `ADMIN-009`: 複数明細の取消で全商品の在庫とversionを1回だけ増やし、注文の `cancelledAt` を評価時刻へ設定。
  - `ADMIN-010`: 別接続から同じ注文を同時取消し、成功1件・409 1件・在庫復元1回。
  - `ADMIN-013`: 取消後の商品versionに対するPR10の古い在庫更新が409 `VERSION_CONFLICT`。
  - 未認証401、customer 403、Zod不正400、注文未存在404、古いversion 409を検証する。
  - 商品ID順で2明細を用意し、1商品目は在庫復元可能、2商品目は `stock = 2_147_483_647` とする。2商品目の加算でPostgreSQL integer overflowを発生させ、先に実行された注文更新と1商品目の在庫・version更新も含めて全変更がrollbackされることを確認する。
- E2E
  - `E2E-006`: Chromium / Firefox / WebKitで管理者ログイン→注文管理→受付注文を処理中へ更新→「処理中」の表示を確認する。versionは画面へ露出せず内部の `expectedVersion` として扱う。
- VRT
  - `VRT-008`: `AdminOrderTable` の通常、空、更新中、競合を768px・1440pxで確認する。
- 完了確認
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test:unit`
  - `pnpm test:frontend`
  - `pnpm db:prepare:test && pnpm test:backend`
  - `pnpm test:e2e`
  - 固定Linux環境で `pnpm test:vrt:update` と `pnpm test:vrt`
  - `pnpm build`
  - `pnpm build-storybook`

## 9. リスク

- 取消処理で商品ロック順が不定だとdeadlockの原因になる。注文明細取得と商品ロックを商品ID昇順へ固定する。
- 注文更新だけ成功して在庫復元が失敗すると整合性が壊れる。状態更新、取消日時、全商品の在庫・version更新を同じtransactionへ置き、2商品目の在庫加算をinteger overflowさせるバックエンド結合テストで途中失敗を決定的に再現する。
- 同時取消で事前読取だけに依存すると二重復元が起きる。`id`・現在状態・`expectedVersion` の条件付きUPDATEをtransaction内の勝者判定にする。
- 取消で商品versionが進むため、同時に開いている商品管理画面は409になる。これは意図した競合として `ADMIN-013` で固定する。
- E2Eの注文fixtureをbrowser間で共有すると先行projectの状態更新が後続projectを壊す。購入者、商品、注文、管理者をbrowserごとに固定IDで分離する。
- macOSで生成したVRT画像はCIと一致しない。PR10と同じ固定Linux環境だけを正本生成に使う。

## 10. 未確定事項

なし。

## 11. 完了条件

- 管理者だけが注文一覧を取得し、PRODUCTで許可された5遷移だけを実行できる。
- 取消時に注文状態・version・取消日時と、全明細商品の在庫・versionが同一transactionで一度だけ更新される。
- 競合・禁止遷移・途中失敗で先行状態や在庫を上書きせず、部分更新が残らない。
- 管理注文画面の正常、空、loading、error、更新中、競合と明示再確認が利用者・支援技術へ伝わる。
- `UNIT-ORDER-001`・`002`、`ADMIN-006`〜`011`・`013`、`E2E-006`、`VRT-008` が成功する。
- migration、対象外機能、新規依存を追加せず、全品質コマンドが成功する。
