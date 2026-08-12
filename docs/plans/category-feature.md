# 商品カテゴリ機能の実装計画

## 1. 背景と目的

現在の商品は単一SKUとして管理され、公開一覧は作成日時順の全件表示だけを提供している。`AGENTS.md`、`docs/PRODUCT.md`、`docs/DEVELOPMENT_PLAN.md` ではカテゴリを対象外としているが、今回の仕様確認でこの制約を正式に変更し、商品へ必須の単一カテゴリを割り当ててカテゴリ別に閲覧できるようにすることを合意した。

固定カテゴリ、商品との外部キー、管理画面での割り当て、公開一覧のcategory queryを追加する。テストサンドボックスの目的を維持するため、カテゴリCRUD、階層、複数所属、検索との統合は追加せず、DB制約、API契約、Server Component表示、管理更新の楽観ロックを最小の責任境界で検証する。

本計画は会話で承認済みの仕様を実装可能なstackへ分解する。ユーザーは、複数層・複数ファイルに及ぶ仕様変更のため計画が必要であることと、保存先 `docs/plans/category-feature.md` を確認し、計画作成を承認済みである。計画承認前は実装、branch作成、migration生成を行わない。

## 2. 現状調査

### 調査済みの事実

- `main` は `6676f28` で `origin/main` と一致し、計画作成前のworktreeはcleanである。
- `products` tableは `id`、商品情報、公開状態、在庫、`version`、日時を持つが、カテゴリ列とカテゴリmasterは存在しない。最新migrationは `drizzle/0005_slimy_malice.sql` であり、mainへ取り込まれたmigrationは変更できない。
- `src/contracts/product.ts` の公開 `ProductDto` は正確な在庫、公開状態、versionを隠し、`AdminProductDto` が管理用fieldを追加する。管理作成・metadata更新・在庫更新は同じ契約をRoute Handler、API client、MSWで共有している。
- 公開一覧・詳細は `product-page-data.ts` のserver-only facadeから `product-service.ts` を直接呼ぶ。`/products` 自身は `/api/products` をHTTP経由で呼ばない。
- 公開一覧は `created_at DESC, id ASC` の固定順であり、`ProductListView` が正常、空、loading、errorを表示する。商品詳細は公開DTOだけを受け取り、カート追加actionを合成している。
- 管理商品画面はTanStack Queryと共通API clientを使うClient Componentである。商品metadataと在庫は `expectedVersion` を送り、成功時にversionを増やし、409時は入力を保持して最新値の明示反映を要求する。
- 商品作成は現在カテゴリ入力なしで `products` へinsertする。`category_id NOT NULL` を導入する層では、管理作成API・フォームと全商品fixtureを同じ有効な中間HEADへ更新する必要がある。
- 通常seedには公開24件と非公開1件があり、E2Eにも購入・注文管理用の商品がある。商品を直接insertするバックエンド結合テストも存在する。
- `DESIGN.md` の「編集カテゴリ」は `home-content.ts` の静的な編集テーマであり、商品taxonomyではない。今回のカテゴリとは接続しない。
- 現在のtest、build、DB、VRTコマンドは `package.json` とREADMEに定義済みであり、新しい依存packageやscriptは不要である。

### 承認済みの仕様

- 商品は階層のないカテゴリへ必ず1件だけ所属する。
- 固定カテゴリは `衣類/clothing` (displayOrder 10)、`バッグ・服飾小物/bags-accessories` (20)、`シューズ/shoes` (30)、`ホーム・生活雑貨/home-living` (40)、`その他/other` (90) の5件とする。
- カテゴリは固定masterとし、管理者は商品の割り当てだけを変更できる。カテゴリCRUD、公開状態、削除操作は設けない。
- 購入者は `/products?category=<slug>` でカテゴリ別商品を閲覧する。`/products` は全件表示を維持する。
- 商品一覧上部に `ALL ITEMS` と固定カテゴリのリンクを表示する。商品詳細には商品のカテゴリへ戻るリンクを表示し、商品カードへカテゴリlabelは追加しない。
- 公開 `ProductDto` はカテゴリの `name` と `slug` を含み、`GET /api/products` は任意のcategory queryを受ける。カテゴリ単独APIは追加しない。
- 実在する空カテゴリは専用の空状態、不明slugは404 `CATEGORY_NOT_FOUND` とする。空slug・重複category queryは画面では404、APIでは400 `VALIDATION_ERROR` とする。
- 管理商品作成・編集はcategory IDを必須入力とし、default categoryを設けない。カテゴリ変更も既存metadata PATCHと `expectedVersion` を使い、商品versionを1増やす。
- 不明category IDは400 `VALIDATION_ERROR` と `categoryId` のfield errorを返す。
- カテゴリ変更は価格、在庫、公開状態を変えないため、checkoutToken、注文snapshot、注文履歴へ含めない。

