# Coding Guidelines適用リファクタリング計画

## 1. 背景と目的

外部の `coding-guidelines` Skillは、Server Component優先、propsで制御できる表示状態、`useEffect`の限定利用、イベント処理からの判断ロジック分離、コンポーネント周辺への関数配置、利用者が区別できるStorybook storyを重視している。

本リポジトリは、Server Componentとserver-only facade、TanStack QueryとJSON API、表示コンポーネントと通信コンテナ、テストレベル別の責任分担をすでに実装している。Skillの規則を機械的に全ファイルへ適用すると、リポジトリ固有のアーキテクチャと衝突する変更や、挙動を変えない大量の書式差分が生じる。

本リファクタリングでは、現在の仕様、API、DB、画面表示を維持したまま、効果が確認できる次の3点へ対象を限定する。

- props変更に追従するための内部state同期を、Reactの `key` による明示的なライフサイクル境界へ置き換える。
- 注文確定の非同期処理に埋め込まれた表示判断を、引数と戻り値だけで検証できる純粋関数へ分離する。
- Storybookの表示名を日本語化し、条件分岐ごとの画面状態を一覧から判別できるようにする。

計画承認後も各変更を目的別に分けて実装する。計画作成時点では、アプリケーションコード、テスト、Storybook storyを変更しない。

## 2. 現状調査

### 調査済みの事実

- 計画作成前の作業ブランチは `feature/add-ship-skill`、作業ツリーはcleanである。
- `pnpm lint`、`pnpm typecheck`、`pnpm test:unit`（12 files / 77 tests）、`pnpm test:frontend`（13 files / 89 tests）は成功している。
- 商品一覧・詳細、注文履歴・詳細・完了、Root Layoutの初期session取得は、Server Componentから機能別のserver-only facadeを直接呼んでいる。Server Componentから自分自身のRoute HandlerをHTTP fetchしていない。
- ブラウザの `fetch` は `src/lib/api-client/request-json.ts` に集約され、API通信を開始する `useEffect` は存在しない。
- `CartView`、`AdminProductForm`、`AdminOrderTable`、`ProductListView`、`ProductDetailView`、`OrderHistoryView` は、正常、空、ローディング、エラー、競合などの表示状態をpropsまたは明示的な状態値で制御できる。
- `useEffect` は認証状態とQuery errorの同期、AbortControllerやtimerのcleanup、利用者変更時の処理破棄などに使われている。これらを一律に削除できない。
- `src/features/admin/AdminProductEditPage.tsx` は447行で、取得した商品からフォームstateを初期化するために `initializedProductRef` と `useEffect` を使用している。このEffectは外部systemとの同期ではなく、props由来データを内部stateへ初回転記する責務を持つ。
- `src/features/cart/CartPage.tsx` は395行で、`currentCustomerRef` とEffectを使って利用者変更時にcheckout処理をabortし、複数のstateを初期値へ戻している。
- `CartCheckout.frontend.test.tsx` には、checkout中の利用者変更、unmount、遅延response、409後の再取得、401、network errorを扱う回帰テストがある。
- `AdminProductEditStock.frontend.test.tsx` には、入力保持、409時の最新値確認、古いGETによるcache巻き戻し防止の回帰テストがある。
- `CartPage` の `handleCheckout` と `refreshCartAfterCheckoutError` は、API errorの種類から、session失効、カート再取得、注文結果不明、通常errorの表示状態を決める分岐を非同期処理内に持つ。
- Storybook storyは条件分岐と `VRT-001`〜`VRT-008` の状態を概ね網羅しているが、story export名が `Default`、`Empty`、`Loading`、`Conflict` などの英語であり、明示的な日本語の表示名は設定されていない。
- Storyの `title`、`parameters`、`decorators` は、自動生成されるstory ID、VRT用layout、provider注入に利用されている。単純に `component` だけのMetaへ縮小できない。
- テストにはnested `describe` とsnapshot依存がなく、利用者が観測できるrole、label、text、focus、request回数、競合後の状態を検証している。
- 既存の管理画面非同期競合制御は `useAdminRequestCoordinator` へ集約済みであり、カートと管理商品のFrontendテストも責務別ファイルへ分割済みである。今回それらを再設計しない。

### Skillとリポジトリ規約の優先関係

