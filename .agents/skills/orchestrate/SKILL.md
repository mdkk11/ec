---
name: orchestrate
description: "Orchestrate or resume an end-to-end repository change from `$orchestrate TASK` through risk-based planning, delegated implementation, independent implementation review, bounded stabilization, and human-review readiness. Use only when the user explicitly invokes `$orchestrate` or explicitly asks for this full orchestration workflow; do not use for a simple commit, push, PR creation, requirement interview, or PR-monitoring request alone."
---

# Orchestrate

Act as the workflow controller. Delegate specialized work, preserve repository rules, and keep every pull request explainable and reviewable. Do not auto-merge. The workflow is role-based: runtime configuration chooses the concrete agent and model for each role; this Skill defines the responsibilities and gates, not a model assignment.

## Start

1. Extract the task after `$orchestrate`. If it is missing, ask for the task and stop.
2. Read [runtime-preflight.md](references/runtime-preflight.md) completely. Perform the core capability inventory before repository mutation, then validate only the direct dependencies selected by triage.
3. Perform the remaining read-only preflight checks before changing files or external state.
4. Read [workflow.md](references/workflow.md) completely, classify the task as `small`, `normal`, or `large/high-risk`, select each gate as `required`, `conditional`, or `skipped`, recover existing state from current evidence, and resume at the first incomplete or stale phase rather than restarting by default.
5. Read [pr-review-protocol.md](references/pr-review-protocol.md) completely before drafting PR bodies, posting explanation comments, or processing review feedback.
6. Treat applicable `AGENTS.md`, repository docs, user instructions, actual tool declarations, installed skill bodies, and current CLI `--help` output as higher-priority runtime facts than examples in this Skill.

## Responsibility boundary

Own only orchestration:

- Classify the task and select the risk path and gate matrix, including the Architecture Decision Gate when the route requires it.
- Track phase, artifacts, gate status, stack dependencies, verification, direct artifact identities, and blockers.
- Bound runtime and discovery diagnostics; reuse static/config evidence while its material inputs remain unchanged, and recheck invocation-scoped runtime evidence for the current invocation when a selected gate needs it.
- Separate the Architecture Decision Gate from its optional ADR artifact: record `existing-covered`, `recorded`, or `no-new-decision` with the applicable decision evidence and approval state.
- Choose and invoke available skills, role-configured agents, and CLIs in the required order.
- Delegate implementation through the configured implementation-worker role by default. Pass the implementation contract, and use the controller as the author only when that role cannot be started and the user explicitly accepts the fallback; record the reason.
- Enforce approval gates, independence between author and critic, and final readiness criteria.
- Compare worker-reported results with the actual worktree diff, Git status, changed-file list, HEAD/base, and verification output.
- Restack descendants and invalidate stale verification, reviews, guides, explanations, or audits when a lower layer or material input changes.

Delegate:

- Delegate conditional specification interrogation to `grill-with-docs` when the selected gate is enabled. For Normal work, skip it when requirements, acceptance criteria, edge cases, and responsibility boundaries are sufficiently clear; use it when material ambiguity remains or interrogation is likely to prevent an implementation mistake.
- Delegate product/requirements ambiguity to `grill-with-docs`; handle technical trade-offs in planner decision analysis, and route irreversible or business decisions to the applicable human approval gate. An ADR candidate alone does not require another grill.
- Delegate implementation to the configured implementation-worker role with the contract in [workflow.md](references/workflow.md).
- Delegate the independent implementation review to a separate configured reviewer role. Give it raw request/spec/plan/diff/verification evidence and do not disclose the author’s verdict or completion claim.
- Delegate bounded PR/CI/review diagnosis to `babysit-pr`. Use its one-shot mode for a bounded `$orchestrate` run; use continuous monitoring only when the user separately requests monitoring and accept that its own stop conditions then govern.
- Delegate stacked branch and PR operations to `gh-stack` only when an existing or selected stack is in scope, while treating the current `gh stack --help` output as the CLI source of truth.
- Use the configured planner role for planning or plan review when available. Use a separate configured final-auditor role for the High-risk final acceptance audit or an explicitly enabled audit.
- Use repository-specific skills when they match a selected phase.

## Global safety rules

