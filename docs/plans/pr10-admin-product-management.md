# PR10 商品・在庫管理の実装計画

## 1. 背景と目的

`docs/DEVELOPMENT_PLAN.md` のPR10だけを対象に、管理者の商品作成・編集・非公開化・在庫更新と、`expectedVersion` による競合制御を完成させる。

Plan Mode終了後は、最初に本計画を `docs/plans/pr10-admin-product-management.md` へ保存し、コードを変更せず計画ファイルの承認を待つ。承認後の別段階で実装を開始する。

## 2. 現状調査

- PR09まで `main` へ反映済み。
- `products` には `isPublished`、`stock`、`version` と必要なDB制約が存在するためmigrationは不要。
- admin用DTO・API・画面・APIクライアント・テストは未実装。
- 既存のlint、typecheck、unit 63件、frontend 65件は成功済み。
- 既存の未追跡 `.agents/skills/explained-code-review-workspace/` は変更しない。

## 3. 解決する問題

- 管理者が商品情報と在庫を更新できない。
- customerと未認証利用者を管理API/UIから拒否する境界がない。
- 注文減算を含む他操作後に、古い管理画面が在庫を上書きする危険がある。
- 管理フォームの入力エラー、送信中、通信失敗、409競合、再確認状態が未実装。
- 古い一覧取得や再取得レスポンスが、より新しい更新結果とversionを上書きする可能性がある。

## 4. 採用する方針

- `/admin/products` に全商品一覧と新規作成フォームを配置する。
- `/admin/products/[productId]` に商品情報・公開状態フォームと在庫フォームを分離して配置する。
- 管理状態はTanStack Queryと共通APIクライアントで取得・更新する。
- 409時は入力を保持して全更新を停止し、管理一覧を再取得して最新値を並べて表示する。「最新値をフォームへ反映」を明示操作した後だけ編集を再開する。
- 商品情報更新は変更されたfieldだけと `expectedVersion` を送る。在庫は専用endpointを使用する。
- 同一画面の更新成功時はレスポンスの最新versionを共有し、別フォームの未送信入力は保持する。
- 新規商品の初期値は価格0円、在庫0、非公開とする。
- すべての管理商品queryへ `AbortSignal` を渡す。mutation開始前と409回復前に対象queryを `cancelQueries` し、古い取得処理を中断する。
- ページcontrollerでoperation revisionを増分管理し、開始時のrevisionと一致する処理だけがquery cache、共有version、成功・競合表示を更新できるようにする。
- 商品情報と在庫のmutationは同じ商品単位で直列化し、同時送信を許可しない。mutation成功時はレスポンスから直接cacheを更新し、直後の不要な再取得は行わない。

## 5. 採用しない方針

- 画像アップロード、商品削除、検索、絞り込み、クーポン管理は追加しない。
- 管理商品詳細GET APIは追加せず、既定の管理一覧APIから対象商品を選ぶ。
- 競合時の自動再送、入力の自動上書き、古いversionによる強制更新は行わない。
- queryの応答順が常に開始順になるとは仮定しない。
- 新しい状態管理、フォームlibrary、migration、依存packageは追加しない。

## 6. 変更対象と公開インターフェース

- `src/contracts/product.ts`
  - `AdminProductDto`
  - 管理一覧・単体レスポンスschema
  - 作成、商品PATCH、在庫PATCHのrequest schema
  - 価格・在庫は0以上の整数、versionは1以上の整数、商品PATCHは変更fieldを1件以上必須とする。
- `src/server/auth/request-actor.ts`
  - Cookieセッションを解決する `requireAdminRequest` を追加する。
- `src/features/admin` と `src/lib/api-client`
  - 管理商品ユースケース、HTTP変換、APIクライアント、query controller、表示コンポーネント、fixture、Storybook storyを追加する。
- Route Handler
  - `GET /api/admin/products`
  - `POST /api/admin/products`
  - `PATCH /api/admin/products/:productId`
  - `PATCH /api/admin/products/:productId/stock`
- UI
  - 管理者headerに「商品管理」リンクを表示する。
  - 未認証はログイン導線、customerは権限不足表示とし、管理APIを呼ばない。