- リポジトリの `AGENTS.md`、`docs/ARCHITECTURE.md`、`docs/TEST_STRATEGY.md`、`docs/TEST_SCENARIOS.md` を優先する。
- Skillの「Server ComponentはgatewayからHTTP fetchする」という例は採用しない。本リポジトリでは、Server Componentはserver-only facadeからuse caseを直接呼び、自身のRoute HandlerをHTTP経由で呼ばないことが明示されているためである。
- Skillの `.then().catch()` 優先は一律適用しない。既存の `async/await` はtransaction、abort、revision確認、`finally` cleanupの順序を明示しており、書き換えても責務やテスト容易性が改善しないためである。
- Skillの「1 test 1 assertion」「すべてactual/expected変数を使う」「Metaはcomponentだけ」という書式は一括適用しない。既存テストは1つの利用者行動に対する複数の観測結果を契約としており、Storybook MetaにはVRTで必要な設定があるためである。
- Skillの「すべての条件分岐を別関数・別コンポーネントへ抽出する」は、非同期処理から独立して判断できる複雑な分岐だけへ適用する。単純なguardや1回しか使わない表示分岐は、その場に残す方が追跡範囲が小さい。

## 3. 解決する問題

### 商品編集フォームの初期化Effect

- `AdminProductEditPage` は、取得完了後に `product` をフォームstateへ転記するため、Effectと初期化済みIDのrefを必要としている。
- データ取得・認可・not-found表示と、編集draft・validation・mutation・競合回復が同じコンポーネントにあり、どのstateが商品IDの変更で破棄され、どのstateがQuery更新後も保持されるかをEffectの条件から読み取る必要がある。
- 409後やmutation成功後は入力保持が必要なため、商品versionをkeyにするとdraftを意図せず破棄する。商品IDだけをライフサイクル境界にする必要がある。

### カート利用者変更時の手動reset

- `CartPage` はsession gateとcustomer固有のQuery・checkout処理を同じコンポーネントで持ち、customer ID変更をEffectで検知して5つのstate/refを手動resetしている。
- reset対象を追加したときにEffectへの追加を忘れると、別利用者へ前の利用者のfeedbackやpending状態が残る可能性がある。
- customer固有部分を `key={customerId}` の子コンポーネントへ分ければ、Reactのunmount cleanupとstate初期化をライフサイクル境界として利用できる。

### 注文確定の判断と副作用の混在

- checkout error codeから利用者向けfeedbackを決める処理と、Query再取得、session更新、router遷移、state更新が同じasync handlerにある。
- `CHECKOUT_CHANGED`、`STOCK_CONFLICT`、`EMPTY_CART` はいずれも再取得を要求するが、表示文言が異なる。network errorとschema不正responseは、注文結果不明として再送前の確認を要求する。
- 現在のFrontend結合テストは最終挙動を保証しているが、error分類を変更するときに非同期setup全体を読む必要がある。

### Storybook上の状態識別

- storyの状態網羅は十分だが、サイドバー上の表示名が英語で、UI・状態・エラーを日本語で説明するプロジェクト方針と一致していない。
- export名やstory IDを変更するとVRTの参照先へ影響するため、IDを維持したまま表示名だけを日本語化する必要がある。

## 4. 採用する方針

### 4.1 商品IDを編集draftのライフサイクル境界にする

- `AdminProductEditPage` は、session、Query、商品選択、loading/error/not-foundを扱うコンテナとして残す。
- 同じファイルに非exportの編集コンポーネントを置き、取得済み `product`、query key、Query cache更新に必要な値を受け取る。
- `useAdminRequestCoordinator` は外側で1回だけ生成し、Query guardと子のmutationで同じinstanceを共有する。商品IDによる子の再mountでQuery世代・revision管理を分断しない。
- coordinatorの実行中状態はReact stateとして公開し、商品ID切替で編集コンポーネントのローカル `pending` が初期化されても、新しい商品のフォームを旧mutation完了まで無効化する。
- コンテナは編集コンポーネントを `key={product.id}` で描画する。別商品IDへ変わった場合だけ子を再mountし、フォームdraft、field error、pending、conflict、status messageを初期化する。
- 編集コンポーネントは `useState(() => valuesFromProduct(product))` で初期値を作り、`initializedProductRef` と商品初期化Effectを削除する。
- keyへ `product.version` を含めない。Query再取得、mutation成功、409回復でversionが変わっても、入力中draftを自動破棄しないためである。
- 既存の `useAdminRequestCoordinator`、409後の最新値取得、明示的な「最新値を反映」、cache更新順序は変更しない。

### 4.2 customer IDをカート処理のライフサイクル境界にする

