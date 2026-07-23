# MockShop EC Test Sandbox

小規模ECを題材に、単体テスト、フロントエンド結合テスト、バックエンド結合テスト、E2E、VRTの責任範囲と運用を検証するサンドボックスです。

現在は `docs/DEVELOPMENT_PLAN.md` のPhase 2として、Next.jsトップページ、非DBテスト基盤、PostgreSQL・DrizzleのDB共通基盤までを実装しています。商品、認証、カート、注文、管理機能は後続PRで追加します。

## Requirements

- Node.js 24
- pnpm 11
- Docker / Docker Compose

リポジトリの `.node-version` と同じNode.js、および `package.json` の `packageManager` と同じpnpmを使用してください。Vitestとjsdomの対応範囲外であるNode.js 23では検証しません。

## Setup

```bash
pnpm install
cp .env.example .env.local
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

開発DBとバックエンド結合テストDBは別のPostgreSQLコンテナ・接続先を使用します。

```bash
pnpm db:up
pnpm db:migrate
```

| 用途 | 環境変数 | DB | 接続先 |
| --- | --- | --- | --- |
| 開発 | `DATABASE_URL` | `mockshop_dev` | `localhost:5432` |
| Backend結合 | `TEST_DATABASE_URL` | `mockshop_test` | `localhost:5433` |

バックエンド結合テストは、専用テストDBを初期化してmigrationを適用してから実行します。

```bash
pnpm db:prepare:test
pnpm test:backend
```

`db:prepare:test` は `NODE_ENV=test`、DB名、開発DBとの接続先分離、実際の接続先を検証してからテストDBだけを初期化します。`TEST_DATABASE_URL` がない場合に `DATABASE_URL` へフォールバックしません。

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