## 3. 解決する問題

1. 商品とカテゴリの関係をDBが保証できず、商品発見のための安定した分類がない。
2. 管理者が商品作成・編集時にカテゴリを明示できない。
3. 購入者がカテゴリをURLとして共有・再読込できる形で商品を絞り込めない。
4. 不明カテゴリ、空カテゴリ、不正queryを全件表示や一般的な空状態と区別できない。
5. カテゴリが対象外である現行文書と追加仕様が矛盾している。
6. migration、seed、E2E fixture、直接DB insertの一部だけを変更すると、NOT NULL・外部キー制約または型検査で中間HEADが壊れる。

## 4. 採用する方針

### ドメインと言語

- **カテゴリ**は、商品を購入者向けcatalogで分類する固定taxonomyを指す。
- **編集テーマ**はトップページの静的な編集表現を指し、カテゴリとは関連付けない。
- domain-modelingの成果として、この区別と用語を実装の最下層でroot `CONTEXT.md` に記録する。`CONTEXT.md` には実装詳細や一時的な仕様を含めない。

### DBと固定master

- `categories` tableへ `id`、`name`、`slug`、`display_order` を持たせる。更新日時や公開状態は、固定masterに不要なため追加しない。
- `name`、`slug`、`display_order` はそれぞれ一意とする。slugは英小文字kebab-case、display orderは正の整数をCHECK制約で保証する。
- `products.category_id` はNOT NULLで `categories.id` を参照し、削除時は `RESTRICT` とする。カテゴリ絞り込み用にcategory IDのindexを追加する。
- 新しいschemaから `pnpm db:generate` で `0006` migrationとsnapshotを生成する。生成された新migrationだけを、列追加を一時nullableにする、固定カテゴリをinsertする、既存商品を `other` へbackfillする、NOT NULL・外部キーを設定する順へ整える。既存migrationは編集しない。
- migration単体で任意の既存DBを最新schemaへ移行できるようにし、seed実行をmigration成立条件にしない。
- 固定ID・表示名・slug・表示順は純粋なfeature moduleで1組だけ定義し、管理Client、seed、fixtureが共有する。SQL migrationには同じ値を明示し、テストで一致を検証する。
- seedはカテゴリを商品より先に冪等upsertする。通常商品は意味に沿う4カテゴリへ、種別不明の非公開・テスト専用商品は `other` へ明示的に割り当てる。

### 契約・管理更新

- カテゴリ契約は `src/contracts/category.ts` に置き、カテゴリDTOとcategory ID・slugのschemaを定義する。
- Layer 1では公開 `ProductDto` を変更せず、`AdminProductDto` にフォーム選択用の `categoryId` を追加する。Layer 2で公開 `ProductDto.category` を `{ name, slug }` として追加し、最終的な `AdminProductDto` は公開categoryと `categoryId` の両方を持つ。内部category IDを公開DTOへ含めない。
- 管理作成requestは `categoryId` を必須、metadata PATCHでは任意の変更fieldとして扱う。categoryだけの更新も有効なmetadata更新とする。
- 管理serviceはカテゴリの存在を確認してからinsert/updateする。不明IDはHTTPへ依存しないvalidation errorとして返し、Route Handlerが400 `VALIDATION_ERROR` と `fieldErrors.categoryId` へ変換する。
- category変更は既存の商品metadata更新と同じ条件付きUPDATEに含め、`version = version + 1` を同じ文で実行する。カテゴリ専用更新endpointや別versionは追加しない。
- 作成フォームは未選択optionを初期値とし、default categoryを設けない。編集フォームは取得済み商品の `categoryId` を初期値とし、未選択への変更は許可しない。両フォームの選択肢は固定masterから表示し、入力不正時は送信せずcategory selectへfocusを移す。
- 409で取得した最新商品には最新categoryを表示し、「最新値をフォームへ反映」を選ぶまで利用者の入力を上書きしない。