- `CartPage` はsessionのloading/error/anonymous/role判定だけを担当する。
- customerとして認証済みの場合、同じファイルの非exportコンポーネントへ処理を委譲し、`key={sessionState.user.id}` と `customerId` を渡す。
- 子コンポーネントへ、cart Query、cart operation、checkout mutation、feedback、AbortController、router遷移を移す。
- customer変更時は旧子コンポーネントのcleanupでcheckout requestをabortし、新しい子コンポーネントのstate初期値とcustomer固有query keyを使用する。
- `currentCustomerRef`、`currentCustomerRef` とcustomer IDを比較する条件、customer変更Effectによる手動resetを削除する。
- unmount後の遅延responseからstateを更新しないためのmounted判定と、AbortController cleanupのEffectは外部非同期処理との同期として維持する。
- `CartOperationProvider` のqueue、session generation、古いresponse防止は変更しない。今回の責務はcheckout画面stateのライフサイクルに限定する。

### 4.3 注文確定errorの判断を純粋関数へ分離する

- `src/features/cart/cartCheckoutFeedback.ts` を `CartPage.tsx` と同じ階層へ追加する。
- API errorまたは未知errorを受け、次に実行するactionと表示feedbackを返す関数を定義する。
  - 401: sessionをanonymousへ更新するaction。
  - `CHECKOUT_CHANGED`、`STOCK_CONFLICT`、`EMPTY_CART`: 原因別文言と、最新cartを再取得するaction。
  - network error、成功responseのschema不正: 注文結果を確認できないfeedbackと、利用者の再確認を要求するaction。
  - その他のAPI error・未知error: 再試行可能な通常error feedbackを表示するaction。
- cart再取得結果と現在のfeedbackから、`confirmationRequired`、`errorMessage`、`message`、`refreshFailed` の次状態を返す純粋関数も同ファイルへ置く。
- 純粋関数はrouter、QueryClient、React state、AbortControllerを参照しない。async handlerは戻り値のactionに従って既存副作用だけを実行する。
- `src/features/cart/cartCheckoutFeedback.unit.test.ts` を追加し、分類の各branchと再取得成功・失敗の状態遷移を入力と出力で検証する。
- 既存Frontend結合テストは、実コンポーネント、TanStack Query、API client、MSWを通した最終挙動の保証として維持する。単体テストへ置換しない。

### 4.4 Story IDを維持して表示名を日本語化する

- 各Story objectの `name` に、画面上の差分が分かる日本語名を設定する。例は「通常」「商品なし」「読み込み中」「取得エラー」「在庫切れ」「長い商品名」「更新中」「競合」である。
- export名は変更しない。VRTが使用するstory IDと `tests/vrt/*.vrt.spec.ts` の参照先を維持するためである。
- `title`、`parameters`、`decorators`、provider、fixture、event handlerは維持する。
- Buttonのvariant storyは削除しない。今回の目的は表示名と既存状態の対応を明確にすることであり、story catalogの削減を混ぜない。
- storyの追加・削除、VRT対象状態・viewport、基準画像は変更しない。

## 5. 採用しない方針

- `entities/` と `gateways/` を新設しない。`src/contracts`、`src/lib/api-client`、feature use case、server-only facadeという既存境界を維持する。
- Server ComponentからRoute HandlerをHTTP fetchしない。
- `use client` をファイル数の削減だけを目的に外さない。interaction、TanStack Query、form、Error Boundaryに必要なClient Componentは維持する。
- 認証error同期、timer cleanup、AbortController cleanupなど、外部非同期処理との同期に必要なEffectを削除しない。
- `CartOperationProvider` のqueueを汎用class、reducer、state machine、外部packageへ置き換えない。
- `useAdminRequestCoordinator` をadmin以外へ拡張しない。admin mutationのrevision制御とcart operation queueは責務が異なる。
- 単純なguard、短いJSX条件、1箇所だけで使う文字列まで別ファイルへ抽出しない。
- 全テストへAAAコメント、`actual` / `expected` 変数、1 assertion制約を機械的に追加しない。
- test file名をSkill例の `.test.tsx` へ変更しない。`.unit.test`、`.frontend.test`、`tests/backend`、`tests/e2e`、`tests/vrt` がテスト境界のsource of truthである。
- story Metaを `component` だけへ縮小しない。
- 新しい依存、API、DB schema、migration、business rule、利用者向け画面文言、CSSを追加・変更しない。

## 6. 変更対象

### 商品編集state境界

