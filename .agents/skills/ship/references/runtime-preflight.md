# Runtime preflight

Perform this phase without modifying the worktree, local branches, PRs, installed skills, or configuration. Refreshing remote-tracking refs with a non-destructive fetch is permitted because stale remote state can otherwise cause duplicate or misdirected work.

## 1. Check required skills

Perform this check before inspecting the repository:

- `grill-with-docs`
- `grilling`
- `domain-modeling`
- `babysit-pr`
- `gh-stack`

If any required skill is unavailable:

1. Report every missing skill.
2. Tell the user installation is required and request authorization to install it.
3. Stop before triage, repository work, or external mutation.

Do not use the small fast path, continue part of the workflow, reproduce the missing skill's procedure, or select a manual fallback.

## 2. Establish repository state

1. Resolve the repository root, current branch, default branch, remotes, upstream, and worktree status.
2. After resolving the exact remote, refresh its remote-tracking refs with `git fetch --prune <remote>` when authentication and repository policy permit. If fetch is unavailable, query remote refs and GitHub directly and mark local tracking refs as potentially stale.
3. Detect nested or parent `AGENTS.md` files that apply to the target paths and read them completely.
4. Identify unrelated staged, unstaged, and untracked changes. Do not assume they belong to `$ship`.
5. Inspect recent branches and PRs in every state—open, draft, merged, and closed—before deciding whether work or submission is missing. Resolve the current branch's PR directly when one exists; do not infer absence from an open-PR list alone.
6. Reconcile local HEAD, remote branch HEAD, PR head/base/state, default-branch HEAD, and `gh stack view --json`. If a related PR is already merged or closed, report that terminal state instead of creating a duplicate PR or choosing a new task from stale context.
7. Confirm GitHub authentication before any later push or PR operation, without printing tokens.

Prefer `rg --files` and targeted reads. Do not dump secrets or entire configuration files into chat.

Remote refresh and PR reconciliation happen before task classification or statements such as “this branch has no PR,” “the branch is ahead of main,” or “start from the current main.”

## 3. Discover capabilities and skills

Use the current session's tool and skill catalog first. Then inspect the configured personal, repository, and plugin skill locations when needed.

For every required skill:

1. Read its current `SKILL.md` completely before invoking it.
2. Treat its current safety and stop conditions as authoritative.

Required delegation checks:

- `grill-with-docs`: verify the installed body and any skills it invokes. At the time `$ship` was authored, the upstream wrapper invoked `grilling` and `domain-modeling`; re-check instead of assuming this remains true.
- `babysit-pr`: verify its script paths, prerequisites, mutation policy, and stop conditions. Prefer its documented one-shot diagnostic mode for bounded stabilization.
- `gh-stack`: read it before creating, submitting, rebasing, syncing, or navigating a stack. Reconcile its guidance with the installed extension's current help.

Inspect current Codex capabilities from actual tool declarations. If the CLI is available, `codex features list` may supplement—not override—the active session tools. Do not hard-code model names. Confirm that independent agents can be created before promising independent review.

## 4. Discover repository conventions

Inspect only enough documentation to determine:

- Where specifications, plans, ADRs, and durable context belong.
- Whether plan creation or implementation requires explicit human approval.
- Branch and commit naming conventions.
- Pull-request templates and required body sections.
- Test-boundary and scenario ownership rules.
- Package manager and commands for lint, typecheck, tests, build, migrations, E2E, and VRT.
- CI workflows, required checks, protected branches, and release constraints.

Use actual files as the source of truth: package scripts, Makefiles, task runners, CI YAML, and repository docs. Do not invent a command from the ecosystem defaults.

Default documentation layout only when the repository has no convention:

```text
docs/CONTEXT.md                  durable project/domain knowledge only
docs/specs/YYYYMMDD-<feature>.md feature specification when persistence helps
docs/plans/YYYYMMDD-<feature>.md implementation plan when persistence helps
docs/adr/YYYYMMDD-<decision>.md  durable design decision only
```

Do not create an ADR for every feature or put temporary hypotheses into `CONTEXT.md`.

## 5. Inspect GitHub CLI and stacking support

Run current help rather than relying on remembered syntax:

```text
gh --version
gh auth status
gh extension list
gh stack --help
gh pr create --help
```

Derive the workflow from the installed `gh stack` help. If the command is unavailable, tell the user that the official extension is required, request authorization to install it, and stop.

## 6. Check other blockers

Apply these gates after the required-skill check:

| Blocker | Behavior |
| --- | --- |
| Independent subagent support | Allow the small fast path when otherwise safe. Stop medium/large work before independent plan review or final audit. |
| `gh` or GitHub authentication | Permit local planning/implementation only when the user wants that partial outcome; stop before push or PR creation. |
| Repository command | Mark it unavailable; do not substitute an assumed equivalent. |

## 7. Report before implementation

Give a short preflight result containing:

- Task classification candidate.
- Applicable repository rules and approval gates.
- Available delegated skills and agents.
- Discovered verification commands.
- Stacking mechanism.
- Dirty-worktree or permission blockers.
- Proposed responsibility boundary and artifacts.
- Recovered phase and the evidence that makes earlier phases current or stale.
- Requested milestone and the phases that would remain deferred at that checkpoint.

Continue automatically only when the user request and repository rules authorize the next mutation and no gate above requires a stop.
