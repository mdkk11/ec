# MockShop EC Test Sandbox

小規模ECを題材に、単体テスト、フロントエンド結合テスト、バックエンド結合テスト、E2E、VRTの責任範囲と運用を検証するサンドボックスです。

現在は `docs/DEVELOPMENT_PLAN.md` のPhase 7として、Next.jsトップページ、PostgreSQL・Drizzle基盤、Cookieセッション認証、公開商品の閲覧、購入者カート、定率クーポン、注文確定・注文履歴、管理者の商品・在庫管理・注文状態管理までを実装しています。

## Requirements

- Node.js 24
- pnpm 11
- Docker / Docker Compose

リポジトリの `.node-version` と同じNode.js、および `package.json` の `packageManager` と同じpnpmを使用してください。Vitestとjsdomの対応範囲外であるNode.js 23では検証しません。

## Setup

```bash
pnpm install
cp .env.example .env.local
pnpm db:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

アプリは [http://localhost:3000](http://localhost:3000) で起動します。

## Commands

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:frontend
pnpm test:backend
pnpm test:e2e
pnpm test:vrt
pnpm db:up
pnpm db:down
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm db:prepare:test
pnpm db:prepare:e2e
pnpm build
pnpm storybook
pnpm build-storybook
```

初回のPlaywright実行前に購入導線で使用する3ブラウザをインストールします。

```bash
pnpm exec playwright install chromium firefox webkit
```

## Explained code review

リポジトリ固有の`explained-code-review` Skillを明示的に呼び出すと、Planと現在のworkspaceを実装意図ごと・リスク順に整理し、Shiki構文強調を備えたself-containedなレビュー画面を生成できます。通常は指摘確認中心の`review`、引き継ぎや実装理解ではファイル責務・segment解説を追加する`walkthrough`を使います。SkillのruntimeはNode.js 20以上とGitだけで、rootの依存関係やpackage scriptを使いません。

インストール、別projectへの移植、全オプション、安全性、Skill開発方法は[Skill単体の利用ガイド](./.agents/skills/explained-code-review/README.md)を参照してください。この文書はSkill folderと一緒にコピーされます。

Codexへ次のように依頼してください。

```text
$explained-code-review を使い、origin/mainとの差分をレビューして画面を開いてください。
$explained-code-review を使い、現在のworkspaceをファイルごとに詳しく解説してください。
```

baseやplanを指定する場合は依頼へ含めます。

```text
$explained-code-review を使い、baseはmain、planはplans/example.mdとしてレビューしてください。
```

既定scopeはbaseと`HEAD`のmerge-baseから現在workspaceまでです。コミット済み、staged、unstaged、未追跡のnet差分を含み、selected planと`.review/**`は除外します。コミット済み差分だけを見る場合は`scope commits`と依頼してください。

baseはローカルrefを`origin/HEAD`、`origin/main`、`main`、`origin/master`、`master`の順で解決します。`git fetch`は自動実行しないため、remoteの最新状態が必要なら呼び出し前に更新してください。

生成物はGit管理対象外の`.review/<review-id>/`へ保存されます。

- `index.html`: `file://`で開けるself-containedなレビュー画面
- `report.json`: JSON Schemaで検証済みのレビュー内容

外部CDN、認証、server、DB、GitHub APIは使用しません。group承認、コメント、指摘の解決状態、表示テーマはbrowserのlocalStorageへ保存されます。承認と解決状態は内容fingerprintが一致する場合だけ復元され、変更されたgroupのコメントは「前版コメント・要再確認」として分離されます。

正式な作業順は次のとおりです。

1. `generate`: Skillで収集・二段階レビュー・HTML生成
2. `review`: `index.html`を`file://`で開き、意図と指摘を確認
3. `fix`: 必要な修正をworkspaceへ反映
4. `regenerate`: Skillを再実行
5. `reapprove`: 新snapshotを再確認・再承認
6. `commit`: 確認済みsnapshotをコミット

画面上の承認は収集時snapshotに対するものです。修正後は必ず再生成・再承認してください。

Skillだけを別projectへ移す場合は、フォルダ全体をそのprojectの`.agents/skills/explained-code-review/`、またはglobalの`~/.codex/skills/explained-code-review/`へコピーします。通常実行にSkill内の`node_modules`は不要です。project-local版とglobal版が同時にある場合の優先順位は保証しません。

Skill自身の開発・acceptanceだけはSkill directory内で依存を導入します。

```bash
cd .agents/skills/explained-code-review
pnpm install --ignore-workspace
pnpm build:highlighter
pnpm build:validator
pnpm test
pnpm test:stress
pnpm exec playwright install chromium
pnpm test:ui
```

`vite`はNext.jsアプリの実行には使用しません。Vitestと`@storybook/nextjs-vite`が要求するビルダーとしてdevDependencyに限定しています。