- `src/features/admin/AdminProductEditPage.tsx`
  - session・Query・not-foundのコンテナと、商品ID単位の編集コンポーネントへ責務を分ける。
  - `initializedProductRef` と商品初期化Effectを削除する。
  - mutation、cache、409、入力保持、focus、表示は維持する。
- `src/features/admin/AdminProductEditStock.frontend.test.tsx`
  - 既存ケースを回帰確認へ使う。
  - 商品ID変更時のdraft初期化が既存ケースで観測できない場合だけ、同一treeで別product IDへ切り替える最小ケースを追加する。
- `src/features/admin/use-admin-request-coordinator.ts`
  - refによる同期的な多重送信guardを維持しつつ、実行中状態を表示へ反映できる読み取り専用stateを返す。

### カートstate境界と判断ロジック

- `src/features/cart/CartPage.tsx`
  - session gateとcustomer固有checkoutコンポーネントへ分ける。
  - customer変更Effectと `currentCustomerRef` を削除する。
  - checkout error処理を純粋関数のaction実行へ置き換える。
- `src/features/cart/cartCheckoutFeedback.ts`
  - checkout error分類と再取得後feedback更新を純粋関数として追加する。
- `src/features/cart/cartCheckoutFeedback.unit.test.ts`
  - error分類とfeedback遷移のbranchを検証する。
- `src/features/cart/CartCheckout.frontend.test.tsx`
  - 既存のORDER-002/003/006/007/013/014、401、network error、利用者変更、unmountのケースを維持する。
  - pure function追加だけを理由に同じ条件のFrontendテストを増やさない。
- `src/features/cart/CartPage.frontend.test.tsx`
  - customer専用表示、再試行、明細操作がsession gate分割後も維持されることを既存ケースで確認する。

### Storybook表示名

- `src/components/button/Button.stories.tsx`
- `src/features/auth/LoginForm.stories.tsx`
- `src/features/home/components/ProductPreviewCard.stories.tsx`
- `src/features/products/ProductCard.stories.tsx`
- `src/features/products/ProductListView.stories.tsx`
- `src/features/products/ProductDetailView.stories.tsx`
- `src/features/cart/CartView.stories.tsx`
- `src/features/coupons/CouponForm.stories.tsx`
- `src/features/orders/OrderHistoryView.stories.tsx`
- `src/features/admin/AdminProductForm.stories.tsx`
- `src/features/admin/AdminOrderTable.stories.tsx`

各storyへ表示用 `name` だけを追加し、export名、args、fixture、Meta設定を維持する。

### Stack構成

`origin/main` を基点に、次の順でstackを作る。各layerは親の内容を含み、記載した責務以外を混ぜない。

1. `feature/coding-guidelines-admin`
   - 責務: 計画と、管理商品編集draftの商品ID境界を導入する。
   - 主な変更: 編集コンポーネント分割、coordinator実行状態の表示反映、idle時とmutation中の商品切替回帰テスト。
   - 親: `main`。
   - 検証: lint、typecheck、管理商品Frontend結合、build。
2. `feature/coding-guidelines-cart`
   - 責務: customer ID境界とcheckout feedback判断の純粋関数化を導入する。
   - 主な変更: session gate分割、customer切替cleanup、error分類と再取得後状態遷移、unit・Frontend結合。
   - 親: `feature/coding-guidelines-admin`。
   - 検証: lint、typecheck、unit、カートFrontend結合、build。
3. `feature/coding-guidelines-stories`
   - 責務: 既存Storyの表示名だけを日本語化する。
   - 主な変更: 11個のstory fileの `name` metadata。
   - 親: `feature/coding-guidelines-cart`。
   - 検証: lint、typecheck、build-storybook、Story ID確認、VRT。

### 変更しない文書・境界

- `docs/PRODUCT.md`、`docs/ARCHITECTURE.md`、`docs/TEST_STRATEGY.md`、`docs/TEST_SCENARIOS.md` は変更しない。公開仕様、依存方向、テスト責任、scenarioの期待結果が変わらないためである。
- API client、Route Handler、server use case、Drizzle schema、migration、Backend結合、E2Eは変更しない。

## 7. 実装手順

変更は次の目的単位で順に行い、各段階で差分と対象テストを確認する。

### 手順1: 商品編集draftを商品IDのkey境界へ移す

