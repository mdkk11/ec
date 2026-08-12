# トップページの導線・商品数・文言を整える実行計画

## 1. 背景と目的

トップページと共通レイアウトには、商品を見つけても詳細へ移動できない箇所、不要なページ内リンク、未実装機能を示すだけのフッター項目が残っている。また、ヘッダーの日本語ラベルと英語の編集コピーが混在し、ブランドサイトとして文字のバランスが不自然になっている。

公開商品の固定seedを4件から24件へ増やし、後続の商品一覧ページネーションを検証できるデータ量を用意する。トップページでは新着8件だけを編集表示し、商品一覧・商品詳細へ正常に移動できるようにする。商品画像は固定ローカルfixtureと `next/image` を使用し、すべてのテストを決定的に保つ。

共通ナビゲーションはユーザー指定の `ALL ITEMS`、`Login` を基準に短い英語へ統一し、説明、状態、エラー、購入・管理操作は自然な日本語を維持する。本計画の承認までは実装を開始しない。

## 2. 現状調査

### 調査済みの事実

- `src/components/layout/SiteHeader.tsx` は `商品一覧`、`SEASONAL EDIT`、`POINT OF VIEW` の3リンクを表示し、モバイルでは3リンク用の開閉メニューを持つ。
- 未認証時のヘッダー操作は `ログイン` である。認証後は購入者に `注文履歴`、`カート`、管理者に `商品管理`、`注文管理`、両ロールに `ログアウト` を表示する。
- `src/features/home/components/HeroSection.tsx` の `新着を見る` は `/products` ではなく、同じページの `#new` へ移動する。
- `src/features/home/components/ProductPreviewCard.tsx` は商品詳細へのリンクを持たず、商品名を1行で切り捨てる。
- `src/features/home/home-content.ts` のトップ商品は4件で、数値IDはDBの商品UUIDと結び付いていない。
- 通常seedは公開商品4件と非公開商品1件を持つ。E2E seedは購入導線専用の公開商品5件を追加するため、現在のE2E商品一覧は9件になる。
- 商品画像のZod契約と管理フォームは `/images/` で始まるローカルpathを前提としている。
- `SiteFooter` は実在する3リンクに加え、ルートを持たない配送、問い合わせ、サイズガイド、FAQ、SNS、Journalを文字だけで表示する。
- `PRODUCT.md`、`DEVELOPMENT_PLAN.md`、`DESIGN.md`、`AGENTS.md` は操作・状態・エラーを日本語とし、英語はブランド名、シーズン名、編集見出しに限定している。今回指定された `ALL ITEMS`、`Login` は現行ルールの例外になる。
- 検索、カテゴリ、絞り込み、お気に入り、配送、問い合わせ、SNS連携、productionインフラは対象外である。
- 計画ファイル以外のworktreeはcleanである。

### 採用する完成像

- 通常seedの公開商品を24件にする。既存4件を維持し、固定UUID・固定日時を持つ20件を追加する。
- トップページは作成日時順の先頭8件だけを表示する。トップ8件のIDは通常seedの商品UUIDと一致させる。
- 24商品は1商品1枚の固定ローカルJPEGを使用し、`next/image` で通常どおりHTTP取得・最適化する。一覧・トップは通常の遅延読み込み、詳細の主画像は既存の `priority` を維持する。
- ヘッダー左側は `ALL ITEMS` だけにし、`SEASONAL EDIT` と `POINT OF VIEW` を削除する。
- 未認証時は `Login`、購入者は `Orders` / `Cart` / `Logout`、管理者は `Products` / `Orders` / `Logout` とする。
- 説明、状態、エラー、フォーム、購入・管理操作は日本語を維持する。

## 3. 解決する問題

1. トップの商品カードから商品詳細へ移動できない。
2. ヒーローの主要CTAが商品一覧へつながらない。
3. ヘッダーに不要なページ内リンクと、1リンクには過剰なモバイル開閉メニューがある。
4. ヘッダー内の日本語・英語ラベルの粒度が揃っていない。
5. 通常seedが4件しかなく、後続のページネーションを確認できるデータ量がない。
6. フッターが未実装機能を利用できるように見せている。
7. メールマガジン未実装中にもかかわらず「月に2回お届けします」と断定している。
8. 今回の英語ナビゲーション指定と既存文書の日本語UI原則が矛盾している。
9. トップ用商品IDと通常seedが別ファイルにあり、代表1件だけの確認では残りの商品リンク切れを検出できない。

