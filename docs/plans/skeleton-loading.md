# 画面構造に沿ったSkeleton Loadingの実装計画

## 1. 背景と目的

現在の初回読み込み画面は、商品一覧・商品詳細・注文履歴・注文詳細・カート・管理画面で中央寄せのテキストを表示している。読み込み完了後の画像、カード、フォーム、表とは高さと幅が大きく異なるため、完了時に画面構造が急に切り替わり、利用者が読み込み後の配置を予測しにくい。

今回の変更では、機能非依存の小さな `Skeleton` UI primitiveを追加し、各画面が実際に使用するgrid、画像比率、カード、フォーム、表の寸法に合わせて初回読み込み状態を構成する。既知の見出し・navigation・パンくずは実テキストで残し、未取得データだけをSkeletonにする。Skeleton自体は支援技術から隠し、既存の日本語読み込み通知を維持する。

本計画は、2026-08-20にユーザーが推奨案どおりと回答して確定した仕様に基づく。ユーザーは、複数画面、共通UI、Frontend結合、Storybook、VRTへまたがるため計画が必要であることと、保存先 `docs/plans/skeleton-loading.md` を確認し、計画作成を承認済みである。独立レビュー後の計画をユーザーが承認するまでは実装を開始しない。

## 2. 現状調査

### 調査済みの事実

- 計画作成時の `main` は `86dd9e7` で `origin/main` と一致する。関連する未完了PRと既存のSkeleton実装はない。
- 作業は1つの意味的な変更として `main <- feature/skeleton-loading` の1層stackで扱う。
- Next.jsのroute-level `loading.tsx` は次の4件である。
  - `src/app/products/loading.tsx`: `ProductListView status="loading"`
  - `src/app/products/[productId]/loading.tsx`: `ProductDetailView status="loading"`
  - `src/app/orders/loading.tsx`: `OrderHistoryView status="loading"`
  - `src/app/orders/[orderId]/loading.tsx`: `OrderDetailLoadingView`
- Client側の初回auth/query待機は、`CartPage`、`AdminProductsPage`、`AdminProductEditPage`、`AdminOrdersPage` にある。現在は中央寄せのstatus textを使うか、`AdminOrderTable status="loading"` へ渡している。
- headerの`SessionControls`、商品詳細の`ProductCartAction`は狭い範囲の認証確認を表示する。カート・クーポン・注文・管理更新・ログインのmutation中は、確定済み内容を維持しながら `aria-busy`、disabled、文言で通知する。
- 共通UIは `src/components`、機能固有の表示構成は `src/features/<feature>` に置く規約である。Skeleton library、class結合library、shimmer実装はなく、Tailwind v4の `animate-pulse` と既存色tokenだけで実装できる。
- `src/app/globals.css` は `prefers-reduced-motion: reduce` でanimationを抑止する。Skeleton側でも `motion-reduce:animate-none` を指定できる。
- `.page-wrap` は左右余白をmobile 16px、tablet 24px、desktop 32px、最大幅1664pxに固定する。
- Storybookを実際に375pxと1440pxで表示して計測した結果は次のとおりである。
  - 商品一覧は375pxで2列・各画像165.5×220.66px、1440pxで4列・各画像329×438.66px。既存の `aspect-[3/4]` と `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` を再利用すれば一致する。
  - 商品詳細は375pxで343×457.33pxの3:4画像の下に情報を積み、1440pxで880×1173.33pxの画像と440pxの情報列を2:1で並べる。
  - 注文履歴カードは375pxで343×303px、1440pxで1376×207pxとなり、`sm` 境界で縦積みから左右配置へ変わる。
  - 注文詳細、カート、管理商品編集は既存の `minmax(0,1fr) 22rem` の2列をdesktopで使う。
- VRTの固定viewportは、商品一覧が375/768/1440、商品詳細・カート・注文履歴が375/1440、管理商品フォーム・管理注文表が768/1440、管理商品一覧が375/1440である。
- 既存のloading Story/VRTは商品一覧と注文履歴にある。商品詳細、注文詳細、カート初回読み込み、管理商品一覧・編集の初回読み込みには専用Story/VRTがない。管理注文表はLoading StoryがあるがVRT対象外である。
- Frontend結合では `PRODUCT-003`、`PRODUCT-012`、`ORDER-011`、`ADMIN-011` と管理商品一覧取得中のstatus通知を確認している。注文詳細、カート初回読み込み、管理商品編集初回読み込みの明示的なloading検証はない。
- VRT baselineは `mcr.microsoft.com/playwright:v1.61.1-noble` の固定Linux環境だけで更新し、macOSで生成した画像は正本にしない。