### 公開閲覧

- 公開商品serviceはcategoryをjoinしてDTOへ変換する。絞り込み時はslugからカテゴリを解決してから `is_published = true AND category_id = ?` で取得し、既存の固定順を維持する。
- `/api/products` は `NextRequest.nextUrl.searchParams` のcategory件数と値を共有Zod schemaで検証する。queryなしは全件、正しい1件は絞り込み、不正値は400、不明slugは404とする。
- `/products` のServer Componentは同じquery schemaを使うが、自分自身のRoute Handlerを呼ばない。queryなし・正しいslugだけserver-only facadeへ渡し、不正値・不明slugは `notFound()` へ送る。
- server-only facadeは表示順のカテゴリ一覧、選択カテゴリ、公開商品を返す。カテゴリnavigationは `aria-label` と `aria-current="page"` を持つ通常のリンクとし、Client stateやTanStack Queryを追加しない。
- 選択中はカテゴリ名を見出しとパンくずへ反映する。既存カテゴリに商品が0件ならカテゴリ専用の説明を表示する。全件0件の既存表示は維持する。
- 詳細のパンくずと戻りリンクは `product.category.slug` を使い、対応するcategory queryへ移動する。

### テスト境界

- ZodのID、slug、query、管理request境界は単体テストで確認する。
- migration、unique/CHECK/FK/RESTRICT、公開絞り込み、404/400、管理割り当て、楽観ロックは実PostgreSQLを使うバックエンド結合を主担当とする。
- 一覧navigation、選択状態、カテゴリquery中のloading/error、空・404、詳細リンク、管理必須入力、focus、409後の入力保持はDBなしのフロントエンド結合を主担当とする。routeのloading/errorは誤ったカテゴリ名を推測せず、retry後にURLの選択カテゴリを復元する。
- E2Eは代表的なカテゴリ閲覧と管理商品への割り当てだけを既存導線へ追加し、全カテゴリ・全境界を重複しない。
- UI差分が生じる `ProductList`、`ProductDetail`、`AdminProductForm` の既存Storyを更新し、固定Linux環境で対象baselineだけを更新する。

## 5. 採用しない方針

- カテゴリの作成、名称変更、並び替え、削除を行うUI/APIは追加しない。
- 複数カテゴリ、親子階層、未分類商品、カテゴリ画像、カテゴリ件数、カテゴリ別の独立routeを追加しない。
- トップページの編集テーマ、検索、並び替え、お気に入りとカテゴリを接続しない。
- category queryをClient stateや `useEffect` で同期しない。URLとServer Componentをsource of truthとする。
- カテゴリ一覧だけのJSON API、管理商品詳細GET、カテゴリ専用PATCH、別の状態管理・フォームlibraryを追加しない。
- カテゴリ変更をcheckoutToken、注文snapshot、注文履歴へ追加しない。
- category IDを公開 `ProductDto` へ含めない。
- 既存migration、既存注文table、order itemを変更しない。

## 6. 変更対象

### 仕様・用語

- `CONTEXT.md`: カテゴリと編集テーマの用語を実装詳細なしで定義する。
- `AGENTS.md`: カテゴリを対象外から外し、固定・単一・非階層・管理CRUDなしの継続規約を追加する。
- `docs/PRODUCT.md`: 対象画面、商品カテゴリ、管理割り当て、公開閲覧、エラー、対象外を同期する。
- `docs/ARCHITECTURE.md`: categories model、products FK、DTO、query、管理request、依存方向を同期する。
- `docs/TEST_STRATEGY.md`: カテゴリの各テストレベルとDB境界を追加する。
- `docs/TEST_SCENARIOS.md`: category単体・DB・公開・管理・E2E・VRTシナリオを追加または既存シナリオへ割り当てる。
- `docs/DEVELOPMENT_PLAN.md`: 完了済みPhaseへ暗黙に混ぜず、カテゴリを後続Phaseと2つのstacked PRとして定義する。
- `DESIGN.md`: 商品一覧のカテゴリnavigation、選択見出し、詳細の戻り導線を追加し、編集テーマとは別であることを明記する。