## 4. 採用する方針

### 文言と共通レイアウト

- グローバルナビゲーションだけを短い英語ラベルに統一する。
  - 匿名: `ALL ITEMS` / `Login`
  - 購入者: `ALL ITEMS` / `Orders` / `Cart` / `Logout`
  - 管理者: `ALL ITEMS` / `Products` / `Orders` / `Logout`
- `SEASONAL EDIT` と `POINT OF VIEW` はヘッダーから削除する。トップページ内の編集セクション自体は残す。
- モバイルの `<details>` メニューを削除し、全viewportで `ALL ITEMS` を直接表示する。中央ロゴ、右側アカウント操作の3列は維持する。
- ヒーローの主要CTAを `/products` へ接続する。編集セクションへの補助CTAは残すが、ヘッダーへ同じリンクを重複させない。
- ヒーロー補足を「軽やかな素材と落ち着いた色を、春から夏の日常へ。」へ修正する。
- 編集セクション導入を「今季の服と道具を、素材と使い心地から3つのテーマで選びました。」へ修正する。
- 未実装機能の準備中表示だけになっているメールマガジンセクションは削除する。
- フッターからHELP・FOLLOWの未実装項目と不要な編集セクションリンクを削除する。ロゴ、ブランド説明、実在する `ALL ITEMS` 導線、著作権・通貨表示だけの簡潔な構成にする。
- フッターのブランド説明は「毎日の服と道具を、素材と使い心地から選ぶ小さなオンラインストアです。」とする。
- 375pxでは認証済みメールアドレスを非表示にし、ナビゲーションの文字サイズと間隔を詰める。リンクとボタンは高さ44px以上を維持し、anonymous/customer/adminの各状態でロゴと重ならないことを確認する。

### 商品データ

- 既存4件のID、価格、在庫、先頭4件の並び順を維持する。
- 非公開商品の既存ID末尾 `005` は維持し、追加20件はID末尾 `006`〜`025` を使う。
- 追加商品の `createdAt` は `2026-02-28` から1日ずつ古くし、既存4件とE2E専用商品の相対順を変えない。
- 追加20件は次の固定内容を使用する。

| 商品名 | 価格 | 在庫 | 画像ファイル |
| --- | ---: | ---: | --- |
| コットンツイル ワイドトラウザー | 24,200円 | 6 | `cotton-twill-trousers.jpg` |
| ファインウール リブカーディガン | 31,900円 | 4 | `rib-cardigan.jpg` |
| ウォッシュドキャンバス トート | 16,500円 | 10 | `canvas-tote.jpg` |
| ストーンウェア マグ | 4,950円 | 12 | `stoneware-mug.jpg` |
| コンパクトウール ブルゾン | 42,900円 | 3 | `wool-blouson.jpg` |
| シルクコットン スカーフ | 13,200円 | 8 | `silk-cotton-scarf.jpg` |
| メリノウール クルーネックニット | 29,700円 | 5 | `merino-crewneck.jpg` |
| ウールブレンド プリーツスカート | 26,400円 | 7 | `pleated-skirt.jpg` |
| コットンポプリン バンドカラーシャツ | 19,800円 | 6 | `band-collar-shirt.jpg` |
| リサイクルナイロン ショルダーバッグ | 18,700円 | 9 | `nylon-shoulder-bag.jpg` |
| グレインレザー カードケース | 9,900円 | 15 | `leather-card-case.jpg` |
| キャンバス デッキシューズ | 17,600円 | 4 | `canvas-deck-shoes.jpg` |
| ウールフェルト ルームシューズ | 8,800円 | 0 | `felt-room-shoes.jpg` |
| ブラス デスクトレイ | 7,700円 | 11 | `brass-desk-tray.jpg` |
| リサイクルガラス カラフェ | 6,600円 | 8 | `glass-carafe.jpg` |
| ウォッシュドリネン クッションカバー | 11,000円 | 7 | `linen-cushion-cover.jpg` |
| オークウッド シューホーン | 5,500円 | 10 | `oak-shoehorn.jpg` |
| ストーンウェア ディナープレート | 4,400円 | 12 | `stoneware-dinner-plate.jpg` |
| コットンウール スローケット | 14,300円 | 5 | `cotton-wool-throw.jpg` |
| シダーウッド ハンガーセット | 12,100円 | 6 | `cedar-hangers.jpg` |

