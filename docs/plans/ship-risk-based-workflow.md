# `$ship` risk-based workflow 改修計画

## 1. 背景と目的

現行の `$ship` は、state-machine、durable evidence による再開、入力変更時の stale 判定、PR head/base と stack 関係の照合、unrelated changes の保護、author と critic の分離を備えている。一方、通常の機能追加やリファクタでも、仕様化、独立 plan review、人間の plan 承認、stacked PR、説明 phase、独立 final audit を一律に要求するため、task risk に対して ceremony が過剰になっている。

これらの安全性と回復性は維持し、task を Small / Normal / Large or High-risk に分類して、必要な gate だけを有効化する workflow へ変更する。Normal を既定経路とし、1 meaningful PR、独立 implementation review、bounded stabilization を中心に、人間レビュー可能な状態まで進める。

## 2. 現状調査

### 調査済みの事実

- `.agents/skills/ship/SKILL.md` は controller の責務、phase state、global safety、完了報告を定義している。
- `.agents/skills/ship/references/workflow.md` は全 task にほぼ共通の直列 phase を定義し、現行 Medium path で specification、plan、independent plan review、user approval、stack、explanation、final audit を必須にしている。
- `.agents/skills/ship/references/runtime-preflight.md` は `grill-with-docs`、`grilling`、`domain-modeling`、`babysit-pr`、`gh-stack` を開始前の一律 hard dependency としている。
- 現在の `grill-with-docs` は `grilling` に `domain-modeling` を使用させる wrapper である。`grilling` と `domain-modeling` は `$ship` が直接呼ぶ契約ではない。
- `babysit-pr` は one-shot snapshot と continuous watch を提供し、flaky retry を最大3回に制限している。`$ship` の bounded stabilization では one-shot を使える。
- `gh-stack` は stack の作成、submit、restack、state 照合を提供するが、単一PRには不要である。
- `.agents/skills/ship/references/pr-review-protocol.md` は Reviewer Guide と human prefix protocol を定義している。`[SHIP:NOTE]` は既に重要な箇所へ限定する記述だが、workflow 側では explanation phase 自体が一律必須である。
- `.agents/skills/ship/evals/evals.json` は resume、merged/closed PR の重複防止、Draft PR checkpoint の3ケースだけを持つ。
- repository-local `explained-code-review` は独立 blind review を行えるが、HTML review artifact の生成に特化している。すべての `$ship` invocation の必須 dependency にはしない。
- 公式 OpenAI documentation では、trusted project の `.codex/config.toml` で main agent の既定 `model` と `model_reasoning_effort` を設定でき、`.codex/agents/*.toml` で project-scoped custom agent ごとの model、reasoning effort、instructions、sandbox を設定できる。一方、child spawn 時には parent turn の live sandbox/approval override が再適用され得るため、custom agent file の configured sandbox と effective runtime sandbox は別に確認・報告する必要がある。
- 現在の Codex CLI は `0.148.0-alpha.6` で multi-agent feature が有効であり、local model catalog は `gpt-5.6-sol` の `high` と `gpt-5.6-luna` の `max` をサポートしている。
- 現在の repository には `.codex/` directory がなく、project-level model routing は未設定である。
- `AGENTS.md` は複数ファイルの設計変更に実行計画と承認を要求する。計画作成後は実装承認まで停止する。
- 作業開始時の worktree は clean だった。ローカル `main` は `origin/main` より8コミット遅れているが、対象の `$ship`、`AGENTS.md`、`docs/PLANNING.md`、`explained-code-review` には差分がない。

## 3. 解決する問題

1. Normal task が High-risk と同等の ceremony を常に通る。
2. implementation 品質を確認する正式な独立 review gate がなく、plan critique と final audit に保証が分散している。
3. implementation worker の入力、結果、write scope、scope drift の扱いが明文化されていない。
4. stack が reviewability ではなく標準工程として扱われている。
5. delegated Skill の transitive dependency まで `$ship` が一律に検証し、不要な path も開始不能になる。
6. Normal task で implementation review と final specification audit の責務が重複する。
7. local review fix と CI/review fix の非収束時 escalation が十分明確でない。
8. 現行 eval が risk routing、independence、scope drift、stale evidence、prefix semantics を十分に覆っていない。

