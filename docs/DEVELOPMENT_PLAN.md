# DEVELOPMENT PLAN

## 1. 目的

この文書は、現在のVite製トップページ試作から、ECテストサンドボックスを段階的に構築する順序、各フェーズの実装範囲、PR分割、Definition of Done（DoD）を定義する。

各フェーズでは機能実装と、その機能の責任に合う自動テストを同時に追加する。最後のフェーズまでテスト追加を先送りしない。

## 2. 全体方針

- 現在のViteコードは `DESIGN.md` とともにデザイン参照として扱い、Next.jsへ段階的に作り直す。
- 一時的にViteとNext.jsの2アプリを長期間並存させない。Next.js基盤のPRで実行入口を切り替える。
- 商品は単一SKU、クーポンは定率1件、注文は住所・配送・決済なしという最小モデルを維持する。
- 読取専用画面はServer Componentとserver-only facade、ブラウザ操作が必要なserver stateはTanStack QueryとJSON Route Handlerを使い、どちらも機能単位ユースケースとDrizzleへ接続する。
- ビジネスルールは単体、UI状態はフロントエンド結合、DB整合性はバックエンド結合、代表導線はE2E、見た目はVRTで検証する。
- あるフェーズのDoDを満たすまでは、その機能へ追加要件を重ねない。
- 本番デプロイは今回の完了条件に含めない。

## 3. フェーズ

### Phase 0: 文書・プロジェクト方針

#### 実装範囲

- `PRODUCT.md` で利用者、機能、ビジネスルール、対象外を定義する。
- `TEST_STRATEGY.md` でテスト責任、DB境界、CI方針を定義する。
- `ARCHITECTURE.md` で依存方向、データモデル、API、競合制御を定義する。
- `TEST_SCENARIOS.md` でシナリオIDと主担当レベルを定義する。
- 本文書でフェーズ、PR、DoDを定義する。
- `AGENTS.md` で実装者向けの継続的な作業規約を定義する。

#### DoD

- 6文書が存在し、相互リンクが有効である。
- 商品、クーポン、注文状態、競合に関する用語とルールが文書間で一致している。
- 単体、フロント結合、バックエンド結合、E2E、VRTの責任とDB利用境界が判断可能である。
- 今回実装しない機能が明記されている。
- アプリケーションコード、依存関係、実行設定を変更していない。

### Phase 1: Next.js・基本品質基盤

#### 実装範囲

- ViteからNext.js App Routerへ実行基盤を移行する。
- `DESIGN.md` の色、タイポグラフィ、レスポンシブ、アクセシビリティ方針を引き継ぐ。
- 既存トップページの情報構成、ブランド・編集コピー、ビジュアルを引き継ぎ、共通レイアウトとホーム固有コンポーネントへ分離して作り直す。固有コピーとグローバルナビゲーションは英語表記を維持し、フォーム内の操作・状態は日本語とする。コード互換性と、検索・お気に入り・仮カート、未実装のメールマガジンなど対象外のデモ表示は維持しない。
- ESLint、TypeScript strict設定、Vitest、Testing Library、MSW、Playwright、Storybookを導入する。
- ローカルfixture画像と、`Temporal` polyfillを使う決定的なテスト時刻の基本方針を用意する。
- GitHub Actionsに静的検査・単体・フロント結合の初期ジョブを追加する。

#### DoD

- `pnpm dev` でNext.jsアプリが起動する。
- lint、typecheck、単体テスト、フロント結合のsmoke test、build、Storybook buildが成功する。
- MSWを通したAPIクライアントのsmoke testがある。
- Storybookに共通Buttonなど最低1つのstoryがあり、ローカルで表示できる。
- Vite固有の実行設定や不要依存が残っていない。
- Vite試作から引き継いだトップページが外部画像URLに依存せず表示される。
- 375px、768px、1440pxで共通レイアウトとトップページが破綻しない。

### Phase 2: PostgreSQL・Drizzle・認証基盤

#### 実装範囲

- ローカル・CI用PostgreSQLの起動方法を用意する。
- Drizzle schema、migration、開発seed、E2E seedを導入する。
- `users`、`sessions` のschemaと制約を実装する。
- メールアドレス・パスワードの簡易ログイン、Cookieセッション、ログアウトを実装する。
- `customer` / `admin` の認証・認可helperを実装する。
- バックエンド結合テスト用のDB guard、migration、fixture、cleanupを整備する。
- CIにPostgreSQL serviceを使うバックエンド結合ジョブを追加する。

