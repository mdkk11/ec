# 商品・カート・共通ナビゲーションUI改善の実装計画

## 1. 背景と目的

商品詳細、カート、共通ヘッダー、管理商品一覧には、現在の商品データと画面表示が一致しない箇所や、操作意図が分かりにくい箇所が残っている。商品詳細は在庫の有無だけを表示し、カートは数量を在庫上限なしの数値入力で受け付け、商品画像には固定placeholderを使っている。管理商品一覧は管理DTOに画像パスがあるにもかかわらず画像を表示しない。共通ヘッダーは認証後の全導線を横並びにし、カートもテキスト表示している。

今回の変更では、現在庫と実商品画像を既存のDB・契約境界から画面へ届け、カート数量を在庫内の選択肢へ制限する。あわせて、カート追加と数量更新の重複・非同期競合を既存の操作queueで決定的に扱い、ヘッダー、空カート、管理一覧、global scrollの表示を簡素化する。新しい状態管理、UI library、DB列は追加せず、既存DTO、TanStack Query、CartOperationProvider、Next Image、native select/detailsを再利用する。

本計画は会話で確定した仕様に基づく。ユーザーは、複数画面、公開・customer API契約、非同期操作、Frontend結合、Storybook、VRTへまたがるため計画が必要であることと、保存先 `docs/plans/storefront-cart-ui-improvements.md` を確認し、計画作成を承認済みである。計画の独立レビューとユーザー承認が完了するまでは、実装branchの作成と実装を行わない。

## 2. 現状調査

### 調査済みの事実

- 計画作成時の `main` は `af63997` で `origin/main` と一致し、worktreeは計画ファイル追加前にcleanである。関連するopen PRと既存計画はない。
- `src/features/products/server/product-service.ts` はDBから `products.stock` を取得しているが、公開 `ProductDto` へは `availability` だけを返す。`docs/ARCHITECTURE.md` とBackend結合テストは一覧・詳細の公開DTOが正確なstockを持たないことを明示している。
- 商品詳細と商品一覧は同じ `ProductDto` を使用する。商品一覧のProductCardは実商品画像を表示し、在庫切れ時だけ画像上に状態を表示する。今回、商品一覧の画像・在庫表示は変更しない。
- `ProductDetailView` は装飾付きの `在庫あり` / `在庫切れ` を表示する。詳細だけ正確な在庫数を返すには、一覧DTOを広げずdetail専用DTOへ分ける必要がある。
- `src/features/cart/server/cart-service.ts#loadCart` は商品をjoinしてstockを取得するが、image pathを選択せず、`cart-calculation.ts` はstockをissue判定に使った後DTOから落としている。`CartItemDto` はstockとimage pathを持たない。
- `CartView` は数量を `type="number"` で受け付け、商品画像に `/images/fixtures/product-placeholder.svg` を固定指定する。空カートの2リンクはinline要素を個別marginで並べるため、縦方向の間隔が安定しない。
- `CartOperationProvider` は同一operation fingerprintの実行中・queue済みtaskを同期的に重複排除し、同じ明細への未実行の数量変更は最新taskへ置換する。`ProductCartAction` も送信中buttonをdisabledにし、CART-014のFrontend結合テストはdouble clickでもPOSTが1回であることを既に検証している。
- したがってカート追加のために別のlockやAPI idempotency keyを追加する必要はない。既存重複排除を維持し、送信完了後は再度1点追加できる仕様とする。
- `SessionControls` は匿名時に `Login`、customerに `Orders` / `Cart` / email / `Logout`、adminに `Products` / `Orders` / email / `Logout` を横並びで表示する。DESIGNとAGENTSはこれらを英語の直接導線として規定しているため、今回のlabel・dropdown変更と文書を同期する必要がある。
- icon packageは導入されていない。カートiconは小さなrepository-local SVGで実装でき、追加dependencyは不要である。
- `AdminProductDto` と管理一覧APIは既に `imagePath` を返す。`AdminProductsPage` の一覧行が画像を描画していないだけなので、管理API変更は不要である。
- `AdminProductForm` のStory/VRTはあるが、管理商品一覧のStory/VRTはない。管理一覧画像を視覚検証するには、一覧の表示部分をfeature内のpresentational componentとして切り出してStoryを追加するのが最小の安定したfixture境界である。
- `src/app/globals.css` のglobal smooth scrollは `html { scroll-behavior: smooth; }` の1宣言だけである。reduced-motion overrideは他のtransition/animation抑止にも使うため残す。
- 実在する品質コマンドは `pnpm lint`、`pnpm typecheck`、`pnpm test:unit`、`pnpm test:frontend`、`pnpm test:backend`、`pnpm test:e2e`、`pnpm test:vrt`、`pnpm test:vrt:update`、`pnpm build`、`pnpm build-storybook` である。VRT baselineはREADME記載の固定Linux containerだけで更新する。

