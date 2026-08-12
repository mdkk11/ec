# TEST STRATEGY

## 1. 目的

この文書は、ECテストサンドボックスにおける各テストレベルの責任、DB利用境界、実行方法、運用ルールを定義する。

テスト数を増やすこと自体を目的にしない。失敗したテストから問題の所在を判断でき、同じ仕様を必要以上に重複検証せず、変更に対して十分な確信を短時間で得られる構成を目指す。

具体的なケースは [TEST_SCENARIOS.md](./TEST_SCENARIOS.md)、プロダクトルールは [PRODUCT.md](./PRODUCT.md)、実装境界は [ARCHITECTURE.md](./ARCHITECTURE.md) を参照する。

## 2. テストレベルの責任分担

| レベル | 主な責任 | 対象例 | DB | HTTP | 主なツール |
| --- | --- | --- | ---: | --- | --- |
| 単体 | 1つの関数・schema・表示判断の入出力 | 金額計算、クーポン判定、状態遷移、Zod、reducer | 使用しない | 使用しない | Vitest |
| フロントエンド結合 | 表示コンポーネント、route境界、Client通信の協調 | 画面状態、操作、フォーム、エラー表示、アクセシビリティ | 使用しない | Client通信だけMSWで置換 | Vitest、Testing Library、MSW |
| バックエンド結合 | HTTP契約と実DBの整合性 | Route Handler契約、Drizzle/DB制約、トランザクション、競合 | 実PostgreSQL | HTTP契約ケースでRoute Handler | Vitest、PostgreSQL |
| E2E | ブラウザからDBまでの代表的な利用者導線 | ログイン、購入、履歴、管理操作、ロール分離 | 実PostgreSQL | 実アプリ | Playwright |
| VRT | 安定したUI状態の視覚差分 | 主要コンポーネント、画面状態、レスポンシブ | 使用しない | Storybook fixture | Storybook、Playwright |

### 判断原則

- ビジネスルールは、可能な限り単体テストを主担当にする。
- UIとAPIレスポンスの組み合わせはフロントエンド結合テストを主担当にする。
- PostgreSQLの制約・ロック・トランザクションに依存する保証はバックエンド結合テストだけで行う。
- E2Eは層をまたぐ代表導線と設定ミスの発見に限定し、入力境界を総当たりしない。
- 見た目はVRT、意味・操作可能性・読み上げ可能性はフロントエンド結合テストで扱う。
- あるバグを最も低いレベルで再現できる場合、そのレベルへ回帰テストを追加する。

## 3. 単体テスト

### 責任

- 商品価格、数量、割引率から金額を計算する純粋関数
- クーポンの開始・終了境界、最低購入額、有効状態の判定
- 注文ステータス遷移の許可・拒否
- Zod schemaの有効値、境界値、無効値
- 固定カテゴリのID・slug、category query、管理商品request schema
- UI状態を決める小さな変換関数やreducer
- APIエラーコードから画面表示へ変換する関数

### 対象外

- Reactコンポーネント間の協調
- `fetch`、MSW、Route Handler
- Drizzle、PostgreSQL
- CSSレイアウトや画像差分

### 方針

- 日付・時刻処理は共通moduleから `Temporal` polyfillを使用し、`Date` を新規利用しない。
- 時刻はdomain関数内部で直接取得せず、`Temporal.Instant` の評価時刻を引数で渡す。
- 金額は整数で検証し、小数の丸めに暗黙変換を使わない。
- 境界値を優先し、実装行をなぞるだけのテストを作らない。
- mockは原則不要とし、純粋な入出力で検証する。

## 4. フロントエンド結合テスト

### 責任

Server Component表示では、明示的なpropsを渡した表示コンポーネントとNext.jsのloading/error/not-found境界を描画する。Client Componentで通信が必要な機能では、TanStack Queryと共通APIクライアントを含むコンポーネントツリーを描画し、HTTPリクエストをMSWで受ける。次を検証する。

- 正常データの表示と主要操作
- データが0件の空状態と次の行動
- 初回読込・再読込・送信中のローディング状態
- 400、401、403、404、409、500、ネットワーク失敗の表示と回復導線
- フォームのクライアント側検証とサーバー側field errorの紐付け
- 管理商品カテゴリの必須選択、focus、競合時の入力保持と最新値提示
- 商品一覧のカテゴリnavigation、選択表示、全件・カテゴリ別の空状態、category not-found
- 送信中の二重操作防止
- 競合後に最新データを再取得する操作
- 複数リクエストの順序が逆転しても古い結果で上書きしないこと
- role、accessible name、focus、aria-liveなどのアクセシビリティ契約

### 境界