### 承認済みの仕様

- 共通化は `src/components` の `<Skeleton className="..." />` に限定し、画面配置・個数・responsive構成は各featureが所有する。
- 4つのroute loadingと、カート・管理商品一覧・管理商品編集・管理注文一覧の初回auth/query待機に適用する。
- header内の認証確認、商品詳細の購入操作内の認証確認、mutation中の更新・送信表示はSkeletonへ変更しない。
- 見出し、カテゴリnavigation、汎用パンくずなど取得前に確定している情報は実テキストで残し、商品名、画像、件数、注文行など未確定データだけをSkeletonにする。
- Skeletonは控えめなopacity pulseとし、横方向のshimmerは使わない。reduced motionでは静止する。
- Skeleton shapeは `aria-hidden="true"`、視覚的な読み込みsectionは `aria-busy="true"`、既存の日本語文言はbusy sectionの兄弟に置く `role="status" aria-live="polite"` のscreen-reader-only textとして1回だけ通知する。

## 3. 解決する問題

1. 初回読み込み表示と完了後レイアウトの高さ・幅・列数が一致せず、大きなlayout shiftが発生する。
2. 商品一覧、詳細、注文、カート、管理画面が同じ読み込み概念を別々の中央テキストで表現している。
3. 初回読み込みとmutation中の表示責任が明示されておらず、Skeleton適用範囲を誤ると確定済み内容や操作feedbackを隠してしまう。
4. Skeletonの装飾をそのまま読み上げると、支援技術に無意味な要素が増える。
5. 商品詳細、注文詳細、カート、管理画面のloading layoutに決定的なStory/VRTがなく、responsive差分を追跡できない。

## 4. 採用する方針

### 共通Skeleton primitive

- `src/components/skeleton/Skeleton.tsx` に、`className` を受け取るだけの小さな表示componentを追加する。
- base classは `animate-pulse bg-line motion-reduce:animate-none` とし、角丸、shimmer、variant、幅・高さ用props、class結合helperは追加しない。幅・高さは呼び出し側のTailwind classで指定する。
- primitive自身へ `aria-hidden="true"` を付ける。読み込み文言や `role="status"` は画面単位で異なるためprimitiveへ持たせない。
- 新しい依存packageやglobal CSS keyframesは追加しない。

### 商品画面

- `ProductListView status="loading"` はパンくず、カテゴリnavigation、`CATALOG`、`ALL ITEMS`、説明を維持し、動的な件数だけをSkeletonにする。
- 商品gridは成功時と同じ列数・gapを使い、既存Default Storyと同じ4件のplaceholderを表示する。各placeholderは3:4画像、商品名2行相当、価格の短い行で構成し、375pxでは2行、1440pxでは1行のgrid占有高を成功Storyと一致させる。
- `ProductDetailView status="loading"` はホームと `ALL ITEMS` のパンくず、`PRODUCT`、`商品説明` を実テキストで維持し、成功時と同じ3:4画像と5:6 responsive gridを使う。動的な商品名・価格・在庫・説明本文・購入操作・カテゴリ戻り導線だけをSkeletonにする。

### 注文画面

- `OrderHistoryView status="loading"` は `ORDER HISTORY` と `注文履歴`、カード内の `注文番号` を実テキストで維持し、既存Default Storyと同じ1件の注文カードplaceholderを表示する。mobileは情報を縦積み、`sm` 以上は注文情報と状態・合計を左右へ分け、375/1440の成功Storyと占有高を比較する。
- `OrderDetailLoadingView` は `ORDER DETAIL`、`注文詳細`、`注文番号`、`確定内容`、`状態`、`商品小計`、`合計`、`注文履歴を見る` を実テキスト・実在linkとして表示する。成功fixtureと同じ2明細行＋22rem summaryを使い、注文ID・日付・商品名・単価・数量・金額・状態値だけをSkeletonにする。取得前の送信操作は作らない。
- `[orderId]/loading.tsx` が子segmentの注文完了にも適用されうるが、取得前にdetail/completeを判別するための別APIやpropは追加しない。両画面で共有する注文内容の形だけを示す。