#### DoD

- 空のDBへmigrationを適用でき、同じmigrationをローカルとCIで利用できる。
- 開発seedとE2E seedで購入者・管理者アカウントを再現できる。
- パスワードが平文保存されず、Cookie属性が文書どおりである。
- `AUTH-001`〜`AUTH-005`、`AUTH-008`、`AUTH-011`、`AUTH-012` が成功する。後続機能を必要とする認可シナリオは該当フェーズで追加する。
- `DB-001`、`DB-005` と、認証tableの正規化・一意性・ロール・token制約を扱う `DB-007` が成功する。
- 未認証401、CookieとDBセッションの発行・失効が実DBで検証される。
- バックエンド結合テストが1 workerで直列実行され、各テスト開始前にDBが初期化される。
- 開発DBをバックエンド結合テストから誤って消去できない。

### Phase 3: 商品一覧・商品詳細

#### 実装範囲

- `products` schema、migration、fixtureを追加する。
- 公開商品一覧・詳細のJSON APIを実装する。
- 商品一覧・商品詳細をServer Componentで実装する。
- 正常、空、ローディング、エラー、404、在庫切れを実装する。
- ProductCard、ProductList、ProductDetailのStorybook storyとVRTを追加する。
- GitHub Actionsに `storybook-vrt` ジョブを追加し、以後のPRで必須checkとする。

このフェーズでは商品閲覧と在庫状態の表示までを実装する。商品詳細からのカート追加操作はPhase 4で接続する。管理者の商品作成・編集UIは実装せず、管理用APIもPhase 6まで作らない。

#### DoD

- 公開商品だけが購入者APIへ返り、非公開商品は詳細APIでも404になる。
- 価格・在庫のDB制約が実DBで検証される。
- `PRODUCT-001`〜`PRODUCT-013` の該当テストが成功する。
- `API-001` で公開APIがschema違反の成功レスポンスを返さないことを確認できる。
- 一覧・詳細の表示状態とroute境界をフロントエンド結合、Server Componentから実DBまでを商品閲覧E2Eで確認できる。
- `E2E-007` で商品画面がブラウザから商品APIを呼ばず、Server Componentから実DBを取得する。
- 対象storyのChromium VRTが375px、768px、1440pxの必要な組み合わせで成功する。
- `storybook-vrt` ジョブがCIで成功する。
- キーボードで商品一覧から詳細へ移動でき、画像altと見出し構造が適切である。

### Phase 4: カート・クーポン

#### 実装範囲

- `carts`、`cart_items`、`coupons` のschema、migration、fixtureを追加する。
- Client Componentのserver state管理へTanStack Queryを導入し、API通信を`useEffect`で実装しない。
- カート取得、追加、数量更新、削除APIを実装する。
- 商品詳細へ在庫状態に応じたカート追加操作を接続する。
- クーポン適用・解除と金額計算を実装する。
- カート・注文確認のUIを実装する。注文確定ボタンは次フェーズまで実処理へ接続しない。
- 正常、空、更新中、API失敗、在庫超過、古いレスポンス、クーポンエラーを実装する。
- CartとCouponFormのStorybook storyとVRTを追加する。
- GitHub ActionsにPostgreSQLとChromiumを使う `e2e` ジョブを追加し、以後のPRで必須checkとする。

#### DoD

- カートの数量・重複行・在庫上限がDB/APIで正しく扱われる。
- クーポンの正規化、開始・終了境界、最低購入額、切り捨てを単体テストで保証する。
- `CART-001`〜`CART-015`、`COUPON-001`〜`COUPON-007`、`COUPON-009`〜`COUPON-011` が成功する。
- `AUTH-010` と `DB-003`、`DB-004`、`DB-006` が成功する。
- Front結合テストではMSWだけで正常・空・ローディング・エラー・競合相当を再現できる。
- カート・クーポンの対象VRTが成功する。
- カート追加からクーポン適用までのChromium E2E smoke testが成功する。
- `e2e` ジョブがCIで成功する。

### Phase 5: 注文・注文履歴・在庫競合

#### 実装範囲

- `orders`、`order_items` のschemaとmigrationを追加する。
- 注文確定ユースケースとJSON APIを実装する。
- カート・商品行の固定順ロック、checkoutToken再検証、在庫減算、商品version更新、注文スナップショット、カートclearを単一トランザクションで実行する。
- 注文完了、注文履歴、注文詳細画面を実装する。
- 409時のカート再読込と再確認導線を実装する。
- 複数DB接続による同時注文テストを追加する。
- 購入者の主要E2EをChromium、Firefox、WebKitとMobile Chromiumへ展開する。

