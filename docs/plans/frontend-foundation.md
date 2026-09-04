# フロントエンド基盤整備計画

## 1. 背景と目的

開発環境とCIの再現性を高め、次の問題を解消する。

- 依存パッケージとGitHub Actionsの供給網リスクを下げる
- 型検査、lint、未使用コード検査、formatをローカルとCIで再現可能にする
- ローカルでは早く失敗を通知し、CIを唯一の正式な品質ゲートにする
- コード整形だけの変更と、静的検査や実行環境を変える変更を分離して確認できるようにする

アプリケーションのビジネスルール、UI、API、DB、migration、テスト境界は変更しない。

## 2. 現状調査

### 2.1 調査済みの事実

- 採用中の世代はNext.js `16.2.11`、TypeScript `5.9.3`、Node.js 24、pnpm `11.15.1`である。
- `package.json` のdependencies/devDependenciesはすべてexact versionだが、今後の追加をexactに固定する `saveExact` は未設定である。
- Node.jsは `.node-version` のmajor指定、`engines.node: ">=24 <25"`、全CI jobの `node-version-file: .node-version` で管理している。exact patchを単一正本にする仕組みと、ローカル自動取得はない。
- `pnpm-workspace.yaml` には `allowBuilds`、`overrides`、`minimumReleaseAgeExclude` がある。通常releaseの7日待機と、不要な除外のpruneは未設定である。
- 正式lintはESLint 9で、Next.js core-web-vitals、Next.js TypeScript、Storybook recommended ruleを使っている。formatter、Knip、Lefthook、Dependabot、EditorConfigはない。
- `tsconfig.json` は `strict: true` だが、今回候補とする未使用、switch fallthrough、override、副作用import、erasable syntax、module syntaxの個別strict optionは未設定である。
- `next.config.ts` は `typedRoutes` を有効化していない。
- CIは `static-and-unit`、`backend-integration`、`storybook-vrt`、`e2e` の4 jobで構成されている。
- GitHub Actionsの `uses:` は `actions/checkout@v7` などtag参照であり、full commit SHAへ固定されていない。
- CI impact selectorは `package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、`tsconfig.json`、`next.config.ts`、`eslint.config.js`、workflow変更をhigh-riskとして全4 jobへ倒す。
- Playwrightは `fullyParallel: false`、`workers: 1`、`retries: 0` とproject別fixture分離を採用している。
- 対象にはTypeScript/TSXが219 fileあり、80文字を超えるJS/TS行が824行ある。import、Tailwind class、package.json scriptsのsortingを伴う全体formatは広い機械差分になる。
- リポジトリ直下のアプリとは別に `.agents/skills/explained-code-review/package.json` を正本とするrepository-local packageがある。rootのpnpm workspaceへ暗黙に混ぜず、Knipでは別workspace境界として扱う必要がある。

### 2.2 2026-08-30時点のバージョン調査

公開後7日を経過したstable releaseをnpm registryとNode.js公式release indexで確認した結果、実装候補は次のとおりである。

| 対象 | 候補 | 公開日 |
| --- | --- | --- |
| Node.js 24 LTS | `24.19.0` | 2026-08-03 |
| pnpm 11 | `11.23.0` | 2026-08-23 |
| Oxlint | `1.79.0` | 2026-08-18 |
| Oxfmt | `0.64.0` | 2026-08-18 |
| `oxlint-tsgolint` | `7.0.2001` | 2026-07-21 |
| Knip | `6.32.2` | 2026-08-11 |
| Lefthook | `2.1.10` | 2026-07-08 |

これは調査時点の事実である。各dependencyを追加する直前に、stable、Node/pnpm major、公開後168時間以上という同じ条件を再確認する。新しい適格patch/minorがある場合はそちらをexact指定し、世代は上げない。

### 2.3 参照仕様

- pnpmの `devEngines.runtime` はproject-local runtimeを解決し、lockfileへexact versionとchecksumを記録できる。
- `pnpm/setup` は `packageManager` と `devEngines.runtime` を参照し、固定したpnpmとNode.jsを1 stepで準備できる。依存を使わない `changes` jobだけは `actions/setup-node` で同じNode.js versionを参照する。pnpm storeは約239MBのcache転送・展開がcacheなしのinstallより遅いため、cacheしない。
- OxlintはNext.js、React、TypeScript、import、jsx-a11y等をbuilt-in pluginとして持ち、`oxlint-tsgolint` によるtype-aware lintを実行できる。
- Storybook ruleは `eslint-plugin-storybook` をOxlintのJS pluginとして読み込める。ただしJS pluginはalphaで、type-aware ruleを実行できない。
- Oxfmtのimport sorting、Tailwind class sortingはopt-inで、package.json field sortingは既定で有効、scripts sortingはopt-inである。side-effect import sortingは安全上無効が既定である。
- Next.js `typedRoutes` はstableである。一方、`cacheComponents` はrendering/cache semanticsを変えるopt-in機能である。
- GitHubはActionをimmutableなfull commit SHAへ固定することを推奨している。
- Dependabotのversion update cooldownはsecurity updateへ適用されない。一方、pnpmの `minimumReleaseAge` はsecurity fixも止めるため、対象package/versionだけの一時除外が必要になる。

## 3. 解決する問題

1. ローカルとCIがNode.js 24というmajor範囲しか共有せず、patch差による再現性のずれが残る。
2. 新規dependencyのexact保存と、公開直後の通常releaseを避ける方針が設定で強制されていない。
3. GitHub Actionsのtagが可変で、将来追加されるtag参照をCIで検出できない。
4. ESLint、TypeScript、未使用コード検査の責任が整理されておらず、利用可能なstrict checkを有効化していない。
5. 共通formatterがなく、import、Tailwind class、package.jsonの並びに再現可能な基準がない。
6. commit前の早期通知がなく、軽微なlint/format失敗もCIまで分からない。
7. tooling configを追加した際にimpact selectorを同期しなければ、必要な正式checkがskipされ得る。

## 4. 採用する方針

### 4.1 Runtimeとdependency供給網

- `package.json` の `devEngines.runtime` をNode.js exact patchの単一正本とし、`name: "node"`、適格なNode 24 LTS exact version、`onFail: "download"` を設定する。
- `engines.node: ">=24 <25"` はpackageの対応範囲として残す。exact実行環境と対応範囲の責任を分ける。
- `packageManager` は公開後7日を経過したpnpm 11 exact versionへ更新し、ローカルとCIが参照するpnpm versionの単一正本にする。`engines.pnpm: ">=11 <12"` は対応範囲として残す。pnpm 11はlegacy `packageManager` の解決情報をlockfileへ保存しないため、pnpm versionのlockfile一致は完了条件にしない。
- `.node-version` を削除し、CIのNode.js versionを `package.json` の `devEngines.runtime` 参照へ統一する。
- 依存を使うCI jobは `pnpm/setup` でpnpmとNode.jsをまとめて準備する。pnpm storeはcacheせず、pnpm versionは `packageManager` だけに置く。
- `pnpm-workspace.yaml` に `saveExact: true`、`minimumReleaseAge: 10080`、`minimumReleaseAgeExcludePrune: true` を追加する。
- 既存 `allowBuilds` を維持し、`dangerouslyAllowAllBuilds` は使わない。
- `postcss@8.5.22` のoverrideとrelease-age除外が現在の解決に必要かlockfileとfresh installで確認する。解決中でも公開後7日を経過していればrelease-age除外は人手で削除し、overrideだけでinstallできることを確認する。解決対象から外れている場合はdependencyを `pnpm update/remove` した際のprune結果を反映する。
- security fixだけは、対象packageとversionを限定した `minimumReleaseAgeExclude` を理由コメント付きで一時追加する。wildcard、package全version、恒久例外は認めない。対象versionが公開後7日を経過してもlockfileで解決中なら自動pruneされないため、その時点で人手により例外を削除し、frozen installで成立を確認する。
- `minimumReleaseAgeExcludePrune` は経過時間で例外を消す機能ではない。`pnpm add/update/remove` によってpackage/versionがlockfileの解決対象から外れたときだけ、対応する不要な例外を設定から削除する責任を持つ。

### 4.2 OxfmtとEditorConfig

- Oxfmtを正式formatterにし、`format` をcheck、`format:fix` を明示的な書換えcommandとする。この変更と同時に `package.json`、README、AGENTS.md、CI、impact selectorを同期する。
- `.oxfmtrc.json` では既存styleに合わせ、single quote、semicolonなし、JSX attributeはdouble quoteを使う。print widthは既存コードで一般的な100とし、80文字化だけを目的とした大規模な折返しを避ける。
- 最初はimport sortingとTailwind class sortingを無効にし、改行、空白、引用符などの整形だけを既存コードへ適用して差分を確認する。binding付きimportの並べ替えと、重複・競合するTailwind classの並べ替えは実行順や表示へ影響し得るため、同時に適用しない。
- 整形差分の確認後にimport sortingを有効にし、React/Next、Node builtinと外部package、`@/` internal alias、relative import、type importの順にgroup化する。side-effect importは並べ替えない。全import差分をfile単位で確認し、binding importの初期化順に依存するfileがあればそのfileをsorting対象外にして根拠を設定へ残す。
- import sortingと分けてTailwind class sortingを有効にし、Tailwind v4のstylesheetとして `src/app/globals.css` を指定する。重複・競合classを差分から抽出し、Storybook VRTとE2Eで表示差分がないことを確認する。
- package.json field sortingとscripts sortingを有効にする。
- `.next/**`、`.next-e2e/**`、`storybook-static/**`、`playwright-report/**`、`test-results/**`、`.review/**`、`.impact/**`、`drizzle/meta/**`、VRT画像、lockfile、生成済みbundle、repository-local skillの独立package/workspace、設計・計画文書をformat対象外にする。アプリのsource、test、root config、`.storybook`、`.github`、root `package.json` を正式対象にする。
- `.editorconfig` でUTF-8、LF、末尾改行、空白trim、2 spacesをeditor非依存に固定する。Markdownの末尾空白だけは意味を持つ可能性があるためtrim対象外にする。
- 既存コードの整形は、Oxfmt/EditorConfigの設定、scripts/dependency、対象fileのformat結果、formatを正式gateにするために不可欠なREADME・AGENTS・CI・impact selector同期だけで構成する。lint rule、TypeScript strict化、runtime変更は混ぜない。
- 適用前に `oxfmt --check` で対象file一覧を記録する。対象外のmigration snapshot、生成物、VRT画像が変わる、side-effect importが移動する、文字列・template literalの値が変わる場合は適用を止めて設定を修正する。

### 4.3 Oxlintへの移行

- Oxlintを正式lintとし、`.oxlintrc.json` でbuilt-inのNext.js、React、TypeScript、import、jsx-a11y、Vitest/Node環境を構成する。
- `oxlint-tsgolint` を追加し、CIの正式lintはtype-awareかつwarningを失敗扱いにする。
- `lint:oxlint` はOxlintの全対象非変更check、`lint:fix` は開発者が明示実行するOxlint fix commandとする。
- 現在のESLint effective configを、通常のTSX、Storybook story、Node configの代表fileごとに `eslint --print-config` で記録し、Next/TypeScript/Storybookの有効ruleをOxlint built-in ruleおよびJS plugin ruleへ対応付ける。
- Storybookは `eslint-plugin-storybook` のrecommended rulesをJS pluginとしてstoryと `.storybook` の対象だけへ適用する。
- active ruleからOxlint native、Storybook JS plugin、fallbackへの対応表を `docs/tooling/lint-parity.md` に保存する。Next、TypeScript type-aware、Storybookの代表違反と期待rule IDは `scripts/tooling/verify-lint-parity.mjs` がtemporary fixtureを作って確認し、fixtureをrepositoryへ残さない。
- parity auditで現在有効なruleをすべてOxlintで実行できた場合、`eslint`、`eslint-config-next`、ESLint専用設定を削除し、`lint` を `pnpm lint:oxlint` とする。
- 実在する未対応ruleが確認された場合だけ、そのrule名、対象glob、Oxlint側の追跡issueまたは不足機能、fallback削除条件を `eslint.config.js`、`docs/tooling/lint-parity.md`、READMEへ明記し、そのruleだけを `lint:eslint-gap` で実行する。この場合の `lint` は `pnpm lint:oxlint && pnpm lint:eslint-gap` とし、fallback失敗をCIの正式gateへ必ず伝播させる。既存ESLint一式を無条件に二重実行しない。
- lint移行で検出された既存違反は、rule無効化や広いignoreではなく、挙動を変えない最小コード修正で適合させる。ruleを無効化する場合はfile単位またはrule単位の根拠をconfigへ記録する。

### 4.4 TypeScript strict化とtyped routes

- TypeScript 5.9で利用可能な次を有効にする。
  - `noUnusedLocals`
  - `noUnusedParameters`
  - `noFallthroughCasesInSwitch`
  - `noImplicitOverride`
  - `noUncheckedSideEffectImports`
  - `erasableSyntaxOnly`
  - `verbatimModuleSyntax`
  - `moduleDetection: "force"`
- `next.config.ts` に `typedRoutes: true` を追加する。
- 既存のunused、type-only import、dynamic linkで生じる型エラーは実在routeに基づいて修正し、`as any`、無差別な `as Route`、検査の無効化で回避しない。

### 4.5 Knip

- Knipを正式な未使用file/export/dependency検査として追加し、`knip` scriptを用意する。
- root workspaceではNext.js App Router、Storybook、Vitest、Playwright、Drizzle、root scripts/configを実在するentry/projectとして `knip.json` に列挙する。
- `.agents/skills/explained-code-review` はroot applicationへ混ぜず、独自 `package.json`、scripts、Playwright config、testsを持つ別Knip workspaceとして列挙する。clean CIでnested dependencyのinstallが必要と判明した場合は、そのexact frozen-installを `knip:prepare` として正式化し、`knip` を `pnpm knip:prepare && knip` に接続する。CIは常に `pnpm knip` だけを呼び、READMEとAGENTS.mdにもこの前処理を含むcommand契約を記載する。
- generated bundle、schemaから生成されるartifact、frameworkが規約で読むentryだけを根拠付きで扱う。`ignoreDependencies: ["*"]`、全issue type無効化、`.agents/**` 全体ignoreのような設定は使わない。
- false positiveは、import元、package script、framework configのどれがentryであるかを確認してから個別設定する。

### 4.6 Lefthook

- Lefthookを追加し、dependency側のinstall scriptでローカルのGit hookを登録する。
- `pnpm-workspace.yaml` の `allowBuilds` に `lefthook: true` を追加する。Lefthook自身がCIではhook登録をスキップするため、rootの `prepare` scriptは重ねない。
- pre-commitはLefthook標準の `{staged_files}` でstage済みのJS/TS/JSON/YAML/CSSをOxfmtとOxlintへ直接渡し、非変更のcheckを並列実行する。
- hookから `git add`、`lint:fix`、`format:fix` を実行せず、working treeとGit indexを変更しない。同じファイルに未stage差分がある場合はworking treeの内容も検査対象になる。
- typecheck、Knip、unit/frontend/backend test、build、Storybook、E2E、VRTはhookへ入れず、CIを正式判定元にする。

### 4.7 GitHub ActionsとDependabot

- `.github/workflows/ci.yml` の全 `uses:` を正規repositoryのrelease commitであることを確認したfull 40-character SHAへ固定し、右側に可読なversion commentを残す。
- pinactによるAction SHA参照検査を `static-and-unit` へ統合する。4つのrequired check名とjob責任は増減させない。
- SHA pin検査には `suzuki-shunsuke/pinact-action` を検証済みfull SHAとversion commentで追加し、`fix: "false"`、`verify: "true"`、`min_age: "7"`、`verify_min_age: "true"` とする。既存 `permissions: contents: read` とdefault `${{ github.token }}` だけを使い、workflow書換え・push権限は与えない。pinactは40文字SHA、release refとの対応、version comment、7日経過を検証する。
- `.github/dependabot.yml` を追加する。
  - npmは週次。productionとdevelopmentそれぞれでminor/patchをgroup化する。
  - npm majorはgroupへ含めず、個別の更新提案にする。
  - GitHub Actionsはnpmと別ecosystem groupにする。
  - version update cooldownは7日とする。
  - security updateはcooldown対象外のままにし、auto-mergeは設定しない。
- GitHub repository側のDependabot security update有効化はrepository外の設定変更になるため、本計画の対象外とする。

### 4.8 CI impact selectionとcommand契約

- Oxfmt、Oxlint、Knip、Lefthook、Dependabot、EditorConfig関連configをimpact selectorのtooling/high-risk pathへ追加する。
- package、lockfile、runtime、workflow、TypeScript、Next.js、lint/format/Knip config変更は全4 jobへ倒す現在の保守的挙動を維持する。
- selector testへ各新規pathの代表caseと `.node-version` 削除後の分類を追加する。
- `static-and-unit` でformat check、Oxlint、lint parity検査、typecheck、Knip、SHA pin検査を実行し、その後に既存selector test、unit、frontend integration testを維持する。
- 追加・変更する `lint`、`lint:fix`、`format`、`format:fix`、`knip` commandを `package.json`、README、AGENTS.md、CIで同期する。

## 5. 採用しない方針

- TypeScript 7、Next.js 16.3、pnpm 12、Node.js 26への世代更新
- `cacheComponents`、`use cache`、`cacheTag`、`updateTag`、Server Actions
- Oxlintと既存ESLint全ruleの恒久二重実行
- ls-lintと既存PascalCase fileの一括rename
- `.vscode/settings.json` や特定editor extensionの強制
- Playwrightの並列化、worker増加、retry追加、browser matrix縮小
- Turso/SQLite、Better Auth、Intent UI、別の状態管理・API framework・ORM・test runner
- UI、API、DB schema、migration、business rule、VRT画像の変更
- GitHub Actions以外のcontainer image digest固定。Playwright/PostgreSQL image固定は別の供給網課題として扱う。
- Dependabot更新のauto-merge

## 6. 変更対象

### 6.1 Runtime・供給網

- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `.node-version`（削除）
- `.github/workflows/ci.yml`
- `.github/dependabot.yml`（追加）
- `scripts/impact/select-ci-jobs.mjs`
- `scripts/impact/select-ci-jobs.test.mjs`
- `README.md`
- `AGENTS.md`

### 6.2 Oxfmt適用

- `package.json`
- `pnpm-lock.yaml`
- `.oxfmtrc.json`（追加）
- `.editorconfig`（追加）
- `.github/workflows/ci.yml`
- `scripts/impact/select-ci-jobs.mjs`
- `scripts/impact/select-ci-jobs.test.mjs`
- `README.md`
- `AGENTS.md`
- Oxfmtの正式対象になり、改行・空白・引用符またはsortingの差分が出るsource/test/script/config

`docs/**`、migration snapshot、VRT画像、generated artifact、repository-local skill packageはOxfmtの対象外とする。

### 6.3 静的品質

- `package.json`
- `pnpm-lock.yaml`
- `.oxlintrc.json`（追加）
- `eslint.config.js`（parity完了時は削除、実在gap時だけ縮小）
- `knip.json`（追加）
- `lefthook.yml`（追加）
- `pnpm-workspace.yaml`
- `docs/tooling/lint-parity.md`（追加）
- `scripts/tooling/verify-lint-parity.mjs`（追加）
- `tsconfig.json`
- `next.config.ts`
- `.github/workflows/ci.yml`
- `scripts/impact/select-ci-jobs.mjs`
- `scripts/impact/select-ci-jobs.test.mjs`
- strict化、typed routes、lintへ適合する既存source/test/config
- `README.md`
- `AGENTS.md`

`docs/PRODUCT.md`、`docs/ARCHITECTURE.md`、`docs/TEST_STRATEGY.md`、`docs/TEST_SCENARIOS.md`、`CONTEXT.md` は変更しない。アプリ仕様、テスト責任、EC用語を変えないためである。ADRも作成しない。今回のtooling判断は設定で戻せ、hard-to-reverseなarchitecture decisionではない。

## 7. 実装手順

### 7.1 実装順序

変更は技術的な依存関係に従って次の順で進める。各段階は、その段階までの設定だけで既存の4 CI jobを実行できる状態にする。

| 段階 | 責務と主なfile | 前提 | 後続への影響 | この段階の検証 | 戻す条件と方法 |
| --- | --- | --- | --- | --- | --- |
| Runtimeと供給網 | `package.json`、`pnpm-workspace.yaml`、lockfile、GitHub Actions、Dependabot、impact selector | 既存のNode 24・pnpm 11構成 | 後続のdependency追加、local command、全CI jobがこのversion・release-age設定を使う | runtime path/version、fresh/frozen install、SHA pin、4 CI job | exact runtimeの取得またはCI setupが成立しない場合はNode正本を `.node-version` へ戻す。Action SHA固定とDependabotは独立して維持できる |
| Oxfmt適用 | `.oxfmtrc.json`、`.editorconfig`、source/test/config、format command、CI | Runtimeと供給網 | 後続の静的品質変更は整形済みのfileを前提にする | format再実行で差分0、全import差分確認、VRT/E2E、4 CI job | import初期化順やTailwind表示が変わる場合は該当sortingを無効化して整形規則だけを維持する |
| 静的品質 | Oxlint、TypeScript、Knip、typedRoutes、Lefthook、CI | Oxfmt適用 | `pnpm lint`、`pnpm typecheck`、`pnpm knip`、pre-commitの正式契約になる | lint parity、typecheck、Knip、Lefthook、全test/build、4 CI job | lint coverageが下がる場合は該当ESLint ruleだけを残す。strict optionがruntime変更を要求する場合はそのoptionを有効化せず再検討する |

### 7.2 Runtimeと供給網

1. npm registryとNode公式indexを再確認し、公開後168時間以上のNode 24 LTS patch、pnpm 11、追加tool versionを確定する。
2. `package.json` にexact `devEngines.runtime` とpnpm `packageManager` を設定し、`pnpm-workspace.yaml` にexact保存、10080分待機、exclude pruneを設定する。
3. fresh installで `pnpm-lock.yaml` のNode runtime version/checksumとdependency解決を更新し、既存override/allowBuildsを維持する。pnpm versionはlockfileへ記録されないため、`packageManager` と実行結果の一致だけを確認する。
4. temporary `runtime:version` scriptで `process.version` と `process.execPath` をJSON出力し、`pnpm run` で実行する。versionがexact pinと一致し、`realpath(process.execPath)` がsystem `node` のrealpathと異なり、lockfileのruntime version/checksumと一致することを確認する。検証用scriptは確認後に削除する。
5. registryに依存する7日待機の動作確認は実装時に一度だけ行う。`mkdtemp` 配下の独立package/workspaceで、実行時点で公開168時間未満のstable package/versionをregistryから選び、公開時刻を出力したうえで、通常解決の拒否、version限定excludeによる通過、`pnpm remove/update` でlockfileから外れた際のexclude pruneを確認する。temporary directoryは確認後に削除し、このprobeをCIへ入れない。
6. `.node-version` を削除し、依存を使うCI jobは `pnpm/setup` から `packageManager` と `devEngines.runtime` を参照する。依存を使わない `changes` jobは `actions/setup-node` から同じNode.js versionを参照する。
7. 全Action refを、公式release/tagが指すcommitをAPIで確認してfull SHAへ固定し、version commentを付ける。
8. pinact-actionをfull SHAで追加し、`fix: "false"`、`verify: "true"`、`min_age: "7"`、`verify_min_age: "true"` で検証専用にする。tag参照、誤ったversion comment、公開後7日未満のAction refを一時fixtureで個別に拒否できることを確認する。
9. Dependabotのnpm production/development minor-patch group、個別major、Actions group、週次、7日cooldownを追加する。
10. selectorのhigh-risk pathとtestを同期し、runtime/config/workflow差分が4 jobすべてを選ぶことを確認する。
11. READMEとAGENTS.mdへNode自動取得、version正本、7日待機、security例外、追加commandを記載する。
12. この段階までの変更でローカル回帰確認と4 CI jobを成功させる。

### 7.3 Oxfmt適用

1. OxfmtとEditorConfigを追加し、format対象・ignore・改行・空白・引用符の規則を設定する。最初はimport/Tailwind sortingを無効にする。
2. `pnpm format` を書換え前に実行し、非zeroと対象file一覧を確認する。
3. `pnpm format:fix` を一度だけ実行し、改行・空白・引用符以外の変更がないことを確認する。
4. `git diff --name-only` と個別diffで、対象外file、import順、文字列/template literal、VRT/migration/generated artifactに変更がないことを確認する。
5. import sortingを有効にして全import差分を確認した後、Tailwind class sortingとpackage/scripts sortingを有効にする。重複・競合Tailwind classを確認し、unit/frontend/VRT/E2E/buildで挙動や表示に差がないことを確認する。
6. `.github/workflows/ci.yml` に `pnpm format` を追加し、selectorに `.oxfmtrc.json`、`.editorconfig` をhigh-risk pathとして追加する。READMEとAGENTS.mdへ `format`、`format:fix` を同期する。
7. format設定・dependency・scripts、format結果、正式gateに必要なCI/selector/docs同期以外が混ざっていないことを確認する。
8. この段階までの変更でローカル回帰確認と4 CI jobを成功させる。VRT画像は更新しない。

### 7.4 静的品質

1. 既存ESLintのeffective configを代表fileごとに採取し、有効ruleをOxlint native、Storybook JS plugin、未対応に分類する。
2. Oxlintと `oxlint-tsgolint` を追加し、type-aware・deny-warningsの正式lintを構成する。
3. Storybook recommended rulesをstory/Storybook configだけへ適用し、代表的な違反fixtureでOxlintが検出することを一時検証する。
4. active rule対応表と代表違反fixture検証を `docs/tooling/lint-parity.md`、`scripts/tooling/verify-lint-parity.mjs` に残し、`lint:parity` として `static-and-unit` で継続実行する。parity完了ならESLint一式を削除して `lint` をOxlintだけへ接続する。gapがあれば、実在gapだけのfallback config/scriptと削除条件を残し、`lint` からOxlintとfallbackを順に実行する。
5. TypeScript strict optionを一つずつ有効化し、各optionで発生したdiagnosticをoption別に修正する。type-only importの修正とロジック修正を混ぜずに確認する。
6. `typedRoutes: true` を有効化し、typegen、typecheck、buildでLink/routerのroute型を確認する。
7. Knipをroot applicationとrepository-local skillの2 workspace境界で設定し、実在entryを列挙する。各ignoreには生成元またはframework読込根拠をコメントする。clean checkout相当としてnested packageの `node_modules` がない状態で、root install後の `pnpm exec knip --debug` を実行し、2 workspaceの認識とunresolved import 0件を確認する。成功する場合は `knip: "knip"` とする。nested installが必要な場合は `knip:prepare` をnested packageのexact frozen installに固定し、`knip: "pnpm knip:prepare && knip"` とする。どちらの場合もCIは `pnpm knip` だけを正式commandとして呼び、root `pnpm-workspace.yaml` のpackagesにはnested packageを追加しない。
8. Knipが報告したunused file/export/dependencyを1件ずつimport/package script/configと照合し、真のdead codeだけを削除する。アプリ機能や将来用interfaceは追加しない。
9. Lefthookを追加し、`pnpm-workspace.yaml` でdependency install scriptを許可する。ローカルではdependency側のinstall scriptがGit hookを登録し、CIではLefthook自身の判定で登録をスキップする。pre-commitは `{staged_files}` を使ってOxfmtとOxlintの非変更checkを直接実行する。
10. `static-and-unit` にformat、Oxlint、`lint:parity`、typecheck、Knip、SHA pin、既存selector/unit/frontendを統合する。
11. selector test、README、AGENTS.mdのcommand契約を最終構成へ同期する。
12. 全変更を適用した状態でローカル回帰確認と4 CI jobを成功させる。

## 8. テスト・検証方法

### 8.1 各段階で行う確認

- `git diff --check`
- `pnpm install --frozen-lockfile`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:frontend`
- `pnpm db:up`
- `pnpm db:prepare:test`
- `pnpm test:backend`
- `pnpm test:vrt`
- `pnpm test:e2e`
- `pnpm build`
- `pnpm build-storybook`
- 検証後の `pnpm db:down`
- `static-and-unit`、`backend-integration`、`storybook-vrt`、`e2e` の4 CI jobがすべて成功すること

### 8.2 Runtime・供給網

- `pnpm --version` が `packageManager` のexact versionと一致する。
- pnpm script内の `process.version`、lockfileのNode runtime、`pnpm/setup` と `actions/setup-node` の解決versionが一致する。
- pnpm script内の `realpath(process.execPath)` がsystem `node` のrealpathと異なり、project-local runtimeを使っていることを確認する。
- activeな設定・script・利用手順に `.node-version` 参照が残らない。
- registryを使う一回限りのprobeでは、実行時点で公開168時間未満のstable package/versionと公開時刻を出力し、`mkdtemp` fixture内だけで通常解決の拒否、version限定excludeの通過、`pnpm remove/update` 後のexclude pruneを確認する。時間経過や `pnpm install` だけでpruneされるとはみなさない。
- 一回限りのprobe前後の `git status --short` が同一であり、temporary fixtureがrepository内へ残らないことを確認する。
- `pnpm install --frozen-lockfile` が許可済みbuildだけで成功する。
- pin検査が全 `uses:` の40-character SHAとversion commentを確認する。
- `node --test scripts/impact/*.test.mjs`

### 8.3 Format・静的品質

- `pnpm format`
- `pnpm lint`
- ESLint fallbackが残る場合は `pnpm lint:eslint-gap`
- `pnpm lint:parity`
- `pnpm typecheck`
- `pnpm knip`
- nested skillの `node_modules` がないclean checkoutでroot install後の `pnpm exec knip --debug` を実行し、rootと `.agents/skills/explained-code-review` の2 workspace認識、unresolved import 0件を確認する。nested installが必要なら `pnpm knip:prepare && pnpm exec knip --debug` で再確認し、その前処理を正式な `pnpm knip`、CI、README、AGENTS.mdへ同期する。
- `pnpm build`
- `pnpm build-storybook`
- Oxfmtの再実行で差分が出ないことを確認する。
- import sorting後もside-effect importの相対位置が変わらないことをdiffで確認する。
- Tailwind class sorting後に `pnpm test:vrt` を実行し、VRT画像を更新せず一致することを確認する。
- 対象拡張子のstage済みファイルだけでOxfmtとOxlintが実行され、hookがworking treeとindexを変更しないことを確認する。
- clean clone、通常の再install、CI installの3経路でLefthook binary準備が成功することを確認する。clean cloneと再installでは `.git/hooks/pre-commit` が登録され、CIではinstallがhook失敗を起こさないことを確認する。

### 8.4 全変更適用後の回帰確認

- `pnpm test:backend` は `pnpm db:up` と `pnpm db:prepare:test` 後に実行する。
- `pnpm test:e2e`
- `pnpm test:vrt`
- `pnpm build-storybook`
- `pnpm build`
- 4 required check相当をすべて成功させる。
- UI変更はないためVRT画像を更新しない。差分が出た場合はformatによるclass順の意味差分またはbuild環境差を調査する。
- `docs/TEST_SCENARIOS.md` のscenario追加は行わない。今回の責任はtool/configの静的検証であり、business behaviorを変えないためである。

## 9. リスク

### 9.1 Node自動取得

`devEngines.runtime` はversion検証だけでなくproject-local Nodeをdownloadしてscript実行へ使う。初回installのnetwork依存とdisk使用量が増える。download失敗時はsystem Nodeへsilent fallbackせず、明示的に失敗させる。READMEへcacheとtroubleshootingを記載する。

### 9.2 7日待機とsecurity fix

Dependabot security updateはcooldownを回避しても、pnpmは `minimumReleaseAge` で止める。security updateには対象package/versionだけの一時excludeと理由が必要である。広いexcludeは供給網対策を無効化するため設定不備として扱う。

`minimumReleaseAgeExcludePrune` は公開後7日経過では発火しない。解決中のsecurity versionが7日を経過したら例外を人手で削除する。自動pruneはadd/update/removeでそのversionがlockfileから外れた場合の後片付けだけに使う。

### 9.3 Oxfmtの広い差分

import、Tailwind class、package.json sortingにより多くのfileが変わる。さらに、binding importの初期化順と重複・競合Tailwind classは意味を変え得る。改行・空白・引用符の整形を先に確認し、その後sorting差分をfile単位で確認して全test・VRT・E2Eを通す。意図した挙動変更が必要になった場合はsortingを適用せず計画を再確認する。

### 9.4 Oxlint parity

Storybook JS pluginはalphaでtype-aware ruleを実行できない。実測gapを隠してESLintを削除するとcoverageが落ちるため、effective configと代表違反でparityを確認する。gapがある場合は最小fallbackを残すが、ESLint全体の恒久併用はしない。

### 9.5 Strict TypeScriptとtyped routes

既存diagnostic修正が広がる可能性がある。castやignoreで型安全性を落とさず、optionごとに原因を追跡する。runtime behaviorを変える必要が判明した場合は実装を止め、仕様を再確認する。

### 9.6 Knip false positive

Next.js、Storybook、Playwright、Drizzle、repository-local skillにはframeworkやpackage scriptが暗黙に読むentryがある。広いignoreで検査を通さず、entryの根拠をconfig commentへ残す。

## 10. 未確定事項

ユーザー判断が必要な未確定事項はない。

実装時に機械的に確定する事項は次の2点で、判定条件は固定済みである。

1. dependency exact versionは追加直前に「stable・指定major・公開後168時間以上」で再計算する。
2. ESLint削除可否はeffective rule parityで決める。gap 0件なら削除し、gapが実在する場合だけrule/path/削除条件を明記した最小fallbackを残す。

これらの判定で世代更新、lint coverage低下、runtime behavior変更が必要になる場合は実装を続けず、計画を再オープンする。

## 11. 完了条件

- Node 24 exact runtimeとpnpm 11 exact package managerが `package.json` を単一正本とする。Node runtimeはlocal/CI/lockfileで一致し、pnpm versionはlocal/CIで一致する。
- `.node-version` と重複version指定がなく、pnpmがexact Nodeを自動取得できる。
- `saveExact`、7日待機、exclude prune、限定 `allowBuilds` が有効である。
- Dependabotがnpm/Actionsを週次・7日cooldown・指定groupで提案し、majorとsecurity updateの扱いが仕様どおりである。
- 全GitHub Actionsが検証済みfull SHAとversion commentへ固定され、pin検査がCIで失敗を検出する。
- Oxfmtがimport、Tailwind class、package.json scriptsを含む正式formatterとなり、全対象fileが同じ整形規則を満たす。
- 改行・空白・引用符の変更とsortingの変更を分けて確認でき、sortingによる実行順・表示への影響がない。
- Oxlintがtype-aware・deny-warningsの正式lintとなり、ESLintはparity完了時に削除される。fallbackが残る場合は実在gapだけである。
- TypeScript 5.9の指定strict optionとNext.js typed routesが有効で、cast/ignoreによる無効化がない。
- Knipがroot applicationとrepository-local skillの実在entryを検査し、広いignoreで結果を隠していない。
- Lefthookがstage済みの対象ファイルへ非変更の高速checkを行う。CIが唯一の正式gateである。
- Lefthookのplatform binary準備とローカルのGit hook登録はallowlisted dependency install scriptが担当し、CIではhook登録をスキップする。fresh clone・CI・再installで成立する。
- 既存4 required check、impact selection、E2E 1 worker/retries 0、browser matrix、test responsibilityが維持される。
- package.json、README、AGENTS.md、CIのcommand契約が一致する。
- unit、frontend、backend、E2E、VRT、build、Storybook buildが全変更適用後に成功し、VRT画像、UI、API、DB、business ruleに意図した差分がない。