1. `AdminProductEditPage` のsession・Query・not-found判定を外側へ残し、取得済み商品を編集する非exportコンポーネントを同じファイルへ切り出す。
2. 外側から `key={product.id}` を指定し、内側のフォームstateをlazy initializerで作る。
3. 商品初期化Effectと `initializedProductRef` を削除する。
4. query data更新後もdraft、field error、conflictが意図せずresetされないことを、`ADMIN-004`、`ADMIN-005`、古いGET巻き戻し防止ケースで確認する。
5. 別product IDへの切替だけがstateを初期化することを、既存テストで不足する場合は1件追加して固定する。
6. mutation中に別product IDへ切り替えた場合は、新しい商品のフォームが旧mutation完了まで無効であることをFrontend結合で固定する。

### 手順2: カートをsession gateとcustomer固有処理へ分ける

1. `CartPage` のsession状態分岐を外側へ残し、customer IDを受ける非exportコンポーネントへQueryとcheckout処理を移す。
2. 外側から `key={customerId}` を指定する。
3. customer変更Effect、手動state reset、`currentCustomerRef` を削除する。
4. unmount cleanupでAbortControllerを破棄し、遅延response後にstate・cache・routerを更新しない既存guardを維持する。
5. 利用者切替、unmount、二重送信、cart操作中のcheckout抑止を既存Frontend結合テストで確認する。

### 手順3: checkoutの判断と副作用を分ける

1. `cartCheckoutFeedback.ts` にerror分類のdiscriminated unionと純粋関数を追加する。
2. 再取得前の原因別messageと、再取得成功・失敗後のfeedback遷移を同じmoduleへ置く。
3. unit testで401、3種類の再取得対象error、network、schema不正response、通常API error、未知error、再取得成功・失敗を検証する。再取得成功は `confirmationRequired` のtrue・falseを個別に通し、全branchの入力と出力を明確にする。
4. `CartPage` のasync handlerは分類結果に応じて `setAnonymous`、cart再取得、feedback更新のいずれかを実行する薄い処理へする。
5. Frontend結合で自動再送しないこと、409後の再取得、注文結果不明時の確認要求、401のsession更新を確認する。

### 手順4: Storybookの表示名を日本語化する

1. 11個のstory fileへ、export名を変えず日本語の `name` を追加する。
2. VRT対象storyのexport名と `tests/vrt/*.vrt.spec.ts` の参照文字列が変更されていないことを差分と検索で確認する。
3. Storybook buildとVRTを実行し、story IDの解決と基準画像が変わらないことを確認する。
4. ローカルVRTが文字描画差で失敗する場合は、同じ環境の `origin/main` を一時worktreeで同一testへ通す。mainでも同じ差が出る場合は基準画像を更新せず、PRのPlaywright container上のCI結果を合格判定に使う。

### 手順5: 全体確認

1. `rg` で `initializedProductRef`、`currentCustomerRef`、customer変更時の手動reset Effectが残っていないことを確認する。
2. `rg` で Server Componentから自APIへのfetch、exhaustive-deps抑止、追加の `utils/` / `helpers/` directory、新規dependencyが混入していないことを確認する。
3. `git diff` と `git diff --check` で、計画外のAPI、文言、CSS、fixture、基準画像変更がないことを確認する。
4. 目的ごとにコミットを分ける。
   - 商品編集フォームのkey境界化。
   - カートのkey境界化。
   - checkout判断ロジックの純粋関数化とunit test。
   - Storybook表示名の日本語化。

## 8. テスト・検証方法

