# Lint responsibility map

`pnpm lint` は Oxlint を type-aware mode と warning 失敗で実行する。現在の lint 責任は次のように移行した。

| 以前の設定 | 現在の担当 | 確認方法 |
| --- | --- | --- |
| Next.js core-web-vitals | Oxlint built-in `nextjs` rules | `pnpm lint:parity` の async Client Component |
| React / React Hooks | Oxlint built-in `react` rules | `pnpm lint:parity` の Hooks 違反 |
| TypeScript | Oxlint built-in `typescript` rulesと `oxlint-tsgolint` | `pnpm lint:parity` の未処理Promise |
| import / jsx-a11y | Oxlint built-in `import` / `jsx-a11y` rules | `.oxlintrc.json` の明示ruleと `pnpm lint` |
| Storybook recommended | 最小ESLint fallback | `pnpm lint:parity` のrenderer package直接import |

移行ツールが自動変換しなかったruleは次のとおり扱う。

- `react/jsx-uses-react` と `react/jsx-uses-vars`: React 17以降のJSX transformとOxlintの未使用変数解析が同じ責任を持つ。
- `react/no-deprecated`: type-awareな `typescript/no-deprecated` へ置き換えた。
- `react/require-render-return`: Oxlintの同名ruleを明示的に有効化した。
- `react-hooks/config` と `react-hooks/gating`: OxlintがReact Compilerを固定された有効設定で解析するため、設定不備という状態が存在しない。

Oxlint 1.79.0のJS plugin経由ではStorybook 10.5.3の代表違反を検出できなかったため、Storybook recommended rulesだけをESLint fallbackへ残している。Oxlintで `pnpm lint:parity` のStorybook fixtureを検出できるversionへ更新したら、`lint:eslint-gap`、`eslint.config.js`、ESLint依存を削除する。