- Preserve unrelated user changes. Stop before editing when the target worktree has overlapping or unexplained changes.
- Honor repository planning and approval rules even when they add checkpoints to this workflow.
- Do not install skills, extensions, or other dependencies without user authorization.
- Do not use destructive Git commands. Resolve exact branch and PR targets before mutation.
- Do not force-push except when an approved restack requires it; verify the branch is owned by this stack and use `--force-with-lease`.
- Do not post a human-facing GitHub reply when an applicable dependency or repository policy requires approval of the exact response.
- Do not merge automatically. Leave final merge decisions to a human.
- Do not claim human-review readiness while required checks, reviews, audits, dependency updates, or explanation synchronization remain incomplete.
- Treat any allowed-scope violation from an implementation worker as a blocker until the change is removed, explicitly authorized, or the user resolves the scope decision. Never hide scope drift inside a repair.
- A completed gate becomes stale when a material input changes. Do not use an old green result to pass a new head, base, specification, material plan content, or stack ancestry.

## State reporting

Maintain a compact operational state record in the conversation. Persist it only when repository convention explicitly requires a dedicated workflow-state artifact; do not put it in specifications or implementation plans:

```text
Phase: preflight/recover | triage | specification | architecture-decision | planning | plan-review | approval
       | implementation | implementation-review | submit | stabilize | explain
       | final-audit | human-review-ready
Task class: small | normal | large/high-risk
Gates: specification=<required|conditional|skipped>; architecture-decision=<...>; plan=<...>; plan-review=<...>
       approval=<required|conditional|skipped>
       implementation-review=<required|conditional|skipped>; stack=<...>
       explanation=<...>; final-audit=<...>
Spec: <path @ blob SHA/content revision, or chat artifact identity>
Architecture decision:
  Gate: pending-approval | complete | skipped <reason>
  Outcome: existing-covered | recorded | no-new-decision  # pending-approval or complete only
  Evidence: <ADR path @ blob SHA/content revision, or repository/spec evidence>
  Reason: <required when Gate is skipped or Outcome is no-new-decision>
  Approval: <current evidence | unresolved | not-applicable>
  Health: <doctor evidence | not-applicable>
Plan: <path @ blob SHA/content revision, or chat artifact identity>
Implementation author: <role/agent and implementation HEAD SHA>
Reviewer: <separate role/agent; reviewed HEAD/base/spec/plan identities>
Stack: <ordered branch/PR list and parent/base ancestry, or single PR>
Verification: <current results and verification-input identities per layer>
Requested milestone: <full readiness or explicit earlier checkpoint>
Evidence:
  Decision: <outcome and applicable ADR path @ blob SHA, or reason>
  PR: head=<SHA> base=<SHA>
  Reviewer Guide: PR head SHA it describes, or skipped with reason
  Final audit: audited HEAD/base/spec/plan identities, or skipped with reason
Runtime sandbox (current invocation):
  Configured: <read-only | workspace-write | ...>
  Effective: <runtime-reported value | unavailable>
  Logical role policy: <read-only | implementation write>
  Enforcement: <confirmed | unavailable | mismatched>
Blockers: <missing dependency, approval, scope drift, CI, review item, or routing limitation>
```

`pending-approval` is incomplete. It may coexist with planning only when repository policy permits proposed decision input; it never permits implementation or human-review readiness.

Update this record after every phase transition, gate selection, worker handoff, lower-stack change, evidence invalidation, or blocker. A skipped phase must include its reason. A completed phase becomes stale when a material input changes; rerun it instead of preserving a false green state.

Keep specifications and plans focused on the problem, relevant evidence, constraints, decisions, implementation, and verification. Exclude workflow narration such as fetched refs, worktree cleanliness, branch or stack setup, commit and PR identifiers, approval history, phase transitions, and conversation history unless a fact materially changes the technical solution or the repository’s required document template explicitly asks for it.

An explicit earlier milestone such as plan completion, implementation completion, or draft PR creation is a checkpoint, not successful completion of the full workflow. Stop there when requested, record every deferred phase, and resume from that evidence on the next `$orchestrate` invocation.

## Completion

Finish only when the applicable readiness gate in [workflow.md](references/workflow.md) passes. Report:

- Files and PRs created or changed.
- Risk path taken, selected/skipped gates and reasons, and phase outcomes.
- Architecture Decision Gate outcome, applicable ADR artifact identity/status, approval, and `adrs doctor` health evidence when used; do not treat doctor health as decision-quality proof.
- Planner, implementation worker, independent reviewer, final auditor, and other skills delegated to, including any fallback or unavailable role.
- Implementation worker contract result and actual-diff/scope reconciliation.
- Stack order and base relationships, or the single-PR decision.
- Verification, bounded repair/stabilization, and final acceptance results.
- Reviewer Guide and prefix protocol status, including a Small-task skip when the guide is not useful.
- Runtime routing: configured role assignment, independently verified author/reviewer roles, current-session applicability, and any configuration limit or fallback.
- Current limitations and residual risks.
- Exact remaining human action, normally review and merge.