- 各商品へ、素材・用途・手触りを1〜2文で説明する自然な日本語descriptionを用意する。商品名の単なる言い換えや同じ定型文の反復は避ける。

### 商品画像

- 24商品すべての画像をローカル固定fixtureとする。既存4商品のファイル名・参照pathは維持するが、商品名と被写体の不一致、商標ロゴ、縦横比のばらつきを解消するため、追加20枚と同じ条件で全24枚を `imagegen` スキルにより生成し直す。
- 生成した24枚は `public/images/home/` に既存4件と上表20件の固定ファイル名で保存し、参照pathを増やさない。
- 全商品画像を3:4、1200×1600px相当、文字・ロゴなし、淡い単色背景、自然光、低彩度、商品単体が判別できる構図へ揃える。
- 採用後の画像は固定fixtureとしてコミットし、テスト実行時に再生成しない。
- 商品表示は既存の `next/image`、`fill`、3:4 aspect ratio、responsive `sizes` を使う。ブラウザの独自`fetch`、画像API、外部CDN、画像proxyを追加しない。

### トップ商品との整合

- `PreviewProduct.id` をDBと同じUUID文字列へ変更する。
- トップの新着8件は既存4件と追加商品の先頭4件とする。
- トップ用のブランド・色は編集情報として `home-content.ts` に維持し、DB schemaへ列を追加しない。
- 商品プレビューカード全体をNext.jsの内部リンクにし、accessible nameを「<商品名>の詳細を見る」とする。
- 商品名の1行truncateを削除し、狭い幅でも折り返す。
- `4 ITEMS` の固定値を削除し、トップ用配列長から `8 ITEMS` を表示する。

### 仕様同期

- `AGENTS.md`、`docs/PRODUCT.md`、`docs/DEVELOPMENT_PLAN.md`、`DESIGN.md` へ「グローバルナビゲーションの短いブランドラベルは英語を許可する」という例外を同じ表現で追加する。
- `DESIGN.md` のトップ商品数を8件、通常商品seedを24件へ更新する。
- `docs/TEST_SCENARIOS.md` の `E2E-007` を、トップの `ALL ITEMS` と全8商品リンクの有効性、代表商品のブラウザ遷移を含む内容へ更新する。

## 5. 採用しない方針

- `SEASONAL EDIT` と `POINT OF VIEW` のリンク先としてカテゴリ画面や記事画面を新設しない。
- 検索、カテゴリ、絞り込み、お気に入り、配送、問い合わせ、FAQ、SNS、メールマガジン登録を実装しない。
- 商品一覧のページネーションUI、query parameter、API契約は今回追加しない。24件は後続変更に使えるデータとして用意する。
- 外部画像host、Unsplash API、画像CDN、S3互換storage、productionインフラを追加しない。
- 画像URL対応のZod契約、`next.config.ts` の `remotePatterns`、E2Eの外部通信mockを追加しない。
- トップページをDB取得する動的一覧へ変更しない。トップは8件の編集用固定コンテンツ、商品一覧・詳細は既存のServer Componentとseedを使用する。
- トップ用編集データとseedのためだけに共通repositoryや設定層を追加しない。整合はテストで保証する。
- API契約、DB schema、migration、商品ビジネスルール、並び順を変更しない。
- フォーム、エラー、在庫、注文、管理画面の操作文言を英語へ一括翻訳しない。
- 新しい依存packageやトップ専用のVRT設定・実行基盤を追加しない。既存Storybook/VRTへ決定的な共通レイアウトstoryを1件追加する。

## 6. 変更対象

### 方針文書

- `AGENTS.md`: グローバルナビゲーションの英語例外を追加する。
- `docs/PRODUCT.md`: UI表記の仮定を同期する。
- `docs/DEVELOPMENT_PLAN.md`: Phase 1のコピー方針を同期する。
- `DESIGN.md`: ブランドボイス、ヘッダー、トップ8件・通常seed24件を更新する。
- `docs/TEST_SCENARIOS.md`: `E2E-007` をトップ導線まで拡張する。

### 商品データと画像