### DB・契約・fixture

- `src/server/db/schema/index.ts`: categories table、Product.categoryId、型、index、制約を追加する。
- `drizzle/0006_*.sql`、`drizzle/meta/0006_snapshot.json`、`drizzle/meta/_journal.json`: 固定master、backfill、NOT NULL、FKを含む新migrationを追加する。
- `src/contracts/category.ts`、`src/contracts/product.ts`: category、query、DTO、管理request schemaを追加する。
- `src/features/categories/category-catalog.ts`: 固定5カテゴリのID、名称、slug、表示順を定義する。
- `src/server/db/seed.ts`: category seedと全商品の明示的なcategory IDを追加し、開発・E2E準備処理で商品より先に適用する。
- 次の棚卸しをLayer 1の必須insert/fixture範囲とし、対象を実装時の追加調査へ委ねない。

| exact file / symbol | category割り当て | 検証 |
| --- | --- | --- |
| `src/features/admin/server/admin-product-service.ts` / `createAdminProduct` | requestの必須 `categoryId`。不明IDはinsertしない | 管理Backend結合の201・400 |
| `src/server/db/seed.ts` / `seedProducts`・`seedCatalogProducts` | 既知25件を承認済み分類へ明示割り当て | seed後のcategory全件検査 |
| `src/server/db/seed.ts` / `seedE2EFixtures` の `purchaseProducts` | 5件とも `bags-accessories` | 購入E2E setup |
| `src/server/db/seed.ts` / `seedE2EFixtures` の `e2eAdminOrderFixtures` 商品insert | 3件とも `other` | 管理注文Backend/E2E回帰 |
| `tests/backend/product-browsing.backend.test.ts` / `insertProduct` | defaultは `other`、絞り込みcaseだけcategoryをoverride | 商品閲覧Backend結合 |
| `tests/e2e/admin-products.spec.ts` / 管理作成フォーム | `other` を利用者操作で明示選択し、暗黙defaultを使わない | `E2E-003` |
| `src/features/admin/admin-product-fixtures.ts` / `adminProductFixture` | `categoryId` を追加 | 管理Frontend結合・Story |
| `src/features/admin/AdminProductForm.stories.tsx` / `values` | create/edit表示用category値を追加 | `VRT-007` |
| `src/features/admin/admin-product-frontend-test-helpers.tsx` と管理Frontend testのMSW response | 上記Admin DTO fixtureを通じてcategoryを返す | 管理Frontend結合 |

- Layer 2では `src/features/products/product-fixtures.ts` と `src/contracts/product.unit.test.ts` の公開Product DTO fixtureへcategory name/slugを追加する。Layer 1では公開DTOとこれらのfixtureを変更しない。

### server・API

- `src/features/products/server/product-service.ts`: category join、slug解決、絞り込み、category not foundを実装する。
- `src/features/products/server/product-page-data.ts`: category navigationと選択状態を返すserver-only facadeへ拡張する。
- `src/features/admin/server/admin-product-service.ts`: categoryを含む取得・作成・更新、存在検証、version更新を実装する。
- `src/features/admin/server/admin-product-http.ts`: 不明category IDを400 field errorへ変換する。
- `src/app/api/products/route.ts`: category queryの400/404変換を追加する。
- 既存の管理商品Route Handlerは共有request schemaとservice変更を使い、endpointは増やさない。

### UI・Client

- `src/app/products/page.tsx`、`src/app/products/not-found.tsx`: searchParams検証とcategory 404を実装する。
- `src/features/products/ProductListView.tsx`: category navigation、見出し、件数、カテゴリ専用空状態を追加する。
- `src/features/products/ProductDetailView.tsx`: categoryパンくずと戻りリンクを追加する。
- `src/features/admin/AdminProductForm.tsx`: category select、error、disabled、focus、最新category表示を追加する。
- `src/features/admin/AdminProductsPage.tsx`、`AdminProductEditPage.tsx`: category form state、parse、差分抽出、競合反映を追加する。
- `src/lib/api-client/admin-product.ts` は型変更へ追従するがendpointを追加しない。

### テスト

- category/product単体、商品閲覧・管理商品のFrontend/Backend結合、既存product/admin E2Eを更新する。
- `ProductListView`、`ProductDetailView`、`AdminProductForm` のStoryとfixtureを更新する。
- `tests/vrt/products.vrt.spec.ts` と `tests/vrt/admin-products.vrt.spec.ts` の対象baselineだけを固定Linux環境で更新する。