### カート

- `CartView.tsx` に表示専用の `CartLoadingView({ statusMessage })` を追加し、`CartPage` のsession loadingには `認証状態を確認しています。しばらくお待ちください。`、cart query pendingには `カートを読み込んでいます。しばらくお待ちください。` を渡す。
- `SHOPPING CART`、`カート`、`合計`、`クーポンコード`、`商品小計`、`合計` を実テキストで維持し、成功時と同じ明細列＋22rem summaryを使う。既存Default Storyと同じ明細2件を、mobileでは3:4画像の縦積み、`sm` 以上では128px画像＋情報の2列で表示する。
- summaryはcoupon input、動的金額、注文buttonに相当する非操作のSkeletonを置く。取得前にform controlやbuttonは作らない。
- API error、未認証、role不一致、mutation中は既存のStatusPage・CartView feedbackを維持する。

### 管理画面

- `AdminProductLoadingViews.tsx` に、`statusMessage` を受け取る商品管理一覧用 `AdminProductsLoadingView` と商品編集用 `AdminProductEditLoadingView` を置く。同じfeature内へまとめるが、variant propを持つ汎用ページgeneratorにはしない。
- `AdminProductsLoadingView` は `ADMINISTRATION`、`商品管理`、説明、`商品一覧`、`新しい商品`、フォームの固定field labelを維持し、成功時と同じ `xl` の一覧＋22〜32rem作成フォームを使う。既存AdminProductList Default Storyと同じ一覧2行は80pxの3:4画像とmetadata・button shape、右列はカテゴリ・商品名・商品説明（min-height 8rem）・価格/在庫2列・画像パス・公開checkbox・submitの全field shapeにする。
- `AdminProductEditLoadingView` は商品管理への戻り導線、`ADMINISTRATION`、`商品情報と公開状態`、`在庫`、各固定field labelを維持し、動的な商品名・versionだけをSkeletonにする。成功時と同じmetadata form＋22rem在庫formを使い、metadata側はカテゴリ・商品名・商品説明（min-height 8rem）・価格・画像パス・公開checkbox・submit、在庫側は在庫数・説明・submitのshapeを置く。
- `AdminProductsPage` と `AdminProductEditPage` のsession loadingには `認証状態を確認しています。しばらくお待ちください。`、query pendingには `商品を読み込んでいます。しばらくお待ちください。` を渡す。error、未認証、role不一致、not-found、mutation中は既存表示を維持する。
- `AdminOrderTable status="loading"` は `statusMessage` を受け、`注文`、`状態`、`合計`、`状態を更新` の実table headerと、既存Default Storyと同じ1行のtable body shapeを成功時と同じ `min-w-[48rem]` で表示する。`AdminOrdersPage` のsession loadingには認証確認文言、query pendingには注文一覧取得文言を渡す。

### アクセシビリティと決定性

- 各loading viewはfragmentで返し、先頭に `role="status" aria-live="polite"` のsr-only文言、兄弟に視覚的Skeletonを含む `<section aria-busy="true">` を置く。busy region内へlive regionを入れない。
- 各画面にstatus regionを1つだけ置き、呼び出し元がauth/queryに対応する現在の日本語通知全文を渡す。Skeletonの個数分statusを増やさない。
- Skeletonにはfocus可能要素、実在しないリンク、button、見出しを作らない。取得前に確定している実在navigationだけを操作可能なまま残す。
- VRTは既存のreduced motion・animation disabled設定を利用し、無期限pending requestや現在時刻・乱数へ依存しない表示componentを直接Storyで描画する。

### 文書とテスト境界

- `DESIGN.md` にSkeletonの色、動き、既知情報の維持、読み上げ、実画面寸法の再利用方針を追加する。
- `docs/TEST_SCENARIOS.md` の `PRODUCT-003`、`PRODUCT-012`、`ORDER-011`、`ADMIN-011` を新表示へ更新する。`ORDER-015`（注文詳細route loading）、`AUTH-014`（保護画面のauth待機）、`CART-019`（cart query待機）、`ADMIN-016`（管理商品一覧・編集query待機）、`VRT-011`（注文詳細loading）、`VRT-012`（管理商品loading views）を追加する。DB・API・ビジネスルールは変わらないためPRODUCTとARCHITECTUREは変更しない。
- 読み込み通知・既知見出し・操作可能要素の有無はFrontend結合、layout・responsive・Skeleton形状はStorybook/VRTを主担当にする。E2Eで一時的なloading timingを固定しない。

