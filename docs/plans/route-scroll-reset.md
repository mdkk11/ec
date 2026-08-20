# Route遷移時のスクロール位置修正計画

## 1. 背景と目的

`scroll-behavior: smooth` の削除後も、商品一覧などを下へスクロールしてNext.jsの `Link` から別ページへ進むと、遷移先がページ先頭ではなく途中の位置で開く。global smooth scrollの削除はスクロールのアニメーションを無効にするだけで、App Routerの位置判定・復元を変更しない。

この変更では、新しいページへの通常のLink遷移を即座にページ先頭へ移動させる。独自のscroll管理componentは追加せず、現在固定しているNext.js 16.2.11のscroll handlerとE2Eだけを変更する。

## 2. 現状調査

### 調査済みの事実

- 作業開始時に `origin/main` を取得し、ローカル `main` をマージ済みPR #34の `43d06ac2bacebabc9f9dcb1126121ab74519bd43` へfast-forwardした。
- `feature/route-scroll-reset` は `43d06ac` をbaseにした単独stackで、計画作成前のworktreeはcleanである。
- `package.json` はNext.js `16.2.11` を固定している。
- `src/app/globals.css` にglobalな `scroll-behavior: smooth` はなく、reduced motion内の `scroll-behavior: auto !important` だけが残っている。
- repository内のNext.js `Link` に `scroll={false}` はなく、通常遷移は既定の `scroll=true` を使っている。
- 現行buildで `/products` を `scrollY=1700` まで下げ、表示中の商品リンクから詳細へ遷移すると、詳細表示後の `scrollY` は `736` になった。
- Next.js 16.2.11の旧App Router scroll handlerは、遷移先segmentの先頭DOM要素を探索し、その要素の上端がviewport内と判定されると現在位置を維持する。
- ソースを変更せず `__NEXT_EXPERIMENTAL_APP_NEW_SCROLL_HANDLER=true` で別buildを作り、同じ操作を行うと、詳細表示後の `scrollY` は `0` になった。
- `next.config.ts` の型とNext.jsのconfig schemaは `experimental.appNewScrollHandler` を提供している。
- `tests/e2e/product-browsing.spec.ts` は実Next.js App Routerで商品一覧から詳細へ進む `E2E-007` を持つが、遷移後のスクロール位置は検証していない。
- 実装中に追加したproduction buildのE2Eでは旧handlerでも先頭表示になった。旧handlerの途中位置は実ブラウザ/dev環境で再現するため、E2Eは設定差分のred-greenではなく、利用者向け契約を固定する回帰テストとして扱う。

### 推測

- 現象はCSS animationではなく、Next.js 16.2.11の旧App Router scroll handlerが新しいsegmentのscroll対象を部分的に合わせることで発生している。新handlerを有効にした比較結果と、repository内に別のscroll制御がないことがこの判断を支持する。

## 3. 解決する問題

商品一覧の中ほど・下部から商品詳細へ進んだ利用者が、詳細ページのパンくずや商品画像上端ではなく途中から閲覧を始める。前画面の縦位置が遷移先へ持ち越されたように見え、ページ間navigationは即時に先頭から始まるという `DESIGN.md` の方針を満たさない。

## 4. 採用する方針

- `next.config.ts` で `experimental.appNewScrollHandler: true` を明示する。
- 商品一覧を十分に下へスクロールしてから実在商品のLinkを操作し、商品詳細の見出し表示後に `window.scrollY === 0` となるE2Eを追加する。
- Next.jsとbrowserを含む問題なので、回帰テストの主担当をE2Eとする。React表示componentやCSSの単体・Frontend結合テストは追加しない。
- `docs/TEST_SCENARIOS.md` に、この再現条件を独立した `E2E-008` として記録する。
- 通常の前方Link遷移だけを対象とし、同一ページ内hash navigationとbrowserの戻る・進むによる履歴復元はNext.js/browser標準へ委ねる。

## 5. 採用しない方針