- PostgreSQL、Drizzle、Route Handlerを起動しない。Server Componentと実DBの結合はE2Eで確認する。
- Client通信ではAPIクライアントやTanStack Queryをmodule mockせず、ブラウザと同じHTTP呼び出しをMSWで置換する。
- 通常のMSW handlerは共有Zod契約と同じレスポンス・エラー形式を返す。APIクライアントの防御を確認する専用シナリオだけ、意図的にschema不正のpayloadを返す。
- ルーティングが重要なケースではApp Router相当のnavigation adapterを用いるが、Next.js内部実装の詳細は検証しない。
- スナップショット文字列だけで画面全体を検証しない。利用者が認識・操作する要素をassertする。

### 状態の扱い

| 状態 | 検証観点 |
| --- | --- |
| 正常 | データ、合計、利用可能操作、遷移先 |
| 空 | 空である説明、不要な操作がないこと、次の導線 |
| ローディング | 読込中の通知、操作抑止、完了後の解除 |
| エラー | 種別に合う文言、入力保持、再試行またはログイン導線 |
| 競合 | 自動上書きしないこと、最新値取得、再確認の要求 |

## 5. バックエンド結合テスト

### 責任

バックエンド結合は、実際のRoute HandlerからPostgreSQLまでを通す「HTTP契約テスト」と、DrizzleからPostgreSQL制約へ直接到達する「DB契約テスト」に分ける。

HTTP契約テストでは次を検証する。

- Zod入力とHTTPステータス・エラー形式
- セッションCookieからの利用者解決
- 未認証401、ロール不足403、他利用者の注文に対する404 `ORDER_NOT_FOUND`
- 公開商品のcategory絞り込みと固定順、空・不明・不正queryのHTTP変換
- カートの同一商品集約
- 注文時の再計算とスナップショット保存
- 注文トランザクションのcommit / rollback
- 条件付き在庫減算と同時注文
- `expectedVersion` による楽観ロック
- 取消時の状態更新と在庫復元の原子性

DB契約テストではRoute HandlerとZodを経由せず、Drizzleまたは同一接続のSQLから意図的な不正値を投入して、次を検証する。

- 価格・在庫・version・数量・割引率のCHECK制約
- カテゴリの一意・slug形式・表示順CHECK、商品categoryのNOT NULL・外部キー・削除制限
- cartと商品の複合一意制約
- 利用者、商品、カート、注文の外部キー
- 空DBへの全migration適用
- 既存商品を持つ旧schemaからのカテゴリbackfill migration

### DBを使う理由

次はin-memory代替やmockでは保証しない。

- PostgreSQLで実際に適用される型・制約・外部キー
- migrationが新規DBへ適用できること
- transaction rollback後に部分データが残らないこと
- 複数接続によるロック、条件付きUPDATE、競合結果
- Drizzleが生成するSQLとschemaの整合性

### データ分離

- バックエンド結合テストはVitest設定で1 worker・直列実行に固定する。並列化はworkerごとのDBを導入する別変更まで行わない。
- テストジョブ開始時に空のテストDBへmigrationを適用する。
- 各テストは必要最小限のfixtureを明示的に作る。
- 各テストの開始前に全アプリtableを依存順でtruncateし、そのテストのfixtureだけを投入する。
- 同時実行テストは別接続から同じ一意なfixtureを操作し、transaction共有による見かけ上の成功を避ける。
- テスト間でseedの更新結果を共有しない。
- 開発DBの接続文字列ではバックエンド結合テストを起動できないguardを設ける。

## 6. E2E

### 責任

E2Eは、ブラウザ、Next.js、Cookie、Route Handler、PostgreSQLが一体として動くことを、次の代表導線で確認する。

- 購入者ログインから商品閲覧、カート、クーポン、注文、注文履歴まで
- `ALL ITEMS` から代表カテゴリを選び、該当商品の詳細から同じカテゴリへ戻る導線
- 在庫条件が変わった注文の失敗と回復
- 管理者の商品作成・編集・非公開化
- 管理者の在庫更新と注文状態更新
- 購入者が管理画面・管理APIを利用できないこと

### ブラウザ構成

- デスクトップの主要購入導線をChromium、Firefox、WebKitで実行する。
- 管理導線は3ブラウザで最低1本の代表シナリオを実行する。
- モバイルはChromiumの代表viewportで、商品一覧、カート、購入導線のレスポンシブ操作を確認する。
- ブラウザ差が原因でないビジネスルールの境界値はE2Eで繰り返さない。

### データ準備

- Playwrightのglobal setupからテストDBをresetし、migrationと固定E2E seedを適用する。
- E2Eは小規模サンドボックスの決定性を優先し、Playwrightを1 workerで直列実行する。ブラウザproject間の並列化は行わない。
- テスト専用HTTP APIは作らない。
- テストは固定IDや固定表示名を利用できるが、実装上の連番順には依存しない。
- browser projectごとに利用者、セッション、カート、商品、クーポン、注文を含む全可変fixtureの名前空間を分離し、将来worker数を増やしても共有しない。
- E2E途中でfixtureの在庫を直接変更するscriptも、本番ユースケースと同様に商品versionを同じUPDATEで増やす。
- 外部サービスや外部画像への通信は行わない。

### セレクター

