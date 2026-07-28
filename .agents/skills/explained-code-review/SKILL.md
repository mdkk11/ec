---
name: explained-code-review
description: planと現在のGit workspaceを実装意図ごと・リスク順に整理し、Blind reviewとplan照合を分離した解説付きHTMLレビュー画面を生成する。PR前レビュー、未コミット差分の確認、planとの実装漏れ確認、Markdownフィードバック共有に使う。
---

# Explained Code Review

収集時点のworkspace snapshotを、人間が変更意図を理解して承認できる固定UIへ変換する。

## 必須原則

- 最初に`references/review-rules.md`を最後まで読む。
- runtimeはNode.js 20以上とGitだけを前提にする。repository側のpackage managerや依存を使わない。
- Stage 1は必ず履歴を継承しない独立subagentで行う。独立contextを利用できなければ停止し、Blind review済みと表現しない。
- Stage 1へ渡すのは`blind-input.json`、review rules、`report-schema.json`、出力先だけ。`plan-input.json`、selected planのpath/content、会話中のplan要約は渡さない。
- Stage 1 subagentへselected planを読まないよう明示する。これは手続的隔離でありfilesystem sandboxではない。
- Stage 1 JSONを保存してから、親contextで初めて`plan-input.json`を読む。
- generatorの検証を迂回しない。

## 1. Skill directoryを決める

この`SKILL.md`の親directoryを`<skill-dir>`とする。project-localでもglobalでも、scriptとassetは`import.meta.url`から解決される。

## 2. workspaceを収集する

repository rootから実行する。

```bash
node <skill-dir>/scripts/collect-diff.mjs
```

必要に応じて引数を加える。

```bash
--repository <path>
--base <ref>
--scope workspace|commits
--plan <repository-file>
--no-plan
--rule <repository-file>
--review-id <id>
--output <temporary-directory>
```

既定scopeは`workspace`。merge-baseから現在workspaceまでのnet差分に、未追跡の通常fileを加える。selected planと`.review/**`は対象外になる。baseは`origin/HEAD`、`origin/main`、`main`、`origin/master`、`master`の順で解決し、fetchしない。

標準出力から`blindInputPath`、`planInputPath`、`reviewId`を記録する。

## 3. Stage 1: Blind review

履歴を継承しないsubagentへ、次のraw taskだけを渡す。`report-schema.json`は出力fieldの型・enum確認専用であり、final reportにだけある`fingerprint`はStage 1 analysisへ書かない。

```text
<blind-input.json>、<review-rules.md>、<report-schema.json>を読み、Stage 1 Blind reviewを実行してください。
selected plan、plans directory、plan入力は読まないでください。
必要な既存コードはrepositoryから読んで構いません。
全hunkを実装意図groupへ一度だけ割り当て、結果を<stage-1.json>へJSONだけで保存してください。
schemaVersionは2です。findingはS1-001から採番し、stageはblind、
planAssessmentは{"status":"not-reviewed","rationale":"Blind reviewではplanを参照しないため"}としてください。
大きい差分はbatch化し、全hunk IDの網羅を確認してください。
```

Stage 1 JSON:

```json
{
  "schemaVersion": 2,
  "summary": "Blind reviewの要約",
  "groups": [
    {
      "id": "group-session-validation",
      "title": "セッション検証の変更",
      "summary": "一覧表示用の短い説明",
      "changeType": "fix",
      "risk": "high",
      "intent": "差分から推測した変更意図",
      "implementationSummary": "実装の要約",
      "impact": "影響範囲",
      "verificationPoints": ["重点確認項目"],
      "hunkIds": ["hunk-1"],
      "findings": []
    }
  ]
}
```

finding fieldは`report-schema.json`のfindingから`fingerprint`だけを除いたものを使う。空差分では`groups`を空配列にする。

## 4. Stage 2: Plan review

Stage 1を保存後、親contextで`plan-input.json`を読む。

- planあり: 要件充足、漏れ、不一致、未記載影響、plan自体の問題を確認する。
- planなし: `skipped-no-plan`とし、Stage 1を元に最終分析を作る。
- S1 findingは別groupへ移動できるが、`planAssessment`以外を追加・削除・変更しない。
- Stage 2 findingは`S2-001`から採番し、`stage: "plan"`にする。
- Stage 2 findingの`planAssessment`は`confirmed`とし、そのfindingがplan照合で成立する理由を書く。planで軽減済みならfindingとして追加せず、要約へ判断を残す。
- 全hunkを重複なく一度だけ割り当てる。

最終分析:

```json
{
  "schemaVersion": 2,
  "overview": "レビュー全体の概要",
  "blindSummary": "Stage 1 summaryと完全に同じ文字列",
  "planReview": {
    "status": "completed",
    "planPath": "plans/example.md",
    "summary": "plan照合の要約"
  },
  "groups": []
}
```

`groups`はStage 1と同じ形。planなしでは`status`を`skipped-no-plan`、`planPath`をnullにする。

## 5. 固定reportを生成する

```bash
node <skill-dir>/scripts/generate-report.mjs \
  --blind-input <blind-input.json> \
  --plan-input <plan-input.json> \
  --stage1 <stage-1.json> \
  --analysis <final-analysis.json>
```

generatorは厳密parser、standalone schema validator、Stage 1完全保持、hunk網羅、finding位置を検証する。成功時は`.review/<review-id>/index.html`と`report.json`だけが残る。同じreview IDは安全に置換され、内容fingerprintが変わった保存状態は現行状態として復元されない。

## 6. 表示して報告する

macOS:

```bash
open .review/<review-id>/index.html
```

HTTP serverは不要。`file://`で開く。完了時はbase ref/OID、merge-base、scope、workspace fingerprint、review ID、group/finding数、plan status、`index.html`の絶対pathを伝える。利用者へ「修正後は再生成・再承認が必要」と伝える。