## 4. 採用する方針

### Risk routing

- `small | medium | large/high-risk` を `small | normal | large/high-risk` に変更し、Normal を default にする。
- triage で task class と gate matrix を決め、各 phase を `required`、`conditional`、`skipped` のいずれかとして state に記録する。
- state-machine 自体は維持し、skip された phase も理由を evidence として残す。resume 時は現在の class、gate selection、artifact revision、HEAD/base を照合する。

### Small

- `preflight/recover -> triage -> implementation -> relevant verification -> independent diff/code review -> PR -> minimal stabilization -> human-review-ready` を基本経路にする。
- repository policy が要求しない限り、grill/spec、formal plan、plan review、plan approval、stack、explanation phase、final audit を skip する。
- acceptance criteria、non-goals、verification は conversation state に短く残す。

### Normal

- `preflight/recover -> triage -> conditional specification/grill -> plan -> implementation -> verification -> independent implementation review -> repair/reverify -> PR -> bounded stabilization -> human-review-ready` を基本経路にする。
- requirements、acceptance criteria、edge cases、responsibility boundary が十分明確なら `grill-with-docs` を skip できる。material ambiguity がある場合、または specification interrogation によって実装ミスを減らせる場合は使用する conditional / recommended gate とし、`orchestrator/planner -> grill-with-docs -> planning` の経路を残す。
- plan review、human plan approval、stack、separate explanation phase、final audit は repository policy、task characteristics、review findings が要求した場合だけ追加する。
- implementation review が acceptance criteria、correctness、tests、relevant risks を確認した同一 evidence に対して、final audit を重ねない。

### Large / High-risk

- specification、plan、independent plan review、必要な human approval、implementation、verification、independent code review、PR/stabilization、必要な explanation、independent final acceptance audit を維持する。
- rollback、migration ordering、compatibility、observability、data integrity、security、concurrency、destructive behavior を明示的な review 項目にする。
- stack は risk class だけで強制せず、意味のある review boundary が成立する場合だけ選ぶ。

### 独立 implementation review

- implementation author とは別の agent を reviewer にする。reviewer へ desired verdict や author の完了主張を渡さない。
- reviewer へ original request、acceptance criteria/spec、適用される plan、repository rules、actual diff、changed files、verification output、current HEAD/base を渡す。
- acceptance criteria、plan からの material deviation、correctness、責務境界、不要な抽象化、簡素化余地、edge/error handling、security、applicable performance、tests、implementation-detail coupling、regression risk、repository conventions を確認する。
- review result は `PASS | FAIL | BLOCKED`、findings、確認 evidence、必要な repair/reverification を持つ簡潔な形式にする。
- `FAIL` は implementation author が修正し、該当 verification と独立 re-review を行う。現行 plan review と同じ「1回の repair と final re-review」を通常の上限とし、同じ material finding が残る場合は blocker または human decision へ昇格する。
- High-risk では code review を implementation quality、final audit を acceptance criteria/non-goals/spec compliance として分離する。

### Implementation worker contract

- Input は `responsibility`、`relevant context`、`allowed/write scope`、必要な `do-not-touch scope`、`acceptance criteria`、該当する parent/base HEAD、`required verification`、`known risks` を持つ。
- Result は `status`、`changed files and summary`、`verification results`、`plan deviations`、`assumptions`、`residual risks`、`blockers` を持つ。
- controller は worker result だけを信用せず actual diff と status を照合する。allowed scope 外の変更は、既存 user change と区別し、明示的に正当化・承認されるまで review gate を通さない。

### PR と stack

- default を1 meaningful PR にする。
- semantic に独立した責務、明確な parent/child dependency、valid な intermediate HEAD、各 layer 単独の test/review、明確な reviewability 改善が揃う場合だけ stack を選ぶ。
- line count だけを stack 理由にしない。
- existing/selected stack では現行の head/base 照合、restack、descendant stale invalidation、`--force-with-lease` 制約を維持する。

### Explanation と human protocol