### 承認済みの仕様

- 商品詳細だけに現在庫を `在庫 8点` / `在庫 0点` の単純なtextで表示する。在庫0ではカート追加buttonを `在庫切れ` のdisabled状態にする。商品一覧の在庫UIと公開一覧DTOは変更しない。
- カートの商品画像は各商品の実際の `imagePath` を表示する。管理者の商品一覧にも同じ管理DTOの `imagePath` からthumbnailを表示する。商品作成・編集フォームの画像previewは追加しない。
- カート数量はnative selectへ変更し、現在庫がNなら1〜Nだけを選択できる。選択時に更新APIを即送信し、通常時の「数量を更新」buttonは廃止する。
- 保存数量が現在庫を超える場合は、保存数量を `3点（在庫超過）` のdisabled optionとして表示し、現在庫内のoptionを別に提示する。利用者が有効な数量を選ぶまで勝手に最大在庫へ補正しない。
- 在庫0または商品非公開時はquantity selectをdisabledにし、削除操作だけを残す。
- 数量更新中も異なる新しい数量は最新希望値として受け付ける。同じ値の重複送信は行わず、実行中taskの完了時に最新queued draftを消さない。
- 400 `QUANTITY_EXCEEDS_STOCK` では選択値と確定済み合計を保持してerrorと `最新のカートを再取得` を表示する。利用者が明示的にGETした後、最新availableStockでoptionを作り直す。
- 500/networkでは選択値と確定済み合計を保持し、error時だけ `再試行` を表示して同じ希望数量を再送できるようにする。どちらの失敗も、より新しいqueued draftがある場合は古いerrorを表示・反映しない。
- カート追加は送信中だけ同一商品の重複requestを防止し、完了後は再度1点追加できる。
- 空カートの既存 `商品一覧を見る` と `注文履歴を見る` 導線を中央揃えの縦並びにし、共通のgapで間隔を作る。文言とhrefは変更しない。
- ヘッダーは匿名時に `ログイン` を直接表示する。customerは読み上げ名 `カート` のcart iconを直接表示し、`マイページ` dropdownにemail、`オーダー`、`ログアウト` を置く。adminはcartを表示せず、dropdownにemail、`商品管理`、`オーダー`、`ログアウト` を置く。
- カート件数badge、商品フォームの画像preview、新しいUI/icon library、DB変更、在庫の自動補正、backend idempotency keyは追加しない。

## 3. 解決する問題

1. 商品詳細で購入可能な正確な現在庫を判断できない。
2. カート数量欄が在庫外の値を入力でき、利用者が送信後に初めて上限を知る。
3. 在庫減少後の保存数量と現在庫が食い違う状態を、truthfulかつ回復可能なselectで表現できない。
4. 数量の即時更新で実行中taskと置換可能なqueued draftを混同し、古いtaskの完了時に最新希望値を消す可能性がある。
5. カートが実商品画像ではなく共通placeholderを表示し、管理商品一覧もDTOにある画像を表示しない。
6. 認証後のheader操作が狭いviewportで横に増え、cartの視認性とaccount導線のまとまりが弱い。
7. 空カートのinline link間隔とglobal smooth scrollが、意図したlayout・navigation behaviorと一致しない。
8. 現行文書とテストscenarioが、detail stock、bounded select、header dropdown、管理一覧画像の新しいUI契約を表していない。

## 4. 採用する方針

### 商品詳細契約

