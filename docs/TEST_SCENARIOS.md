# TEST SCENARIOS

## 1. この文書の使い方

この文書は、主要な振る舞いをどのテストレベルで保証するかをシナリオ単位で定義する。

- **主担当**は、その仕様を最も詳細に検証するテストレベルを示す。
- **補助確認**は、層を接続したときに代表例だけ再確認するレベルを示す。
- シナリオIDはテスト名、PR説明、バグ報告から参照できる安定した識別子とする。
- 同じ境界値を全レベルで繰り返さない。

## 2. 機能とテストレベルの対応

| 機能・観点 | 単体 | Front結合 | Backend結合 | E2E | VRT |
| --- | :---: | :---: | :---: | :---: | :---: |
| 認証フォームと画面状態 | ○ | ◎ | ○ | ○ | △ |
| セッション・ロール・所有権 | △ | ○ | ◎ | ○ | - |
| 商品画面の表示状態 | ○ | ◎ | ○ | ○ | ○ |
| 商品公開条件・DB制約 | ○ | ○ | ◎ | ○ | - |
| カート画面の操作・状態 | ○ | ◎ | ○ | ○ | ○ |
| カート永続化・競合 | ○ | ○ | ◎ | ○ | - |
| クーポン計算・境界 | ◎ | ○ | ○ | ○ | - |
| クーポン適用画面 | ○ | ◎ | ○ | ○ | ○ |
| 注文・在庫トランザクション | ○ | ○ | ◎ | ○ | - |
| 注文状態遷移ルール | ◎ | ○ | ○ | ○ | - |
| 注文状態・在庫復元の永続化 | ○ | ○ | ◎ | ○ | - |
| 409競合の画面表示 | ○ | ◎ | ○ | ○ | ○ |
| 代表的な購入・管理導線 | - | ○ | ○ | ◎ | - |
| レスポンシブ・視覚差分 | - | ○ | - | ○ | ◎ |

記号は `◎`: 主担当、`○`: 代表確認、`△`: 必要な場合のみ、`-`: 対象外を表す。

## 3. 単体テストシナリオ

| ID | 前提 | 操作 | 期待結果 |
| --- | --- | --- | --- |
| `UNIT-COUPON-001` | 小計10,001円、割引率15% | 割引額を計算 | 1,500円へ切り捨てる |
| `UNIT-COUPON-002` | 小計0円、割引率100% | 合計を計算 | 割引・合計とも0円で負数にならない |
| `UNIT-COUPON-003` | 評価時刻が開始日時と同じ | クーポンを判定 | 利用可能 |
| `UNIT-COUPON-004` | 評価時刻が終了日時と同じ | クーポンを判定 | `COUPON_EXPIRED` |
| `UNIT-COUPON-005` | 小計が最低購入額と同じ | クーポンを判定 | 利用可能 |
| `UNIT-COUPON-006` | 小計が最低購入額より1円少ない | クーポンを判定 | `COUPON_MINIMUM_NOT_MET` |
| `UNIT-COUPON-007` | 無効、開始前、期限切れをそれぞれ準備 | クーポンを判定 | 原因別のdomain errorを返す |
| `UNIT-CART-001` | 単価1,200円の商品を数量3 | 行小計と商品小計を計算 | 3,600円 |
| `UNIT-CART-002` | 数量0、負数、小数 | 数量schemaで検証 | すべて拒否 |
| `UNIT-PRODUCT-001` | 価格・在庫・versionの境界値 | 管理入力schemaで検証 | 価格・在庫は0を許可、version/expectedVersionは1以上の整数だけ許可 |
| `UNIT-ORDER-001` | 各注文状態 | 次状態を判定 | PRODUCTで定義した5遷移だけ許可 |
| `UNIT-ORDER-002` | 同一状態、逆方向、取消後 | 次状態を判定 | `INVALID_STATUS_TRANSITION` |
| `UNIT-API-001` | 各domain error | API errorへ変換 | 規定のHTTP statusとcodeになる |

## 4. API・DB契約

