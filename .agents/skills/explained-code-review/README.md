# Explained Code Review

Gitの変更をファイル順ではなく実装意図ごと・リスク順に整理し、解説付きのローカルレビュー画面を生成するCodex Skillです。

通常の利用では、移植先projectのpackage.jsonやnode_modulesを使用しません。Node.js 20以上とGitだけで動作します。

## 生成されるもの

repository直下の`.review/<review-id>/`へ次の2ファイルを生成します。

- `index.html`: `file://`で開けるself-containedなレビュー画面
- `report.json`: JSON Schemaとsemantic validationを通過したレビュー内容

画面では次の操作ができます。

- 実装意図ごとの変更グループ表示
- risk・changeType filter
- unified diffとAI findingの表示
- グループの承認とfindingのresolve
- 人間コメントのlocalStorage保存
- 未解決findingとコメントのMarkdownコピー
- ダークモードとキーボード操作

外部CDN、server、DB、認証、GitHub APIは使用しません。

## 必要なもの

- Node.js 20以上
- Git
- 独立したsubagent contextを実行できるCodex環境

package managerは通常利用には不要です。Skill自身のテストやvalidator再生成を行う場合だけpnpmを使用します。

## インストール

この`explained-code-review`directoryを丸ごとコピーします。個別fileだけを移動しないでください。

### Project-local

対象repositoryへ配置します。

```text
<repository>/.agents/skills/explained-code-review/
```

projectごとに異なるreview ruleや運用を持たせたい場合に適しています。

### Global

Codexのglobal skill directoryへ配置します。

```text
~/.codex/skills/explained-code-review/
```

複数projectで同じSkillを使う場合に適しています。project-local版とglobal版が同時に存在するときの優先順位は保証しません。

コピー先repositoryでは`.review/`をGit管理対象外にしてください。

```gitignore
.review/
```

## 使い方

CodexへSkillを明示して依頼します。

```text
$explained-code-review を使って現在のworkspaceをレビューし、画面を開いてください。
```

baseやplanを指定できます。

```text
$explained-code-review を使い、baseはorigin/main、planはplans/example.mdとしてレビューしてください。
```

コミット済み差分だけを対象にする場合:

```text
$explained-code-review を使い、scopeはcommitsとしてレビューしてください。
```

planを使わない場合:

```text
$explained-code-review を使い、planなしでworkspaceをレビューしてください。
```

Codexは次の順で処理します。

1. baseのmerge-baseから現在workspaceまでのsnapshotを収集
2. 独立subagentでplanを参照しないBlind review
3. Stage 1結果を固定
4. planがあればStage 2で要件と差分を照合
5. Schema検証済みの`report.json`と固定HTMLを生成
6. `index.html`をブラウザで開く

## 正式なレビュー手順

```text
generate → review → fix → regenerate → reapprove → commit
```

画面上の承認は収集時snapshotに対するものです。修正後のworkspaceを保証するものではありません。コードを修正したら必ず再生成し、新しいsnapshotを再承認してください。

groupやfindingの内容fingerprintが変わると、以前のapproval・resolve状態は復元されません。以前の人間コメントは現行欄へ自動移行されず、「前版コメント・要再確認」として表示されます。

## 収集範囲

既定scopeは`workspace`です。

- merge-baseからHEADまでのコミット済み変更
- staged変更
- unstaged変更
- Git ignoreされていない未追跡の通常file

これらを加算せず、merge-baseから現在workspaceまでのnet差分として扱います。selected planと`.review/**`は常に除外します。

`commits` scopeではmerge-baseからHEADまでのコミット済み差分だけを扱います。

base未指定時は、ローカルに存在するrefを次の順で解決します。

1. `origin/HEAD`
2. `origin/main`
3. `main`
4. `origin/master`
5. `master`

`git fetch`は自動実行しません。remoteの最新状態が必要なら、Skill実行前に利用者がrefを更新してください。

## Planの選択

- 明示された`--plan`を最優先
- 省略時はbranch対応planまたは変更中の`plans/**/*.md`を探索
- 候補が1件なら採用
- 複数候補なら推測せず停止
- 候補なし、または`--no-plan`ならStage 2をskip

planはrepository内の通常fileに限ります。selected planの本文とhunkはBlind review入力や最終reportへ含めません。Stage 2のplan pathと照合結果はreportへ記録されます。

Blind reviewの保証は、独立context、plan入力の分離、selected planを読まない指示による手続的隔離です。filesystem sandboxを意味しません。

## Script interface

通常はCodexが実行します。調査やSkill開発時には直接呼び出せます。

```bash
node <skill-dir>/scripts/collect-diff.mjs \
  [--repository <path>] \
  [--base <ref>] \
  [--scope workspace|commits] \
  [--plan <repository-file> | --no-plan] \
  [--rule <repository-file> ...] \
  [--review-id <id>] \
  [--output <temporary-directory>]
```

collectorの標準出力に`blindInputPath`、`planInputPath`、`reviewId`が含まれます。Stage 1とStage 2の分析JSONを用意した後、generatorを実行します。

`--output`には存在しないpathまたは空の通常directoryだけを指定できます。既存fileを含むdirectory、symlink、通常directory以外は上書きせず停止します。

```bash
node <skill-dir>/scripts/generate-report.mjs \
  --blind-input <blind-input.json> \
  --plan-input <plan-input.json> \
  --stage1 <stage-1.json> \
  --analysis <final-analysis.json>
```

分析JSONの作り方と二段階レビューの厳密な手順は`SKILL.md`、review基準は`references/review-rules.md`、final report契約は`references/report-schema.json`を参照してください。

## 安全性と制限

- Git commandはshell文字列ではなく引数配列で実行
- ext-diffとtextconvを無効化
- 収集前後のworkspace fingerprintが変わったら停止
- untracked symlink、FIFO、socketを拒否
- `.review`のsymlinkとpath escapeを拒否
- review ID単位のlockとatomic swapを使用
- diffやコメントはHTMLとして解釈せずtextとして表示
- JSON埋め込み時にscript終端を無害化

既定上限:

| 対象 | 上限 |
| --- | ---: |
| total patch | 25 MiB |
| 単一text file | 5 MiB |
| diff行 | 250,000 |
| hunk | 20,000 |

上限超過時はtruncateせず停止します。binaryは本文を埋め込まず、path、size、変更種別だけを扱います。mode-only変更はGit meta hunkとして表示します。

## Skillを開発・検証する

この操作だけはSkill directory内へdev dependencyを導入します。

```bash
cd <skill-dir>
pnpm install --ignore-workspace
pnpm build:validator
pnpm test
pnpm exec playwright install chromium
pnpm test:ui
```

- `pnpm test`: Node標準test runnerによるcollector・generator・portable test
- `pnpm test:ui`: Chromiumで実際の`file://`画面を確認
- `pnpm build:validator`: `report-schema.json`からstandalone validatorを再生成

通常利用先へ`node_modules`をコピーする必要はありません。

## 移植時に変更してよいもの

- `references/review-rules.md`: project固有の追加review観点
- `agents/openai.yaml`: 表示名やdefault prompt

Schemaやscriptを変更した場合は、validator再生成と全テストを実行してください。`assets`だけを自由形式HTML生成へ置き換えたり、Stage 1とStage 2を同じcontextで実行したりしないでください。
