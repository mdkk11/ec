# Orchestrate workflow

## Backbone and gate semantics

Use one state machine for every task, then select the gates that apply to the risk class:

```text
preflight/recover -> triage -> [specification] -> planning -> [plan-review] -> [approval]
  -> implementation -> verification -> independent implementation review
  -> [bounded repair/reverification] -> submit -> stabilize -> [explain]
  -> [final-audit] -> human-review-ready
```

Each optional phase is recorded as `required`, `conditional`, or `skipped` with a reason and the direct artifact identities that support its state. `Skipped` means an intentional decision, not an unperformed task. Do not run independent critique in parallel with the artifact it reviews. Independence means a separate agent receives the finalized raw artifact and repository context without being told the author’s desired verdict.

### Phase recovery and checkpoints

After preflight, recover the workflow from durable repository and GitHub evidence before choosing a path. Conversation memory is useful context, but current artifacts decide whether a phase is still current.

| Phase | Minimum current evidence |
| --- | --- |
| specification | Confirmed acceptance criteria, non-goals, assumptions, and required user decisions, or an explicit skip reason; identify the spec path and blob/content revision when durable |
| planning | Final plan artifact grounded in the current specification and repository state; identify the plan path and blob/content revision |
| plan-review | Independent critique and disposition for that exact plan/spec revision, or a recorded skip reason |
| approval | Explicit approval of the reviewed plan when repository policy or the selected route requires it |
| implementation | Worker result reconciled with actual diff, intended commits, and verification at the current implementation HEAD |
| verification | Relevant checks at the current implementation HEAD, with the input HEAD/base and spec/plan identities recorded when applicable |
| implementation-review | Separate reviewer’s `PASS`, `FAIL`, or `BLOCKED` over the actual diff and the reviewed HEAD/base/spec/plan identities |
| submit | PR head/base and any stack parent ancestry match the implementation commits |
| stabilize | Head/base-specific `babysit-pr` snapshot has terminal green checks, no unresolved review action, and clean mergeability |
| explain | An applicable Reviewer Guide describes the current PR head and stack, and any `[ORCHESTRATE:NOTE]` comments target that head; otherwise record why the guide is unnecessary |
| final-audit | Independent acceptance audit ran after stabilization and applicable explanation against the audited HEAD/base/spec/plan identities |
| human-review-ready | Every applicable required gate passes and the current PRs are non-draft when authorized |

Resume at the first incomplete or stale phase among the gates selected for the current route. Do not repeat specification, planning, implementation, submission, or audits merely to reconstruct a narrative. A skipped gate remains skipped with its reason; only required gates and enabled conditional gates are candidates for resumption. If evidence is missing for a required approval gate, ask for that approval rather than assuming it.

When the user requests an earlier milestone, treat plan completion, implementation completion, or draft PR creation as a checkpoint. Perform only the verification needed to make that checkpoint safe and truthful, record every selected but deferred phase, and do not call a pre-submission review the final audit. On continuation, recover the existing artifacts and resume at the first selected incomplete or stale gate. Run explanation or final audit only when that gate was selected or enabled; a Normal route that skipped either gate keeps it skipped unless a later change or explicit request selects it.

If a related PR is already merged or closed, report its terminal state. Do not recreate it, restart implementation, or silently select an adjacent task from stale context.

## Phase 0: Triage and route selection

Classify by semantic and operational risk, not line count. Normal is the default when the task is not clearly Small or High-risk. Record the class, non-goals, acceptance criteria, applicable repository policy, selected gates, and skip/conditional reasons before implementation.

| Gate | Small | Normal | Large / High-risk |
| --- | --- | --- | --- |
| specification / `grill-with-docs` | skipped unless policy or ambiguity requires it | conditional/recommended | required |
| written plan | skipped unless policy requires it | required | required |
| independent plan review | skipped unless policy requires it | conditional based on risk, plan novelty, or policy | required |
| human plan approval | skipped unless policy requires it | conditional based on repository policy or material decisions | conditional when repository policy, user direction, or a material decision makes it appropriate/necessary |
| implementation worker | required by default | required by default | required |
| verification | relevant checks required | relevant checks required | lowest responsible tests plus cross-boundary checks required |
| independent implementation review | required | required | required |
| single PR | default | default | default unless a meaningful stack is justified |
| stack | conditional | conditional | conditional; never by class alone |
| explanation layer | skipped unless reviewability requires it | conditional | conditional when non-obvious reasoning, reviewability, or risk makes it useful/needed; required once selected |
| final audit | skipped | skipped when implementation review covers the same evidence; otherwise conditional | required, separate from code review |