#### DoD

- `ORDER-001`〜`ORDER-014`、`COUPON-008`、`AUTH-007`、`AUTH-009` が成功する。
- 最後の在庫1点への同時注文で成功1件・失敗1件・在庫0となる。
- 複数商品の一部で失敗したとき、注文・在庫・カートに部分更新が残らない。
- 商品の後日更新で過去の注文スナップショットが変化しない。
- 送信中の二重操作を抑止し、在庫・価格・クーポン変更時に再確認を要求する。
- 同じカートへの同時注文で注文・在庫減算が1回だけ行われる。
- `E2E-001`、`E2E-002`、`E2E-005` が対象ブラウザで成功する。
- 注文履歴の対象VRTが成功する。

### Phase 6: 管理者の商品・在庫管理

#### 実装範囲

- 管理者の商品一覧・作成・編集・非公開化APIと画面を実装する。
- 在庫更新APIと画面を実装する。
- 商品と在庫の `expectedVersion` による楽観ロックを実装する。
- 入力エラー、送信中、409競合、最新値再取得を実装する。
- AdminProductFormのStorybook storyとVRTを追加する。

#### DoD

- 管理者だけが商品・在庫を更新できる。
- 負数・小数の価格や在庫はZodとDB制約の両方で拒否される。
- 同じversionからの2更新では先行1件だけが成功する。
- `ADMIN-001`〜`ADMIN-005`、`ADMIN-012`、`AUTH-006` が成功する。
- 商品管理を含む `E2E-003` と `E2E-004` が対象ブラウザで成功する。
- 409時に管理者の入力で最新値を自動上書きしない。

### Phase 7: 管理者の注文状態・取消

#### 実装範囲

- 管理者の注文一覧APIと画面を実装する。
- 注文ステータス遷移と `expectedVersion` による楽観ロックを実装する。
- 受付・処理中からの取消と在庫復元を単一トランザクションで実装する。
- 不正遷移、競合、更新中、空、エラー状態を実装する。
- AdminOrderTableのStorybook storyとVRTを追加する。

#### DoD

- PRODUCTで許可された5遷移だけが成功する。
- 取消時に在庫が1度だけ復元され、状態更新失敗時は復元されない。
- 同時取消で成功1件・409が1件となり、在庫を二重に戻さない。
- `ADMIN-006`〜`ADMIN-011`、`ADMIN-013` が成功する。
- `E2E-006` の注文状態更新が3ブラウザで成功する。
- 注文管理の対象VRTが成功する。

### Phase 8: VRT・CI運用の確立

#### 実装範囲

- 全storyの対象状態とviewportを `VRT-001`〜`VRT-008` に揃える。
- フォント、画像、時刻、アニメーションを固定する。
- VRT基準画像の更新・レビュー手順をREADMEまたはテスト運用文書へ追記する。
- 既に導入済みの静的・非DB、Backend結合、Storybook/VRT、E2Eの4ジョブについて、必須check、全browser matrix、責任境界を最終監査する。
- テスト成果物、Playwright trace、VRT差分画像の保存を設定する。
- 不安定な待機、共有fixture、不要なretryを除去する。

#### DoD

- `pnpm lint`、`pnpm typecheck`、全テスト、アプリbuild、Storybook buildが成功する。
- `VRT-001`〜`VRT-008` がChromiumで決定的に成功する。
- `E2E-001`〜`E2E-007` が定義したブラウザで成功する。
- CI失敗時に責任レベルと差分・traceを特定できる。
- 基準画像の意図的な更新方法と、更新してはいけない条件が文書化されている。
- skip、`.only`、理由のないretry、外部ネットワーク依存がない。

## 4. PR分割案

PRはレビュー可能な目的単位とし、実装だけ・テストだけに不自然に分離しない。次を標準案とする。

