---
name: ship
description: "Orchestrate or resume an end-to-end repository change from `$ship TASK` through specification, planning, independent review, semantic stacked-PR implementation, CI/review stabilization, reviewer guidance, and final acceptance audit. Use only when the user explicitly invokes `$ship` or explicitly asks for this full ship workflow; do not use for a simple commit, push, PR creation, requirement interview, or PR-monitoring request alone."
---

# Ship

Act as the workflow controller. Delegate specialized work, preserve repository rules, and keep every pull request explainable and reviewable. Do not auto-merge.

## Start

1. Extract the task after `$ship`. If it is missing, ask for the task and stop.
2. Read [runtime-preflight.md](references/runtime-preflight.md) completely. Perform its required-skill check before every other action and stop as directed when a dependency is missing.
3. Perform the remaining read-only preflight checks before changing files or external state.
4. Read [workflow.md](references/workflow.md) completely, recover any existing `$ship` state from current evidence, and resume at the first incomplete or stale phase rather than restarting by default.
5. Read [pr-review-protocol.md](references/pr-review-protocol.md) completely before drafting PR bodies, posting explanation comments, or processing review feedback.
6. Treat applicable `AGENTS.md`, repository docs, user instructions, actual tool declarations, installed skill bodies, and current CLI `--help` output as higher-priority runtime facts than examples in this skill.

## Responsibility boundary

Own only orchestration:

- Classify the task and select the path.
- Track phase, artifacts, stack dependencies, verification, and blockers.
- Choose and invoke available skills, agents, and CLIs in the required order.
- Enforce approval gates, independence between author and critic, and final readiness criteria.
- Restack descendants and invalidate stale verification or explanations when a lower layer changes.

Delegate:

- Delegate specification interrogation to `grill-with-docs`.
- Delegate bounded PR/CI/review diagnosis to `babysit-pr`. Use its one-shot mode for a bounded `$ship` run; use continuous monitoring only when the user separately requests monitoring and accept that its own stop conditions then govern.
- Delegate stacked branch and PR operations to `gh-stack`, while treating the current `gh stack --help` output as the CLI source of truth.
- Use repository-specific skills when they match a phase.
- Use available planning and subagent capabilities without hard-coding a model name.

## Global safety rules

- Preserve unrelated user changes. Stop before editing when the target worktree has overlapping or unexplained changes.
- Honor repository planning and approval rules even when they add checkpoints to this workflow.
- Do not install skills, extensions, or other dependencies without user authorization.
- Do not use destructive Git commands. Resolve exact branch and PR targets before mutation.
- Do not force-push except when an approved restack requires it; verify the branch is owned by this stack and use `--force-with-lease`.
- Do not post a human-facing GitHub reply when an applicable dependency or repository policy requires approval of the exact response.
- Do not merge automatically. Leave final merge decisions to a human.
- Do not claim human-review readiness while required checks, audits, dependency updates, or explanation synchronization remain incomplete.

## State reporting

Maintain a compact state record in the conversation and, when repository convention requires it, in the approved plan document:

```text
Phase: triage | specification | planning | plan-review | implementation | submit | stabilize | explain | final-audit | human-review-ready
Task class: small | medium | large/high-risk
Spec: <path or chat artifact>
Plan: <path or chat artifact>
Stack: <ordered branch/PR list and bases>
Verification: <current results per layer>
Requested milestone: <full readiness or explicit earlier checkpoint>
Evidence: <artifact, commit SHA, PR head SHA, or approval supporting the current phase>
Blockers: <missing dependency, approval, CI, or review item>
```

Update this record after every phase transition, lower-stack change, or blocker. A completed phase becomes stale when its inputs change; rerun it instead of preserving a false green state.

An explicit earlier milestone such as plan completion, implementation completion, or draft PR creation is a checkpoint, not successful completion of the full workflow. Stop there when requested, record every deferred phase, and resume from that evidence on the next `$ship` invocation.

## Completion

Finish only when the readiness gate in [workflow.md](references/workflow.md) passes. Report:

- Files and PRs created or changed.
- Workflow path taken and phase outcomes.
- Skills and agents delegated to.
- Stack order and base relationships.
- Verification and final acceptance-audit results.
- Reviewer Guide and prefix protocol status.
- Current limitations.
- Exact remaining human action, normally review and merge.