## 7. 実装手順

### Layer 1: `feature/category-foundation`

**責任:** 固定カテゴリmaster、商品への必須割り当て、管理者の商品作成・編集を1つの有効なDB/API/UI境界として導入する。

**親:** `main`。

**変更:**

1. `AGENTS.md` とPRODUCT/ARCHITECTURE/TEST_STRATEGY/TEST_SCENARIOS/DEVELOPMENT_PLANのうち、カテゴリmodel・管理割り当て・テスト境界に関する記述を同期し、`CONTEXT.md` にカテゴリと編集テーマの区別を記録する。
2. category契約と固定catalog moduleを追加し、5カテゴリの固定ID・名称・slug・表示順を定義する。
3. Drizzle schemaへcategoriesとproducts.categoryIdを追加し、`pnpm db:generate` で新migrationを生成する。新migrationを固定カテゴリinsert、既存productのother backfill、NOT NULL、index、`ON DELETE RESTRICT` FKの安全な順序へ整え、snapshotとの一致を確認する。
4. category seedを商品seedより先にupsertし、通常・E2E・テスト商品へcategory IDを明示する。商品種別が判定できないfixtureだけotherを使う。
5. `AdminProductDto` に `categoryId` だけを追加し、管理作成・metadata更新requestへcategoryを追加する。不明IDは400 field errorへ変換する。公開 `ProductDto` と `/api/products` のresponse contractはLayer 1では変更しない。
6. admin serviceの一覧・作成・更新をcategory対応し、category変更とversion増加を同じ条件付きUPDATEで行う。
7. 管理作成・編集フォームへdefaultなしの必須selectを追加する。validation focus、pending、409、最新値反映へcategoryを含める。
8. DB契約、管理Backend/Frontend結合、管理E2E、AdminProductForm Story/VRTを更新する。

**中間HEAD:** すべての商品が有効なカテゴリを持ち、管理者はカテゴリを明示して商品を作成・編集できる。公開 `ProductDto` と公開一覧APIは従来のresponse contract・全件表示を維持し、カテゴリ閲覧はLayer 2まで提供しない。

**検証:**

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:frontend`
- `pnpm db:prepare:test && pnpm test:backend`
- `pnpm test:e2e`
- `pnpm build`
- `pnpm build-storybook`
- README記載の固定Linux containerで対象の `pnpm test:vrt:update` を実行後、`pnpm test:vrt`
- `tests/backend/database-foundation.backend.test.ts` にmigration upgrade caseを追加する。guardで `TEST_DATABASE_URL` がloopback上の `mockshop_test` であることを確認してから、maintenance接続で専用の `mockshop_category_migration_test` DBを作成する。Nodeの一時folderへ `0000`〜`0005` とfilter済みjournalを配置して既存migratorを実行し、categoryなしproductをinsertした後、通常のmigration folderで `0006` を適用する。5 master行、既存productのother backfill、NOT NULL、FK、RESTRICTをassertし、finallyで専用DBだけをdropする。通常の空DB migration testとは別caseにする。

**リスクとrollback:** migration途中でNOT NULLを先に付けると既存DBが移行不能になるためSQL順序を個別確認する。未mergeならbranchを破棄してrollbackできる。merge後は既存migrationを書き換えず、必要な修正をforward migrationで行う。既存商品はotherへ決定的にbackfillされるためデータ欠損は起こさない。

### Layer 2: `feature/category-browsing`

**責任:** 公開DTO・API・Server Component・一覧/詳細UIをcategory queryへ接続し、購入者がカテゴリ別に閲覧できる完成状態を提供する。

**親:** `feature/category-foundation`。

**変更:**

1. PRODUCT/ARCHITECTURE/TEST_STRATEGY/TEST_SCENARIOS/DEVELOPMENT_PLANとDESIGNへ、公開query、404/空状態、navigation、代表E2E/VRTを同期する。
2. 公開ProductDtoへcategory name/slugを追加し、category query schemaをAPIとpageで共有する。
3. 公開product serviceをcategory join・slug解決・固定順絞り込みへ拡張し、空カテゴリと不明カテゴリを区別する。
4. `/api/products` でqueryなし、正しいslug、不明slug、空・重複queryを200/404/400へ変換する。
5. `/products` のServer Componentとserver-only facadeへsearchParams、category navigation data、選択状態を渡し、不正・不明queryをproduct一覧用not-foundへ送る。
6. ProductListViewへaccessibleなカテゴリnavigation、選択見出し、全件/カテゴリ別の空状態を追加する。
7. 商品詳細のパンくずと戻りリンクを商品カテゴリのqueryへ接続する。ProductCardの表示は変更しない。
8. 公開Backend/Frontend結合、商品閲覧E2E、ProductList/ProductDetail Story/VRTを更新する。

**中間HEAD:** `/products` は全件、`/products?category=<slug>` は実在カテゴリの商品だけを同じ固定順で表示し、空・400・404を仕様どおり区別する。詳細から元カテゴリへ戻れる。

**検証:**

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:frontend`
- `pnpm db:prepare:test && pnpm test:backend`
- `pnpm test:e2e`
- `pnpm build`
- `pnpm build-storybook`
- README記載の固定Linux containerで対象の `pnpm test:vrt:update` を実行後、`pnpm test:vrt`
- 375px、768px、1440pxでcategory navigationの折返し、focus、選択状態、空状態を目視確認する。