### Small fast path

Use only for an obvious isolated change such as a typo, copy change, tiny CSS adjustment, or well-understood bug fix. All of these must hold:

- Acceptance criteria are unambiguous and non-goals are obvious.
- No schema, migration, auth, security, concurrency, public API, architecture, or destructive behavior changes.
- One meaningful PR is sufficient.
- Repository rules do not require formal specification, plan, or approval.

Route through `preflight/recover -> triage -> implementation -> relevant verification -> independent diff/code review -> submit -> minimal stabilization -> human-review-ready`. Keep a short conversation record of goal, acceptance criteria, non-goals, and verification. Unless policy requires them, skip persistent specification, formal plan, plan critique, plan approval, stack, explanation, and final audit. Still protect unrelated changes and perform an independent review of the actual diff.

### Normal standard path

Use for ordinary features, refactors, and multi-file changes that do not meet High-risk criteria. Route through:

```text
preflight/recover -> triage -> conditional specification -> planning
  -> implementation -> verification -> independent implementation review
  -> bounded repair/reverification -> single PR -> bounded stabilization
  -> human-review-ready
```

The `grill-with-docs` gate is conditional and recommended, not automatic. Skip it when requirements, acceptance criteria, edge cases, and responsibility boundaries are sufficiently clear. Use it when material ambiguity remains, or when specification interrogation is likely to prevent an implementation mistake. When enabled, use the `orchestrator/planner -> grill-with-docs -> planning` sequence and record the resulting specification evidence. Plan review, human plan approval, stack, a separate explanation phase, and final audit are conditional additions driven by repository policy, task characteristics, or review findings; do not run them by default.

Normal implementation review must check acceptance criteria, correctness, tests, and relevant risks against the same specification/plan, actual diff, verification, and HEAD/base. When that evidence is unchanged and the reviewer passes, it is the acceptance gate and the separate final audit is skipped. Enable a final audit only when implementation review cannot cover acceptance/spec compliance, a material finding demands it, repository policy requires it, or the user explicitly asks for it.

### Large / High-risk path

Use for auth or authorization, payments, migrations, destructive changes, security, public APIs, concurrency, data integrity, or major architecture. Maintain specification, written plan, independent plan review, implementation, verification, independent implementation review, PR/stabilization, and an independent final acceptance audit. Select human plan approval when repository policy, user direction, or a material decision makes it appropriate/necessary. Select the explanation layer when non-obvious reasoning, reviewability, or risk makes it useful/needed; once selected, keep it current and required. Make rollback, migration ordering, compatibility, observability, abuse cases, data integrity, security, concurrency, and destructive behavior explicit review items. Prefer smaller reversible layers, but never split a transaction or invariant into an invalid intermediate state.

High-risk implementation review focuses on implementation quality and actual diff correctness. The final auditor separately checks each acceptance criterion, non-goal, specification/plan compliance, risk safeguard, and required evidence. Neither review may be represented as the other.

## Phase 1: Conditional specification

When the specification gate is enabled, invoke the installed `grill-with-docs` skill and let its current workflow control the interrogation. Pass the original request and discovered repository context; do not duplicate its questions in `$orchestrate`. Verify that the result covers:

- Goal and acceptance criteria.
- Non-goals.
- Expected behavior and affected actors.
- Edge cases and error handling.
- Test strategy and relevant scenario ownership.
- Responsibility boundaries, open decisions, and explicit assumptions.

Persist the result only when repository convention or task complexity warrants it. Follow repository naming and approval rules.

## Phase 2: Implementation plan

Use the configured planner role or another planning-capable agent when necessary. Ground the plan in the approved specification and actual code. Define each proposed layer with responsibility, concrete behavior/data flow, main files, parent dependency, downstream consumers, verification at that HEAD, risks, and rollback implications. Aim for roughly 100–200 changed lines only as a soft reviewability signal; never split by line count when it creates a semantically broken layer.