- README
  - Phase 6到達、管理画面URL、更新・競合動作、E2E fixture分離を記載する。

## 7. 実装手順

### 計画作成段階

1. 本計画を `docs/plans/pr10-admin-product-management.md` へ保存する。
2. 計画ファイル以外を変更せず、ユーザーへ内容確認を依頼する。
3. 計画ファイルの承認後に、以下の実装段階へ進む。

### 実装段階

1. 管理用Zod契約と境界値単体テストを追加する。
2. admin認可と共通HTTPエラー変換を実装する。
3. 全商品を作成日時降順・同時刻ID昇順で返す取得処理、商品作成処理を実装する。
4. `WHERE id AND version = expectedVersion` と `version = version + 1` を同じUPDATEに含める商品・在庫更新を実装する。0件更新時は存在確認し、404と409を分離する。
5. `Temporal.Instant` をRoute Handlerから渡し、作成・更新日時を決定的に保存する。
6. 管理APIクライアントとTanStack Query画面を実装する。query cancellation、operation revision、商品単位のmutation直列化をcontrollerへ集約する。
7. 管理一覧、新規作成、個別編集、在庫更新、空・読込・通信エラー・入力エラー・送信中・競合表示を実装する。
8. header導線、README、ブラウザ別E2E seedを更新する。
9. Storybook/VRTと全テストを追加し、固定Linux環境で基準画像を生成する。

## 8. テスト・検証方法

- 単体
  - `UNIT-PRODUCT-001`: 価格・在庫0を許可し、負数・小数・不正versionを拒否。
  - 管理DTO、作成、部分更新、変更fieldなし、image pathを検証。
- フロントエンド結合
  - 管理者の正常取得、空、loading、500/network error、再試行。
  - `ADMIN-002`: 不正入力ではHTTP送信せず、field errorとfocusを設定。
  - 作成・編集・非公開化・在庫更新、送信中の重複防止。
  - `ADMIN-004`・`005`: 409後も入力を保持し、最新値取得と明示確認まで再送不可。
  - 未認証・customerでは管理APIを呼ばない。
  - background GETを保留した状態でmutationを成功させ、その後に古いGETを解放してもcacheとversionが巻き戻らないこと。
  - 409後の再取得と再試行を逆順で完了させ、古いoperation revisionが最新の商品・入力・競合表示を変更しないこと。
- バックエンド結合
  - `ADMIN-001`〜`005`、`ADMIN-012`、`AUTH-006`。
  - 未認証401、customer 403、入力400、未存在404、競合409、DB変更なし。
  - 非公開化後に購入者一覧・詳細から除外されること。
  - 注文減算でversionが進んだ後、古い在庫更新が409になること。
- E2E
  - `E2E-003`: 3ブラウザでログイン→商品作成→在庫変更→非公開化。
  - `E2E-004`: 3ブラウザでcustomerの管理URL拒否。
  - ブラウザごとに管理者・customer・商品名を分離する。
- VRT
  - `VRT-007`: `AdminProductForm` の通常、入力エラー、更新中、競合を768px・1440pxで撮影。
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

- 商品情報と在庫が同じversionを共有するため、両フォームの成功・競合時に共有versionを同期しないと自己競合が起きる。ページcontrollerで一元管理する。
- 競合後に最新versionだけ差し替えると暗黙の上書きになるため、明示確認まで両フォームを停止する。
- query cancellationだけでは完了済みレスポンスとの競合を完全には防げないため、operation revisionも併用する。
- 管理詳細GETを追加しないため詳細画面も一覧取得を使うが、小規模サンドボックスの既定APIを維持する判断を優先する。

## 10. 未確定事項

なし。

## 11. 完了条件

- PR10のAPI/UIと正常・空・loading・error・409状態が実装される。
- `ADMIN-001`〜`005`、`012`、`AUTH-006`、`E2E-003`、`004`、`VRT-007` が成功する。
- customerの購入者権限とadmin権限が混在しない。
- 古い商品・在庫更新が注文減算や先行更新を上書きしない。
- 古いGET・再取得・mutationのレスポンスが最新cache、version、入力状態を巻き戻さない。
- migrationや対象外機能を追加せず、全品質コマンドが成功する。