**リスクとrollback:** query解析をRoute Handlerとpageで別実装すると400/404がずれるため共有schemaを使う。下位layerが変わった場合はLayer 2を `gh stack rebase --upstack` 相当の現行CLI手順でrestackし、全検証と説明を再実行する。未mergeならLayer 2だけを破棄してLayer 1の管理割り当て状態へ戻せる。

### Stack運用

1. 計画承認後、最新 `main` を再確認して `gh stack init feature/category-foundation` で下位branchを作成する。
2. Layer 1を明示的にstage・確認・commitし、`gh stack add feature/category-browsing` で上位branchを作成する。
3. Layer 2を明示的にstage・確認・commitする。
4. 各HEADの検証後、`gh stack submit --auto --remote origin` でdraft PRを作成する。
5. PR本文は各layer自身のdiffだけを説明し、stack順、Reviewer Guide、正確な検証結果を記載する。
6. 下位修正後は上位をrestackし、影響するテスト・CI・Reviewer Guide・`[SHIP:NOTE]` を最新SHAへ同期する。

## 8. テスト・検証方法

### 単体

- category ID、slug、category query schemaの有効・空・重複・形式不正を検証する。
- 管理作成でcategory IDを必須とし、metadata PATCHでcategoryだけの更新を許可する。
- ProductDtoがcategory name/slugを必須とし、category IDを公開しないことを確認する。

### フロントエンド結合

- 全件表示で `ALL ITEMS` をcurrentとして固定カテゴリを表示する。
- category linkのhref、accessible name、current状態、選択見出し、件数、固定順を検証する。
- category queryでroute loading/error境界を表示しても存在しないカテゴリ名を推測せず、errorの再試行後は同じURLから選択カテゴリの表示へ復帰することを確認する。
- 実在する空カテゴリはカテゴリ専用の説明を表示し、全件0件の説明と区別する。
- 不正・不明categoryのnot-found表示と一覧へ戻る導線を確認する。
- 商品詳細から商品のcategory queryへ戻れることを確認する。
- 管理作成のcategory未選択でHTTPを送らず、field errorを表示してselectへfocusする。編集は取得済みcategoryを初期選択し、未選択へ変更できないことを確認する。
- 管理作成・編集でcategory IDを送信し、成功後のcacheとフォームを更新する。
- category変更中の重複送信を防ぎ、409後は入力categoryを保持して最新categoryを提示し、明示反映まで再送しない。

### バックエンド結合

- 空DBへ全migrationが成功する。
- 旧productsを含むDBへ新migrationを適用すると全行がotherへbackfillされ、NULLが残らない。
- categoriesのname/slug/display orderのunique、slug形式、正の表示順、products FK、`ON DELETE RESTRICT` をRoute Handlerを通さず確認する。
- 公開一覧が公開商品だけをcategory IDで絞り、既存の `created_at DESC, id ASC` を維持する。
- 実在する空カテゴリは200 `{ items: [] }`、不明slugは404 `CATEGORY_NOT_FOUND`、空・重複queryは400 `VALIDATION_ERROR` になる。
- 管理作成・更新で有効categoryを保存し、不明IDを400 field errorで拒否してDBを変更しない。
- categoryだけのmetadata更新がversionを1増やし、古いexpectedVersionは409で先行categoryを上書きしない。
- customer・未認証の管理category更新を既存の403/401境界で拒否する。

