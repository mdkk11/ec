# 管理画面の非同期競合制御共通化計画

## 1. 背景と目的

管理商品一覧、商品編集、注文管理のClient Componentでは、mutationとTanStack Queryの再取得が競合した際に、古いGET結果でmutation成功後のcacheとversionを巻き戻さないための制御を個別に実装している。

本リファクタリングでは、3画面で責務と実装が一致している「Query世代の無効化」「操作revisionの判定」「AbortControllerの管理とunmount cleanup」だけをadmin feature内のhookへ集約する。フォーム、pending表示、409時の最新値確認、認証処理、API呼び出し、cache更新は各画面に残し、利用者から見える挙動とテスト境界を変えずに重複と修正漏れを減らす。

本計画の承認後に実装を開始する。計画作成時点ではアプリケーションコードとテストを変更しない。

## 2. 現状調査

- 作業ブランチは `feature/refactor-admin-async-concurrency` で、計画作成前の作業ツリーはcleanである。
- `AdminProductsPage`、`AdminProductEditPage`、`AdminOrdersPage` は、いずれも次の4つのrefを持つ。
  - mutationまたは競合回復処理の実行中判定
  - Query結果を受理できる世代番号
  - 現在の非同期操作を識別するrevision
  - 現在の操作に属する `AbortController`
- 3画面のQuery関数は、開始時のQuery世代と操作中フラグを記録し、古くなった成功・失敗結果をTanStack Queryの `CancelledError` へ変換する同一処理を持つ。
- 3画面のmutation開始処理は、revision更新、操作中フラグ設定、Query世代更新、既存controllerのabort、新controller作成を同じ順序で行う。
- 3画面とも、非同期処理の各境界でrevisionを照合し、unmount時にはrevisionとQuery世代を進めてcontrollerをabortする。
- 商品編集と注文管理では、409後に同じrevisionを維持したまま最新値取得用controllerへ差し替える。
- 画面固有の責務は一致していない。
  - 商品一覧は作成フォームと作成成功時の一覧先頭追加を管理する。
  - 商品編集は商品情報・在庫・競合再取得のpending種別、入力保持、最新値の明示反映を管理する。
  - 注文管理は注文単位の選択状態、pending、競合確認を管理する。
- `AdminProducts.frontend.test.tsx` は `ADMIN-004`、`ADMIN-005`、mutation前またはmutation中に開始した古いGETによるcache巻き戻し防止、409回復中の401を検証している。
- `AdminOrders.frontend.test.tsx` は `ADMIN-008`、二重送信防止、更新中に開始した古いGETによる状態・version巻き戻し防止を検証している。

## 3. 解決する問題

- 古いQuery結果を破棄する同一処理が3画面に分散し、修正時に一部画面だけ挙動がずれる可能性がある。
- revision更新、Query世代更新、controller差し替えの順序が各画面のイベント処理へ埋め込まれており、画面固有の処理を追いにくい。
- unmount cleanupも各画面で重複し、新しいadmin管理画面で同じ競合制御が必要になった際に実装漏れが起きやすい。
- 一方で、mutation全体を汎用化するとフォーム、409回復、cache更新、認証の異なる責務までconfigやcallbackへ押し込み、現在より理解しにくくなる。

## 4. 採用する方針

- `src/features/admin/use-admin-request-coordinator.ts` に `useAdminRequestCoordinator` を追加する。
- hookは次の最小責務だけを持つ。
  - `runGuardedQuery`: Query開始時の世代と操作中状態を記録し、完了時に古い成功・失敗結果を `CancelledError` に変換する。
  - `beginOperation`: revisionを進め、操作中にし、Query世代を無効化し、既存controllerをabortして `{ revision, signal }` を返す。
  - `isOperationRunning`: 同一画面での重複操作をrefから判定する。
  - `isCurrentOperation`: 非同期処理の継続前にrevisionが最新か判定する。
  - `nextOperationSignal`: 409後の最新値取得など、同じrevision内の後続request用controllerへ差し替え、`AbortSignal` を返す。revisionが古い場合はcontrollerを作らず `null` を返す。
  - `finishOperation`: revisionが最新の場合だけ操作中状態を解除し、画面側がpending表示を解除してよいかbooleanで返す。
  - unmount時にrevisionとQuery世代を進め、保持中controllerをabortする。