- Small のPR bodyは Purpose、必要ならScope、Verificationを最低限とし、Reviewer Guideはdiffの読み順、非自明な判断、review focus、repository policyのいずれかに価値がある場合だけ追加する。Normal / High-risk は Reviewer Guide を原則維持するが、現在の diff の review に必要な情報だけに絞る。
- `[SHIP:NOTE]` は domain invariant、state transition、auth/security、data integrity、transaction/concurrency、cache/performance、非自明な architecture decision に限定し、trivial code には付けない。
- `[SHIP:Q]` と `[SHIP:VERIFY]` は read-only、`[SHIP:CHANGE]` だけを明示的 change request とする意味論を維持する。

### Final audit と stale evidence

- final audit は High-risk または明示的に有効化された task だけで行う。
- Normal で implementation review が同じ acceptance criteria、diff、verification、HEAD/base を確認済みなら final audit は skip する。
- original request、acceptance criteria/spec、material plan content、actual code/diff、verification、PR head/base、stack ancestry のうち gate の入力が変われば、依存する evidence を stale にする。判定には spec/plan の path と blob SHA/content revision、implementation HEAD、PR head/base、review/audit が確認した各 revision など既存artifactのidentityを直接使い、独自のmonotonic evidence revisionは作らない。
- lower stack が変わった場合は全 descendant の implementation verification、review、存在する/applicable な Reviewer Guide、必要な explanation、final audit を stale にする。
- final audit 後に code、PR head/base、spec が変わった場合は audit を stale にし、同じ artifact を根拠に ready としない。

### Dependency と bounded stabilization

- `grill-with-docs` は specification/grill gate を有効にした場合だけ direct dependency として検証する。内部の `grilling` と `domain-modeling` は wrapper 側の契約に委ね、`$ship` の hard-coded dependency list から外す。
- `gh-stack` は existing stack の recovery または stack 選択時だけ検証する。
- `babysit-pr` は PR stabilization を実行する前に検証し、local-only checkpoint までの作業を不必要に止めない。
- independent agent support は independent review が必要になる前に確認し、欠けている場合は独立性を偽らず blocker とする。
- `$ship` の bounded stabilization は `babysit-pr` の one-shot snapshot を使う。flaky retry は同 Skill の最大3回を超えない。branch-related fix が同じ原因で収束しない場合は、同 Skill の stop condition と local review の bounded cycle に従い human decision へ昇格する。
- planner、implementation worker、independent reviewer、final auditor という role だけを定義し、具体的な model 名は記載しない。

### Runtime model routing

- workflow semantics と model assignment を分離する。`$ship` の Markdown は `orchestrator/planner`、`implementation worker`、`independent implementation reviewer`、`final auditor` という role と独立性だけを定義し、具体的な model 名や reasoning level を記載しない。
- project runtime の `.codex/config.toml` で main orchestrator の default を `gpt-5.6-sol` / `high` にする。
- `.codex/agents/ship-planner.toml` で planner を `gpt-5.6-sol` / `high`、configured read-only にする。plan artifact の書込みが必要な場合は orchestrator が reviewer-approved result を保存する。
- `.codex/agents/ship-implementation-worker.toml` で implementation worker を `gpt-5.6-luna` / `max` にする。`$ship` は原則この独立 subagent へ implementation contract を渡し、main orchestrator 自身による実装は runtime が subagent を利用できない場合の明示的 blocker/fallback decision に限定する。
- `.codex/agents/ship-independent-reviewer.toml` で independent implementation reviewer を `gpt-5.6-sol` / `high`、configured read-only にする。
- `.codex/agents/ship-final-auditor.toml` で final auditor を `gpt-5.6-sol` / `high`、configured read-only にする。
- preflightでは configured sandbox、runtimeが公開する場合のeffective sandbox、logical role policy、runtime enforcementの確認可否を分離する。effective read-onlyを確認できない場合は保証を主張せず、write-capableでもplanner/reviewer/auditorのno-edit/no-external-state/no-PR-mutation契約は維持してruntime limitationを報告する。独自wrapperや擬似sandboxは追加しない。
- current session へ project config が遡及適用されるとは仮定しない。実装作業自体では spawn API の正式な per-agent model/reasoning override を使い、implementation author を Luna Max、reviewer を別の Sol High agent として起動する。
- runtime や active tool surface が named custom agent または per-agent override を公開しない場合は擬似 routing を追加しない。利用可能な設定 level、実際に解決された assignment、不可能な部分を最終報告する。

## 5. 採用しない方針

