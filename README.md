# MockShop EC Test Sandbox

小規模ECを題材に、単体テスト、フロントエンド結合テスト、バックエンド結合テスト、E2E、VRTの責任範囲と運用を検証するサンドボックスです。

現在は `docs/DEVELOPMENT_PLAN.md` のPhase 4として、Next.jsトップページ、PostgreSQL・Drizzle基盤、Cookieセッション認証、公開商品の閲覧、購入者カート、定率クーポンまでを実装しています。注文と管理機能は後続PRで追加します。

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

初回のPlaywright実行前にChromiumをインストールします。

```bash
pnpm exec playwright install chromium
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

E2EはPlaywrightのglobal setupから専用DBをresetし、migrationと固定seedを適用します。実行中の開発serverを再利用せず、`NEXT_DIST_DIR=.next-e2e`へbuildしてから`localhost:3105`でE2E専用serverを起動します。

```bash
pnpm db:prepare:e2e
pnpm test:e2e
```

## Authentication

開発・E2E用の架空アカウントは次の2件です。`db:seed` は同じ固定データを冪等に適用します。

| ロール | メールアドレス | パスワード |
| --- | --- | --- |
| 購入者 | `customer@example.test` | `CustomerPass123!` |
| 管理者 | `admin@example.test` | `AdminPass123!` |

パスワードはscrypt hashだけをDBへ保存します。ログイン成功時の生セッショントークンはHttpOnly Cookieだけへ、SHA-256 hashはDBだけへ保存します。
初期セッションはRoot LayoutのServer Componentで解決し、ブラウザの`useEffect`からセッションAPIを取得しません。

## Products

`db:seed` とE2E global setupは、固定UUID・固定日時の架空商品を冪等に作成します。公開商品4件のうち1件は在庫切れで、非公開商品1件は公開APIへ返りません。商品画像はリポジトリ内のローカルassetだけを使用します。

公開商品一覧は `created_at DESC, id ASC` の固定順です。検索、絞り込み、利用者が選択する並び替えは実装しません。購入者でログインすると、在庫がある商品を商品詳細からカートへ追加できます。

商品一覧・詳細はServer Componentからserver-onlyな商品facadeを通して取得します。Server Componentから自分自身のRoute Handlerをfetchせず、ブラウザでserver stateの取得・更新が必要な機能だけTanStack QueryとJSON APIを使用します。API通信を`useEffect`で実装しません。

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