- `ProductDto` は公開一覧の最小DTOとして維持し、stockを追加しない。
- `productDetailDtoSchema` / `ProductDetailDto` を `ProductDto` に非負整数 `stock` を追加したschemaとして `src/contracts/product.ts` に定義し、`productResponseSchema` だけdetail DTOを返す。
- product serviceは共通DB selectionを維持しつつ、一覧用mapperはavailabilityだけ、詳細用mapperはavailabilityとstockを返す。Admin DTOは既存stockを維持する。
- `ProductDetailView` のsuccess propsをdetail DTOにし、装飾badgeをplain textの在庫数へ置き換える。公開一覧、ProductCard、checkout token、order snapshotにはstockを追加しない。

### カート契約・数量更新

- `CartItemDto` に `imagePath` と `availableStock` を追加する。`availableStock` は画面表示時点の現在庫であり、保存数量ではないことをfield名で明示する。
- `cart-service.ts#loadCart` で `products.imagePath` を選択し、既に選択しているstockとともに `calculateCart` へ渡す。calculation resultへ両fieldを写すが、checkout tokenの正規化材料へは追加しない。
- CartLineは `item.imagePath` をNext Imageへ渡し、repositoryの動的商品画像規約どおり商品名をaltにする。管理商品一覧thumbnailも同じalt規則を使う。
- native selectのoptionは `1..availableStock` を生成する。保存数量が上限超過なら現在の保存数量をdisabled optionとして先頭に追加する。在庫0・非公開ならselect自体をdisabledにする。
- selectのonChangeはdraftを先に表示し、選択数量を `onUpdate` へ即時送信する。更新中の別selectionは既存CartOperationProviderへ渡し、same itemのqueued taskを最新値へ置換する。
- response成功時は、そのrequest値が現在draftと一致する場合だけdraftをclearしてserver cartへ戻す。400ではdraftを保持して明示的な最新cart取得、500/networkではdraftを保持してerror時だけの再試行を提供し、より新しいselectionを古いtaskで消さない。
- operation errorはUIが400 stock errorと再送可能errorを区別できる最小限のcode/kindをCartPageからCartViewへ渡す。400の再取得は既存cart queryのrefetchを使い、checkout専用feedbackと混在させない。500/networkの再試行は失敗operationをそのまま既存CartOperationProviderへ再投入する。
- 通常の更新buttonと自由入力validation messageは削除する。APIの在庫超過validationとBackend結合は防御境界として維持する。

### カート追加・空状態

- ProductCartActionとCartOperationProviderのpending表示・duplicate fingerprint判定をsource of truthとする。新しいmutex、ref guard、API parameterは追加しない。
- CART-014を「保留中のdouble clickは1 POST、button disabled、成功後にbuttonが再度利用可能」として明確化する。
- 空カートの2リンクを1つのflex column wrapperへ入れ、wrapperのgapで間隔を管理する。semantic linkと既存hrefは維持する。

### ヘッダー

- anonymous labelを `ログイン` へ変更する。
- customerのcartはinline SVGを持つicon-only linkとし、visible tooltipに依存せず `aria-label="カート"` を付ける。badgeは追加しない。
- account操作はnative `details` / `summary` の `マイページ` dropdownにまとめる。追加libraryやglobal click listenerを導入せず、keyboardのEnter/Spaceと標準focusを利用する。
- dropdown内はemailを非操作情報として示し、role別の実在linkとlogout buttonだけを置く。customerは `オーダー`、adminは `商品管理` と `オーダー` を表示する。
- logout pending/errorは既存SessionProviderとlocal stateを維持し、dropdown内で支援技術へ通知する。role境界とadminにcartを出さない規則を維持する。

### 管理商品一覧画像

- `AdminProductsPage` にinlineで存在する一覧・空状態をfeature固有の `AdminProductList` presentational componentへ切り出す。汎用table/card abstractionにはしない。
- 各行に固定aspect ratioのNext Image thumbnailを追加し、既存の商品名、公開状態、価格、在庫、version、編集linkを維持する。
- `AdminProductList.stories.tsx` へ通常・空状態を追加し、管理APIやTanStack QueryをStoryで起動しない。Frontend結合は引き続き実 `AdminProductsPage`、TanStack Query、API client、MSWを通す。