- `src/server/db/seed.ts`: 固定UUID・日時・価格・在庫・ローカル画像pathを持つ公開商品20件を追加する。
- `public/images/home/*.jpg`: 既存4商品画像を置換し、上表に対応する商品画像20枚を追加する。
- `src/features/home/home-content.ts`: UUID化した新着8商品の編集情報を定義する。

### トップページ・共通レイアウト

- `src/components/layout/SiteHeader.tsx`: 不要な2リンクとモバイルメニューを削除し、`ALL ITEMS` を直接表示する。
- `src/features/auth/SessionControls.tsx`: ロール別の英語ナビゲーションへ変更する。
- `src/components/layout/SiteFooter.tsx`: 未実装項目を削除し、実在する導線だけへ縮小する。
- `src/features/home/components/HeroSection.tsx`: 主要CTAを商品一覧へ接続し、補足文を修正する。
- `src/features/home/components/EditorialSection.tsx`: 導入文をブランドボイスへ合わせる。
- `src/features/home/components/NewArrivalsSection.tsx`: 配列長から件数を表示する。
- `src/features/home/components/ProductPreviewCard.tsx`: 商品詳細リンク、accessible name、折り返す商品名を実装する。
- `src/features/home/components/NewsletterSection.tsx`: 未実装機能の準備中表示だけになっているため削除する。
- 共通レイアウトのStorybook story: anonymous状態のトップ、ヘッダー、フッターを既存VRTで撮影できる決定的なstoryを追加する。

### テスト

- `src/features/home/HomePage.frontend.test.tsx`: 新着8件、全href、UUIDの一意性、CTA、未実装操作の非表示を確認する。
- `src/features/auth/LoginForm.frontend.test.tsx`: `SessionControls` の英語ラベルとhrefへassertionを同期する。ログインフォームの日本語送信ボタンは変更しない。
- `tests/e2e/app-shell.spec.ts`: トップ画像数12枚、ローカル画像path、ヘッダーのレイアウト・focusを確認する。
- `tests/e2e/product-browsing.spec.ts`: E2E商品一覧29件、通常商品24枚の読込・ローカルpath・一意性、トップ8件すべてのhrefが200、代表カードのブラウザ遷移、既存の一覧→詳細→一覧を確認する。
- `tests/e2e/authentication.spec.ts`: ヘッダー内の `Login` / `Logout` へ操作名を同期する。
- `tests/e2e/admin-products.spec.ts`: ヘッダー内の `Products` へ操作名を同期する。
- `tests/e2e/admin-orders.spec.ts`: ヘッダー内の `Orders` へ操作名を同期する。

## 7. 実装手順

1. 方針文書5件を更新し、英語にする範囲、日本語を維持する範囲、通常seed24件・トップ8件、`E2E-007` を同期する。
2. 追加20商品の固定ID・日時・価格・在庫・description・画像pathを `src/server/db/seed.ts` へ追加する。
3. 24商品すべてがローカル固定fixtureを参照する構成にし、既存4枚を含む全24枚を `imagegen` で生成する。3:4、商品との一致、文字・ロゴなし、統一した色調を確認して固定ファイル名で保存する。
4. `home-content.ts` のIDを実商品UUIDへ変更し、追加商品の先頭4件を含む新着8件を定義する。
5. `ProductPreviewCard` を詳細リンクへ変更し、全カードをキーボードで選択可能にする。商品名のtruncateを削除する。
6. `HeroSection` の主要CTAを `/products` へ変更し、トップの対象文言を修正する。`NewArrivalsSection` は配列長から `8 ITEMS` を表示する。
7. `SiteHeader` から不要リンクとモバイルメニューを削除し、`ALL ITEMS` を直接配置する。`SessionControls` をロール別の英語ナビゲーションへ変更する。
8. `SiteFooter` を実在する導線だけへ縮小し、未実装のメールマガジンセクションを削除する。375pxでは認証済みメールアドレスを隠し、anonymous/customer/adminのヘッダーを崩さない。
9. フロント結合テストでトップ8件のUUID一意性、全href、accessible name、英語ナビゲーションを確認する。
10. E2Eでトップ8件のhrefを収集し、すべて一意かつ200であることを確認する。代表1件はクリックして商品詳細へ遷移する。
11. E2E商品一覧件数を、通常seed24件とE2E購入用5件の合計29件へ同期する。通常商品24件の画像を順にviewportへ入れ、読込完了、ローカルpath、pathの一意性を確認する。
12. 共通レイアウトの決定的なStorybook storyを追加し、既存VRTで375px、768px、1440pxを撮影する。
13. lint、typecheck、unit、frontend、backend、E2E、build、Storybook、VRTを実行する。
14. 375px、768px、1440pxでトップ、ヘッダー、フッター、商品一覧を目視確認する。375pxはanonymous/customer/adminをすべて確認する。