- hookはReactのrefだけで状態を管理し、再renderを発生させるUI stateは持たない。
- 各画面のQuery関数は、API取得処理を `runGuardedQuery` で包む形へ置換する。query key、enabled条件、取得API、返却dataは変更しない。
- 各画面のmutationは、開始・現在性判定・終了をhookのprimitiveへ置換する。`queryClient.cancelQueries` の位置と、成功時のcache更新順序は維持する。
- 商品編集と注文管理の409回復処理では、`nextOperationSignal` が返すsignalで同じrevisionの最新値取得を継続し、`null` の場合は処理を終了する。入力保持、エラー文言、401処理、最新値の明示反映は各画面へ残す。
- `AbortController` 自体はhook外へ公開せず、各画面にはrequestへ渡す `AbortSignal` だけを返す。
- 商品編集のpending種別、商品一覧のpending boolean、注文管理のpending注文IDは各画面に残し、`finishOperation` がtrueを返した場合だけ解除する。
- 公開API、business rule、Zod contract、Route Handler、server use case、DB、表示文言、CSSは変更しない。
- 既存Front結合テストをリファクタリングのbehavior contractとして使う。hookのref構造を直接検証する実装詳細テストは追加しない。

## 5. 採用しない方針

- mutation関数、pending state、エラーstate、cache更新をcallbackやconfigで受ける汎用mutation wrapperは作らない。
- admin featureを越えた共通hook、global store、Context、DI、classは導入しない。
- TanStack Queryの既定動作を変更せず、QueryClientのdefault optionsやretry設定を競合回避のために変更しない。
- 409時の自動再送、自動上書き、入力破棄は行わない。
- 認証・認可、401時の `setAnonymous`、利用者向け文言をhookへ移さない。
- 商品と注文のAPI clientやquery helperを統合しない。
- 新しいpackageは導入しない。
- UI差分がないためStorybook story、VRT基準画像は変更しない。

## 6. 変更対象

- `src/features/admin/use-admin-request-coordinator.ts`
  - Query世代、操作revision、実行中判定、AbortController、unmount cleanupを管理するfeature-local hookを追加する。
- `src/features/admin/AdminProductsPage.tsx`
  - 重複するref、Query guard、cleanup、mutation世代制御をhookへ置換する。
  - 作成フォーム、validation、認証、cache先頭追加、表示stateは維持する。
- `src/features/admin/AdminProductEditPage.tsx`
  - 重複する競合制御をhookへ置換する。
  - 商品情報・在庫の処理差、409回復、入力保持、最新値反映、画面固有pending stateは維持する。
- `src/features/admin/AdminOrdersPage.tsx`
  - 重複する競合制御をhookへ置換する。
  - 注文単位の選択・pending、409確認、cache置換、認証処理は維持する。

`src/features/admin/AdminProducts.frontend.test.tsx` と `src/features/admin/AdminOrders.frontend.test.tsx` は既存ケースをそのまま回帰確認へ使い、仕様上の不足が見つからない限り変更しない。`docs/PRODUCT.md`、`docs/ARCHITECTURE.md`、`docs/TEST_STRATEGY.md`、`docs/TEST_SCENARIOS.md`、READMEも、仕様・依存方向・テスト責任・利用手順が変わらないため変更しない。

## 7. 実装手順