- `getByRole`、`getByLabel`、`getByText` を優先する。
- 見た目のclass名、DOM階層、nth-childへ依存しない。
- `data-testid` は意味のあるroleやlabelを付けられない場合だけ使用する。

## 7. VRT

### 責任

Storybook上の決定的なfixtureを使い、意図しない見た目の変化を検出する。主対象は次とする。

- 商品カード: 通常、在庫切れ、長い商品名
- 商品一覧: 通常、空、ローディング、エラー
- 商品詳細: 通常、在庫切れ、長い商品名・説明
- カート: 通常、空、更新中、在庫競合
- クーポン: 適用済み、入力エラー、期限切れ
- 注文履歴: 通常、空
- 管理表・フォーム: 通常、入力エラー、更新中、競合
- 共通エラー表示、toast、dialog

### 実行条件

- VRTはChromiumだけで実行する。
- CIと基準画像更新は `mcr.microsoft.com/playwright:v1.61.1-noble` の固定Linux環境で実行する。
- viewportは必要なstoryに限り375px、768px、1440pxを使用する。
- フォントとテスト画像をリポジトリ内に固定する。
- 現在時刻、UUID、乱数、アニメーション、caret、transitionを固定または無効化する。
- ローディングstoryはMSWの無期限pendingに依存せず、明示的な表示状態をfixtureで作る。
- ピクセル差分の許容値は設定ファイルで一元管理し、個別テストで安易に緩和しない。

### 基準画像の更新

- 基準画像はレビュー対象としてリポジトリで管理する。
- 基準画像はPlaywrightの固定Linux環境で生成し、macOSで生成した画像を正本にしない。
- UI変更の意図が確認できるPRだけで更新する。
- VRT失敗を解消する目的だけで一括更新しない。
- PRには影響したstoryとBefore / After、または変更後画像を添付する。

## 8. 重複を避ける対応例

| 仕様 | 主担当 | 他レベルでの確認 |
| --- | --- | --- |
| 割引額の切り捨て | 単体 | E2Eでは計算済み合計が表示される1例だけ |
| クーポン終了日時を含まない | 単体 | バックエンド結合で時計値が伝播する1例 |
| 409時の画面表示 | フロントエンド結合 | E2Eでは実在庫変化を使う代表1例 |
| 在庫が負数にならない | バックエンド結合 | E2Eで同時注文を再現しない |
| 3ブラウザで購入できる | E2E | 下位レベルでブラウザ差を模倣しない |
| 375pxでカードが崩れない | VRT | E2Eでは操作可能性だけ確認 |

## 9. CI構成

GitHub Actionsでは次のジョブへ分け、失敗した責任範囲を判別できるようにする。

全ジョブは独立runnerで動く前提とし、checkout、pnpm setup、Node.js setup、pnpm cache、`pnpm install --frozen-lockfile` をそれぞれ実行する。PostgreSQL serviceを使うジョブはhealth check完了後にmigrationを実行する。

1. `static-and-unit`
   - lint
   - typecheck
   - 単体テスト
   - フロントエンド結合テスト
2. `backend-integration`
   - PostgreSQL service起動
   - PostgreSQL health check
   - migration
   - バックエンド結合テスト
3. `storybook-vrt`
   - Playwright 1.61.1とChromiumを含む固定Linux container
   - Node.js 24、pnpm 11、依存packageのinstall
   - Storybook build
   - Storybook起動
   - Chromium VRT
4. `e2e`
   - PostgreSQL service起動
   - PostgreSQL health check
   - Playwright Chromium、Firefox、WebKitとOS依存packageのinstall
   - migration / E2E seed
   - Next.js build / start
   - Chromium、Firefox、WebKit

package scriptは導入時に次の契約へ揃える。

```text
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:frontend
pnpm test:backend
pnpm test:e2e
pnpm test:vrt
pnpm test:vrt:update
pnpm build
pnpm build-storybook
```

各ジョブは `DEVELOPMENT_PLAN.md` の該当フェーズで導入し、導入後は通常PRの必須checkとする。Phase 8完了後は4ジョブすべてを必須にする。基準画像更新を伴うPRでもVRTをskipしない。

## 10. カバレッジと品質判断

- 単一の全体カバレッジ率を品質目標にしない。
- 金額計算、クーポン判定、注文状態遷移は分岐と境界値をすべて単体テストする。
- 注文・取消トランザクションは成功と各rollback経路をバックエンド結合で検証する。
- 新しいビジネスルールには対応するテストシナリオIDを追加する。
- flakeは再実行で隠さず、時刻、非同期待機、共有データ、外部依存のどれが原因かを修正する。
- `.only`、恒久的な`.skip`、理由のないretry増加を許可しない。

## 11. テストしない領域

- Next.js、React、Drizzle自体の内部実装
- ブラウザ標準機能の網羅
- PostgreSQLエンジン自体の正しさ
- 実在する決済・配送・メールサービス
- 負荷、性能、侵入、災害復旧試験
- 対象外機能に関する将来想定のテストfixture