After writing a plan, do not implement until all required plan-review and user-approval gates pass. If plan review is selected, use a separate critic and one bounded cycle:

```text
Plan -> independent critique -> patch/disposition -> final verification
```

Ask the critic to check PR boundaries, dependency direction, valid intermediate HEADs, acceptance coverage, lowest responsible test level, architecture, migrations, rollback, security, edge cases, concurrency, and unnecessary abstraction. Record accepted and rejected findings with reasons.

## Phase 3: Delegated implementation and verification

Implementation is a separate role by default. The controller passes this contract to the configured implementation-worker role:

### Worker input

- `responsibility`: the single approved layer and its intended behavior.
- `relevant context`: specification, plan, repository rules, and affected modules.
- `allowed/write scope`: exact files or directories the worker may change.
- `do-not-touch scope`: unrelated user changes, generated files, other layers, and protected files.
- `acceptance criteria`: observable requirements and non-goals.
- `parent/base HEAD`: the exact starting revision and stack relationship.
- `required verification`: exact commands and relevant test ownership.
- `known risks`: edge cases, invariants, security, concurrency, migration, or compatibility concerns.

### Worker result

Require a concise result with:

```text
Status: PASS | BLOCKED
Changed files and summary: <actual intended changes>
Verification results: <exact commands and outcomes>
Plan deviations: <none or explicit deviation and reason>
Assumptions: <explicit assumptions>
Residual risks: <remaining risk>
Blockers: <none or exact blocker>
```

The controller never trusts this report alone. Reconcile it with `git status`, actual diff, changed-file list, parent/base HEAD, and verification output. Any change outside allowed scope is scope drift: stop the gate, distinguish it from pre-existing user work, and require removal or explicit authorization before review or submission. If the configured worker cannot start, record the runtime limitation and obtain explicit authorization for a controller fallback; do not silently claim delegated implementation.

After implementation, run the relevant verification required by the selected route and repository rules. Record exact commands, outcomes, skipped checks with reasons, and the direct identities of the verification inputs (HEAD/base/spec/plan as applicable).

## Phase 4: Independent implementation review

Use a separate configured reviewer agent, never the implementation author. Give the reviewer only raw evidence:

- Original request and acceptance criteria/specification.
- Applicable plan and repository rules.
- Actual diff, changed files, current HEAD/base, stack ancestry, and verification output.

Do not provide the author’s completion claim, desired verdict, or hidden reasoning. Ask for a concise result:

```text
Verdict: PASS | FAIL | BLOCKED
Findings: <material findings with severity and evidence>
Acceptance criteria: <criterion-by-criterion result>
Plan deviations: <material deviation or none>
Verification: <checks reviewed or missing>
Repair/reverification: <required action or none>
```

Review acceptance criteria, material plan deviation, correctness, responsibility boundaries, unnecessary abstraction, simplification opportunities, edge/error handling, security, applicable performance, tests, implementation-detail coupling, regression risk, and repository conventions. Use actual diff and current evidence, not a summary substituted for them.

`FAIL` requires the implementation author to repair, the affected verification to rerun, and an independent re-review of the new evidence. Allow one bounded repair and re-review cycle by default. If the same material finding remains, or the reviewer is unavailable, escalate to a blocker or human decision. A reviewer must not approve work it authored.

## Phase 5: PR and optional stack

Default to one meaningful PR. Select a stack only when all of these are true:

- Responsibilities are semantically independent.
- Parent/child dependencies and valid intermediate HEADs are clear.
- Each layer can be tested and reviewed on its own.
- The stack materially improves reviewability or safe rollback.

Line count alone is not a stack reason. For an existing or selected stack, read `gh-stack`, use current `gh stack --help`, reconcile head/base ancestry, restack safely, and use `--force-with-lease` only for stack-owned rewritten branches. Preserve draft status unless the user or repository policy authorizes readiness.

Each PR describes only its own diff plus minimum parent context. Use the template and the applicable Reviewer Guide in [pr-review-protocol.md](pr-review-protocol.md), and include exact verification actually run.

