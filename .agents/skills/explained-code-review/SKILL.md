---
name: explained-code-review
description: Planと現在のGit workspaceをBlind reviewとPlan照合に分け、Plan充足・Shiki構文強調・実装意図group・必要に応じたファイル別walkthroughを備えたself-contained HTMLへ変換する。PR前レビュー、未コミット差分の確認、実装漏れ確認、コード解説に使う。
---

# Explained Code Review

収集時点のworkspace snapshotを、人間が変更意図とPlan充足を確認できる固定UIへ変換する。

## 必須原則

- 最初に`references/review-rules.md`を最後まで読む。
- JSONを作る前に`references/analysis-contract.md`を最後まで読む。
- 通常runtimeはNode.js 20以上とGitだけ。repository側のpackage manager、`node_modules`、CDN、HTTP serverを使わない。
- Stage 1は必ず履歴を継承しない独立subagentで行う。独立contextを利用できなければ停止し、Blind review済みと表現しない。
- Stage 1のbatchへ渡すのは`blind-input.json`、対象batch ID、review rules、`analysis-contract.md`、`batch-output-schema.json`、出力先だけ。`report-schema.json`はBlind consolidatorと最終生成の契約確認にだけ使う。`plan-input.json`、selected Plan、会話上のPlan要約は渡さない。
- Stage 1 JSONを固定してから、親contextで初めて`plan-input.json`を読む。
- repositoryのtest commandをreview生成の一部として暗黙実行しない。test fileの存在を「test成功」の証拠にしない。
- generatorの検証を迂回しない。

## 1. modeを決める

- 通常は`review`。
- 利用者が「ファイルごとに詳しく」「実装を解説して」「walkthrough」と依頼したら`walkthrough`。
- `walkthrough`はreview内容にファイル責務とsegment解説を追加するため、生成時間と分析量が増える。
- 生成後にmodeを変える場合は再収集・再生成する。

この`SKILL.md`の親directoryを`<skill-dir>`とする。

## 2. workspaceを収集する

repository rootから実行する。

```bash
node <skill-dir>/scripts/collect-diff.mjs --explain review
```

必要に応じて次を追加する。

```text
--repository <path>
--base <ref>
--scope workspace|commits
--plan <repository-file>
--no-plan
--rule <repository-file>
--review-id <id>
--output <temporary-directory>
--explain review|walkthrough
```

既定scopeは`workspace`。merge-baseから現在workspaceまでのnet差分と未追跡の通常fileを収集し、selected Planと`.review/**`を除外する。fetchはしない。

collectorは次を機械的に確定する。

- `mode`
- 各fileの`explanationPolicy`
- 4,000 diff行またはraw text 1 MiBごとの`blindBatches`
- 20,000 text diff行のwalkthrough上限

`--output`は存在しないpathまたは空の通常directoryだけを使う。標準出力から`blindInputPath`、`planInputPath`、`reviewId`を記録する。

## 3. Stage 1: Blind review

### batch実行

`blind-input.json.blindBatches`ごとに、履歴を継承しない独立subagentを同じturnで起動する。各subagentには対象batchのhunk IDだけを分析するよう明記し、selected Planを読ませない。1 hunkが上限を超えるbatchでもhunkをtruncateしない。

各batchへのtask:

```text
<blind-input.json>、<review-rules.md>、<analysis-contract.md>、<batch-output-schema.json>を読み、指定された<batch-id>のhunkだけをBlind reviewしてください。
selected Plan、plans directory、plan入力を読まないでください。
必要な既存コードはrepositoryから読んで構いません。
batch-output-schemaどおりhunkごとにgroup候補・finding候補・walkthrough notesを出し、<batch-output.json>へJSONだけで保存してください。
walkthroughではcollectorのexplanationPolicyに従い、segmented fileだけsegmentを作ってください。
```

各batch完了時に検証する。失敗したJSONをconsolidatorへ渡さない。

```bash
node <skill-dir>/scripts/validate-batch-output.mjs \
  <batch-output.json> <blind-input.json> <batch-id>
```