### E2E

- `E2E-007` を拡張し、`ALL ITEMS` から代表カテゴリを選び、該当商品のみが表示され、詳細へ移動し、カテゴリ一覧へ戻れることをChromiumで確認する。
- `E2E-003` を拡張し、各browser用管理者がcategoryを明示して商品を作成し、別categoryへ更新後に公開一覧の所属が変わることを代表1例で確認する。
- E2E fixtureの全可変商品へcategoryを明示し、browser project間で共有しない。

### VRT・build

- `VRT-002`: ProductListの通常、カテゴリ選択、カテゴリ空状態を375/768/1440の必要な組み合わせで確認する。
- `VRT-003`: ProductDetailのcategoryパンくず・戻りリンクを既存viewportで確認する。
- `VRT-007`: AdminProductFormのcategory selectを通常、入力エラー、更新中、競合で確認する。
- 基準画像はREADMEの固定Linux containerで対象storyだけ更新し、差分を目視してからcommitする。
- `pnpm build` と `pnpm build-storybook` を各layerで成功させる。

## 9. リスク

- categoryをNOT NULLにするmigrationは既存行がある環境で失敗しやすい。固定master insertとbackfillをNOT NULLより前に実行し、空DBと旧schema DBの両方で検証する。
- 固定categoryをSQL、TypeScript、seedで扱うため値がずれる可能性がある。固定IDをfeature moduleからseed・UIで共有し、migration後のDB値との一致をBackend結合で検証する。
- admin metadataとstockが同じ商品versionを共有する既存設計は維持される。category変更成功・409・最新値反映で共有versionを巻き戻さないことをFrontend/Backend結合で確認する。
- 公開filterでcategory存在確認と商品取得が分かれるが、カテゴリ削除機能がなくFK RESTRICTで保護されるため、追加のtransactionやcacheは導入しない。
- すべての商品fixtureへ必須categoryが波及する。Section 6のLayer 1 insert/fixture棚卸しを完了条件として扱い、各行の検証で漏れを検出する。
- ProductDto追加はcart/orderのproduct表示fixtureにも波及しうるが、checkoutTokenとorder snapshotの材料は変更しない。関連テストでtokenと過去注文の回帰がないことを確認する。
- category navigationが狭いviewportで横overflowする可能性がある。wrapするlink listと44px以上の操作領域をVRT・目視で確認する。
- Layer 1はDB invariantと管理UIを同時に含むためdiffが大きいが、NOT NULL導入後も有効な商品作成導線を保つため、schema/API/UIを不自然に分離しない。

## 10. 未確定事項

なし。

## 11. 完了条件

- カテゴリを対象外とする文書の矛盾がなくなり、カテゴリと編集テーマが別概念として定義されている。
- 固定5カテゴリと商品category FKがmigration、schema、seedで一致し、すべての商品が必ず1カテゴリを持つ。
- migrationが空DBと既存productsを持つ旧schema DBの両方へ適用できる。
- 管理者がdefaultなしの必須categoryを指定して商品を作成・編集でき、category変更が商品versionと同じUPDATEで進む。
- 不明category ID、未認証、ロール不足、version競合が仕様どおりDB変更なしで処理される。
- `/products` と `/products?category=<slug>` が全件・カテゴリ別を固定順で表示し、空・不正query・不明slugを区別する。
- 公開ProductDto、API、Server Component、一覧・詳細UIが同じcategory name/slugを使用する。
- category変更がcheckoutToken、注文snapshot、注文履歴へ影響しない。
- 対応する単体、Frontend結合、Backend結合、E2E、VRTが責任重複なく成功する。
- 各stack layerでlint、typecheck、関連test、build、Storybook buildが成功し、最終HEADで全品質コマンドとGitHub Actions 4jobがgreenになる。
- 独立最終auditで全acceptance criterionとnon-goalがPASSし、Reviewer Guideと説明が最終PR head SHAに同期している。
