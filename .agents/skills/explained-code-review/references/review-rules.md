# Review Rules

## Stage 1: Blind review

selected planのpath/contentと会話上のplan説明を参照せず、snapshot差分、既存コード、適用規約だけを確認する。

- bug、regression、security、data integrity、performance
- 責務の崩れ、不要な複雑化、error handling不足
- test不足、意図を説明できない変更

Stage 1は履歴を継承しない独立contextで行う。これは入力を分離する手続的保証であり、filesystem sandboxとは表現しない。

## Stage 2: Plan review

Stage 1 JSONを固定した後で初めてplanを読み、次を確認する。

- 要件充足、実装漏れ、planとの不一致
- planに記載されていない影響
- plan自体の誤り、曖昧さ、過剰設計

Stage 1のgroup ID・順序・hunk割当・説明・file explanation・segmentを完全に保持する。S1 findingは元group、ID、severity、本文、locationを保持し、`planAssessment`だけを更新する。planで説明できる場合も削除しない。Stage 2はS2 finding、Plan link、coverage、verificationだけを追加できる。

## Plan coverageとverification

- coverage itemにするのは差分から静的に判定できる実装、test code、文書要件だけ。
- `satisfied`はgroupまたはdiff位置を示す具体的evidenceを必須にする。
- `partial` / `missing`は不足を説明するS2 findingを必須にする。
- `not-applicable`はscope外または明示的対象外の理由を書く。
- test fileの追加は「test codeを実装した」evidenceにはできるが、「test commandが成功した」evidenceにはしない。
- command成功、目視、性能値、portable実行結果は`verificationItems`へ分離し、実行記録を取り込まない限り`not-verified`にする。

## 実装意図group

- file単位ではなく、一緒に理解・検証すべき変更を同じgroupへ置く。
- renameとimport、schemaと利用側、UIと関連testは原則同じgroupにする。
- 1 hunkを主たる意図の1 groupへ割り当てる。重複・欠落は禁止する。
- 変更のない将来機能をgroupに作らない。
- group `summary`は一覧で読める短い説明にする。
- `changeType`は`feature | fix | refactor | test | docs | build | chore | mixed`。
- riskは失敗時の影響と発生可能性から決め、critical → high → medium → low順に表示する。

## Walkthrough

- navigationと説明の所有単位は`(groupId,fileId)`。同じpathが複数groupに属する場合はgroupごとに説明する。
- collectorの`explanationPolicy`を変更しない。`summary-only`をAI判断で増やさない。
- `segmented` hunkは全diff行を0-based inclusive rangeで一度だけ覆う。1segmentは最大120行。
- 行数で機械的に細切れにせず、同じ目的の隣接範囲をまとめ、異なる責務を同じsegmentへ詰め込まない。
- 120行上限で継続分割するときは、説明に前後関係を含める。
- `whatChanged`、`why`、`reviewFocus`は各1〜2文。説明の言い換え反復や1行segment乱造を避ける。
- 正常な実装説明をfindingへ変換しない。

## Risk / severity

- `critical`: 認証回避、重大な情報漏えい、復旧困難なデータ破壊、主要経路の全面停止
- `high`: 主要機能障害、権限・transaction・整合性の破壊
- `medium`: 限定条件のbug、明確なregression、重要なtest/error handling不足
- `low`: 影響が小さい保守性、説明不足、軽微なtest不足

styleの好みだけをfindingにしない。具体的な失敗条件、利用者影響、規約違反のいずれかを説明する。

## Finding

category:

`bug`、`regression`、`security`、`data-integrity`、`performance`、`responsibility`、`complexity`、`error-handling`、`test-gap`、`unclear-change`、`requirement-gap`、`plan-mismatch`、`unplanned-impact`、`plan-defect`

location:

- 追加・context行: `locationKind: diff`、`lineSide: new`
- 削除行: `locationKind: diff`、`lineSide: old`
- plan自体: `locationKind: plan`
- repository規約: `locationKind: rule`
- diff行へ置けない実装漏れ: `locationKind: repository`

`startLine`と`endLine`は1以上。diff locationはgroup hunkの該当sideと交差させる。plan/rule/repositoryでは`lineSide`をnullにする。

confidence:

- `high`: 差分と既存契約から失敗を直接説明できる
- `medium`: 強い状況証拠があるが実行環境や呼出元に依存する
- `low`: 追加確認が必要だが具体的リスクがある

## Snapshotと承認

- reportは収集時snapshotだけを説明する。修正後は再収集する。
- group承認は変更意図を確認した状態であり、finding解決を意味しない。
- 全group承認済みでも未解決findingがあれば「確認済み・指摘残あり」とする。
- 人間コメント、承認、resolveは対象fingerprint一致時だけ現行状態へ復元する。