- `usePathname` と `window.scrollTo` を使うglobal Client Componentは追加しない。すべてのpathname変更で強制resetすると、browser back時の位置復元まで壊し、Next.jsと重複するscroll管理を所有するためである。
- 各 `Link` へ既定値と同じ `scroll={true}` を列挙しない。現行の旧handlerでもtrueであり、再現した問題を解決しない。
- click handlerで遷移前に `window.scrollTo(0, 0)` を呼ばない。Linkごとの実装漏れを作り、遷移成立前に元画面だけが動くためである。
- CSSの `scroll-behavior` を再追加・変更しない。スクロール位置の決定とは別責務である。
- Next.jsのversion更新、独自router wrapper、外部dependencyは追加しない。

## 6. 変更対象

- `next.config.ts`: `experimental.appNewScrollHandler` を有効化する。
- `tests/e2e/product-browsing.spec.ts`: 深い位置の商品Linkから詳細へ進む回帰E2Eを追加する。
- `docs/TEST_SCENARIOS.md`: `E2E-008` の前提・導線・Chromium主担当を追加する。

PRODUCTのビジネスルール、API、DB、React表示、Storybook/VRTの見た目は変更しない。`PRODUCT.md`、`ARCHITECTURE.md`、VRT baselineは変更対象外とする。

## 7. 実装手順

1. `next.config.ts` の既存 `nextConfig` に `experimental: { appNewScrollHandler: true }` を追加する。
2. `tests/e2e/product-browsing.spec.ts` に `E2E-008` を追加する。`/products` を開き、意味のあるaccessible nameで対象商品Linkを取得し、Linkがviewport内にある深い位置までscrollする。遷移前が `scrollY > 0` であること、Link操作後に商品詳細URLとH1が確定すること、その後 `scrollY` が0であることを確認する。
3. `docs/TEST_SCENARIOS.md` のE2E表へ、商品一覧下部から詳細への通常Link遷移が先頭表示になるシナリオを追加する。
4. diffと対象テストを確認し、設定・回帰テスト・scenario文書だけを1つのfix commitへまとめる。

## 8. テスト・検証方法

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:frontend`
- `pnpm build`
- `pnpm test:e2e --project=chromium-products`
- E2E内で遷移直前の `window.scrollY > 0` と、商品詳細H1表示後の `window.scrollY === 0` を確認する。
- `git diff --check` と `git status --short` で無関係な変更・生成物がないことを確認する。

設定変更はCIの共通設定pathとして全責任領域へ影響しうるため、PRではCIのstatic/unit/frontend、backend、storybook/VRT、E2Eの判定結果を確認する。見た目を変更しないためVRT baselineは更新しない。

## 9. リスク

- `appNewScrollHandler` はNext.js 16.2.11ではexperimental設定である。固定version上で動作確認し、将来Next.jsが新handlerをdefault化または設定を削除した際は、version更新PRで設定を除去・追従する。
- scroll位置のassertをURL変更直後に読むとroute描画前の一時値を拾う可能性がある。商品詳細H1の表示を待ってからscroll位置を確認し、固定sleepは使わない。
- E2E fixtureの表示順へ依存しすぎると保守性が落ちる。indexやCSS階層ではなく固定seedの商品accessible nameとURLを使用する。

## 10. 未確定事項

なし。Next.js 16.2.11の旧handlerで再現し、新handlerで同じ操作が `scrollY=0` になることを確認済みである。

## 11. 完了条件

- 通常のLinkで商品一覧下部から商品詳細へ遷移した後、詳細H1表示時の `window.scrollY` が0である。
- `E2E-008` が深いスクロール位置からの実Link遷移を再現し、新handlerで先頭表示の契約を検証している。
- browser back/forwardやhash navigationを上書きする独自Client scroll処理を追加していない。
- API、DB、migration、dependency、React表示、VRT baselineに差分がない。
- lint、typecheck、unit、Frontend結合、build、対象E2Eが成功する。
- diffが `next.config.ts`、商品閲覧E2E、TEST_SCENARIOS、承認済み計画に限定される。