## Phase 6: Bounded stabilization and stale propagation

Read and invoke `babysit-pr` rather than reproducing its watcher or CI heuristics. For a bounded `$orchestrate` run, use its one-shot diagnostic snapshot. Continuous monitoring is a separate user request. Retry flaky failures only within that Skill’s documented maximum of three attempts. Non-convergent branch-related fixes or review repairs stop at the bounded cycle and become a blocker/human decision.

When a material gate input changes, invalidate dependent evidence. Track at least these inputs:

| Changed input | Stale evidence |
| --- | --- |
| original request, acceptance criteria, non-goals, or specification | planning, implementation, verification, review, explanation, final audit |
| material plan content or material plan-review disposition | implementation, verification, review, explanation, final audit |
| implementation diff or commit | verification, implementation review, explanation, final audit |
| PR head/base or merge base | stabilization, implementation review, explanation, final audit |
| lower stack layer | every descendant implementation verification, review, applicable Reviewer Guide, explanation, and final audit |
| stack ancestry or restack | affected descendant verification, review, explanation, and final audit |
| verification input (HEAD/base/spec/material plan or required environment) | the verification and downstream review/audit that consumed that input |
| Reviewer Guide target head | the guide and any final audit that consumed it |
| explanation comments | explanation gate and any final audit that consumed them |
| final-audit input (HEAD/base/spec/material plan/verification) | the final audit and any readiness decision based on it |

After lower-layer changes, identify every descendant, restack, rerun affected checks, and reconcile applicable guides/notes against the new diff. After final audit, any code, PR head/base, stack, specification, or material plan content change makes that audit stale; never reuse the same artifact as ready evidence.

## Phase 7: Explanation and final audit

For Normal and High-risk work, maintain a compact Reviewer Guide for the current PR: review order, key decisions, reviewer focus, and exact verification. For Small work, add it only when it materially improves reviewability or repository policy requires it; its absence alone is not a readiness blocker. Add `[ORCHESTRATE:NOTE]` only for non-obvious domain invariants, state transitions, authorization/security, data integrity, transactions/concurrency, cache/performance, or meaningful architecture decisions. Do not comment on trivial code.

The explanation phase is skipped for Small unless reviewability requires it, conditional for Normal, and conditional for High-risk when non-obvious reasoning, reviewability, or risk makes it useful/needed; once selected, treat it as required. Verify comments target the current head SHA and valid diff lines. Reconcile them after every code or stack change.

Run the independent final auditor only when the selected route requires it or a conditional gate is enabled. Provide raw original request, specification, plan, final diffs, stack bases, and verification results. Require one line per acceptance criterion and non-goal with `PASS`, `FAIL`, or `UNCERTAIN` plus evidence. Handle final-audit `FAIL` or `UNCERTAIN` through one bounded repair cycle: apply the minimal repair, restack where applicable, rerun affected verification, and run one independent re-audit against the current evidence. If the same material issue remains, or an `UNCERTAIN` cannot be resolved with evidence, escalate to a blocker or human decision. Do not relabel uncertainty as pass.

## Human-review readiness

The task is ready only when all applicable conditions hold:

- Required local and CI verification is green.
- The independent implementation review passes and any bounded repair is complete.
- No unresolved AI-review findings remain.
- Stack bases and descendant branches include the latest parent changes.
- Normal and High-risk PRs have a compact Reviewer Guide describing the current diff and synchronized with the current head, unless repository policy supplies an equivalent reviewability artifact. Small PRs may omit the guide when it is not useful; guide absence alone does not block readiness.
- `[ORCHESTRATE:NOTE]` comments are optional; when they exist or the explanation gate explicitly selects them, synchronize them with the current head and valid diff lines.
- Acceptance criteria and non-goals pass the required final audit, or the Normal final-audit skip is supported by the unchanged implementation-review evidence.
- Required dependency skills completed their bounded responsibilities.
- Worker result and actual diff are reconciled with no unresolved scope drift.
- Runtime role assignment and reviewer independence were verified to the extent the active Codex runtime permits; limitations are reported.
- No repository approval gate remains.

Use the current CLI help to move draft PRs to ready-for-review when authorized. Report the ready milestone and stop. Never merge automatically.