### 文書とテスト境界

- `AGENTS.md`、PRODUCT、ARCHITECTURE、TEST_STRATEGY、TEST_SCENARIOS、DEVELOPMENT_PLAN、DESIGNを同じstackで同期する。新しいdomain用語はないため `CONTEXT.md` とADRは変更しない。
- Product detail / cart / header / admin listの意味・操作はFrontend結合、public/customer JSON responseはBackend結合、representative navigationはE2E、layout・画像・dropdown open状態はStorybook/VRTを主担当とする。
- VRTはVRT-003、VRT-004、VRT-009と新しい管理商品一覧scenarioだけを更新・追加し、無関係なbaselineを更新しない。
- StorefrontShellのcustomer/admin Storyは固定の認証stateを渡し、Story `play` で `マイページ` summaryを開く。VRTはdropdown itemがvisibleになるまで待ってから撮影し、本番componentへStory専用open propを追加しない。native `details` は外側clickやEscapeで閉じるpopup menuではなく、標準disclosureとして扱う。

## 5. 採用しない方針

- 公開商品一覧DTOとProductCardへ正確なstockを追加しない。
- stock、image pathをcheckout token、注文snapshot、注文履歴へ追加しない。
- cart quantityをClientだけで自動補正しない。Server responseを受けずに合計・cart versionを楽観更新しない。
- quantity更新の通常button、自由入力、0による削除を残さない。
- add-to-cart用のDB lock、idempotency key、追加の状態管理、mutation hookを重ねない。
- cart badge、mini cart、画像upload/preview/変換、外部画像、admin image editorを追加しない。
- menu library、icon package、汎用dropdown component、汎用admin product cardを追加しない。
- global smooth scrollを別selectorへ移動せず削除する。reduced-motionのanimation/transition抑止は削除しない。
- DB schema、migration、seedの商品画像値を変更しない。

## 6. 変更対象

### 仕様・継続規約

- `AGENTS.md`: global navigationの英語固定規則を、承認済みのカタカナlabel、cart icon、role別dropdownへ更新する。
- `docs/PRODUCT.md`: detail stock、cart selectと在庫超過回復、実商品画像、role別headerを追加する。
- `docs/ARCHITECTURE.md`: `ProductDetailDto`、`CartItemDto.imagePath/availableStock`、response contract、checkout token非変更を記録する。
- `docs/TEST_STRATEGY.md`: bounded select、実画像、header dropdownのFrontend/VRT責任を追加する。
- `docs/TEST_SCENARIOS.md`: PRODUCT-011、CART-003/007/008/009/014、AUTH-012を更新し、管理一覧画像・header role menuのscenarioとVRT対象を追加する。
- `docs/DEVELOPMENT_PLAN.md`: 完了済みphaseを改変せず、今回の改善を2層のfollow-up stackとして追加する。
- `DESIGN.md`: detail stock text、cart select/画像/空状態、header icon/dropdownとカタカナlabel、admin thumbnailを同期する。

### Layer 1: 商品詳細・カート

- `src/contracts/product.ts`、`src/contracts/product.unit.test.ts`: detail DTOとschema境界を追加する。
- `src/features/products/server/product-service.ts`、`src/features/products/server/product-page-data.ts`: detailだけstockを返す。
- `src/features/products/ProductDetailView.tsx`、stories、fixtures、Frontend結合: 現在庫textとdetail typeへ追従する。
- `src/contracts/cart.ts`、`src/contracts/cart.unit.test.ts`: cart item image/current stock contractを追加する。
- `src/features/cart/server/cart-service.ts`、`src/features/cart/cart-calculation.ts` とunit test: image/current stockをDTOへ写し、token材料を維持する。
- `src/features/cart/CartPage.tsx`、`CartView.tsx`、`cart-fixtures.ts`、stories、CartPage Frontend結合: 実画像、bounded immediate select、error種別、最新cart再取得、error時再試行、空状態gapを実装する。
- `src/features/cart/ProductCartAction.frontend.test.tsx`: duplicate防止と成功後再操作を明確化する。本番重複排除codeは再現失敗がない限り変更しない。
- `tests/backend/product-browsing.backend.test.ts`、`tests/backend/cart.backend.test.ts`: detail/list DTO分離とcart response fieldsを検証する。
- `tests/e2e/product-browsing.spec.ts`、`tests/e2e/cart.spec.ts`、購入導線のquantity selector: exact stock、combobox、実cart imageの代表例へ更新する。
- `tests/vrt/products.vrt.spec.ts`、`tests/vrt/cart.vrt.spec.ts` と対象baseline: VRT-003/VRT-004だけを更新する。
- `src/app/globals.css`: smooth scroll削除は同じstorefront/cart layerに含める。