全batch完了後、さらにPlanを受け取らない独立Blind consolidatorを起動する。batch outputを統合し、全hunkを重複なく一度だけ割り当て、findingを`S1-001`から採番して`stage-1.json`を保存する。batchが1件でもこのconsolidationを行う。

Stage 1契約:

- `schemaVersion: 3`、collectorと同じ`mode`。
- groupはfile数や行数ではなく、一緒に理解・承認する実装意図で作る。
- findingは`stage: "blind"`、`planAssessment.status: "not-reviewed"`。
- `review`では`fileExplanations: []`。
- `walkthrough`ではgroup内の各`(groupId,fileId)`にfile explanationを1件作る。
- `segmented` hunkの全diff行を、連続する0-based inclusive rangeで重複・欠落なく覆う。1segmentは最大120行。
- segmentは論理的な変更単位を優先し、「何を変えたか」「なぜ必要か」「レビュー時に見る点」を各1〜2文にする。1行segment乱造や説明反復を避ける。
- `summary-only`分類と理由はcollectorの値をそのまま使い、segmentを作らない。

Stage 1を保存したら内容を変更しない。

## 4. Stage 2: Plan review

親contextで初めて`plan-input.json`を読む。

Planあり:

- 差分で静的に判定できる見出し・箇条書き・完了条件を`requirementKind: "static"`の`planCoverage.items`へ整理する。
- `satisfied`は具体的なimplementation/test/documentation evidenceを1件以上持つ。
- `partial`と`missing`は不足を説明するS2 findingを1件以上持つ。
- `not-applicable`はscope外または対象外の理由を書く。
- groupとfile explanationへ関連`planItemIds`を追加する。
- command成功、目視、性能値など実行しなければ判定できない項目は`requirementKind: "runtime"`の`verificationItems`へ移し、`status: "not-verified"`とする。

Planなし:

- `planReview.status`と`planCoverage.status`を`skipped-no-plan`にする。
- coverage items、verification items、planItemIds、S2 findingを空にする。

Stage 2で変更・追加できるものは次だけ。

- S1 findingの`planAssessment`
- `S2-001`から始まる`stage: "plan"`のfinding
- group/file explanationの`planItemIds`
- top-level `planCoverage`と`verificationItems`
- final overviewとPlan summary

Stage 1のgroup ID、順序、hunk割当、説明、file explanation、segment、S1 findingの所属group・ID・severity・本文・locationは変更しない。

最終分析は`schemaVersion: 3`とし、`overview`、Stage 1と同一の`blindSummary`、`planReview`、`planCoverage`、`verificationItems`、`groups`を持たせる。厳密なfield、完全な最小例、Stage 1からfinalへの変換例は`analysis-contract.md`に従う。

## 5. 固定reportを生成する

```bash
node <skill-dir>/scripts/generate-report.mjs \
  --blind-input <blind-input.json> \
  --plan-input <plan-input.json> \
  --stage1 <stage-1.json> \
  --analysis <final-analysis.json>
```

generatorは次を検証・生成する。

- Stage 1完全保持、Blind batch集計、全hunk coverage、finding/evidenceのdiff・Plan・rule位置
- Plan status・evidence・S2 finding・Plan link整合性
- walkthroughのfile所有、summary-only分類、segment全行coverage
- Shiki 4.3.1 / JavaScript RegExp engineによるlight/dark token
- token range復元、1 MiB/hunkのtokenize前上限、hunk前後での10秒deadline検出、hunk token上限、64 MiB report上限
- v3 Schema、atomic swap、self-contained `index.html`と`report.json`

## 6. 表示して報告する

macOS:

```bash
open .review/<review-id>/index.html
```

HTTP serverは不要。完了時はbase ref/OID、merge-base、scope、mode、workspace fingerprint、review ID、group/finding数、Plan status、未確認verification件数、`index.html`の絶対pathを伝える。

必ず「画面の承認は収集時snapshotに対するもの。修正後は再生成・再承認が必要」と伝える。