| ID | 前提 | 操作 | 期待結果 | 主担当 |
| --- | --- | --- | --- | --- |
| `API-001` | 公開DTO契約に違反する商品がDBに存在 | 商品一覧・詳細APIを取得 | 200を返さず500 `INTERNAL_ERROR` | Backend結合 |
| `API-002` | カート取得APIがnetwork error | TanStack Queryの再試行操作を実行 | 通信エラーを表示し、再試行成功後にカートを表示 | Front結合 |
| `DB-001` | 空のPostgreSQL database | 全migrationを適用 | errorなく最新schemaになる | Backend結合 |
| `DB-002` | 商品・カート・注文table | 負の価格・在庫、0以下のversionを直接insert/update | CHECK制約で拒否 | Backend結合 |
| `DB-003` | cart item table | 数量0を直接insert | CHECK制約で拒否 | Backend結合 |
| `DB-004` | 同じcartとproductの行が存在 | 重複するcart itemを直接insert | 複合一意制約で拒否 | Backend結合 |
| `DB-005` | 参照先のないID | session、cart item、order itemを直接insert | 外部キー制約で拒否 | Backend結合 |
| `DB-006` | coupon table | 範囲外割引率、負の最低購入額、不正な期間を直接insert | CHECK制約で拒否 | Backend結合 |
| `DB-007` | users、sessions table | 非正規化・重複email、不正role、不正・重複token hashを直接insert | CHECK、enum、一意制約で拒否 | Backend結合 |

## 5. 認証・認可

| ID | 前提 | 操作 | 期待結果 | 主担当 | 補助確認 |
| --- | --- | --- | --- | --- | --- |
| `AUTH-001` | seed購入者が存在 | 正しいメール・パスワードでログイン | userを返し、規定属性のCookieとtoken hashを保存 | Backend結合 | E2E |
| `AUTH-002` | seed購入者が存在 | 誤ったパスワードでログイン | 401 `INVALID_CREDENTIALS`、Cookieなし | Backend結合 | Front結合 |
| `AUTH-003` | ログイン画面表示中 | 必須項目を空で送信 | field errorを表示しHTTP送信しない | Front結合 | - |
| `AUTH-004` | ログインAPIが保留中 | 送信ボタンを連続操作 | ボタンを無効化しリクエストは1回 | Front結合 | E2E |
| `AUTH-005` | 未認証 | 現在セッションAPIへアクセス | 401 `UNAUTHENTICATED` | Backend結合 | Front結合 |
| `AUTH-006` | 購入者でログイン | 管理APIへアクセス | 403 `FORBIDDEN`、DB変更なし | Backend結合 | E2E |
| `AUTH-007` | 期限切れセッションCookie | 注文履歴を開く | 401を受けログイン導線を表示 | Backend結合 | Front結合 |
| `AUTH-008` | ログイン済み | ログアウト後に現在セッションAPIへアクセス | DBセッションとCookieが失効し、401になる | Backend結合 | E2E |
| `AUTH-009` | 購入者A・Bの注文あり | AがBの注文IDを取得 | 404 `ORDER_NOT_FOUND`、Bの情報を本文へ含めない | Backend結合 | - |
| `AUTH-010` | 管理者でログイン | カートAPIへアクセス | 403 `FORBIDDEN` | Backend結合 | - |
| `AUTH-011` | ログインAPIが500 | フォームを送信 | 入力を保持し、再試行可能なエラーを表示 | Front結合 | - |
| `AUTH-012` | 正しい認証情報を返すMSW handler | ログインフォームを送信 | トップへ遷移し、headerにログイン状態を表示 | Front結合 | E2E |

## 6. 商品一覧・詳細

| ID | 前提 | 操作 | 期待結果 | 主担当 | 補助確認 |
| --- | --- | --- | --- | --- | --- |
| `PRODUCT-001` | 公開商品が複数存在 | 商品一覧を取得 | 公開商品だけを `created_at` 降順、同時刻は `id` 昇順で表示 | Backend結合 | E2E |
| `PRODUCT-002` | 公開商品が0件 | 商品一覧を表示 | 空状態と商品が追加されるまで待つ説明を表示 | Front結合 | VRT |
| `PRODUCT-003` | 商品一覧のServer Componentが描画中 | 商品一覧を開く | route loading状態を表示 | Front結合 | VRT |
| `PRODUCT-004` | 商品一覧のserver取得が失敗 | 商品一覧を開く | error boundaryと再試行操作を表示 | Front結合 | VRT |
| `PRODUCT-005` | 商品一覧のerror boundaryを表示中 | 再試行 | `reset()`でserver segmentの再描画を要求 | Front結合 | - |
| `PRODUCT-006` | 非公開商品が存在 | 購入者が詳細APIへアクセス | 404 `PRODUCT_NOT_FOUND` | Backend結合 | - |
| `PRODUCT-007` | 存在しないID | 商品詳細を開く | 404表示と一覧へ戻る導線 | Front結合 | - |
| `PRODUCT-008` | 在庫0の公開商品 | 商品詳細を表示 | 在庫切れであることを表示 | Front結合 | VRT |
| `PRODUCT-009` | 長い商品名・説明 | 各viewportでstoryを表示 | 文字切れや操作重なりがない | VRT | - |
| `PRODUCT-010` | 公開商品DTOが存在 | 商品一覧を表示 | 商品名・価格・在庫状態と詳細導線を表示 | Front結合 | E2E |
| `PRODUCT-011` | 公開・在庫ありの商品 | 商品詳細を表示 | 商品情報と在庫ありであることを表示 | Front結合 | E2E |
| `PRODUCT-012` | 商品詳細のServer Componentが描画中 | 商品詳細を開く | route loading状態を表示 | Front結合 | VRT |
| `PRODUCT-013` | 商品詳細のserver取得が失敗 | 商品詳細を開く | error boundaryに再試行と一覧への導線を表示 | Front結合 | - |