## 5. 採用しない方針

- すべての画面をpropsで生成する `SkeletonPage`、schema、JSON設定、factoryを作らない。
- Skeleton用のUI library、class結合library、icon packageを追加しない。
- shimmer、gradient animation、canvas、JavaScript timerを使わない。
- 実データ件数や文字列長を推測してSkeletonへ埋め込まない。表示数はviewport内の構造を示す固定fixtureとする。
- Skeletonへ読み上げ名、role、focus、クリック操作を持たせない。
- header内の認証確認、商品詳細の購入操作内の認証確認、再取得・更新・送信・競合中の既存内容をSkeletonへ置き換えない。
- API contract、TanStack Query設定、retry、DB schema、migration、seed、server use caseを変更しない。
- loadingを観測するための固定sleep、テスト専用HTTP API、本番componentのStory専用propを追加しない。
- 無関係なVRT baselineや許容pixel差を更新しない。

## 6. 変更対象

### 共通UI

- `src/components/skeleton/Skeleton.tsx`: aria-hidden、pulse、reduced-motionを持つ最小primitiveを追加する。

### 商品

- `src/features/products/ProductListView.tsx`: 成功時と同じgrid寸法の4件Skeletonへloading branchを変更する。
- `src/features/products/ProductDetailView.tsx`: 成功時と同じresponsive gridのdetail Skeletonへ変更する。
- `src/features/products/ProductListView.stories.tsx`: 既存Loading storyを新表示へ追従する。
- `src/features/products/ProductDetailView.stories.tsx`: `features-products-productdetail--loading` Storyを追加する。
- `src/features/products/ProductViews.frontend.test.tsx`: status通知、既知見出し・navigation、Skeleton側に操作要素がないことを検証する。
- `tests/vrt/products.vrt.spec.ts` と対象baseline: `VRT-002-product-list-loading-{375|768|1440}` を更新し、`VRT-003-product-detail-loading-{375|1440}` を追加する。

### 注文

- `src/features/orders/OrderHistoryView.tsx`: 見出しを維持した注文カードSkeletonへ変更する。
- `src/features/orders/OrderDetailLoadingView.tsx`: 明細＋summary Skeletonへ変更する。
- `src/features/orders/OrderHistoryView.stories.tsx`: 既存Loading storyを新表示へ追従する。
- `src/features/orders/OrderDetailLoadingView.stories.tsx`: `features-orders-orderdetailloading--default` Storyを追加する。
- `src/features/orders/Orders.frontend.test.tsx`: 履歴と詳細のstatus通知、既知見出し、操作要素の境界を検証する。
- `tests/vrt/order-history.vrt.spec.ts` と対象baseline: `VRT-006-order-history-loading-{375|1440}` だけを更新する。
- `tests/vrt/order-detail.vrt.spec.ts` と対象baseline: 専用specで `VRT-011-order-detail-loading-{375|1440}` を追加する。

### カート

- `src/features/cart/CartView.tsx`: `CartLoadingView` を追加する。
- `src/features/cart/CartPage.tsx`: session loadingとquery pendingを `CartLoadingView` へ接続する。
- `src/features/cart/CartView.stories.tsx`: `features-cart-cart--loading` Storyを追加する。
- `src/features/cart/CartPage.frontend.test.tsx`: pending APIでstatus通知と静的見出しを確認し、完了後に実カートへ切り替わることを検証する。
- `tests/vrt/cart.vrt.spec.ts` と対象baseline: `VRT-004-cart-loading-{375|1440}` を追加する。

### 管理

