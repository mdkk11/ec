# Analysis JSON contract

この文書はAIが生成するbatch、Stage 1、final analysisの機械可読契約を示す。final reportの`fingerprint`、`tokenRuns`、`highlighting`はgeneratorが付けるため、analysis JSONへ書かない。

## Batch output

`batch-output-schema.json`を正とする。`hunks`は指定batchのhunkと同じ集合にし、1 hunkにつき1件出す。`findings`は一時indexで扱い、S1 IDはconsolidatorが全batch統合後に付ける。review modeの`walkthroughNotes`はnull。保存後は`validate-batch-output.mjs <batch-output.json> <blind-input.json> <batch-id>`を実行し、schemaに加えてcollector分類、finding index、diff位置と担当hunkの交差、rule位置と収集済みruleの一致、segment順序・120行上限・全行coverageを検証する。

```json
{
  "schemaVersion": 3,
  "batchId": "blind-batch-1",
  "summary": "このbatchの要約",
  "hunks": [
    {
      "hunkId": "hunk-1",
      "suggestedGroupId": "group-session-validation",
      "title": "セッション検証",
      "changeType": "fix",
      "risk": "high",
      "intent": "差分から推測した意図",
      "implementationSummary": "実装内容",
      "impact": "影響範囲",
      "verificationPoints": ["確認点"],
      "findings": [],
      "walkthroughNotes": null
    }
  ]
}
```

## Stage 1

```json
{
  "schemaVersion": 3,
  "mode": "review",
  "summary": "Blind reviewの要約",
  "groups": [
    {
      "id": "group-session-validation",
      "title": "セッション検証",
      "summary": "一覧用の短い説明",
      "changeType": "fix",
      "risk": "high",
      "intent": "差分から推測した意図",
      "implementationSummary": "実装内容",
      "impact": "影響範囲",
      "verificationPoints": ["確認点"],
      "hunkIds": ["hunk-1"],
      "findings": [],
      "fileExplanations": []
    }
  ]
}
```

findingは次の全fieldを持つ。

```json
{
  "id": "S1-001",
  "stage": "blind",
  "severity": "high",
  "category": "bug",
  "locationKind": "diff",
  "lineSide": "new",
  "file": "src/example.ts",
  "startLine": 10,
  "endLine": 10,
  "title": "短い題名",
  "issue": "問題",
  "rationale": "失敗条件と影響",
  "suggestion": "修正案",
  "confidence": "high",
  "planAssessment": {
    "status": "not-reviewed",
    "rationale": "Blind reviewではPlanを参照しないため"
  }
}
```

walkthroughのfile explanationはgroupの各fileに1件作る。`endLineIndex`はinclusive。

```json
{
  "id": "file-group-session-validation-file-1",
  "fileId": "file-1",
  "responsibility": "このgroup内でのfile責務",
  "implementationSummary": "このfileの実装内容",
  "reviewPoints": ["確認点"],
  "detailLevel": "segmented",
  "summaryOnlyKind": null,
  "summaryOnlyReason": null,
  "segments": [
    {
      "id": "segment-hunk-1-0",
      "hunkId": "hunk-1",
      "startLineIndex": 0,
      "endLineIndex": 9,
      "whatChanged": "何を変えたか。",
      "why": "なぜ必要か。",
      "reviewFocus": "レビュー時に見る点。",
      "findingIds": []
    }
  ]
}
```

summary-onlyではcollectorのkind/reasonをコピーし、`segments: []`にする。

## Final analysis

Stage 1 groupへ`planItemIds`を追加し、各file explanationにも`planItemIds`を追加する。S1 findingは`planAssessment`以外を変えない。S2 findingだけを追加できる。

```json
{
  "schemaVersion": 3,
  "mode": "review",
  "overview": "全体概要",
  "blindSummary": "Stage 1 summaryと完全に同じ文字列",
  "planReview": {
    "status": "completed",
    "planPath": "docs/plan.md",
    "summary": "Plan照合の要約"
  },
  "groups": [
    {
      "id": "group-session-validation",
      "title": "セッション検証",
      "summary": "一覧用の短い説明",
      "changeType": "fix",
      "risk": "high",
      "intent": "Stage 1と同じ",
      "implementationSummary": "Stage 1と同じ",
      "impact": "Stage 1と同じ",
      "verificationPoints": ["確認点"],
      "hunkIds": ["hunk-1"],
      "findings": [],
      "fileExplanations": [],
      "planItemIds": ["plan-session-validation"]
    }
  ],
  "planCoverage": {
    "status": "completed",
    "items": [
      {
        "id": "plan-session-validation",
        "requirementKind": "static",
        "label": "セッション検証を追加する",
        "startLine": 3,
        "endLine": 3,
        "status": "satisfied",
        "rationale": "実装根拠がある。",
        "evidence": [
          {
            "kind": "implementation",
            "groupId": "group-session-validation",
            "file": "src/example.ts",
            "lineSide": "new",
            "startLine": 10,
            "endLine": 20
          }
        ],
        "findingIds": []
      }
    ]
  },
  "verificationItems": [
    {
      "id": "verify-tests",
      "requirementKind": "runtime",
      "label": "test commandが成功する",
      "startLine": 8,
      "endLine": 8,
      "requiredAction": "repository指定のtest commandを実行する",
      "status": "not-verified"
    }
  ]
}
```

Planなしは`planReview.status`と`planCoverage.status`を`skipped-no-plan`、`planPath`をnull、coverage itemsとverificationItemsと全planItemIdsを空にする。