- state-machine、durable recovery、stale 判定を削除して単純な checklist にしない。
- Small の速度向上を理由に verification、diff review、unrelated changes 保護を省略しない。
- Normal の保証を plan review と final audit の二重実行で代替しない。
- High-risk の rollback、migration、compatibility、security、data-integrity gate を弱めない。
- すべての task に stack、HTML review artifact、ADR、`[SHIP:NOTE]` を強制しない。
- 新しい runner、schema file、dependency、workflow state fileを追加しない。既存 Markdown と eval JSON の契約内で表現する。
- model routing を Skill 本文へ埋め込まず、project-scoped Codex runtime configuration 以外の独自 launcher や wrapper を追加しない。
- `$ship` から delegated Skill の内部依存を推測して再実装または一律検証しない。
- 自動 merge、無断の force-push、unrelated user changes の修正を許可しない。

## 6. 変更対象

| ファイル | 変更内容 |
| --- | --- |
| `.agents/skills/ship/SKILL.md` | risk-based controller、柔軟な phase state、role と implementation/review contract、完了報告を更新する |
| `.agents/skills/ship/references/workflow.md` | Small / Normal / High-risk の経路、独立 implementation review、repair、optional stack/explanation/final audit、stale matrix を定義する |
| `.agents/skills/ship/references/runtime-preflight.md` | core capability、direct conditional dependency、delegated transitive dependency を分離する |
| `.agents/skills/ship/references/pr-review-protocol.md` | Reviewer Guide を最小化し、`[SHIP:NOTE]` を conditional にし、3 prefix の意味論を保持する |
| `.agents/skills/ship/evals/evals.json` | 現行3ケースの意図を保持しながら、指定された13ケースへ再編・追加する |
| `.agents/skills/ship/agents/openai.yaml` | stacked PR を default と読める表示文と prompt を risk-based orchestration に合わせる |
| `.codex/config.toml` | main orchestrator の project default を Sol High にし、multi-agent を有効化する |
| `.codex/agents/ship-planner.toml` | planner の project-scoped custom agent を Sol High / read-only で定義する |
| `.codex/agents/ship-implementation-worker.toml` | implementation worker を Luna Max で定義し、scope と result contract を守らせる |
| `.codex/agents/ship-independent-reviewer.toml` | implementation author と分離した Sol High / read-only reviewer を定義する |
| `.codex/agents/ship-final-auditor.toml` | High-risk の acceptance/spec audit を行う Sol High / read-only auditor を定義する |

`explained-code-review`、global の delegated Skill、application code、product documents、personal `~/.codex` configuration は変更しない。

## 7. 実装手順