## 7. カート

| ID | 前提 | 操作 | 期待結果 | 主担当 | 補助確認 |
| --- | --- | --- | --- | --- | --- |
| `CART-001` | ログイン済み、在庫あり | 商品を1件追加 | カート行を作り件数・小計を更新 | Backend結合 | E2E |
| `CART-002` | 同じ商品が既に数量1 | 同商品を数量2追加 | 行を増やさず数量3に更新 | Backend結合 | Front結合 |
| `CART-003` | 在庫3、カート数量2 | 数量4へ更新 | 400 `QUANTITY_EXCEEDS_STOCK`、数量2を維持 | Backend結合 | Front結合 |
| `CART-004` | カート投入後に商品が非公開化 | カートを取得 | 明細を自動削除せず利用不可を通知し、checkoutTokenを返さない | Backend結合 | Front結合 |
| `CART-005` | カートに商品あり | 商品を削除 | 行と小計から除外 | Front結合 | E2E |
| `CART-006` | カートが空 | カート画面を表示 | 空状態と商品一覧への導線 | Front結合 | VRT |
| `CART-007` | 更新APIが保留中 | 数量変更 | 対象操作を無効化し更新中を通知 | Front結合 | VRT |
| `CART-008` | 更新APIが500 | 数量変更 | 入力を勝手に確定せず再試行可能 | Front結合 | - |
| `CART-009` | 数量2と3の応答順が逆転 | 素早く数量変更 | 最終操作の数量3を古い応答で上書きしない | Front結合 | - |
| `CART-010` | カート内の商品が非公開後に再公開 | カートを再取得 | 明細を利用可能へ戻し、新しいcheckoutTokenを返す | Backend結合 | Front結合 |
| `CART-011` | 別customerのcart item ID | 更新または削除 | 404 `CART_ITEM_NOT_FOUND`、他人のカートを変更しない | Backend結合 | - |
| `CART-012` | 商品が非公開または存在しない | カートへ追加 | 404 `PRODUCT_NOT_FOUND`、カートを変更しない | Backend結合 | Front結合 |
| `CART-013` | 自分のカートに商品あり | cart itemを削除 | DB行を削除し、cart versionを1増やして再計算結果を返す | Backend結合 | - |
| `CART-014` | ログイン済み、公開・在庫ありの商品詳細 | カートへ追加 | 商品追加APIを1回送信し、追加後のカート状態を通知 | Front結合 | E2E |
| `CART-015` | 公開・在庫0の商品詳細 | 商品詳細を表示 | カート追加操作を利用不可にし、追加APIを送信しない | Front結合 | VRT |

## 8. クーポン

| ID | 前提 | 操作 | 期待結果 | 主担当 | 補助確認 |
| --- | --- | --- | --- | --- | --- |
| `COUPON-001` | 条件を満たす有効コード | 小文字・前後空白付きで適用 | 正規化して適用し割引・合計を表示 | Backend結合 | E2E |
| `COUPON-002` | 存在しないコード | 適用 | 404 `COUPON_NOT_FOUND`、合計不変 | Front結合 | Backend結合 |
| `COUPON-003` | 無効なコード | 適用 | 400 `COUPON_INACTIVE`、合計不変 | Front結合 | Backend結合 |
| `COUPON-004` | 開始前のコード | 適用 | `COUPON_NOT_STARTED` | Backend結合 | Front結合 |
| `COUPON-005` | 期限切れコード | 適用 | `COUPON_EXPIRED` | Backend結合 | Front結合 |
| `COUPON-006` | 最低購入額未達 | 適用 | `COUPON_MINIMUM_NOT_MET` | Front結合 | Backend結合 |
| `COUPON-007` | 有効クーポン適用中 | クーポン解除 | 割引を除去し合計を再計算 | Front結合 | - |
| `COUPON-008` | カートでは有効、注文前に無効化 | 確認済みcheckoutTokenで注文確定 | 409 `CHECKOUT_CHANGED`、注文を保存せず再確認を要求 | Backend結合 | Front結合 |
| `COUPON-009` | 適用済みクーポンが期限切れ | カートを再取得 | `COUPON_EXPIRED` issue、checkoutTokenなし、原因別表示 | Backend結合 | Front結合 |
| `COUPON-010` | 有効クーポン適用中 | クーポン解除APIを実行 | coupon_idをnullにし、cart versionを1増やして再計算結果を返す | Backend結合 | - |