- `src/features/admin/AdminProductLoadingViews.tsx`: 管理商品一覧・編集の表示専用loading viewを追加する。
- `src/features/admin/AdminProductLoadingViews.stories.tsx`: `features-admin-adminproductloading--list` と `features-admin-adminproductloading--edit` の固定Storyを追加する。
- `src/features/admin/AdminProductsPage.tsx`: session loadingとquery pendingを一覧loading viewへ接続する。
- `src/features/admin/AdminProductEditPage.tsx`: session loadingとquery pendingを編集loading viewへ接続する。
- `src/features/admin/AdminOrderTable.tsx`: loading branchを実table寸法のSkeletonへ変更する。
- `src/features/admin/AdminOrdersPage.tsx`: session loadingでも静的見出し＋loading tableを表示する。
- `src/features/admin/AdminOrderTable.stories.tsx`: 既存Loading storyを新表示へ追従する。
- `src/features/admin/AdminProductListCreate.frontend.test.tsx`: 一覧loadingのstatusと静的見出しを検証する。
- `src/features/admin/AdminProductEditStock.frontend.test.tsx`: 商品編集初回loadingのstatusと動的操作がないことを検証する。
- `src/features/admin/AdminOrders.frontend.test.tsx`: session/query loadingのstatusと静的見出しを検証する。
- `tests/vrt/admin-products.vrt.spec.ts` と対象baseline: `VRT-012-admin-product-list-loading-{375|1440}` と `VRT-012-admin-product-edit-loading-{768|1440}` を追加する。
- `tests/vrt/admin-orders.vrt.spec.ts` と対象baseline: `VRT-008-admin-order-table-loading-{768|1440}` を追加する。

### 文書

- `DESIGN.md`: Skeleton componentとloading layoutの方針を追加する。
- `docs/TEST_SCENARIOS.md`: `PRODUCT-003`、`PRODUCT-012`、`ORDER-011`、`ADMIN-011`を新表示へ追従し、`ORDER-015`、`AUTH-014`、`CART-019`、`ADMIN-016`、`VRT-011`、`VRT-012`を追加する。既存VRT-002/003/004/006/008へloading対象を反映する。
- `docs/plans/skeleton-loading.md`: 実装中はphase、検証結果、承認証跡を更新する。

## 7. 実装手順

### Layer 1: `feature/skeleton-loading`

**責任:** 共通Skeleton primitiveを使い、すべての初回フルページloadingを実画面と同じ構造へ揃える。

**親:** `main` (`86dd9e7`)。

**変更:**

1. `Skeleton.tsx` を追加し、依存追加なしで共通の色、pulse、reduced-motion、aria-hiddenを定義する。plan fileだけのdocs commitを先に作り、この時点では本番コードを変更しない。
2. ProductList/ProductDetailのloading branchを、成功時と同じnavigation・grid・比率を使うSkeletonへ変更する。既存Frontend結合を更新し、detail Loading storyを追加する。
3. OrderHistory/OrderDetailLoadingViewを、成功時と同じカード・明細・summary構造へ変更する。注文詳細loadingのFrontend結合とStoryを追加する。
4. `CartLoadingView` を追加し、CartPageのsession/query初回待機へ接続する。APIを保留するFrontend結合と固定Storyを追加する。
5. 管理商品一覧・編集のloading viewを追加し、各pageのsession/query初回待機へ接続する。AdminOrderTable loadingを表Skeletonへ変更し、AdminOrdersPageのsession待機も同じ画面構造へ揃える。
6. すべてのloading viewでstatus regionが1つ、busy regionの兄弟であること、`aria-busy`がtrue、Skeletonがaria-hidden、未取得操作が存在しないことをFrontend結合で確認する。Client pageはauth待機とquery待機を別testとして正しい文言を確認する。
7. DESIGNとTEST_SCENARIOSを実装・テスト境界に同期する。
8. 既存loading Storyを更新し、不足するLoading storyを追加する。固定Linux環境で対象VRT baselineだけを更新し、375/768/1440の変更後画像を目視する。
9. lint、typecheck、unit、Frontend結合、build、Storybook build、VRTを実行し、diffとstack状態を確認して目的単位の日本語commitを作成する。

**commitと有効HEAD:**

1. `docs: Skeleton Loadingの実装計画を追加`: 本計画だけを追加する。文書変更だけなのでbuild結果へ影響しない。
2. `feat: 購入画面の初回読込にSkeletonを適用`: 共通primitive、商品・注文・カートのloading、Frontend結合、Story、対象VRT baselineを含める。このHEADでlint、typecheck、unit、Frontend結合、build、Storybook build、対象VRTを成功させる。
3. `feat: 管理画面の初回読込にSkeletonを適用`: 管理商品・管理注文のloading、Frontend結合、Story、対象VRT baseline、DESIGN、TEST_SCENARIOSを含める。このLayer 1最終HEADを唯一のPR review対象HEADとし、全検証を成功させる。

