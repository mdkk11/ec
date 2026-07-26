# MockShop EC Test Sandbox

小規模ECを題材に、単体テスト、フロントエンド結合テスト、バックエンド結合テスト、E2E、VRTの責任範囲と運用を検証するサンドボックスです。

現在は `docs/DEVELOPMENT_PLAN.md` のPhase 3として、Next.jsトップページ、PostgreSQL・Drizzle基盤、Cookieセッション認証、公開商品の一覧・詳細閲覧までを実装しています。カート、注文、管理機能は後続PRで追加します。

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

E2EはPlaywrightのglobal setupから専用DBをresetし、migrationと固定seedを適用します。実行中の開発serverを再利用せず、`localhost:3105`でE2E専用serverを起動します。

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

公開商品一覧は `created_at DESC, id ASC` の固定順です。検索、絞り込み、利用者が選択する並び替え、商品詳細からのカート追加はこのPhaseに含みません。

商品一覧・詳細はServer Componentからserver-onlyな商品facadeを通して取得します。Server Componentから自分自身のRoute Handlerをfetchせず、ブラウザでserver stateの取得・更新が必要な機能だけTanStack QueryとJSON APIを使用します。API通信を`useEffect`で実装しません。

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

CIの `storybook-vrt` ジョブをmainの必須checkにする設定はリポジトリ管理者が手動で行います。GitHubのbranch protectionでmainを対象にし、`storybook-vrt` をrequired status checkへ追加してください。

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