## 9. 注文・注文履歴・在庫競合

| ID | 前提 | 操作 | 期待結果 | 主担当 | 補助確認 |
| --- | --- | --- | --- | --- | --- |
| `ORDER-001` | 有効なカートとクーポン | checkoutTokenで注文確定 | 最新値で検証し、在庫減算・version更新・注文保存・カートclearをcommit | Backend結合 | E2E |
| `ORDER-002` | カートが空 | 注文確定 | 400 `EMPTY_CART`、注文を作らない | Backend結合 | Front結合 |
| `ORDER-003` | 送信APIが保留中 | 注文ボタンを連続操作 | ボタンを無効化しリクエストは1回 | Front結合 | E2E |
| `ORDER-004` | 在庫1、別利用者2人のカートに各1 | 別DB接続から同時確定 | 1件成功、1件409、在庫0、失敗注文なし | Backend結合 | - |
| `ORDER-005` | 複数商品のうち1商品だけ在庫不足 | 注文確定 | 全処理rollback、他商品の在庫も注文も変化なし | Backend結合 | - |
| `ORDER-006` | カート表示後に価格変更 | 確認済みcheckoutTokenで注文確定 | 409 `CHECKOUT_CHANGED`、最新価格で再確認を要求 | Backend結合 | Front結合 |
| `ORDER-007` | カート表示後に在庫減少 | 注文確定 | `STOCK_CONFLICT` と最新カート取得導線 | Front結合 | E2E |
| `ORDER-008` | 注文成功済み | 商品名・価格を管理変更 | 注文履歴は注文時スナップショットを表示 | Backend結合 | Front結合 |
| `ORDER-009` | 注文履歴あり、同時刻の注文あり | 履歴を取得 | 自分の注文だけをcreatedAt降順、同時刻はid降順で表示 | Backend結合 | E2E |
| `ORDER-010` | 注文履歴なし | 履歴画面を表示 | 空状態と商品一覧への導線 | Front結合 | VRT |
| `ORDER-011` | 履歴APIが保留中または500 | 履歴画面を表示 | ローディングまたは再試行可能なエラー | Front結合 | VRT |
| `ORDER-012` | 同じcustomer・同じカート、在庫は十分 | 別DB接続から同時に同じcheckoutTokenで確定 | 注文・在庫減算は1回、後続は400 `EMPTY_CART` | Backend結合 | - |
| `ORDER-013` | 確認後に同額の商品構成へカートを変更 | 古いcheckoutTokenで注文確定 | 合計が同じでも409 `CHECKOUT_CHANGED`、注文なし | Backend結合 | Front結合 |
| `ORDER-014` | 確認後に商品を非公開化 | 古いcheckoutTokenで注文確定 | 409 `CHECKOUT_CHANGED`、カート明細を保持 | Backend結合 | Front結合 |

## 10. 管理機能・楽観ロック・注文状態