1. 実装開始時に `git status --short` と対象ファイルの差分を確認し、計画外の利用者変更がないことを確認する。
2. `useAdminRequestCoordinator` を追加し、4つのref、古いQuery結果の `CancelledError` 変換、操作開始・現在性判定・controller差し替え・終了、unmount cleanupを実装する。controllerはhook内に閉じ、呼び出し元へはsignalだけを返す。
3. `AdminProductsPage` のQuery guardと作成処理をhookへ置換する。フォームvalidationより前の重複送信判定、`cancelQueries` 後のrevision判定、成功cache更新、finallyのpending解除順を維持する。
4. `AdminProductEditPage` をhookへ置換する。画面内の小さなpending開始・終了wrapperはUI state更新だけに限定し、409後の最新値取得は同じrevisionのcontroller差し替えとして維持する。
5. `AdminOrdersPage` をhookへ置換する。注文単位の重複操作防止、409後の最新値取得、成功後のcache置換順を維持する。
6. `rg` と差分確認で、対象3画面から共通化対象のrefと `CancelledError` importが除かれ、認証・cache・409・フォーム処理が画面側に残っていることを確認する。
7. lint、typecheck、Front結合テスト、アプリbuildを実行する。失敗が実装起因なら修正し、計画外の仕様変更は加えない。

## 8. テスト・検証方法

- 静的確認
  - `pnpm lint`
  - `pnpm typecheck`
  - `rg` で `queryGenerationRef`、`revisionRef`、`controllerRef`、Query内の `CancelledError` 変換が3画面に重複して残っていないことを確認する。
- Front結合
  - `pnpm test:frontend`
  - `ADMIN-004`、`ADMIN-005` で409後も入力を保持し、最新値を明示反映するまで再送しないことを確認する。
  - `ADMIN-008` で注文更新の409後に最新状態の明示確認を求めることを確認する。
  - mutation前・mutation中・注文更新中に開始した古いGETが、成功後のcache、状態、versionを巻き戻さないことを確認する。
  - 二重送信防止と409回復中の401遷移が維持されることを確認する。
- build
  - `pnpm build`
- Backend結合、E2E、Storybook、VRTは実行しない。API、server、DB、代表導線、表示・styleを変更せず、変更責任がClient Componentの非同期競合制御であり、既存Front結合テストが主担当だからである。

## 9. リスク

- Query開始時の操作中状態を記録せず、完了時だけを見ると、mutation中に開始してmutation後に完了したGETを受理してしまう。`runGuardedQuery` は開始時の状態を保持する。
- 古いQueryの成功結果だけを破棄し、失敗結果をそのまま投げると、無効化済みrequestのエラー表示が新しい状態を上書きする。成功・失敗の両方を同じ世代判定で `CancelledError` に変換する。
- `cancelQueries` のawait中にunmountや別操作が起きた場合、古い処理が継続する可能性がある。既存どおりawait後と各request完了後にrevisionを照合する。
- 409回復用requestでrevisionを新しくすると、元mutationのfinallyと競合状態管理がずれる。同じrevisionを保ち、controllerだけを差し替える。
- hookにReact stateやfeature固有callbackを持たせると、画面ごとのpending・入力保持・認証の責務が混ざる。hookはrefと判定primitiveだけに限定する。
- `finishOperation` が古いrevisionでもUI pendingを解除すると、新しい操作の表示を消す可能性がある。hookが最新性を判定し、trueの場合だけ画面stateを解除する。

## 10. 未確定事項

なし。

## 11. 完了条件

- 管理3画面のQuery世代、操作revision、実行中判定、AbortController、unmount cleanupが `useAdminRequestCoordinator` に集約されている。
- 各画面から共通化対象の重複refと `CancelledError` 変換がなくなっている。
- フォーム、pending表示、409回復、認証、API呼び出し、cache更新は各画面の責務として維持されている。
- 古いGET結果でmutation成功後のcache、状態、versionを巻き戻さない。
- 409時に入力を自動再送・上書きせず、最新値の明示確認を求める既存挙動が維持されている。
- 新規依存、公開API変更、business rule変更、DB変更、migration、UI変更、VRT基準画像更新がない。
- `pnpm lint`、`pnpm typecheck`、`pnpm test:frontend`、`pnpm build` が成功する。