### Layer 2: 共通ヘッダー・管理商品一覧

- `src/features/auth/SessionControls.tsx`: role別cart iconとnative account dropdown、カタカナlabel、logout状態を実装する。
- 必要なcart iconはSessionControlsと同じlayout feature内の小さなSVG componentまたは同file内private componentとし、再利用要求が発生しない限り共通icon systemを作らない。
- `src/features/auth/LoginForm.frontend.test.tsx`: anonymous/customer/admin、dropdown開閉、role別link、logout pending/errorを検証する。
- `src/components/layout/StorefrontShell.stories.tsx`: anonymous、customer menu open、admin menu openの固定storyを追加する。
- `tests/e2e/app-shell.spec.ts`: mobileを含むlabel、cart icon、dropdown、role分離、non-overlapを更新する。
- `tests/vrt/storefront-shell.vrt.spec.ts` とbaseline: anonymousのlabel差分、customer/admin menu open状態を必要viewportで追加する。
- `src/features/admin/AdminProductList.tsx` とStory: 管理商品一覧・空状態・実画像thumbnailをpresentational boundaryとして追加する。
- `src/features/admin/AdminProductsPage.tsx`、`AdminProductListCreate.frontend.test.tsx`: query結果を一覧componentへ渡し、実画像と既存編集導線を確認する。
- `tests/vrt/admin-products.vrt.spec.ts` とbaseline: 既存VRT-007 formは維持し、管理商品一覧の通常・空を新scenarioとして追加する。

## 7. 実装手順

### Layer 1: `feature/product-cart-accuracy`

**責任:** 商品詳細とcart responseに必要な現在庫・実商品画像を届け、在庫内の即時数量選択と回復可能なcart UIを完成させる。

**親:** `main`。

**変更:**

1. PRODUCT、ARCHITECTURE、TEST_STRATEGY、TEST_SCENARIOS、DEVELOPMENT_PLAN、DESIGNのうちdetail/cart契約とtest責任を更新する。
2. detail専用Product DTOを追加し、公開一覧は従来DTO、公開詳細だけstock付きDTOを返すようservice、server-only facade、API responseを分ける。
3. ProductDetailView、fixture、Story、Frontend/Backend結合、代表E2Eを正確なstock textへ更新する。
4. CartItemDtoへ `imagePath` / `availableStock` を追加し、cart service/calculationから返す。token生成前後の材料が変わらないことをunit/Backend結合で確認する。
5. CartLineを実商品画像とnative selectへ変更する。通常、在庫超過、在庫0、非公開、即時成功、400後の明示再取得、500/network後のerror時再試行、実行中2→queued 3、queued update置換、same selection duplicateの各stateを明示する。
6. ProductCartActionの保留中double clickと成功後再操作をFrontend結合で固定し、既存providerで1 requestになることを確認する。
7. 空カートlinkをgap付きcolumnへ変更し、global smooth scroll宣言を削除する。
8. Cart/Product StoryとVRT-003/VRT-004 baseline、関連E2E selectorを更新する。

**有効な中間HEAD:** 公開一覧contractは従来どおり、商品詳細だけ現在庫を表示する。cart responseは現在庫と画像を含み、数量選択は在庫内で即時更新され、在庫超過・0・非公開・失敗・request raceから回復できる。headerと管理商品一覧はLayer 2まで従来表示を維持する。

