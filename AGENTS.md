# AGENTS.md

## プロジェクトの目的

このリポジトリは、小規模ECを題材に単体テスト、フロントエンド結合テスト、バックエンド結合テスト、E2E、VRTの責任範囲と運用を検証するサンドボックスです。

EC機能の網羅性より、テスト境界の明確さ、決定性、失敗原因の追跡しやすさを優先してください。対象外機能を将来用として先回り実装しないでください。

## 作業前に読む文書

- `docs/PRODUCT.md`: 機能、ビジネスルール、対象外
- `docs/ARCHITECTURE.md`: 依存方向、データモデル、JSON API
- `docs/TEST_STRATEGY.md`: 各テストレベルの責任とDB境界
- `docs/TEST_SCENARIOS.md`: シナリオIDと担当レベル
- `docs/DEVELOPMENT_PLAN.md`: 実装順序、PR分割、Definition of Done
- `DESIGN.md`: デザイン、レスポンシブ、アクセシビリティの参考方針

文書同士が矛盾する場合は、勝手に都合のよい解釈をせず、変更理由と採用するルールを明記して関連文書を同じPRで更新してください。

## 現在の移行状態

- 現在のViteトップページはデザイン参照です。
- Next.js移行後のコード互換性を維持する必要はありません。
- Next.js基盤へ移行するまでは、実際に存在する `package.json` scriptsをコマンドのsource of truthとしてください。
- アプリケーション機能は `docs/DEVELOPMENT_PLAN.md` の順序で実装してください。

## 採用技術と基本方針

- Next.js App Router / React / TypeScript
- PostgreSQL / Drizzle ORM / Zod
- Vitest / Testing Library / MSW
- Playwright / Storybook
- GitHub Actions
- package managerはpnpm 11
- UIの操作・状態・エラー、設計文書、テストの利用者向け説明は日本語。トップページでVite試作から引き継ぐブランド名、シーズン名、編集見出しは固有コピーとして英語表記を維持する
- コード上の識別子とAPIのcodeは英語
- 金額はJPYの整数。浮動小数点で保存・計算しない

導入するパッケージは、この構成に必要なものへ限定してください。別の状態管理、API framework、ORM、test runnerを重ねないでください。

## アーキテクチャ規約

依存方向は次を守ってください。

```text
React UI -> API client -> JSON Route Handler -> feature use case -> Drizzle -> PostgreSQL
```

- UIはDrizzleやserver専用moduleをimportしない。
- UIからの動的な読取・更新は共通APIクライアントとJSON Route Handlerを通す。
- Server Actionsを同じ機能の別API境界として追加しない。
- Route HandlerはZod入力検証、認証・認可、HTTP変換を担当する。
- API request/response/errorのZod schemaは `src/contracts` に置き、APIクライアント、Route Handler、MSWで共有する。
- ビジネスルールとtransactionは機能単位のユースケースへ置く。
- Drizzle queryをReactコンポーネントやdomainの純粋関数へ混ぜない。
- feature固有コードを早期に共通化しない。3回という回数だけでなく責務が同じと確認してから共通化する。
- 汎用Repository、DI container、CQRS、event busを導入しない。
- 日付・時刻処理は `src/lib/date-time/temporal.ts` から再exportする `@js-temporal/polyfill` の `Temporal` を使用し、`Date` を新規利用しない。
- 時刻依存ロジックは `Temporal.Instant` の評価時刻を引数で受け取り、domain関数内で現在時刻を直接取得しない。

## ビジネスルール変更

- `docs/PRODUCT.md` を正とし、実装だけでルールを変更しない。
- ルール変更時はPRODUCT、ARCHITECTURE、該当するTEST_SCENARIOS、実装、テストを同じPRで同期する。
- 注文状態をDBやRoute Handlerから直接書き換えず、状態遷移ユースケースを通す。
- 在庫を負数にしない。注文はカート、商品を固定順にロックし、checkoutToken検証、在庫減算、商品version更新、保存、カートclearを単一transactionで行う。
- 取消による在庫復元は注文状態更新と同じtransactionで一度だけ行う。
- 管理更新、注文減算、取消復元を含むすべての在庫変更で、商品の `version` を同じUPDATE内で1増やす。
- 管理更新の `expectedVersion` を省略したり、競合時に自動上書きしたりしない。
- 過去の注文表示には注文時スナップショットを使う。
- 商品・注文の物理削除を追加しない。
- カート・注文・履歴はcustomer専用、管理機能はadmin専用とし、adminに購入者権限を暗黙付与しない。
- クーポン管理UI/APIを追加せず、migration、seed、fixtureで用意する。

## DBとmigration