commit 2/3はそれぞれUI、意味テスト、視覚baselineを同じcommitへ含め、baselineが一時的に古いbuild不能・test不能な中間HEADを作らない。

**PR境界:** 共通primitiveだけを未使用で先に提出したり、テスト・baselineだけを別PRへ分離したりしない。1つのreviewer audienceで画面ごとの最終形を比較できるため1PRとする。

**rollback:** このbranch/PRをrevertすれば、各画面は元の中央テキストloadingへ戻る。API、DB、永続データのrollbackは不要である。

## 8. テスト・検証方法

### Loading shape対応表

| View / Story | 成功画面から再利用する構造 | 固定shape | 対象viewportと占有高の基準 |
| --- | --- | --- | --- |
| ProductList Loading | `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`、既存gap、3:4画像 | Default Storyと同じ4商品 | 375では2列×2行、768では3列×2行、1440では4列×1行 |
| ProductDetail Loading | `lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]`、3:4画像 | 画像1、商品名2行、price/stock、48px購入shape、説明本文3行 | 375縦積み、1440で600px画像＋720px情報列 |
| OrderHistory Loading | `space-y-5`、card内 `sm:flex-row` | Default Storyと同じ1注文 | 375で約343×303px、1440で約1376×207pxの成功cardと比較 |
| OrderDetail Loading | `lg:grid-cols-[minmax(0,1fr)_22rem]` | order fixtureと同じ2明細、注文番号/date、summaryの状態＋金額3行 | 375縦積み、1440で22rem summary |
| Cart Loading | `lg:grid-cols-[minmax(0,1fr)_22rem]`、明細 `sm:grid-cols-[8rem_minmax(0,1fr)]` | cart fixtureと同じ2明細、coupon field、金額2行、48px注文shape | 375で3:4画像を縦積み、1440で128px画像＋22rem summary |
| AdminProducts Loading | `xl:grid-cols-[minmax(0,1fr)_minmax(22rem,32rem)]` | AdminProductList Storyと同じ2商品、作成formの全7 field群 | 375縦積み、1440で一覧＋22〜32rem form |
| AdminProductEdit Loading | `lg:grid-cols-[minmax(0,1fr)_22rem]` | metadata 6 field群＋submit、stock field＋説明＋submit | 768は縦積み、1440で22rem stock form |
| AdminOrderTable Loading | overflow container＋`min-w-[48rem]` table | Default Storyと同じ1注文行、4列header | 768/1440とも成功tableと同じ最小幅・scroll境界 |

shape数は実データ件数を示す値ではなく、既存の決定的なsuccess Story fixtureと同じ要素数を使ってloading/successの占有高を比較するためのVRT fixtureである。

### TriggerとFrontend scenario対応表

| Trigger | Scenario | Test / 描画対象 | 期待するstatus全文 |
| --- | --- | --- | --- |
| `/products/loading.tsx` | `PRODUCT-003` | `ProductViews.frontend.test.tsx` でroute componentをrender | `商品を読み込んでいます…` |
| `/products/[productId]/loading.tsx` | `PRODUCT-012` | `ProductViews.frontend.test.tsx` でroute componentをrender | `商品を読み込んでいます…` |
| `/orders/loading.tsx` | `ORDER-011` | `Orders.frontend.test.tsx` でroute componentをrender | `注文履歴を読み込んでいます。しばらくお待ちください。` |
| `/orders/[orderId]/loading.tsx` | `ORDER-015` | `Orders.frontend.test.tsx` でroute componentをrender | `注文詳細を読み込んでいます。しばらくお待ちください。` |
| Cart session loading | `AUTH-014` | `CartPage.frontend.test.tsx` に `{ status: 'loading' }` を渡す | `認証状態を確認しています。しばらくお待ちください。` |
| Cart query pending | `CART-019` | `CartPage.frontend.test.tsx` でMSW responseを保留 | `カートを読み込んでいます。しばらくお待ちください。` |
| AdminProducts session loading | `AUTH-014` | `AdminProductListCreate.frontend.test.tsx` にloading sessionを渡す | `認証状態を確認しています。しばらくお待ちください。` |
| AdminProducts query pending | `ADMIN-016` | 同testでMSW responseを保留 | `商品を読み込んでいます。しばらくお待ちください。` |
| AdminProductEdit session loading | `AUTH-014` | `AdminProductEditStock.frontend.test.tsx` にloading sessionを渡す | `認証状態を確認しています。しばらくお待ちください。` |
| AdminProductEdit query pending | `ADMIN-016` | 同testでMSW responseを保留 | `商品を読み込んでいます。しばらくお待ちください。` |
| AdminOrders session loading | `AUTH-014` | `AdminOrders.frontend.test.tsx` にloading sessionを渡す | `認証状態を確認しています。しばらくお待ちください。` |
| AdminOrders query pending | `ADMIN-011` | 同testでMSW responseを保留 | `注文一覧を読み込んでいます。しばらくお待ちください。` |