`postcss`と`sharp`は、Next.jsが参照するバージョンに公開済みの脆弱性があるため、修正版へ一時的にoverrideしています。Next.js側の依存が更新された時点でoverrideを再評価します。

## Database

開発DB、バックエンド結合テストDB、E2E DBは別のPostgreSQLコンテナ・接続先を使用します。

```bash
pnpm db:up
pnpm db:migrate
pnpm db:seed
```

| 用途 | 環境変数 | DB | 接続先 |
| --- | --- | --- | --- |
| 開発 | `DATABASE_URL` | `mockshop_dev` | `localhost:5432` |
| Backend結合 | `TEST_DATABASE_URL` | `mockshop_test` | `localhost:5433` |
| E2E | `E2E_DATABASE_URL` | `mockshop_e2e` | `localhost:5434` |

バックエンド結合テストは、専用テストDBを初期化してmigrationを適用してから実行します。

```bash
pnpm db:prepare:test
pnpm test:backend
```

`db:prepare:test` は `NODE_ENV=test`、DB名、開発DBとの接続先分離、実際の接続先を検証してからテストDBだけを初期化します。`TEST_DATABASE_URL` がない場合に `DATABASE_URL` へフォールバックしません。

E2EはPlaywrightのglobal setupから専用DBをresetし、migrationと固定seedを適用します。実行中の開発serverを再利用せず、`NEXT_DIST_DIR=.next-e2e`へbuildしてから`localhost:3105`でE2E専用serverを起動します。ローカルHTTPでCookieを検証するためのSecure解除は、専用dist、loopback上の `mockshop_e2e`、同一の `DATABASE_URL` / `E2E_DATABASE_URL` がコード上ですべて確認できる場合だけ許可されます。

```bash
pnpm db:prepare:e2e
pnpm test:e2e
```

## Authentication

開発用の架空アカウントは次の2件です。`db:seed` は同じ固定データを冪等に適用します。

| ロール | メールアドレス | パスワード |
| --- | --- | --- |
| 購入者 | `customer@example.test` | `CustomerPass123!` |
| 管理者 | `admin@example.test` | `AdminPass123!` |

E2E global setupは購入完走、モバイル購入、在庫競合、商品管理、注文管理のbrowser projectごとに、固定IDの購入者・管理者・商品・クーポン・注文を分離して投入します。各projectは他のprojectが変更するカート・在庫・注文・管理商品に依存しません。

パスワードはscrypt hashだけをDBへ保存します。ログイン成功時の生セッショントークンはHttpOnly Cookieだけへ、SHA-256 hashはDBだけへ保存します。
初期セッションはRoot LayoutのServer Componentで解決し、ブラウザの`useEffect`からセッションAPIを取得しません。

## Products

`db:seed` は固定UUID・固定日時の架空商品を冪等に作成します。公開商品4件のうち1件は在庫切れで、非公開商品1件は公開APIへ返りません。E2E global setupはさらにbrowser projectごとの購入用商品を追加します。商品画像はリポジトリ内のローカルassetだけを使用します。

公開商品一覧は `created_at DESC, id ASC` の固定順です。検索、絞り込み、利用者が選択する並び替えは実装しません。購入者でログインすると、在庫がある商品を商品詳細からカートへ追加できます。

商品一覧・詳細はServer Componentからserver-onlyな商品facadeを通して取得します。Server Componentから自分自身のRoute Handlerをfetchせず、ブラウザでserver stateの取得・更新が必要な機能だけTanStack QueryとJSON APIを使用します。API通信を`useEffect`で実装しません。

## Admin products

管理者でログインすると、headerの「商品管理」から `/admin/products` を開けます。商品一覧には公開・非公開の商品を表示し、新規商品は初期状態を非公開、価格0円、在庫0として作成します。個別編集画面では商品情報・公開状態と在庫を別フォームで更新します。

商品情報と在庫の更新には取得時の`version`を`expectedVersion`として必須送信します。注文減算や別の管理更新でversionが進んだ場合は409 `VERSION_CONFLICT`となり、入力を保持したまま最新値を表示します。「最新値をフォームへ反映」を選択するまで古い入力を自動送信・上書きしません。

管理商品のbrowser stateはTanStack Queryでadmin IDごとに分離し、更新開始前に古い取得を中断します。operation revisionが一致する応答だけをcacheへ反映し、遅れて返った古い取得結果で新しいversionを巻き戻しません。

## Admin orders

管理者でログインすると、headerの「注文管理」から `/admin/orders` を開けます。注文は作成日時降順で表示され、`received → processing → shipped → completed` の順方向遷移と、`received` または `processing` からの取消だけを選択できます。

状態更新には取得時の注文versionを`expectedVersion`として送信します。先行更新や取消でversionが変わった場合は409 `VERSION_CONFLICT`となり、選択した状態を自動送信せず、最新状態を確認してから再選択します。

取消は注文状態・取消日時・注文明細の商品在庫・商品versionを同一transactionで更新します。取消済み注文を再度変更することはできず、同時取消でも在庫は一度だけ復元されます。