1. `SKILL.md` の Start、responsibility boundary、state reporting、completion を gate-aware に変更する。task class を Normal default にし、phase ごとの required/conditional/skipped と、spec/plan/HEAD/base/review/auditなど実artifactのrevisionを追跡できる状態表現へ更新する。
2. `workflow.md` の state machine を共通 backbone と risk-based route に分ける。各 class の end-to-end flow、追加 gate の選択条件、recovery/checkpoint、stale propagation を先に定義する。
3. 同ファイルへ implementation worker Input/Result と independent implementation review の契約を追加する。scope drift、FAIL repair、reverification、独立性、High-risk final auditor との責務分離を明記する。
4. stack section を optional capability に変更する。単一PR default、stack 選択条件、existing stack recovery、lower-layer change の descendant invalidation を明記する。
5. explanation、final audit、human-review readiness を gate-aware に変更する。Normal の重複 audit を避けつつ、High-risk と stale evidence の厳格さを維持する。
6. `runtime-preflight.md` の一律 required-skill check を、開始時の capability inventory と gate 選択後の conditional dependency validation に分ける。`grilling` と `domain-modeling` は `grill-with-docs` の transitive dependency として `$ship` の hard dependency から外す。
7. `pr-review-protocol.md` の PR body contract を single PR/stack 両対応にし、SmallはPurpose、必要ならScope、Verificationだけでreadyになれるようにする。Reviewer GuideはSmallでは条件付き、Normal / High-riskでは原則維持し、現在の diff の review に必要な情報へ限定する。`[SHIP:Q]`、`[SHIP:CHANGE]`、`[SHIP:VERIFY]` の既存動作は変更しない。
8. `agents/openai.yaml` の short description と default prompt から stacked PR 必須の含意を除く。
9. `.codex/config.toml` と4つの project-scoped custom agent fileを追加する。official schema の `model`、`model_reasoning_effort`、`sandbox_mode`、`developer_instructions` だけを使用し、Skill本文からは role名で参照する。
10. `evals.json` の既存13ケースへ次の観点を自然に統合し、ケース数自体は増やさない。
   1. Small が不要な spec/plan ceremony を skip する。
   2. Normal が plan review、final audit、stack を無条件実行しない。
   3. High-risk が厳格な gate を維持する。
   4. implementation author と independent reviewer を分離する。
   5. reviewer FAIL 後に repair、verification、re-review を行う。
   6. worker の allowed scope 外変更を検知する。
   7. lower stack 変更で descendant verification を stale にする。
   8. final audit 後の code/head/base/spec 変更で audit を stale にする。
   9. `[SHIP:Q]` で code を変更しない。
   10. `[SHIP:VERIFY]` で code を変更しない。
   11. `[SHIP:CHANGE]` だけを明示的 change request と扱う。
   12. current evidence が有効な resume で specification/planning を繰り返さない。
   13. merged/closed PR に duplicate PR を作らない。
   14. SmallはReviewer GuideなしでもPurpose/Verificationと他条件が揃えばreadyになり、Normal / High-riskのGuideは必要なreviewability情報を持つ。
   15. configured read-onlyとeffective sandboxを区別し、effective値を確認できなければruntime enforcementを保証しない。
   16. stale判定はHEAD/base/spec/plan等のactual artifact revisionを使い、独自counter/fingerprintを要求しない。
11. Skill6ファイルと runtime configuration 5ファイルを通読し、同じ保証が plan review、implementation review、stabilization、final audit に重複していないか、role と model assignment が密結合していないか確認する。

## 8. テスト・検証方法

### 構文・repository validation

- `node -e "JSON.parse(require('node:fs').readFileSync('.agents/skills/ship/evals/evals.json', 'utf8'))"`
- repository内のYAML / TOMLを既存parserでparseする。
- `pnpm format`
- `pnpm lint`
- `pnpm knip`
- `codex --strict-config exec --ephemeral --sandbox read-only "Reply with OK only."` で project config と custom agent file の正式な key が現在の CLI に受理されることを確認し、`codex features list` で multi-agent feature を確認する。現行CLIは `features` subcommand と `--strict-config` の併用を受け付けないため分離する。
- `codex debug models` で `gpt-5.6-sol/high` と `gpt-5.6-luna/max` が current model catalog に存在することを確認する。
- current session の spawn API で implementation worker を Luna Max、別の reviewer を Sol High として起動し、agent ごとの assignment が利用できることを確認する。

application code を変更しないため、unit/frontend/backend/E2E/VRT、typecheck、build は実行対象外とし、その理由を結果へ記録する。

### Workflow simulation

- Small: typo または isolated bug を入力し、spec、formal plan、plan review、approval、stack、explanation、final audit が repository rule なしでは skip されることを確認する。
- Normal: acceptance criteria が明確な feature/refactor を入力し、plan、implementation、verification、independent implementation review、single PR、bounded stabilization で ready になり、plan review/final audit/stack が自動追加されないことを確認する。
- High-risk: migration または authorization 変更を入力し、spec、plan、independent plan review、必要な approval、code review、final audit と risk safeguards が有効になることを確認する。
- Resume: current spec/plan/review/HEAD/base evidence を与え、最初の incomplete/stale gate から再開することを確認する。
- Stale: lower stack、implementation diff、PR head/base、spec を順に変更した想定で、依存する verification/review/explanation/audit だけが stale になることを確認する。
- Prefix: `[SHIP:Q]` と `[SHIP:VERIFY]` は read-only、`[SHIP:CHANGE]` は change request になることを確認する。
- Terminal PR: merged/closed PR を検出した場合、duplicate PR や隣接 task を開始しないことを確認する。
- Routing: Skill本文が role名だけを持ち、project runtime config が orchestrator/planner Sol High、implementation worker Luna Max、reviewer/final auditor Sol High を割り当てることを確認する。
- Sandbox reporting: configured read-only、runtimeが公開するeffective sandbox、logical read-only policy、runtime enforcementの確認可否を別項目として出力し、effective値が非公開なら保証を主張しないことを確認する。
- Evidence: current HEAD/baseをそれぞれ変更し、spec/plan blob revision、reviewed/audited HEAD/base、Reviewer Guide target headに依存するevidenceだけがstaleになることを確認する。独自monotonic revisionは使用しない。