### stacked PR構成

1. `feature/storefront-catalog-fixtures`: 固定商品fixtureを24件に拡充する。
   - 責務: 通常seed20件の追加、全24商品画像の固定fixture化、商品一覧29件と通常商品24画像のE2E同期、seed数に関する文書更新。
   - 親: `main`。
   - 中間HEAD: 商品一覧・詳細・既存購入導線が動作し、通常商品24枚がローカルpathから読み込める。
   - 必須確認: `pnpm lint`、`pnpm typecheck`、`pnpm test:backend`、対象の `product-browsing.spec.ts`、`pnpm build`。
2. `feature/storefront-product-links`: トップ商品を実在商品へ接続する。
   - 責務: トップ8件のUUID、カードと主要CTAのリンク、件数表示、Homeフロント結合、`app-shell.spec.ts` の画像件数・ローカルpath同期、トップ導線E2E、`E2E-007` 更新。
   - 親: `feature/storefront-catalog-fixtures`。
   - 中間HEAD: トップ8件のhrefが一意で、すべて実在商品へ接続する。
   - 必須確認: `pnpm lint`、`pnpm typecheck`、`pnpm test:frontend`、対象の `app-shell.spec.ts` と `product-browsing.spec.ts`、`pnpm build`。
3. `feature/storefront-navigation-copy`: 共通ナビゲーションとトップ文言を整える。
   - 責務: Header、SessionControls、Footer、コピー、Newsletter削除とHomePageフロント結合テスト同期、言語方針文書、共通レイアウトstory、認証・管理E2E、VRT。
   - 親: `feature/storefront-product-links`。
   - 中間HEAD: 既存ルートだけを英語ナビゲーションで表示し、全viewportと認証状態で横overflow・ロゴ重なりがない。
   - 必須確認: `pnpm lint`、`pnpm typecheck`、`pnpm test:unit`、`pnpm test:frontend`、`pnpm test:backend`、`pnpm test:e2e`、`pnpm build`、`pnpm build-storybook`、`pnpm test:vrt`。

各層は独立してbuildと担当テストを成功させ、下位層の変更後は子孫をrestackして該当確認をやり直す。

## 8. テスト・検証方法