| PR | 目的 | 主な変更 | 必須確認 |
| --- | --- | --- | --- |
| 01 | 設計文書を追加 | 6文書のみ | リンク・用語・対象外の整合性 |
| 02 | Next.jsへ移行 | App Router、共通layout、デザインtoken、Vite撤去 | lint、typecheck、build、3 viewport目視 |
| 03 | テスト基盤を導入 | Vitest、Testing Library、MSW、Storybook、Playwright、非DB CI | unit/front smoke、Storybook build |
| 04 | DB基盤を導入 | PostgreSQL、Drizzle、migration、Backend結合helper | 空DB migration、DB guard、Backend smoke |
| 05 | 簡易ログインを追加 | users/sessions、開発・E2E seed、Cookie、ロール、ログインUI/API | `AUTH-001`〜`005`、`008`、`011`、`012`、認証E2E |
| 06 | 商品閲覧を追加 | products schema/API、Server Componentの一覧・詳細、story、VRT CI | `PRODUCT-*`、`API-001`、`E2E-007`、該当VRT |
| 07 | カートを追加 | TanStack Query、carts/items、API、画面、商品詳細の追加操作、story | `CART-*`、`API-002`、該当VRT |
| 08 | クーポンを追加 | coupons、計算、適用UI/API、story、E2E CI | `UNIT-COUPON-*`、`COUPON-001`〜`007`、`009`〜`011` |
| 09 | 注文・履歴を追加 | orders/items、注文transaction、競合、履歴 | `ORDER-*`、`COUPON-008`、購入E2E |
| 10 | 商品・在庫管理を追加 | 管理商品API/UI、version競合 | `ADMIN-001`〜`005`、`012`、`E2E-003`、`004` |
| 11 | 注文状態管理を追加 | 管理注文API/UI、取消・在庫復元 | `ADMIN-006`〜`011`、`013`、`E2E-006` |
| 12 | CI・VRT運用を完成 | 4ジョブ分割、全VRT、artifact、運用手順 | 全コマンド、全browser matrix |

各PRは次を守る。

- migrationと、そのtableを最初に利用する機能を同じPRへ含める。ただしDB共通基盤のPR 04は例外とする。
- UI変更にはフロント結合テストと必要なStorybook storyを含める。
- ビジネスルール変更には単体またはBackend結合テストと文書更新を含める。
- 無関係なリファクタ、依存更新、フォーマット変更を混ぜない。
- PRが大きくなった場合も、DB/APIだけを長期間未使用でmainへ置く分割は避ける。

## 5. 共通Definition of Done

すべての実装フェーズ・PRは、個別DoDに加えて次を満たす。

- 変更対象が [PRODUCT.md](./PRODUCT.md) と [ARCHITECTURE.md](./ARCHITECTURE.md) の範囲内である。
- 対応する [TEST_SCENARIOS.md](./TEST_SCENARIOS.md) のIDが実装・テストされている。
- 正常だけでなく、該当する空、ローディング、エラー、競合が実装されている。
- 最も低い適切なテストレベルを主担当とし、不要なE2E重複がない。
- 新しいDB制約・transactionは実PostgreSQLで確認されている。
- UIはキーボード操作、focus、label、見出し、aria-liveを確認している。
- 新しい外部ネットワーク依存がない。
- migration、seed、fixture、基準画像が決定的である。
- lint、typecheck、関連テスト、buildが成功する。
- ビジネスルール、API、テスト方針に変更があれば関連文書も同じPRで更新する。

## 6. 後続候補としても先回りしない項目

次は将来候補のbacklogやplaceholderも作らない。

- 決済、配送、税、返金
- OAuth、会員登録、パスワード再設定
- 商品バリエーション、検索、お気に入り
- 複数クーポン、定額割引、利用回数制限
- 在庫予約、監査ログ、通知
- マイクロサービス、多言語、多通貨、リアルタイム更新
- 本番インフラ、監視、負荷試験

必要になった時点でPRODUCTとTEST_STRATEGYから変更し、既存フェーズへ暗黙に追加しない。

## 7. Phase 9: 商品カテゴリ

固定・単一・非階層のカテゴリを、既存フェーズへ暗黙に混ぜず2つのstacked PRで追加する。

1. `feature/category-foundation`: 固定カテゴリmaster、商品への必須外部キー、既存商品のother backfill、seed、管理商品作成・編集の必須割り当て、DB・管理テストを実装する。公開商品DTOと公開一覧は変更しない。
2. `feature/category-browsing`: 公開DTO、`GET /api/products` のcategory query、Server Component一覧・詳細、カテゴリnavigation、公開閲覧テストとVRTを親PRの上へ実装する。全件・カテゴリ別、実在空category、不正・不明slugの境界を分ける。

Layer 2では `PRODUCT-014`〜`PRODUCT-017` の該当テストが成功することをDoDとする。

各PRはlint、typecheck、担当テスト、build、Storybook buildを通し、下位PR変更時は上位PRをrestackして検証し直す。
