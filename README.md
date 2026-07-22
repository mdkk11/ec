# MockShop EC Test Sandbox

小規模ECを題材に、単体テスト、フロントエンド結合テスト、バックエンド結合テスト、E2E、VRTの責任範囲と運用を検証するサンドボックスです。

現在は `docs/DEVELOPMENT_PLAN.md` のPhase 1として、Vite試作のビジュアルを引き継いだNext.jsトップページと非DBテスト基盤までを実装しています。商品、認証、カート、注文、管理機能は後続Phaseで追加します。

## Requirements

- Node.js 24
- npm

リポジトリの `.node-version` と同じNode.jsを使用してください。Vitestとjsdomの対応範囲外であるNode.js 23では検証しません。

## Setup

```bash
npm install
npm run dev
```

アプリは [http://localhost:3000](http://localhost:3000) で起動します。

## Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run test:unit
npm run test:frontend
npm run test:e2e
npm run build
npm run storybook
npm run build-storybook
```

初回のPlaywright実行前にChromiumをインストールします。

```bash
npx playwright install chromium
```

`vite`はNext.jsアプリの実行には使用しません。Vitestと`@storybook/nextjs-vite`が要求するビルダーとしてdevDependencyに限定しています。

`postcss`と`sharp`は、Next.jsが参照するバージョンに公開済みの脆弱性があるため、修正版へ一時的にoverrideしています。Next.js側の依存が更新された時点でoverrideを再評価します。

## Deterministic fixtures

- テスト画像は `public/images/fixtures`、トップページ画像は `public/images/home` のローカルassetを使用し、外部画像URLへ依存しません。
- 固定時刻が必要なテストは `src/test/fixtures/time.ts` のUTC時刻を使用します。
- 時刻依存のdomain関数は評価時刻を引数で受け取り、関数内で現在時刻を取得しません。
- fake timerでグローバル時刻を固定したテストは、テスト終了時に必ずreal timerへ戻します。

## Documentation

- [PRODUCT](./docs/PRODUCT.md): 機能、ビジネスルール、対象外
- [ARCHITECTURE](./docs/ARCHITECTURE.md): 依存方向、データモデル、JSON API
- [TEST STRATEGY](./docs/TEST_STRATEGY.md): テストレベルごとの責任
- [TEST SCENARIOS](./docs/TEST_SCENARIOS.md): シナリオIDと担当レベル
- [DEVELOPMENT PLAN](./docs/DEVELOPMENT_PLAN.md): 実装順序とDefinition of Done
- [DESIGN](./DESIGN.md): デザイン、レスポンシブ、アクセシビリティ方針