| ID | 前提 | 操作 | 期待結果 | 主担当 | 補助確認 |
| --- | --- | --- | --- | --- | --- |
| `ADMIN-001` | 管理者ログイン | 有効な商品を作成 | version 1の商品を保存し管理一覧に表示 | Backend結合 | E2E |
| `ADMIN-002` | 商品編集画面 | 価格または在庫に負数・小数を入力 | field error、送信しない | Front結合 | - |
| `ADMIN-003` | 公開商品 | 非公開へ更新 | 購入者一覧・詳細から除外 | Backend結合 | E2E |
| `ADMIN-004` | 2画面が同じversionを取得 | 先に一方、次に他方が商品更新 | 後の更新は409、先の内容を上書きしない | Backend結合 | Front結合 |
| `ADMIN-005` | 在庫編集後に他管理者が更新 | 古いexpectedVersionで在庫更新 | 409、最新値再取得の導線 | Front結合 | Backend結合 |
| `ADMIN-006` | `received`注文 | `processing`へ更新 | 状態・versionを更新 | Backend結合 | E2E |
| `ADMIN-007` | 各許可元状態 | PRODUCTで定義した遷移を実行 | すべて成功 | Backend結合 | - |
| `ADMIN-008` | 完了・取消・逆方向など | 禁止遷移を実行 | 409、状態・version・在庫不変 | Backend結合 | Front結合 |
| `ADMIN-009` | `received`注文 | 取消 | 状態を取消へ変更し全明細の在庫を1度戻す | Backend結合 | E2E |
| `ADMIN-010` | 同じ注文を2画面で表示 | 同時に取消 | 1件成功、1件409、在庫復元は1回 | Backend結合 | - |
| `ADMIN-011` | 管理一覧APIが空・保留・失敗 | 各状態を表示 | 専用の空・ローディング・エラー表示 | Front結合 | VRT |
| `ADMIN-012` | 管理者が商品versionを取得後、customerが注文 | 古いexpectedVersionで在庫更新 | 注文減算を上書きせず409 `VERSION_CONFLICT` | Backend結合 | - |
| `ADMIN-013` | 管理者が商品versionを取得後、別管理者が注文取消 | 古いexpectedVersionで在庫更新 | 在庫復元を上書きせず409 `VERSION_CONFLICT` | Backend結合 | - |

## 11. E2Eシナリオ

| ID | 対象 | 導線 | 実行ブラウザ |
| --- | --- | --- | --- |
| `E2E-001` | 購入者の正常導線 | ログイン→一覧→詳細→カート→クーポン→注文→履歴 | Chromium / Firefox / WebKit |
| `E2E-002` | 在庫変更 | カート表示後にfixture在庫を変更→注文失敗→カート再読込 | Chromium |
| `E2E-003` | 商品・在庫管理 | 管理者ログイン→商品作成→在庫変更→非公開化 | Chromium / Firefox / WebKit |
| `E2E-004` | ロール制御 | 購入者で管理URLへ移動→アクセス拒否 | Chromium / Firefox / WebKit |
| `E2E-005` | モバイル購入 | モバイルviewportで一覧→詳細→カート→注文 | Mobile Chromium |
| `E2E-006` | 注文状態管理 | 管理者ログイン→受付注文を処理中へ更新→表示確認 | Chromium / Firefox / WebKit |
| `E2E-007` | 商品閲覧 | Server Componentの商品一覧→キーボードで詳細→一覧へ戻る | Chromium |

`E2E-002` の途中状態はテスト専用HTTP APIで作らず、テストプロセスから専用fixture更新スクリプトを実行する。ビジネスルールの全境界値やDB同時接続はE2Eへ持ち込まない。

## 12. VRTシナリオ

| ID | Story | 状態 | Viewport |
| --- | --- | --- | --- |
| `VRT-001` | ProductCard | 通常、在庫切れ、長い名前 | 375 / 1440 |
| `VRT-002` | ProductList | 通常、空、ローディング、エラー | 375 / 768 / 1440 |
| `VRT-003` | ProductDetail | 通常、在庫切れ、長い商品名・説明 | 375 / 1440 |
| `VRT-004` | Cart | 通常、空、更新中、在庫競合 | 375 / 1440 |
| `VRT-005` | CouponForm | 適用前、適用済み、入力エラー、期限切れ | 375 / 1440 |
| `VRT-006` | OrderHistory | 通常、空、ローディング、エラー | 375 / 1440 |
| `VRT-007` | AdminProductForm | 通常、入力エラー、更新中、競合 | 768 / 1440 |
| `VRT-008` | AdminOrderTable | 通常、空、更新中、競合 | 768 / 1440 |

同一コンポーネントの全順列は撮らず、レイアウトまたは視覚表現が変わる状態だけを対象にする。

## 13. 追加・変更時のルール

- ビジネスルールを変更した場合は、該当する既存シナリオを更新するか新しいIDを追加する。
- バグ修正では、再現条件に最も近い既存シナリオIDを使用する。該当がなければ追加する。
- 一時的な実装詳細をシナリオの前提にしない。
- 対象外機能のテストケースを将来用として先に作らない。
- E2EやVRTを追加する前に、より低いテストレベルで十分に保証できない理由を確認する。