### 静的・フロントエンド結合

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:frontend`
- HomePageで次を確認する。
  - 新着8商品と `8 ITEMS` を表示する。
  - 8件のUUIDとhrefが一意である。
  - 8件すべてが対応する `/products/:productId` を持つ。
  - 詳細リンクのaccessible nameに商品名が含まれる。
  - ヒーローの主要CTAが `/products` を指す。
  - 検索、お気に入り、仮カート、メールマガジン登録操作を追加していない。
- SessionControlsで次を確認する。
  - 匿名は `Login`。
  - customerは `Orders`、`Cart`、`Logout`。
  - adminは `Products`、`Orders`、`Logout`。
  - 各ラベルが正しい既存ルートまたはlogout処理へ接続する。
  - logout中、失敗、認証確認失敗の日本語状態表示を維持する。

### Backend・E2E

- `pnpm db:prepare:test && pnpm test:backend`
  - API契約、DB制約、並び順に回帰がないことを確認する。画像契約を変更しないため、新しい画像URLテストは追加しない。
- `pnpm test:e2e`
  - トップの `ALL ITEMS` から商品一覧へ遷移できる。
  - トップ8件のhrefがすべて一意で200を返す。
  - 代表商品カードをクリックして対応する詳細へ遷移できる。
  - 一覧は通常seed24件とE2E購入用5件の合計29件を表示する。
  - 通常商品24件を順にviewportへ入れ、各画像の `naturalWidth > 0`、`/images/home/*.jpg` の元path、24pathの一意性を確認する。
  - 商品一覧の先頭と既存購入導線が変わらない。
  - anonymous/customer/adminの英語ヘッダーナビゲーションが正しいルートへ移動する。
  - ページが外部画像hostへ通信しない。

### ビルド・視覚確認

- `pnpm build`
- `pnpm build-storybook`
- `pnpm test:vrt`
  - anonymous状態のトップ、ヘッダー、フッターを含む共通レイアウトstoryを375px、768px、1440pxで撮影する。
  - 既存のローカルfixtureだけで成功する。
  - 意図しない差分がなければ基準画像は更新しない。
- 375px、768px、1440pxで次を目視する。
  - 375pxでanonymous/customer/adminを表示し、中央ロゴが `ALL ITEMS` と認証操作に重ならない。認証済みメールアドレスは非表示になる。
  - モバイルで開閉メニュー削除後も操作領域が44px以上ある。
  - トップ8件の2列・3列・4列グリッドが破綻しない。
  - 商品一覧24件の余白、カード高さ、画像比率が揃う。
  - 長い商品名が切り捨てられず、カード同士へ重ならない。
  - 24商品すべての画像内容が商品名と一致し、重複・文字・ロゴ・破損がない。
  - フッターにリンクと誤認する未実装項目が残っていない。
  - `ALL ITEMS`、`Login`、商品カードのfocusが視認できる。

## 9. リスク

- 通常seedを20件増やすと、E2E商品一覧件数が9件から29件へ変わる。固定件数を持つ商品閲覧E2Eを同じ変更で更新する。
- トップ用編集データとseedは別ファイルにあるため、UUIDの不一致で404になり得る。トップ8件すべてをE2EのHTTP確認対象にする。
- 24枚の生成画像は商品との不一致、重複、文字混入が起こり得る。生成後に一覧montageと個別画像を確認し、不適切な画像だけを再生成する。
- 画像ファイルが大きいとrepository、build、初回表示へ影響する。1200×1600px相当へ揃え、品質を目視できる範囲で圧縮する。
- 24商品を一度に表示するため、ページは長くなる。今回はページネーションを先回りせず、後続実装の比較基準として受け入れる。
- ヘッダー右側はログイン後に項目が増えるため、375pxでロゴと重なる可能性がある。短い英語ラベルと実viewport確認で調整する。
- `Orders` はcustomerとadminで異なるルートを指す。role分岐テストでhrefまで確認する。
- 言語方針を文書へ反映しないと、後続変更で日本語へ戻される可能性がある。関連文書とAGENTSを同じ変更へ含める。

## 10. 未確定事項

なし。

24件という商品数、トップ8件、追加20商品の名称・価格・在庫・画像ファイル名、ローカル画像方針を本計画の確定案とする。ページネーションのページサイズとURL契約は、実装が要求された時点で別計画として決定する。

## 11. 完了条件

- ヘッダーに `SEASONAL EDIT` と `POINT OF VIEW` が表示されない。
- ヘッダーが `ALL ITEMS` とロール別の英語アカウント導線へ統一され、すべて既存ルートへ移動する。
- トップの主要CTAが商品一覧へ移動する。
- 通常seedに公開商品24件があり、トップは新着8件だけを表示する。
- 追加20件が固定UUID・日時・価格・在庫、自然な日本語名・descriptionを持ち、既存4件を含む全24件が固有のローカル固定fixtureを参照する。
- トップ8件のhrefが一意で、すべて実在する商品詳細を200で返す。
- 24商品すべてが商品名と一致する3:4のローカル画像を `next/image` で表示し、自動テスト・通常表示とも外部画像hostへ依存しない。
- トップ件数がデータ件数から算出され、商品名が狭い画面でも切り捨てられない。
- フッターに未実装機能を利用できるように見せる項目が残らない。
- 未実装のメールマガジン登録セクションがトップに残らない。
- 英語ナビゲーションと日本語の説明・状態・取引操作の境界が方針文書と実装で一致する。
- `E2E-007` がトップから一覧・詳細への導線を含み、既存の商品閲覧・購入・管理導線が回帰しない。
- 商品一覧のページネーションは追加せず、後続確認に使える24件のseedだけを用意する。
- lint、typecheck、unit、frontend、backend、E2E、VRT、アプリbuild、Storybook buildが成功する。
- 共通レイアウトstoryが375px、768px、1440pxのVRT対象になっている。
- 375px、768px、1440pxで横overflow、文字重なり、focus欠落、画像崩れがなく、375pxのanonymous/customer/adminでロゴとナビゲーションが重ならない。