各 simulation は `evals.json` の expected output と expectations を先頭から照合し、矛盾があれば文書側または eval 側を修正する。

## 9. リスク

- conditional gate が曖昧だと agent ごとに挙動がばらつく。各 gate に具体的な enable/skip 条件と evidence を記載する。
- phase を optional にした結果、resume 時に「未実施」と「skip 済み」を混同する可能性がある。state record に status と理由を残す。
- Normal の final audit を省略したことで spec compliance が抜ける可能性がある。独立 implementation review の必須 checklist に acceptance criteria と relevant risks を含める。
- dependency check を遅延した結果、終盤で不足が判明する可能性がある。triage 後に選択された全 gate の direct dependency をまとめて確認し、実作業前に blocker を出す。
- reviewer repair を1 bounded cycleにすると未解決で停止しやすくなる。停止時は finding、試行済み修正、verification evidence、必要な human decision を明示し、失敗を隠して先へ進めない。
- ローカル `main` が `origin/main` より遅れている。対象ファイルに差分はないが、実装開始前に remote 状態を再確認し、必要なら user-authorized な更新方法を選ぶ。
- project `.codex` config は既に開始済みの session へ遡及適用されない可能性がある。current task では per-spawn override で検証し、project default の完全な適用は新規 session で有効になるものとして報告する。
- custom agent file の `sandbox_mode = "read-only"` は configured intentであり、parent turnのlive override後のeffective sandboxをruntimeが公開しない場合がある。logical read-only contractを維持しつつ、確認不能をenforcement保証へ読み替えない。

## 10. 未確定事項

- なし。具体的な wording と章配置は、上記の責務分離を維持した範囲で既存 Skill の文体に合わせる。

## 11. 完了条件

- Small / Normal / High-risk の各 route と gate selection が6ファイルで矛盾しない。
- state-machine、durable recovery、stale propagation、PR head/base/stack 照合、unrelated changes 保護が維持される。
- Normal の正式な独立 implementation review が acceptance criteria と implementation quality を確認し、不要な final audit を置き換える。
- High-risk の independent plan review と final audit が別責務として維持される。
- implementation worker contract と scope drift detection が明文化される。
- single PR が default になり、stack capability と restack/stale behavior は残る。
- `grilling` と `domain-modeling` が `$ship` の direct hard dependency ではなくなる一方、delegated contract の確認責務は失われない。
- SmallはReviewer Guideなしでも最小PR bodyと他のready条件で完了でき、Normal / High-riskのReviewer Guideと3つのhuman prefixは必要最小限で維持され、`[SHIP:NOTE]` は非自明な箇所だけになる。
- repair と stabilization が bounded になり、非収束時は blocker/human decision へ昇格する。
- eval が指定された13ケースを個別に覆い、既存3ケースの安全性を失わない。
- JSON parse、format、lint、knip と全 workflow simulation が成功する。
- Skill本文に具体的な model 名がなく、自動 merge を許可しない。
- implementation が原則 Luna Max implementation subagent へ delegate される runtime assignment が、現在の正式な Codex configuration と spawn API で設定・検証される。
- independent implementation review を implementation author とは別の Sol High reviewer で実行できる。
- model assignment が Skill 本文の workflow semantics と密結合せず、project runtime configuration に隔離される。
- runtime 上設定不能または current session へ遡及適用できない部分が、設定可能な level と実際の assignment とともに最終報告される。
- planner/reviewer/auditorのconfigured sandbox、effective sandbox、logical read-only policy、runtime enforcementの確認可否が区別され、確認不能なeffective read-onlyを保証済みと主張しない。
- stale evidenceはspec/planのpathとblob/content revision、implementation/PRのHEAD/base、review/audit/guideが対象にしたrevisionで追跡し、独自monotonic counterやopaque fingerprintを必須にしない。
