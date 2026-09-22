# `$orchestrate` bounded evidence acquisition

## 1. 背景と目的

`$orchestrate` のruntime/Skill discovery診断が、同じpropertyを異なる方法で繰り返し確認して収束しない問題を防ぐ。安全性を下げず、必要な証拠だけをboundedに取得し、material inputが変わっていない証拠を再利用する。

## 2. 現状調査

- risk別gate、artifact identity、stale propagation、bounded repairは既に存在する。
- repair後のaffected verification再実行も既に規定されている。
- runtime preflightには診断順序、同一propertyへのprobe上限、explicit-only Skillの判定がない。
- runtime設定検証例の`codex exec`はmodel/MCP起動を伴い得る。

## 3. 解決する問題

- `allow_implicit_invocation: false`による正常な非表示をdiscovery失敗と誤認する。
- 同じruntime propertyをfresh sessionや別CLIで反復確認する。
- 後続phaseの実行だけを理由に、入力が変わっていないverificationを再実行する。

## 4. 採用する方針

- static evidence、non-model diagnostic、必要なactual runtime probeの順で確認する。
- 同一propertyはprimary method 1つとmaterially differentなfallback最大1つを原則とする。
- 解決しなければ`unavailable`を正規結果として記録し、selected gateに必須の場合だけblockする。
- implicit invocationが無効なSkillは、implicit contextにないことだけで失敗としない。
- later phase自体では既存evidenceをstaleにせず、material inputが変わったaffected evidenceだけを再実行する。

## 5. 採用しない方針

- 診断wrapper、cache、dependency graph、revision counterを追加しない。
- opaqueなsession/runtime fingerprintを追加しない。
- すべてのprobeへ一律の固定秒数をhard-codeしない。
- 新規evalを増やさない。

## 6. 変更対象

- `.agents/skills/orchestrate/SKILL.md`
- `.agents/skills/orchestrate/references/runtime-preflight.md`
- `.agents/skills/orchestrate/references/workflow.md`
- `.agents/skills/orchestrate/evals/evals.json`

## 7. 実装手順

1. `SKILL.md`のcontroller responsibilityへbounded diagnosticsとcurrent evidence reuseを1項目追加する。
2. `runtime-preflight.md`へprobe順序、既定attempt上限、`unavailable`のblocking条件、explicit-only Skillの扱いを追加する。
3. `codex exec`を通常チェックからgate-criticalなfallbackへ下げる。
4. `workflow.md`へlater phaseだけではstaleにならないこととaffected evidenceのみ再実行する原則を追加する。
5. eval 4へruntime/discovery収束条件、eval 12へunchanged evidence reuseを統合する。

## 8. テスト・検証方法

- `evals.json`のJSON parseと13件維持を確認する。
- YAML frontmatterと`agents/openai.yaml`をparseする。
- `pnpm format`、`pnpm lint`、`pnpm knip`、`git diff --check`を実行する。
- explicit-only discovery、primary/fallback/unavailable、unchanged verification reuse、material change後のaffected rerunを文書・eval間でsimulationする。
- current branchの独立reviewを新HEADに対して更新する。

## 9. リスク

- probe上限が厳しすぎると一時障害を恒久的な`unavailable`と誤認する可能性がある。transientと確認できる失敗は単一fallbackの選択理由にできるが上限を増やさず、追加attemptは依存Skill自身のdocumented bounded retryだけに従う。
- evidence reuseが広すぎると環境変更を見落とす。HEAD/base/spec/planに加え、verificationが依存するtoolchain/environment変更もmaterial inputとして扱う。

## 10. 未確定事項

なし。具体的なruntime metadataが公開されない場合は`unavailable`として扱う。

## 11. 完了条件

- 同一runtime/discovery propertyの診断が既定でprimary 1回とfallback最大1回に収束する。
- explicit-only Skillのimplicit非表示をfailure扱いしない。
- unchanged material inputsのevidenceを再利用し、later phaseだけを理由に再実行しない。
- material change後はaffected evidenceだけをstale化する。
- 新しいengine、wrapper、counter、opaque fingerprintを追加しない。
- 既存13 evalと全検証が通り、独立reviewがPASSする。