**検証:**

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:frontend`
- `pnpm db:prepare:test && pnpm test:backend`
- `pnpm test:e2e`
- `pnpm build`
- `pnpm build-storybook`
- README記載の固定Linux containerで全VRTを `pnpm test:vrt:update` により再生成し、意図した対象baseline以外に差分がないことを確認してから `pnpm test:vrt`

**リスクとrollback:** DTO追加漏れはruntime response parseを500にするため、contract unit、service Backend、MSW fixtureを同じlayerで更新する。quantity queueはdraftのconditional clearを誤ると新しい選択を消すため、CART-007/009をrequest gateで検証し、新しいsequence管理を重ねない。400後にstale availableStockを残すと回復不能になるため、明示refetchの成功後だけoptionを最新化し、refetch失敗も再試行可能にする。未mergeならlayer branchを破棄でき、DB rollbackは不要である。

### Layer 2: `feature/navigation-admin-images`

**責任:** 認証状態別headerをcart iconとaccount dropdownへ整理し、管理商品一覧へ実画像thumbnailを追加する。

**親:** `feature/product-cart-accuracy`。

**変更:**

1. AGENTS、PRODUCT、TEST_STRATEGY、TEST_SCENARIOS、DEVELOPMENT_PLAN、DESIGNへheader/admin listの承認済み仕様を同期する。
2. SessionControlsをanonymous direct login、customer cart icon + account details、admin account detailsへ変更し、role別labelとlogout状態を維持する。
3. LoginForm Frontend結合とapp-shell E2Eをdropdownのkeyboard操作、href、role分離、mobile non-overlapへ更新する。
4. StorefrontShellにcustomer/admin menu open Storyを追加し、VRT-009の認証済み状態を必要viewportで追加する。
5. AdminProductListを既存AdminProductsPageから切り出し、Next Image thumbnail、既存metadata、empty state、編集linkを表示する。
6. 管理一覧Frontend結合、Story、代表E2Eと新しいVRT scenarioを追加する。Form VRTと管理APIは変更しない。

**有効な中間HEAD:** 匿名、customer、adminが各roleの実在導線だけをカタカナlabelで利用でき、customerはcart iconへ直接移動できる。管理商品一覧は実商品thumbnailを表示する。Layer 1のproduct/cart契約とUIを包含する。

**検証:**

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:frontend`
- `pnpm db:prepare:test && pnpm test:backend`
- `pnpm test:e2e`
- `pnpm build`
- `pnpm build-storybook`
- README記載の固定Linux containerで全VRTを `pnpm test:vrt:update` により再生成し、意図した対象baseline以外に差分がないことを確認してから `pnpm test:vrt`
- 375px、768px、1440pxでheader controls、open menu、admin thumbnail、horizontal overflowを目視確認する。

**リスクとrollback:** native detailsのpositioningがheader外へoverflowする可能性があるため、right-aligned absolute panelとviewport VRTで確認する。管理thumbnail追加で行高が変わるため既存情報・編集buttonのfocus orderを維持する。未mergeならLayer 2だけを破棄してLayer 1のproduct/cart改善状態へ戻せる。

### Stack運用

1. 計画承認後、cleanな最新 `main` で `gh stack init feature/product-cart-accuracy` を実行する。
2. Layer 1の文書・実装・テストを目的別に明示stageし、各commit前に `git diff --cached` を確認する。
3. Layer 1の検証完了後、`gh stack add feature/navigation-admin-images` で上位branchを作る。
4. Layer 2も文書・実装・テストを目的別にcommitし、各HEADで検証する。
5. `gh stack submit --auto --remote origin` でdraft PRを作成し、各PR本文をrepository templateとSHIP Reviewer Guideへ合わせる。
6. 下位修正時はcurrent `gh stack rebase --upstack` / `push` helpに従って上位をrestackし、影響するverification、CI、Reviewer Guide、`[SHIP:NOTE]` を最新SHAへ同期する。

Layer 2はLayer 1へruntime上の技術依存を持たないが、1つの承認済みUI改善projectをレビュー可能な量へ分けるため同じstackの上位に置く。各layerの文書はそのHEADまでに実装済みの現在仕様だけを記述し、Layer 2のheader/admin仕様をLayer 1で先行して現在形にしない。

## 8. テスト・検証方法

### 単体

