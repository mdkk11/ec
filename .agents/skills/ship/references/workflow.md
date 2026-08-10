# Ship workflow

## State machine

Move forward through these phases and return to earlier phases whenever an input becomes stale:

```text
preflight/recover -> triage -> specification -> planning -> independent plan review -> user approval
       -> stacked implementation -> draft submission -> stabilization
       -> explanation layer -> independent final audit -> human-review-ready
```

Do not run independent critique in parallel with the artifact it reviews. Independence means a separate agent receives the finalized raw artifact and repository context without being told the desired verdict.

## Phase recovery and checkpoints

After preflight, recover the workflow from current evidence before choosing a path. Conversation memory is useful context, but durable repository and GitHub evidence decides whether a phase is still current.

Use the highest phase whose required evidence is complete and whose inputs have not changed:

| Phase | Minimum current evidence |
| --- | --- |
| specification | Confirmed acceptance criteria, non-goals, assumptions, and required user decisions |
| planning | Final plan artifact grounded in the current specification and repository state |
| independent plan review | Critique and disposition for that exact plan revision |
| user approval | Explicit approval of the reviewed plan; never infer it from later repository artifacts |
| implementation | Intended commits and verification at their current HEADs |
| draft submission | PR head/base and stack relationships match those commits |
| stabilization | Head-specific `babysit-pr` snapshot has terminal green checks, no unresolved review action, and clean mergeability |
| explanation | Reviewer Guide and any `[SHIP:NOTE]` comments describe the current PR head and stack |
| final audit | Independent audit ran after stabilization and explanation against the same heads and artifacts |
| human-review-ready | Final audit passes and the current PRs are non-draft with every readiness gate satisfied |

Resume at the first incomplete or stale phase. Do not repeat specification, planning, implementation, submission, or audits merely to reconstruct a narrative. If evidence is missing for an approval gate, ask for that approval rather than assuming it.

When the user requests an earlier milestone:

- Treat plan completion, implementation completion, or draft PR creation as an explicit checkpoint.
- Perform only the verification needed to make that checkpoint safe and truthful.
- Do not run Phase 8 early. A pre-submission code review or acceptance check may be called a preliminary implementation review, but it does not become the final specification audit.
- Record the first deferred phase and the exact evidence needed to resume.
- On continuation, recover the existing artifacts and proceed from that phase. Run the final audit once, after stabilization and explanation, unless a later code, stack, verification, or explanation change makes it stale.

If the related PR is already merged or closed, report the terminal state. Do not recreate the PR, restart implementation, or silently select an adjacent task.

## Phase 0: Triage

Classify by semantic and operational risk, not line count.

### Small fast path

Use only for an obvious, isolated change such as a typo, copy change, tiny CSS adjustment, or well-understood bug fix. Require all of the following:

- Acceptance criteria are unambiguous.
- No schema, migration, auth, security, concurrency, public API, architecture, or destructive behavior changes.
- One meaningful PR is sufficient.
- Repository rules do not require a formal spec or plan.

Record the goal, acceptance criteria, non-goals, and verification briefly. Skip persistent spec/plan ceremony and independent plan critique only when all conditions hold. Still perform relevant implementation verification and final diff review.

### Medium standard path

Use for normal features and refactors. Require delegated specification, a written or repository-approved plan, independent plan critique, user approval, meaningful PR layers, and independent final audit.

### Large/high-risk path

Use for auth, authorization, payments, migrations, destructive changes, security, public APIs, concurrency, or major architecture. In addition to the standard path:

- Make rollback, data integrity, compatibility, abuse cases, observability, and migration ordering explicit.
- Require tests at the lowest appropriate boundary plus integration coverage where risk crosses boundaries.
- Prefer smaller reversible layers, but never split a transaction or invariant into an invalid intermediate state.

## Phase 1: Specification

Invoke the installed `grill-with-docs` skill and let its current workflow control the interview. Pass the original request and discovered repository context. Do not duplicate its questions in `$ship`.

Before leaving the phase, ensure the resulting format covers, directly or equivalently:

- Goal and acceptance criteria.
- Non-goals.
- Expected behavior and affected actors.
- Edge cases and error handling.
- Test strategy and relevant scenario ownership.
- Open decisions and explicit assumptions.

Persist the result only when repository convention or task complexity warrants it. Follow repository naming and approval rules.

## Phase 2: Implementation plan

Use a planning-capable agent or the active agent when necessary. Ground the plan in the approved specification and actual code.

Define each proposed stack layer with:

- Responsibility: one meaningful change.
- Changes: concrete behavior and data flow.
- Main files/modules.
- Parent dependency and downstream consumers.
- Verification at that layer's HEAD.
- Risks and rollback implications.

Aim for roughly 100–200 changed lines only as a soft reviewability signal. Never split by line count when it creates a semantically broken layer. Every layer should build, typecheck, lint, and pass its relevant tests whenever the architecture permits.