- 単体テストとフロントエンド結合テストではDBを起動しない。
- 実PostgreSQLはバックエンド結合テストとE2Eだけで使用する。
- SQLiteやin-memory DBでPostgreSQL結合テストを代替しない。
- migrationは空DBへ適用できる状態を保つ。
- mainへ取り込まれたmigrationファイルを書き換えない。変更は新しいmigrationで行う。
- schemaに表現できる `price >= 0`、`stock >= 0`、一意性、外部キーはDB制約でも保証する。
- テストDBと開発DBを別接続先にし、接続先guardなしでtruncate/resetしない。
- バックエンド結合テストは1 workerで直列実行し、各テスト開始前に全アプリtableをtruncateしてfixtureを作る。
- DB制約はRoute Handlerを経由せずDrizzle/DBへ不正値を直接投入するDB契約テストで確認する。
- E2E用のDBリセットはPlaywrightのglobal setupからscriptで実行し、テスト専用HTTP APIを追加しない。
- seedとfixtureには架空データ、固定ID、決定的な値を使用する。

## テスト規約

### 単体

- 純粋な金額計算、クーポン境界、状態遷移、Zod schemaを対象にする。
- DB、HTTP、Reactコンポーネントを持ち込まない。
- mockより明示的な入力・出力を優先する。

### フロントエンド結合

- 実コンポーネントツリーと共通APIクライアントを使う。
- HTTPだけをMSWで置換し、APIクライアントをmodule mockしない。
- 正常、空、ローディング、4xx、5xx、ネットワーク失敗、409、必要なrequest raceを扱う。
- 実装詳細ではなく、role、label、text、focus、aria-liveを検証する。

### バックエンド結合

- HTTP契約テストは実Route Handlerから実PostgreSQLまで接続する。
- DB契約テストはZodを経由せず、実PostgreSQLのCHECK、一意、外部キー、migrationを直接検証する。
- 認証・認可、制約、transaction、rollback、複数接続の競合を対象にする。
- 各テストが必要なfixtureを作り、他テストの結果へ依存しない。

### E2E

- 代表導線だけを対象にし、下位レベルの境界値を総当たりしない。
- Playwrightは1 workerで直列実行し、browser projectごとにすべての可変fixtureを分離する。
- `getByRole`、`getByLabel`、`getByText` を優先する。
- class名、DOM階層、`nth-child` に依存しない。
- `data-testid` は意味のあるroleやlabelで選択できない場合だけ使用する。
- 固定sleepを使わず、利用者が観測できる状態または確定したnetwork responseを待つ。

### VRT

- Storybookの固定fixtureを主対象にし、Chromiumで実行する。
- 外部画像、システム時刻、乱数、animationへ依存しない。
- 基準画像は意図したUI変更があるPRだけで更新する。
- 失敗を消す目的の一括更新や許容差拡大を行わない。

### 共通

- テスト追加前に `docs/TEST_SCENARIOS.md` の主担当レベルを確認する。
- 同じ仕様を全レベルへ重複実装しない。
- バグは再現できる最も低いレベルに回帰テストを追加する。
- `.only`、理由のない `.skip`、retry増加でflakeを隠さない。
- テストの実行順や共有された可変データへ依存しない。

## UI実装

- 正常だけでなく、対象画面の空、ローディング、エラー、競合状態を同じPRで実装する。
- ローディング・更新中は状態を支援技術にも伝え、重複操作を防止する。
- 409では利用者の入力を勝手に再送・上書きせず、最新状態を読み直して再確認を求める。
- 古い非同期レスポンスで新しい操作結果を上書きしない。
- キーボード操作、focus表示、見出し階層、label、画像alt、コントラストを確認する。
- テスト画像はリポジトリ内fixtureを使い、外部URLを前提にしない。

## 対象外

次を実装しないでください。

- 本物の決済、配送、税、返金
- OAuth、会員登録、パスワード再設定、ゲスト購入
- 商品バリエーション、カテゴリ、検索、絞り込み、お気に入り
- 複数・定額クーポン、利用回数制限
- 在庫予約、監査ログ、通知、リアルタイム更新
- マイクロサービス、多言語、多通貨
- 本番インフラや、将来用の空interface・table・feature flag

## 目標コマンド

Next.jsと各テスト基盤の導入後は、次のscriptsを維持してください。

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:frontend
pnpm test:backend
pnpm test:e2e
pnpm test:vrt
pnpm build
pnpm build-storybook
```

コマンドを追加・改名した場合は、この文書、README、GitHub Actionsを同じPRで更新してください。

## PR前の確認

- `git diff` で無関係な変更が混ざっていないか確認する。
- 該当するシナリオIDと最も低い適切なテストレベルを確認する。
- lint、typecheck、変更に関係するテスト、buildを実行する。
- DB変更では空DB migrationとバックエンド結合テストを実行する。
- UI変更ではフロント結合、Storybook、必要なVRTを実行する。
- 購入・認証・管理の導線変更では該当E2Eを実行する。
- 実行できなかった確認は、理由と未確認範囲をPRへ記載する。
- ビジネスルール、API、テスト境界を変えた場合は文書差分を含める。