## Cart

カートは購入者専用です。管理者は購入者権限を兼任せず、未認証時はログイン導線、管理者でのアクセス時は購入者専用表示になります。

- `GET /api/cart`で現在のカートを取得
- `POST /api/cart/items`で商品を追加。同じ商品は既存行へ集約
- `PATCH /api/cart/items/:itemId`で数量を更新
- `DELETE /api/cart/items/:itemId`で商品を削除

カート追加と数量更新では現在庫を上限としますが、在庫は確保しません。表示時に商品が非公開、または数量が最新在庫を超えていた場合は明細を保持したままissueを表示します。カートが空またはissueを含む場合、`checkoutToken`は返しません。

ブラウザのカート状態はTanStack Queryでcustomer IDごとに分離します。更新中の同一内容は重複送信せず、更新APIを直列実行して保留中の新しい数量は最新希望値へ集約します。

## Coupons

クーポンは購入者のカートへ1件だけ適用できます。コードは前後空白を除去して大文字へ正規化し、割引額は商品小計と定率から整数円へ切り捨てて計算します。適用済みクーポンが失効した場合は自動解除せず、原因を表示して注文確認を無効にします。

開発・E2E seedには次の固定コードを含みます。

| コード | 状態 |
| --- | --- |
| `WELCOME15` | 10,000円以上で15%割引 |
| `INACTIVE10` | 無効 |
| `FUTURE10` | 利用開始前 |
| `EXPIRED10` | 期限切れ |
| `MINIMUM20` | 100,000円以上で20%割引 |

## Orders

注文確定は購入者専用です。カート表示時の`checkoutToken`を送信し、transaction内でカート、商品、クーポンを固定順にロックして最新条件を再検証します。在庫減算、商品version更新、注文snapshot保存、カートclearは同じtransactionで実行します。

- 商品構成・価格・公開状態・クーポン条件の変更は409 `CHECKOUT_CHANGED`
- tokenに含めない在庫だけの変更は409 `STOCK_CONFLICT`
- 同じカートへの同時送信は先行1件だけ成功し、後続は400 `EMPTY_CART`

注文履歴、詳細、完了画面はServer Componentからserver-onlyな注文facadeを通して取得し、自分自身のJSON Route Handlerを呼びません。履歴は作成日時降順・同時刻は注文ID降順、明細は商品ID昇順で表示し、現在の商品ではなく注文時snapshotを使用します。

## Visual regression tests

VRTはStorybookの固定fixtureをPlaywright Chromiumで撮影します。基準画像の生成・更新はCIと同じ `mcr.microsoft.com/playwright:v1.61.1-noble` 環境だけで行い、macOSで生成した画像を正本としてコミットしません。

```bash
pnpm test:vrt
```

意図したUI変更で基準画像を更新する場合は、次の固定Linux環境で実行します。専用volumeへLinux用依存関係を分離するため、ホストの `node_modules` は変更しません。

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

生成後は対象storyの変更後画像をレビューします。VRT失敗を消すための一括更新や許容値変更は行いません。

CIの `storybook-vrt` と `e2e` ジョブをmainの必須checkにする設定はリポジトリ管理者が手動で行います。GitHubのbranch protectionでmainを対象にし、両方をrequired status checkへ追加してください。

schema変更時はmigrationを生成し、生成されたSQLとmetadataをコミットします。mainへ取り込まれたmigrationは編集しません。

```bash
pnpm db:generate
```

コンテナを停止する場合は次を実行します。開発DBのvolumeは削除しません。

```bash
pnpm db:down
```

## Deterministic fixtures

- テスト画像は `public/images/fixtures`、トップページ画像は `public/images/home` のローカルassetを使用し、外部画像URLへ依存しません。
- 日付・時刻処理は `src/lib/date-time/temporal.ts` から提供する `Temporal` polyfillを使用します。
- 固定時刻が必要なテストは `src/test/fixtures/time.ts` の `Temporal.Instant` を使用します。
- 時刻依存のdomain関数は `Temporal.Instant` の評価時刻を引数で受け取り、関数内で現在時刻を取得しません。
- fake timerでグローバル時刻を固定したテストは、テスト終了時に必ずreal timerへ戻します。

## Documentation

- [PRODUCT](./docs/PRODUCT.md): 機能、ビジネスルール、対象外
- [ARCHITECTURE](./docs/ARCHITECTURE.md): 依存方向、データモデル、JSON API
- [TEST STRATEGY](./docs/TEST_STRATEGY.md): テストレベルごとの責任
- [TEST SCENARIOS](./docs/TEST_SCENARIOS.md): シナリオIDと担当レベル
- [DEVELOPMENT PLAN](./docs/DEVELOPMENT_PLAN.md): 実装順序とDefinition of Done
- [DESIGN](./DESIGN.md): デザイン、レスポンシブ、アクセシビリティ方針