- Product list DTOはstockなしを受け入れ、Product detail DTOは0を含む非負整数stockを必須とし、負数・小数を拒否する。
- CartItemDtoはlocal `/images/` pathと非負整数availableStockを必須とする。
- cart calculationはavailableStockとimagePathをresponseへ写し、availability/issue/totalを従来どおり計算する。
- checkout tokenはstockまたはimage pathだけが変わっても材料に含めず、既存のcart version・商品構成・名称・単価・公開状態・coupon・total規則を維持する。

### フロントエンド結合

- 商品詳細はstock 8を `在庫 8点`、stock 0を `在庫 0点` と表示し、0では追加操作をdisabledにする。
- CartはresponseのimagePathをNext Imageへ渡し、数量selectが1〜availableStockだけを持つことをrole/label/optionで確認する。
- 保存数量3・現在庫2ではdisabledの `3点（在庫超過）` と有効な1/2点を表示し、自動requestを送らない。有効値選択後だけPATCHを送る。
- select変更時に更新buttonなしでPATCHを送信する。同じ値のduplicateは送らず、2のrequest保留中に3を選ぶと2→3の順で直列化し、最終表示とserver responseを3へ一致させる。
- 初期availableStock 3で3を選んだPATCHが400になった場合、draft 3と確定済み合計を保持し、`最新のカートを再取得` からGETする。GET後のavailableStock 2ではoptionが1/2だけになり、server確定quantityを表示する。GET失敗は同じ導線で再試行できる。
- 500/networkではdraftと確定済み合計を保持し、error時だけの `再試行` で同じ希望数量を再送して成功できる。
- 実行中2の失敗時に最新queued draft 3がある場合、古いerror・draft処理を表示せず3を送信して最終cartを3へ一致させる。
- 在庫0・非公開itemはselectをdisabledにし、削除buttonを利用可能にする。
- add-to-cartのdouble clickは1 POST、pending button disabled、success後button enabledとなる。
- 空カートの2linkは両方正しいhrefを持ち、VRTで縦gapを確認する。
- Headerはsummaryをkeyboardで開け、customerだけcart icon / customer orders、adminだけ商品管理 / admin ordersを表示する。logout pending/errorとemail表示もdropdown内で維持する。
- Admin product listはresponseのimagePathを表示し、商品名・metadata・編集link・empty stateを維持する。

### バックエンド結合

- `GET /api/products` の一覧itemはstockを返さず、公開詳細だけstockを返す。在庫0も200 detailとしてstock 0とout_of_stockを返す。
- 公開detail service/Route Handlerのschema違反は従来どおり500へ変換される。
- GET/add/update/delete後のCartDto itemがimagePathとavailableStockを返し、stock conflict issueとcheckoutToken null判定を維持する。
- 在庫を超える直接PATCHはselectを迂回しても400 `QUANTITY_EXCEEDS_STOCK`、DB quantityとcart versionを変更しない。
- imagePath/availableStock追加がcart version、checkout token、order transactionを変更しないことを既存cart/order回帰で確認する。

### E2E

- 公開商品詳細でseedの正確なstockを表示する代表1例を既存商品閲覧scenarioへ追加する。
- cart E2Eはspinbutton操作をcombobox selectionへ置き換え、選択直後の更新完了と実商品画像のlocal pathを確認する。
- app-shell E2Eは匿名 `ログイン`、customer cart icon / マイページ / オーダー / ログアウト、admin 商品管理 / オーダー / ログアウト、mobile non-overlapを確認する。
- 管理商品一覧画像はFrontend結合とVRTを主担当とし、画像専用E2Eを追加しない。既存管理E2Eはheader dropdownから商品管理へ到達する変更だけへ追従する。

### Storybook・VRT・build

- VRT-003: ProductDetailの在庫8/0 textを375/1440で確認する。
- VRT-004: Cartの通常、空、更新中、在庫超過を375/1440で確認する。実商品画像、select、空状態gapを対象にする。
- VRT-009: anonymous label差分とcustomer/admin menu open状態を375/768/1440の必要な組み合わせで確認する。
- 新しい管理商品一覧VRTは通常・空を375/1440で確認し、既存VRT-007 AdminProductForm baselineを変更しない。
- 基準画像はREADMEの固定Linux containerで全件再生成し、意図したstory以外に差分がないことを確認してから変更画像を目視・commitする。
- `pnpm build` と `pnpm build-storybook` を両layerで成功させる。