Use the repository's plan format. If it requires permission before creating a plan, stop and ask. After writing the plan, do not implement until all required plan-review and user-approval gates pass.

## Phase 3: Independent plan review

Create a separate critic agent. Provide the original request, finalized specification, plan, applicable repository rules, and targeted code context. Do not provide the author's conclusions or a requested verdict.

Ask the critic to check:

- Natural PR boundaries and dependency direction.
- Valid intermediate HEADs.
- Acceptance-criteria coverage.
- Test strategy and lowest responsible test level.
- Architecture, migrations, rollback, security, edge cases, and concurrency.
- Unnecessary abstraction and over-engineering.

Use one bounded cycle:

```text
Plan -> Critique -> Patch -> Final verification
```

Record accepted and rejected critique points with reasons. Avoid an unbounded critic loop. Present the reviewed plan for user approval unless the repository's explicit workflow says otherwise.

## Phase 4: Stacked implementation

Implement approved layers in order. For each layer:

1. Reconfirm its parent HEAD and worktree cleanliness.
2. Implement only that layer's responsibility.
3. Add or update the lowest appropriate tests.
4. Run the discovered relevant tests, typecheck, lint, and build in the repository-required order.
5. Inspect the diff and stage only intentional files.
6. Commit according to repository conventions.
7. Record verification results and residual risks before starting the child layer.

Use separate agents for implementation and later deep review when available. Do not let parallel agents edit the same worktree or overlapping files.

### Stack operations

Read `gh-stack` and use the installed `gh stack --help` output for exact `init`, `add`, `submit`, `rebase`, `sync`, and `push` operations. Verify commit ancestry and GitHub base fields instead of inferring parents from branch names.

## Phase 5: Draft submission

Create draft PRs unless the user explicitly requests another state. Preserve required repository PR-template sections and add the sections defined in `pr-review-protocol.md`; do not replace one with the other.

Each PR must describe only its own diff plus the minimum parent context needed to review it. Include exact verification performed at that layer. Do not claim tests that were not run.

## Phase 6: Stabilization and restacking

Read and invoke the installed `babysit-pr` skill rather than reproducing its watcher or CI heuristics. For a bounded `$ship` run, request its documented one-shot diagnostic snapshots and use its surfaced actions to stabilize the PR. If the user asks for continuous monitoring, hand off to its watch mode and follow its stricter stop conditions.

Process lower layers before descendants. When a lower layer changes:

1. Identify every descendant branch and PR.
2. Restack using the current `gh stack` help.
3. Use `--force-with-lease` only for stack-owned rewritten branches after verifying remote state.
4. Re-run affected tests, typecheck, lint, build, and review.
5. Mark descendant Reviewer Guides and `[SHIP:NOTE]` comments stale until checked against the new diff.

Overlay the prefix semantics from `pr-review-protocol.md` when classifying comments before passing actionable work to `babysit-pr`. A question is not an actionable code change.

## Phase 7: Explanation layer

Wait until the stack is stable and CI/deep review fixes have landed. Then read `pr-review-protocol.md` and:

1. Update every PR body with its current Reviewer Guide and stack position.
2. Add a small number of `[SHIP:NOTE]` inline comments only where the reasoning materially helps review.
3. Verify comments target the current head SHA and valid diff lines.
4. Reconcile existing explanation comments after any later code or stack change.

Do not optimize for comment count.

## Phase 8: Independent final specification audit

Use an agent independent from implementation. Provide raw artifacts:

- Original user request.
- Final specification.
- ADRs, if any.
- Approved implementation plan.
- Final stack diffs and verification results.

Require one line per acceptance criterion and non-goal with `PASS`, `FAIL`, or `UNCERTAIN` plus evidence. Fix every `FAIL`, then restack and rerun affected verification. Resolve `UNCERTAIN` through evidence or user input; do not relabel it as pass.

This audit is valid only when stabilization and the explanation layer are complete for the same PR head SHA and stack bases. A review performed before draft submission or while checks are pending is preliminary evidence, not Phase 8, and must not cause a duplicate “final” audit later.

After the audit, update `docs/CONTEXT.md` only with durable project knowledge discovered during the work and only when repository convention calls for it. Do not add feature-local history or temporary assumptions.

## Phase 9: Human-review readiness

The stack is ready only when all applicable conditions hold:

- Required CI and local verification are green.
- No unresolved AI-review findings remain.
- Stack bases and descendant branches include the latest parent changes.
- Reviewer Guides describe the current diffs.
- `[SHIP:NOTE]` comments are current or clearly marked obsolete.
- Acceptance criteria and non-goals pass the final audit.
- Required dependency skills completed their bounded responsibilities.
- No repository approval gate remains.

Use the current CLI help to move draft PRs to ready-for-review when the `$ship` invocation and repository policy authorize it. Report the ready milestone and stop. Never merge automatically.
