# MockShop Storefront

FARFETCHの情報設計を参考にしつつ、独自ブランドとして構成したシンプルなECトップページのサンプルです。

## Setup

```bash
npm install
npm run dev
```

## Commands

```bash
npm run dev
npm run lint
npm run build
```

デザイン方針、コンポーネント仕様、レスポンシブ・アクセシビリティ要件は [`DESIGN.md`](./DESIGN.md) を参照してください。

## Current scope

- React + TypeScript + Vite
- Tailwind CSS v4
- レスポンシブなECトップページ
- 検索パネル、モバイルメニュー、お気に入り、カート件数、トースト

商品画像はサンプルとしてUnsplashの外部画像を使用しています。本番運用では自社CDNまたは画像最適化基盤へ置き換えてください。