## 9. リスク

- Product detail DTOを既存ProductDtoへ直接追加すると一覧までstockを公開する。detail専用schemaとresponseで分離し、一覧Backend assertionを維持する。
- CartItemDtoの追加fieldはMSW、Story、unit、Backend、order fixtureへ波及する。typecheckだけでなくruntime Zod parseを通るtestを各境界で実行する。
- availableStockは表示時点の値で在庫予約ではない。select内に収まっていても更新・注文時に在庫が変わりうるため、既存400/409と再取得導線を削除しない。
- immediate updateでdraft clearを無条件に行うと、新しいselectionが古いsuccess/failureで消える。submitted quantityとcurrent draftが一致するときだけclearする。
- 現在庫が0または非公開のitemで数量変更まで無効化すると、回復操作は削除だけになる。これは承認済み仕様としてFrontend結合で固定する。
- native detailsは追加dependencyなしでkeyboard操作を提供するが、panel幅・absolute positioning・focus ringをviewportごとに確認する必要がある。
- inline SVGを装飾扱いにするとcart linkの名前が失われる。linkの `aria-label="カート"` をFrontend/E2Eで検証する。
- AdminProductList抽出時にquery/error/create stateまで移すと責務が広がる。一覧表示と空状態だけをprops componentへ切り出し、server stateはAdminProductsPageに残す。
- VRT変更範囲が広い。対象scenarioだけ更新し、固定Linuxで無関係なbaselineに差分が出た場合は原因を調査して一括承認しない。

## 10. 未確定事項

なし。

### 独立計画レビューの反映

独立criticが指摘した8項目をすべて採用した。

1. 400後のstale availableStock問題は、ユーザー操作による最新cart再取得とFrontend受入条件を追加した。
2. 失敗時draftはユーザーへ再確認し、400/500とも保持する方針と回復導線を承認済み仕様へ追加した。
3. cart/admin画像altはrepository規約に合わせて商品名へ統一した。
4. menu-open Storyは認証fixture、Story play、VRTのvisible待機を具体化し、Story専用production propを不採用とした。
5. VRT更新はscriptの実態に合わせて全件再生成し、意図したbaseline以外の差分がないことを確認する手順へ直した。
6. response逆転という不正確な説明を、既存queueの実行中task、queued draft、task置換の検証へ修正した。
7. 管理画像専用E2Eは責任重複として不採用にし、Frontend結合とVRTを主担当にした。cart E2Eは既存購入導線内の代表画像読込1例だけを維持する。
8. Layer 2はruntime依存ではなく同一projectのreview量分割であることと、各HEADの文書同期規則を明記した。

## 11. 完了条件

- 商品一覧DTOはstock非公開を維持し、商品詳細だけ現在庫を正確に表示する。
- CartDtoが実商品imagePathとavailableStockを返し、checkout token・order snapshotの材料は変わらない。
- quantity selectが通常、在庫超過、在庫0、非公開、更新成功、400後の最新cart再取得、500/network後の再試行、連続selectionを仕様どおり扱い、最新希望値を古いtaskで失わない。
- add-to-cartは保留中1 request、完了後再操作可能である。
- カートと管理商品一覧が実商品画像を表示し、商品フォームpreviewは追加されていない。
- 空カートbutton間隔とglobal smooth scrollが修正されている。
- anonymous/customer/admin headerが承認済みlabel・cart icon・role別dropdownを持ち、keyboard、focus、mobile layout、logout errorを維持する。
- PRODUCT、ARCHITECTURE、TEST_STRATEGY、TEST_SCENARIOS、DEVELOPMENT_PLAN、DESIGN、AGENTSが実装と一致する。
- 対応するunit、Frontend結合、Backend結合、E2E、Storybook/VRTが責任重複なく成功する。
- 各stack layerでlint、typecheck、関連test、build、Storybook buildが成功し、最終HEADで全品質コマンドとGitHub Actions 4jobがgreenになる。
- 独立最終auditで全acceptance criterionとnon-goalがPASSし、Reviewer Guideと説明が最終PR head SHAに同期している。
