# `$orchestrate` Architecture Decision Gate 追加計画

## 1. 背景と目的

`$orchestrate` は現在、Small / Normal / Large・High-risk のrisk-based workflow、conditional specification、written plan、独立review、stale evidence、bounded repairを持つ。一方、architectureまたは重要変更で、既存decisionによるcoverageと新しいdurable decisionの有無をplanning前に確認する明示的なgateがない。

この変更では、Architecture Decision Gateをspecificationとplanningの間へ追加する。Gate通過と新規ADR作成を分離し、結果として`existing-covered`、`recorded`、`no-new-decision`を許可する。新しいdurable decisionを記録する場合だけ[`adrs`](https://github.com/joshrotenberg/adrs) CLIとrepositoryのADR運用を使う。Smallへdocumentation ceremonyを持ち込まず、riskに応じて必要な保証だけを追加する。

## 2. 現状調査

### `$orchestrate`

- backboneは`preflight/recover -> triage -> [specification] -> planning -> ...`であり、Architecture Decision Gateは存在しない。
- `runtime-preflight.md`はspecification、plan、ADRの保存場所を探索し、「すべてのfeatureにADRを作らない」と定めるが、architecture decisionを確認するpositive conditionを定義していない。
- Normalの`grill-with-docs`はconditional/recommended、High-riskではrequiredである。選択時は`orchestrator/planner -> grill-with-docs -> planning`の順で進む。
- High-riskはauth/authorization、payments、migration、destructive change、security、public API、concurrency、data integrity、major architectureを含む。重要変更を識別するrisk分類は既にあるが、既存decisionによるcoverageや新規decisionの有無を記録しない。
- stale propagationはspecificationとmaterial plan contentを追跡するが、decision outcomeやADR artifact identityを追跡しない。
- 現行13 evalはSmallの軽量経路、Normalのconditional specification、High-risk safeguards、state recovery、stale evidenceを扱うが、Architecture Decision Gateを扱わない。

### `adrs`

- upstream `joshrotenberg/adrs`は既存ADR repositoryを探索し、`init`、`new`、`list`、`search`、`link`、`status`、`doctor`を提供する。
- current environmentには`/opt/homebrew/bin/adrs` version `0.12.1`がある。
- commandとoptionはversionにより変わり得るため、`adrs <subcommand> --help`をcurrent source of truthにする。
- `adrs doctor`はrequired sections、日付、連番、重複、broken linkなどのfile/repository healthを検査する。decisionの妥当性やtrade-offの品質は証明しない。

### `mdkk11/linear-perfomance`

- private repositoryの`adrs.toml`は`docs/adr`、NextGen、MADR minimal、default status accepted、doctor warnings-as-errorsを設定する。
- READMEとPLANは、新しい検証設計を実装前にADRへ記録し、編集後とPR完了時に`adrs doctor`を実行する運用を定める。
- 既存decisionとの関係はlinkで表し、実際にdecisionを置き換える場合だけsupersedesを使う。
- この設定値は有効な実例として参照するが、`$orchestrate`へpath、format、status、具体的なCLI構文をhard-codeしない。

### Current repository

- `ec` repositoryには`adrs.toml`、`.adr-dir`、`docs/adr`がない。
- 本変更は汎用workflow contractの更新であり、`ec`へADR repositoryを新規初期化することは要求されていない。
- PR #55はmerge済みで、そのheadはcurrent `origin/main`に含まれる。実装差分は最新`origin/main`から新しい`feature/orchestrate-architecture-decision-gate` branchへ載せ、新規PRとして提出する。

## 3. 解決する問題

1. Architectureまたは重要変更で、既存decisionによるcoverage、新しいdecisionの有無、必要なhuman approvalを確認せずplanningへ進める。
2. Decision gate通過と新規ADR作成を同一視すると、既存方針に従うsecurity fixやmigrationでも不要なADRを量産する。
3. Product ambiguity、technical trade-off、不可逆なbusiness decisionの担当が分離されていない。
4. PlanとADRの責務が定義されておらず、同じ内容の重複またはdecision未確定のplanが生じ得る。
5. Material decision変更後も旧plan、verification、review、auditをcurrent evidenceとして再利用できる一方、単なるstatus/link修正で一律invalidateするとceremonyが増える。
6. `adrs doctor`のhealth checkとdecision qualityを同一視すると、reviewやapprovalの責任が曖昧になる。

## 4. 採用する方針

### Gate semantics

Backboneを次へ変更する。

```text
preflight/recover -> triage -> [specification]
  -> [architecture decision] -> planning
  -> [plan-review] -> [approval] -> implementation -> ...
```

| Task class | Decision gate | 新規ADR |
| --- | --- | --- |
| Small | repository policyが要求しない限りskipped | 原則作らない |
| Normal・局所変更 | skipped | 作らない |
| Normal・durable / cross-cutting | required | 新しいdecisionがある場合だけ作成・更新 |
| Large / High-risk | required | 新しいdecisionがある場合だけ作成・更新 |

Required gateは次の順で判定する。

```text
関連するexisting ADR / repository decisionを検索
  -> existing decisionでcoveredか
     -> yes: existing-covered
     -> no: durableなnew decisionがあるか
        -> yes: recorded
        -> no: no-new-decision + reason
```

Normalでgateをrequiredにするdurable decisionは、少なくとも次のいずれかを満たすものとする。

- component/module/serviceの責務境界またはdependency directionを変える。
- persistence model、schema/migration strategy、public contractを長期的に変える。
- auth/security model、concurrency/consistency model、data-integrity invariantを選択する。
- deployment、operational、observability architectureに継続的な責務を追加する。
- 複数の妥当な選択肢から、後で戻す費用が高い方針を決定する。

局所的な実装詳細、typo、tiny UI、既存decisionに従うroutine change、短期的な仮説は新規ADR対象にしない。High-riskではGate自体を省略しないが、明示的な理由を伴う`existing-covered`または`no-new-decision`を正式な結果として認める。

### Specification、decision、ADR、planの責務

- specification / `grill-with-docs`: product/requirement ambiguity、goal、acceptance criteria、non-goals、actors、edge casesを確定する。
- planner / decision analysis: technical options、trade-off、reversibility、architecture boundaryを評価する。
- human decision: 不可逆な選択、business判断、repository policyが要求するapprovalを決定する。
- ADR artifact: new durable decisionのcontext、considered options、chosen outcome、consequences、既存decisionとの関係を記録する。
- plan: current specificationとdecisionを入力に、files/responsibilities、data flow、implementation order、verification、rollbackを定義する。

High-riskでは既存どおり`grill-with-docs`をrequiredとし、`specification -> architecture decision -> planning`で進む。ただしADR候補があることだけを理由に追加のgrillを行わない。Normalではproduct/requirementsにmaterial ambiguityがある場合、またはspecification interrogationが実装ミスを減らせる場合に`grill-with-docs`を使う。technical trade-offだけならplanner/decision analysisで扱う。

### `adrs` CLI contract

Architecture Decision Gate自体は`adrs`へのhard dependencyにしない。次の場合だけcurrent repositoryの`adrs` CLIをdirect dependencyとして扱う。

- configured ADR repositoryをCLIで検索・検査する。
- ADRを作成、更新、link、supersede、status変更する。
- repository policyが`adrs doctor`成功をreadiness条件にしている。

ADR repositoryへ操作する場合は次を守る。

1. `adrs --version`と対象subcommandの`--help`を確認し、current syntaxをsource of truthにする。
2. `adrs.toml`、`.adr-dir`などcurrent repositoryのconfigからdirectory、format、mode、status policyを解決する。
3. 関連decisionを検索してから、existing-covered、recorded、no-new-decisionを選ぶ。
4. New decisionだけをrepository policyに従って作成または更新する。Accepted decisionの変更方法はrepository policyに従い、必要なら新しいADRでsupersedeする。
5. Related decisionにはlinkを使い、既存decisionを置き換える場合だけsupersedesを使う。
6. Artifact操作後に`adrs doctor`を実行し、structure/config health evidenceとして記録する。

`adrs`がない場合はinstallしない。CLI操作が必要なrouteだけblockerとして報告する。ADR repositoryが未初期化でnew durable decisionの記録が必要な場合は、path、format、mode、status policyを推測して`adrs init`せず、初期化の承認またはrepository directionを求める。未初期化repositoryで`no-new-decision`になったrouteは、`adrs`不在だけを理由にblockしない。

`adrs doctor PASS`はADR repositoryの構造・設定が健全であるevidenceとしてのみ扱う。Decision qualityはplan review、required human approval、implementation review、final auditが担う。

### Approvalとstatus

- ADR statusを`accepted`へhard-codeせず、repositoryの`adrs`設定とapproval policyを使う。
- repository policyまたはmaterial decisionがhuman approvalを要求する場合、planning前にdecision/ADRの承認を得る。
- Proposed ADRをplanning inputとして許すrepositoryではそのpolicyを尊重するが、implementation前に必要なdecision approvalがcurrentであることを確認する。
- Decision内容が同一の`proposed -> accepted`はapproval/readinessを更新し、plan以下を自動的にstaleにしない。

### State recoveryとstale propagation

Operational stateへ次を追加する。

```text
Architecture decision:
  Gate: complete | skipped <reason>
  Outcome: existing-covered | recorded | no-new-decision  # completeの場合だけ
  ADR: <path @ blob SHA/content revision, status>  # applicableな場合だけ
  Reason: <no-new-decisionまたはskip理由>          # applicableな場合だけ
  Approval: <current evidence or not-applicable>
  Health: <doctor evidence or not-applicable>
```

- StateはGate通過とADR artifact作成を別に表現する。`no-new-decision`を架空のADR identityで表さない。
- Specificationまたはoriginal decision inputのmaterial changeはArchitecture Decision Gateをstaleにする。
- Chosen option、decision、material consequences、governing relationship、supersedesなどdecision semanticsの変更はplanning、implementation、verification、implementation review、Reviewer Guide、final auditをstaleにする。
- Decision本文が同一のstatus transition、表記修正、related link追加はartifact identityとapproval/readiness evidenceを更新するが、原則としてdownstreamをstaleにしない。
- Artifact revisionが変わった場合はsemantic impactを再評価する。Blob SHAの変化だけで一律invalidateしない。
- Planとdownstream evidenceは、消費したspecification、decision outcome、applicableなADR path/revisionを直接記録する。
- Resumeではcurrent artifact identity、decision outcome、approval、applicableなhealth evidenceを照合し、currentなら再生成しない。
- Semantic diffを自動判定するparser、monotonic revision、独自workflow engineは追加しない。

### Reviewabilityと完了条件

- `existing-covered`または`recorded`のPRは、PR body / Reviewer Guideからcurrent ADRを必要最小限で参照する。
- ADR本文をPR bodyへ複製しない。
- `no-new-decision`はoperational stateに理由を残す。PRへ記載するのはreviewabilityまたはrepository policy上有用な場合だけとし、空のADR sectionを強制しない。
- Human-review readinessにはcurrent decision outcomeとrequired approvalを含める。ADR identityと`adrs doctor`はapplicableな場合だけ要求する。
- SmallやDecision GateをskipしたNormalへADR ceremonyを追加しない。

## 5. 採用しない方針

- `adrs`を包む新しいSkill、script、wrapper、workflow engineを作らない。
- ADR本文を解析してsemantic staleを自動判定する仕組みを作らない。
- `adrs` MCP serverを必須にしない。既存CLIで必要な操作を完結させる。
- `docs/adr`、NextGen、MADR、minimal、accepted、特定versionのCLI構文を全repositoryへhard-codeしない。
- Architecture Decision Gateがrequiredという理由だけで`adrs`をhard dependencyにしない。
- missing CLIを理由に自動installしない。
- 未初期化repositoryで無断の`adrs init`を行わない。
- ADRをimplementation plan、specification、進捗ログの代替にしない。
- High-riskごとに新規ADRを量産したり、ADRを理由にcode reviewやfinal auditを弱めたりしない。
- `ec` repositoryへ本変更のためだけにADR infrastructureを追加しない。

## 6. 変更対象

| ファイル | 変更内容 |
| --- | --- |
| `.agents/skills/orchestrate/SKILL.md` | Architecture Decision Gateのorchestration責務、outcome、state identity、completion reportを追加する |
| `.agents/skills/orchestrate/references/workflow.md` | Decision phase、risk別gate、artifact条件、approval、semantic stale propagation、readinessを定義する |
| `.agents/skills/orchestrate/references/runtime-preflight.md` | ADR repository操作時だけのconditional dependencyと未導入・未初期化時のstop conditionを追加する |
| `.agents/skills/orchestrate/references/pr-review-protocol.md` | ADR artifactがapplicableな場合だけcurrent decision recordを参照するminimal contractを追加する |
| `.agents/skills/orchestrate/evals/evals.json` | 既存13ケースへGate outcome、conditional CLI、semantic staleの期待を統合する |
| `docs/plans/orchestrate-adrs-gate.md` | 本計画 |
| `~/.codex/skills/orchestrate/*` | repository版の検証・commit後にglobal Skillを同一内容へ同期する。Git管理対象外 |

`agents/openai.yaml`、custom agent TOML、application code、package dependenciesは変更しない。

## 7. 実装手順

1. `.agents/skills/orchestrate/references/workflow.md`のbackbone、phase evidence、gate tableへArchitecture Decision Gateを追加する。Small/Normal/High-riskの選択条件と3つのoutcomeを定義する。
2. 同ファイルでspecification、decision analysis、human decision、ADR artifact、planの責務を分離する。High-riskのrequired grillとNormalのconditional grillを維持する。
3. 同ファイルへ`adrs` CLI contractを追加する。current help/configの尊重、existing decision search、conditional artifact mutation、link/supersedes、doctorの限定的責務を定義する。
4. 同ファイルのstate recovery、stale matrix、human-review readinessへdecision outcomeとapplicableなADR identityを追加する。Material decision changeだけがdownstream evidenceを無効化するようにする。
5. `SKILL.md`へgate selection、3 outcome、conditional CLI delegation、decision evidence reportingを要約する。具体的なformat/path/status/CLI optionを本文へ埋め込まない。
6. `runtime-preflight.md`へ`adrs`をADR repository操作時だけのconditional direct dependencyとして追加する。`no-new-decision` routeをmissing CLI/configでblockしないこと、自動mutationしないことを明記する。
7. `pr-review-protocol.md`へ、applicableなADRのpath/statusをPR bodyまたはReviewer Guideで一度だけ参照する規則を追加する。Small/skip/no-artifact routeへsectionを強制しない。
8. `evals.json`のケース数13を維持して既存ケースへ統合する。
   - Small typoと明確なNormal refactorはGateをskipする。
   - Normal durable decisionはGateをrequiredにし、new decisionの場合だけADRを記録する。
   - High-risk routine fixはGateを通すが、existing-coveredまたはno-new-decisionなら新規ADRを作らない。
   - High-riskの新しいsecurity/data-integrity modelはrequired approvalとADR記録を行う。
   - Missing CLI/configはADR repository操作が必要なrouteだけをblockし、自動install/initしない。
   - Material decision changeはdownstreamをstaleにし、status-only/link-only changeは必要なevidenceだけを更新する。
9. Skillとreferenceを通読し、Gate/artifact、doctor/quality、grill/technical analysisの責務重複とSmall/Normalへの過剰ceremonyを修正する。
10. Repository checks、CLI contract確認、workflow simulationを実行する。
11. 変更ファイルだけを明示stageし、cached diffを確認して日本語commitを作成する。最新`origin/main`をbaseに新しいbranchをpushし、新規PRのtitle/body/testing/review pointsをcurrent headと一致させる。Merge済みPR #55は変更しない。
12. Push済みrepository版とglobal `~/.codex/skills/orchestrate`を比較し、global版を同一内容へ更新する。旧`ship` aliasは復活させない。

## 8. テスト・検証方法

### Structureと構文

- `SKILL.md` frontmatter、`agents/openai.yaml`、`evals.json`をparseする。
- Eval countが13で、各IDが一意であることを確認する。
- `rg`でArchitecture Decision Gateと`adrs` contractが必要なファイルにだけ存在し、hard-coded `docs/adr`/format/status/CLI optionがworkflow semanticsへ混入していないことを確認する。
- `git diff --check`

### Repository checks

- `pnpm format`
- `pnpm lint`
- `pnpm knip`
- Application codeを変更しないため、typecheck、unit/frontend/backend/E2E/VRT、buildは対象外とし理由をPRへ記録する。

### CLI contract

- `adrs --version`
- 利用する各subcommandのcurrent `--help`
- `adrs doctor --help`からhealth checkの責務を確認する。
- Temporary directoryでrepository外のfixtureを作り、configured ADR repositoryに対する作成、検索、link、doctorの基本contractを確認する。Fixtureはrepositoryへ保存しない。
- CLIの成功をdecision qualityの合格証拠として扱っていないことを文面とsimulationで確認する。

### Workflow simulation

- Small: typo/copy変更でDecision Gateがskippedになり、`adrs`不在がrouteをblockしない。
- Normal skip: 明確な局所refactorでDecision Gateがskippedになり、written planへ進む。
- Normal existing: durable/cross-cutting changeがexisting ADRでcoveredされ、new artifactを作らない。
- Normal recorded: 新しいdependency directionを選ぶ変更でADRをplanning前に記録する。
- High-risk no-new-decision: 既存方針に従うroutine security fix/migrationでGate outcomeと理由を残し、新規ADRを作らない。
- High-risk recorded: 新しいauth/security/data-integrity modelで`grill-with-docs -> decision analysis/approval -> ADR record -> planning -> independent plan review`となる。
- Missing dependency: ADR repository操作が必要なrouteだけblockし、install/initを行わない。No-artifact routeはblockしない。
- Existing decision: related decisionを上書きせず、linkまたは必要な場合だけsupersedesを選ぶ。
- Resume: current decision outcome、ADR identity、approval、applicableなhealth evidenceが有効なら次のincomplete gateから進む。
- Semantic stale: chosen option/consequence/supersedes変更でplan以下をstaleにする。本文不変のstatus acceptanceやrelated linkだけではdownstreamをstaleにしない。
- Reviewability: applicableなADRだけをcurrent revisionで参照し、本文や空sectionを複製しない。
- Doctor scope: health PASSとは別にplan review/human approval/final auditがdecision qualityを評価する。

### Global synchronization

- Repository `.agents/skills/orchestrate`と`~/.codex/skills/orchestrate`の全ファイルを比較する。
- Fresh Codex invocationから`$orchestrate`が検出されることを確認する。

## 9. リスク

- Gateとartifactを混同するとroutine High-risk changeでもADRが増える。3 outcomeを明示し、新しいdurable decisionだけをrecordする。
- GateとCLI dependencyを混同するとADR未導入repositoryの`no-new-decision` routeが停止する。CLIはADR repository操作時だけrequiredにする。
- Semantic staleを自動化すると新しいparser/revision engineが必要になる。Actual artifact revisionを記録し、materialityは既存workflowの判断として扱う。
- Status/link変更を常にmaterialと扱うと不要な再実行が増える。Decision semantics、approval/readiness、artifact identityを分けて更新する。
- `adrs doctor`をdecision quality gateにするとreview責任が抜ける。Doctorはstructure/config healthに限定する。
- Repositoryごとのformat、status、directory、CLI versionを上書きすると既存ADR運用を壊す。Current config/helpとrepository policyをsource of truthにする。
- Global Skill同期がrepository commitとずれる可能性がある。Push済みtreeとのfile comparisonを完了条件にする。

## 10. 未確定事項

- なし。High-riskはArchitecture Decision Gate required、新規ADRはnew durable decisionがある場合だけとする。
- Target repositoryにADR infrastructureがなく、新規decisionのdurable recordが必要な場合の初期化方法は各repositoryのdecisionであり、本Skillは自動決定しない。

## 11. 完了条件

- Workflow backboneにArchitecture Decision Gateがspecificationとplanningの間で定義される。
- Gate通過とADR artifact作成が分離され、`existing-covered`、`recorded`、`no-new-decision`を表現できる。
- Smallはrepository policyなしではGate/ADRを要求されず、明確で局所的なNormalもskipできる。
- Durable/cross-cutting NormalとLarge/High-riskはGate requiredだが、新しいdurable decisionがある場合だけADRを作成・更新する。
- High-riskのrequired `grill-with-docs`は維持されるが、ADR候補だけを理由に追加のgrillを行わない。
- Product ambiguity、technical trade-off、不可逆/business decisionの担当が分離される。
- `adrs`はADR repository操作時だけconditional dependencyになり、current config/helpをsource of truthにする。
- Missing CLIまたは未初期化repositoryで自動install/initせず、artifact操作が必要な場合だけplanning前にblockerを報告する。
- `adrs doctor`はstructure/config health evidenceに限定され、decision qualityはreview/approval/auditが担う。
- ADRとspecification/planの責務が重複せず、具体的なdirectory/format/status/CLI optionをhard-codeしない。
- Stateはcurrent decision outcome、reasonまたはADR path/revision、approval、applicableなhealth evidenceを直接記録する。
- Material decision changeだけがplanとdownstream evidenceをstaleにし、status-only/link-only changeで一律invalidateしない。
- 新しいsemantic parser、monotonic revision、wrapper、workflow engineを追加しない。
- ApplicableなADRだけをPRから参照し、Small/skip/no-artifact routeへ空sectionを追加しない。
- 既存13 evalへGate outcomes、conditional CLI、doctor scope、semantic staleケースが統合される。
- Runtime model routing、Luna Max implementation worker、別Sol High reviewer、configured/effective sandbox区別、single PR default、bounded repair、state recoveryの既存保証が維持される。
- JSON/YAML parse、format、lint、knip、diff check、CLI contract、workflow simulationが成功する。
- 新規PRがcurrent headと検証結果を説明し、repository版とglobal `$orchestrate`が一致する。