各testはstatusが1つだけであること、busy regionの子ではないこと、静的見出しが存在すること、未取得の操作要素が存在しないことを検証する。query pending testは保留解除後のsuccess表示まで確認する。

### 自動検証

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:frontend`
- `pnpm build`
- `pnpm build-storybook`
- 固定Linux環境の `pnpm test:vrt:update`
- baseline更新後、同じ固定Linux環境の `pnpm test:vrt`

VRT baseline更新はREADMEの固定コマンドを使う。

```bash
docker run --rm --ipc=host \
  -e HOST_UID="$(id -u)" \
  -e HOST_GID="$(id -g)" \
  -v "$PWD:/work" \
  -v mockshop-vrt-node-modules:/work/node_modules \
  -w /work \
  mcr.microsoft.com/playwright:v1.61.1-noble \
  bash -lc 'corepack pnpm install --frozen-lockfile && corepack pnpm test:vrt:update; vrt_status=$?; chown -R "$HOST_UID:$HOST_GID" /work/tests/vrt/__screenshots__ /work/storybook-static /work/test-results 2>/dev/null || true; exit $vrt_status'
```

### Frontend結合の確認観点

- `role="status" aria-live="polite"` が各loading画面に1つだけ存在し、既存の日本語通知を含む。
- 最上位sectionが `aria-busy="true"` を持つ。
- 既知の画面見出し・navigationは表示され、未取得データに対応するlink、button、form controlは存在しない。
- 保留解除後は成功画面へ切り替わる。
- error、未認証、role不一致、mutation中の既存テストは変わらず成功する。

### VRT・目視確認

- 375px: 商品一覧2列、商品詳細縦積み、注文履歴カード縦積み、注文詳細・カート縦積み、管理商品一覧の横overflowなし。
- 768px: 商品一覧3列、管理商品編集、管理注文表の意図した横overflow container。
- 1440px: 商品一覧4列、商品詳細2:1、注文詳細・カート・管理商品編集の22rem aside、管理商品一覧の22〜32rem form列。
- pulseを無効化したVRT画像が毎回一致し、reduced motionではSkeletonが静止する。
- Before/Afterまたは変更後画像はPRのScreenshotsへ添付する。

### 実行しない検証

- DB・API contract・server use caseを変更しないため、backend結合とmigration確認はローカル必須対象にしない。
- loading timingを固定するE2Eは追加しない。既存E2EがCIの影響選択で実行された場合は結果をPRへ記録する。

## 9. リスク

- Skeletonの固定行数が実データ件数を示すように誤解される可能性がある。件数textを実値として表示せず、shapeをaria-hiddenにして回避する。
- successとloadingで別々にgrid classを記述すると将来ずれる可能性がある。既存class列をそのまま再利用し、VRTでviewportごとの差を固定する。汎用layout abstractionは今回追加しない。
- status regionをSkeletonごとに置くと読み上げが冗長になり、busy region内では通知が解除まで保留される可能性がある。画面単位で1つに限定し、busy regionの兄弟であることをFrontend結合で確認する。
- `animate-pulse` がVRT差分を不安定にする可能性がある。既存のreduced motion・animation disabled設定と `motion-reduce:animate-none` を併用し、固定Linux環境で連続実行する。
- 管理注文表はmobile幅より広い。成功時と同じoverflow containerと `min-w-[48rem]` を維持し、表だけを縮めて誤った完成形を示さない。
- VRT追加によりbaseline数とPR差分が増える。loadingに関係するstoryだけを追加・更新し、無関係な画像差分をstageしない。

## 10. 未確定事項

- なし。共通化単位、適用範囲、既知情報、animation、読み上げ方針はユーザー承認済みである。
- 独立計画レビューの指摘は本書へ反映済みである。実装開始についてユーザー承認を得る。

## 11. 完了条件

- `Skeleton` primitiveが追加依存なしで実装され、画面形状やデータ知識を持たない。
- 4つのroute loadingと、カート・管理商品一覧・管理商品編集・管理注文一覧の初回auth/query待機が実画面構造のSkeletonを表示する。
- header内・購入操作内の小さな認証確認とmutation中表示は従来どおり確定済み内容を維持する。
- 既知の見出し・label・navigationが表示され、Skeletonはaria-hidden、視覚領域はaria-busy、読み込み文言はbusy領域の兄弟にある1つのpolite statusで通知される。
- 375/768/1440の対象Story/VRTが、実画面の列数、3:4画像、22rem aside、48rem tableを維持する。
- DESIGN、TEST_SCENARIOS、Frontend結合、Storybook、VRT baselineが実装と一致する。
- lint、typecheck、unit、Frontend結合、build、Storybook build、固定Linux VRTが成功する。
- diffにAPI、DB、migration、新規dependency、無関係なbaselineが含まれない。
- 独立最終監査で全受入条件と非目標が `PASS` になり、draft PRのCI・review・Reviewer Guideが現在のheadと一致する。

## 12. 独立計画レビュー

別エージェントが確定仕様、repository規約、本計画、対象コード・test・VRTを読み取り専用でレビューした。判定は「要修正」で、次の1回の `Plan -> Critique -> Patch -> Final verification` で処理した。

| 指摘 | disposition | 反映内容 |
| --- | --- | --- |
| busy region内のlive statusは通知を保留しうる | 受け入れ | statusをbusy sectionの兄弟へ置くDOM構造とFrontend assertionを追加 |
| auth/queryで既存通知文言が異なる | 受け入れ | loading viewへ限定的な `statusMessage` を渡し、12 triggerを個別testする表を追加 |
| 既知情報をSkeleton化する箇所が残る | 受け入れ | 画面ごとの固定見出し・label・navigationを列挙し、未取得値・操作だけをshape化 |
| 全対象の寸法・shape数が未確定 | 受け入れ | success Story fixtureと再利用classに基づく8 viewのshape対応表を追加し、4/1/2/2/1件へ固定 |
| scenario/VRT ID・spec責務が未確定 | 受け入れ | `ORDER-015`、`AUTH-014`、`CART-019`、`ADMIN-016`、`VRT-011`、`VRT-012`、story/baseline名を採番し、注文詳細専用VRT specへ分離 |
| 有効な中間HEADが最終状態の言い換え | 受け入れ | plan/storefront/adminの3commitと各検証、最終HEADだけがPR review対象であることを明記 |

拒否した指摘はない。1PR境界、最小primitive、mutation/API/DB/E2Eを非目標にする境界、reduced-motionと固定Linux VRT、1PR revert方針は妥当と確認された。

## 13. 独立最終監査

Draft PR #34のhead `793d741` を固定して別エージェントが最終監査し、3件の指摘を受け入れた。

| 指摘 | disposition | 反映内容 |
| --- | --- | --- |
| カートloadingで既知の「クーポン」見出しと「買い物を続ける」導線が欠ける | 受け入れ | 固定見出しと実リンクを追加し、AUTH-014/CART-019のassertionと375/1440 baselineを更新 |
| Ship状態がPR作成前のまま | 受け入れ | phaseとstackをstabilization・Draft PR #34へ更新 |
| 商品一覧shapeの計画に、成功画面にない在庫状態行が残る | 受け入れ | 実装と成功画面に合わせて商品名・価格の行へ訂正 |

修正後のPR head、CI、完了条件、非目標について再監査する。

## Ship状態

```text
Phase: stabilization
Task class: medium
Spec: 2026-08-20の会話でQ1〜Q5を推奨どおり承認
Plan: docs/plans/skeleton-loading.md
Stack: main <- feature/skeleton-loading（1層、Draft PR #34）
Verification: lint、typecheck、unit 99件、Frontend結合112件、build、Storybook buildが成功。固定LinuxでVRT baseline更新後に95件を再実行して成功
Requested milestone: human-review-ready
Evidence: origin/main 86dd9e7、計画作成承認、375/768/1440のVRT画像目視、独立計画レビュー、全ローカル検証成功、独立最終監査を実施中
Blockers: なし（2026-08-20にユーザーが実装開始を承認）
```