### 各コード変更で必須

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:frontend`
- `pnpm build`

### 商品編集

- `pnpm exec vitest run --project frontend src/features/admin/AdminProductEditStock.frontend.test.tsx`
- `ADMIN-004`: 409時に入力を保持し、最新値を自動上書きしない。
- `ADMIN-005`: 最新値を明示反映するまで古いexpectedVersionを再送しない。
- mutation中に開始した古いGETが、成功後のcacheとversionを巻き戻さない。
- mutation中に商品IDを切り替えた場合、新しい商品の入力と送信操作が旧mutation完了まで無効になる。

### カート・注文確定

- `pnpm exec vitest run --project unit src/features/cart/cartCheckoutFeedback.unit.test.ts`
- `pnpm exec vitest run --project frontend src/features/cart/CartPage.frontend.test.tsx src/features/cart/CartCheckout.frontend.test.tsx`
- `ORDER-003`: checkout送信を1回に抑え、送信中の操作を無効化する。
- `ORDER-006`、`ORDER-007`: 409後に最新cartを取得し、自動再送しない。
- checkout中のcustomer変更とunmount後に、旧requestがstate、cache、routerを更新しない。
- network errorとschema不正responseでは注文結果不明を表示し、利用者へ再確認を要求する。

### Storybook・VRT

- `pnpm build-storybook`
- `pnpm test:vrt`
- VRT 8シナリオのstory IDが解決し、基準画像の更新なしで成功する。
- Storybook sidebarで各状態が日本語名として区別できる。
- ローカルでのみVRTが失敗する場合、`origin/main` の同一testでも同一差が出ることを確認し、PRのLinux container上のVRTを最終判定にする。

### 実行しない確認

- `pnpm test:backend` と `pnpm test:e2e` は原則実行しない。Route Handler、API contract、DB、server use case、認証Cookie、実ブラウザ導線を変更せず、変更責任がClient state lifecycle、表示判断、Storybook metadataに限定されるためである。
- 差分調査でAPI境界やnavigation契約へ変更が広がった場合は、この判断を見直し、該当するBackend結合またはE2Eを追加実行する。

## 9. リスク

- `AdminProductEditPage` のkeyへversionを含めると、Query再取得や競合検出時に入力を失う。keyは商品IDだけに固定する。
- 商品編集コンポーネント分割時にrequest coordinatorを別mountへ移すと、古いQueryの世代管理やAbortController cleanupの順序が変わる可能性がある。開始・cancel・revision照合・cache更新・finishの順序を既存のまま移す。
- coordinatorを外側へ維持したままEditorのローカル `pending` だけを初期化すると、商品切替後に有効に見える操作が同期guardで無言拒否される。coordinatorの実行中stateを新Editorのdisabled状態へ反映する。
- カートのkey境界化でcleanupより先に遅延Promiseが解決すると、旧利用者のrouter遷移が起きる可能性がある。mounted判定をrequest完了直後とrouter/cache更新前に維持する。
- customer変更時の手動resetを削除した後も外側コンポーネントにcustomer固有stateが残ると、keyの効果が不完全になる。checkout feedback、pending、AbortController、mutationはすべてkey付き子へ置く。
- error分類関数へQueryClientやstate setterを渡すと、純粋関数ではなく副作用wrapperになる。戻り値をaction dataに限定する。
- error分類のunit testへMSWやReactを持ち込むと、Frontend結合と責任が重なる。error objectと期待actionの入出力だけを検証する。
- Storyのexport名を日本語へ変更するとstory IDが変わり、VRT参照が失敗する。export名は維持し、`name` だけを追加する。
- storyの表示名追加に合わせてfixtureやlayoutも整理すると視覚差分が混ざる。Storybook変更はmetadataだけに限定する。

## 10. 未確定事項

- macOSローカルのVRTでは、現在の差分と `origin/main` の同一Storyで同じ1,895px（約1%）の文字ラスタライズ差が再現している。基準画像は更新せず、PRのLinux Playwright containerで最終結果を確認する。

## 11. 完了条件

- `AdminProductEditPage` の商品初期化Effectと `initializedProductRef` がなく、商品IDのkey境界でフォームstateが初期化される。
- 商品version更新、409、Query再取得では入力draftを自動破棄せず、利用者が明示的に最新値を反映する既存挙動を維持する。
- mutation中の商品ID切替では、新しい商品フォームが旧mutation完了まで操作可能に見えず、完了後に操作可能へ戻る。
- `CartPage` がsession gateとcustomer固有checkout処理に分かれ、customer IDのkey境界でstateとrequest lifecycleが分離される。
- customer変更を監視して複数stateを手動resetするEffectと `currentCustomerRef` がなくなる。
- checkout error分類と再取得後feedback更新が、React・QueryClient・routerへ依存しない純粋関数として同階層のファイルに置かれる。
- checkout判断の全branch（再取得成功時の確認要否を含む）がunit testで、実コンポーネントの通信・操作・raceが既存Frontend結合テストで成功する。
- Storybookの既存storyが日本語表示名を持ち、export名、story ID、VRT対象、fixture、基準画像が変わらない。
- Server Component、server-only facade、TanStack Query、API client、Route Handler、use case、Drizzleの依存方向に変更がない。
- 新規dependency、API変更、business rule変更、DB変更、migration、画面文言変更、CSS変更、VRT基準画像更新がない。
- `pnpm lint`、`pnpm typecheck`、`pnpm test:unit`、`pnpm test:frontend`、`pnpm build`、`pnpm build-storybook` が成功する。
- VRTは基準画像を更新せずPRのLinux Playwright containerで成功する。ローカル失敗は `origin/main` の同一testとの対照結果をPRへ記録する。
