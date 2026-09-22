# Runtime preflight

Perform this phase without modifying the worktree, local branches, PRs, installed skills, or configuration. Refreshing remote-tracking refs with a non-destructive fetch is permitted because stale remote state can otherwise cause duplicate or misdirected work.

The preflight has two dependency tiers. Core capability checks happen before repository investigation. Gate-specific direct dependencies are selected after triage and validated before the phase that needs them. A skill used internally by a delegated wrapper is transitive: verify the wrapper’s current contract when the wrapper is selected, but do not make the transitive skill a `$orchestrate` hard dependency.

## Bounded evidence acquisition

For each runtime or discovery property, use the cheapest reliable evidence first: static files/configuration, then a non-model diagnostic when needed, then an actual model/MCP runtime probe only when the selected gate depends on that property and cheaper evidence is insufficient. Use one primary attempt and, only if needed, at most one materially different fallback attempt by default. Do not repeat equivalent probes through fresh sessions, MCP reconnects, or alternate commands. Additional attempts beyond that bound are allowed only when the selected dependency documents its own bounded retry policy; a transient failure may justify using the one fallback but never resets or expands the overall bound.

If the property remains unresolved, record `unavailable` as the result. Block only when that property is required to execute or truthfully pass the selected gate; otherwise continue and report the limitation. Attempt bounds are primary, with a bounded command timeout as a secondary safeguard. Reuse diagnostic evidence while its material inputs—such as the relevant Skill/config content, CLI version, invocation mode, or exposed runtime metadata—remain unchanged; do not introduce an opaque fingerprint, counter, cache, or diagnostic wrapper.

## 1. Core capability inventory

Before inspecting the repository, inspect the active tool and skill catalog and confirm:

- `$orchestrate` and its reference files are readable.
- Independent subagent support is available, or the runtime limitation is known.
- Read-only filesystem and Git inspection are available.
- The current CLI and configuration inspection commands are available when runtime routing is in scope.

Do not require every optional workflow skill here. A missing gate-specific dependency is handled after triage. If the controller cannot create a separate reviewer for a route that requires independent review, stop that route before implementation and report the blocker; do not simulate independence.

An already-running `$orchestrate` invocation proves that its explicit invocation resolved and its body is readable; do not launch a fresh runtime merely to rediscover it. When Skill installation, synchronization, invocation policy, or discovery is itself in scope, inspect `SKILL.md`, `agents/openai.yaml`, configured Skill paths, and runtime configuration first. If `allow_implicit_invocation` is `false`, absence from the implicit model context is expected and is not evidence of installation or explicit-invocation failure.

## 2. Establish repository state

1. Resolve the repository root, current branch, default branch, remotes, upstream, and worktree status.
2. After resolving the exact remote, refresh its remote-tracking refs with `git fetch --prune <remote>` when authentication and repository policy permit. If fetch is unavailable, query remote refs and GitHub directly and mark local tracking refs as potentially stale.
3. Detect nested or parent `AGENTS.md` files that apply to target paths and read them completely.
4. Identify unrelated staged, unstaged, and untracked changes. Do not assume they belong to `$orchestrate`.
5. Inspect recent branches and PRs in every state—open, draft, merged, and closed—before deciding whether work or submission is missing. Resolve the current branch’s PR directly when one exists; do not infer absence from an open-PR list alone.
6. Reconcile local HEAD, remote branch HEAD, PR head/base/state, default-branch HEAD, and `gh stack view --json` when stack support is in scope. If a related PR is already merged or closed, report that terminal state instead of creating a duplicate PR or choosing a new task from stale context.
7. Confirm GitHub authentication before any later push or PR operation, without printing tokens.

Remote refresh and PR reconciliation happen before statements such as “this branch has no PR,” “the branch is ahead of main,” or “start from the current main.”

## 3. Triage-selected direct dependencies

After classifying the task and selecting gates, validate only the dependencies needed by that route. Record the result and version/commit where useful.

| Capability | Validate when | Contract |
| --- | --- | --- |
| `grill-with-docs` | specification gate is required or enabled | Read its current `SKILL.md` and invoke its current workflow; do not duplicate its interrogation |
| implementation worker role | every route before implementation | Confirm a separate role can receive the worker contract and return a result; implementation is delegated by default |
| independent reviewer role | every route before implementation review | Confirm the reviewer can be a separate agent from the implementation author and can inspect actual diff/evidence |
| planner role / planning support | written plan or plan review is required | Confirm the selected planning capability and repository plan format |
| `babysit-pr` | stabilization is selected | Read its script paths, prerequisites, mutation policy, stop conditions, and one-shot mode; use its documented snapshot |
| `gh-stack` | an existing or selected stack is in scope | Read it before stack navigation or mutation and reconcile with current `gh stack --help` |
| final auditor role | High-risk or explicit final-audit gate | Confirm an independent agent can receive raw acceptance evidence after stabilization |
| `adrs` CLI | an existing ADR repository is selected for search/health checks, or the Architecture Decision Gate selects `recorded`/another ADR mutation | Confirm the installed CLI and current subcommand help; use repository configuration and policy as the source of truth |

If a selected direct dependency is unavailable, stop before that gate. Preserve any safe earlier checkpoint, state the exact missing capability, and ask for authorization or user direction as appropriate. Do not make missing `grill-with-docs`, `gh-stack`, `babysit-pr`, or `adrs` block a route that does not select them. A required Architecture Decision Gate with `no-new-decision` does not select `adrs` merely because the repository has no ADR CLI or initialization; an ADR operation that is actually needed does.

### Delegated transitive dependencies

`grilling` and `domain-modeling` may be used inside `grill-with-docs`. Read and trust the wrapper’s current contract when `grill-with-docs` is selected, but do not list or independently invoke those skills as `$orchestrate` direct dependencies unless the wrapper explicitly requires it. Do not infer or reimplement internal dependencies of `babysit-pr` or `gh-stack`.

`explained-code-review` is an optional repository-local review capability. Use it only when the selected task or repository policy calls for its artifact; it is not a required dependency for every invocation.

## 4. Project-scoped runtime model routing

Keep workflow semantics and concrete model assignment separate. The Skill and its references name only roles: orchestrator/planner, implementation worker, independent implementation reviewer, and final auditor. The project runtime configuration is the source of truth for the concrete assignment.

Inspect, without editing during preflight:

- Project `.codex/config.toml` for the main orchestrator defaults and multi-agent enablement.
- Project `.codex/agents/*.toml` for role definitions and their config layers.
- Current Codex CLI version, strict-config behavior, feature flags, and model catalog.

Validate only the configuration properties required by the selected route. Start with the project files above. When static inspection is insufficient, choose the minimum applicable non-model diagnostic from the current CLI surface, for example:

```text
codex --strict-config --cd <repository> doctor
codex features list
codex debug models
```

Use an actual model/MCP runtime probe only as the bounded fallback when current-session applicability is gate-critical and the static/non-model evidence cannot establish it:

```text
codex --strict-config --cd <repository> exec --ephemeral --sandbox read-only "<no-op prompt>"
```

The current CLI does not accept `--strict-config` on the `features` subcommand; use a strict `doctor` for configuration parsing when available, then use `features list` only when that inventory is needed. Do not run every example command as a checklist.

Confirm that the project config is trusted, role files parse, configured model/reasoning pairs are supported by the current catalog, and the implementation worker has the write capability required by its contract. For planner, reviewer, and auditor roles, confirm that the custom agent files declare `sandbox_mode = "read-only"` as the intended configuration, but do not treat that declaration as proof of runtime enforcement. If the active runtime exposes effective sandbox or agent metadata, record the reported value; otherwise record it as unavailable. Do not create a launcher, wrapper, or pseudo-routing mechanism to hide an unsupported setting. Keep the logical contract read-only even when effective enforcement is unavailable or write-capable: those roles must not edit files, mutate external state, or mutate PRs.

Report sandbox state as separate fields:

```text
Configured sandbox: read-only
Effective sandbox: <runtime-reported value | unavailable>
Logical role policy: read-only
Runtime enforcement: confirmed | unavailable | mismatched
```

If the effective sandbox is write-capable or cannot be inspected, preserve the role’s logical contract—do not edit files, mutate external state, or mutate PRs—and report the runtime limitation. A configured read-only value alone is not evidence that the child runtime enforced it.

For a new task, use the configured implementation-worker role by default and record the resolved role, model, reasoning level, configured sandbox, effective sandbox (when exposed), and agent identity in the operational state. Start the implementation author and independent reviewer as different agent instances. If the active spawn surface supports explicit per-agent model/reasoning overrides, use the project role plus those formal overrides and record the resolved assignment. If a project config change cannot affect an already-running session, report that limitation and verify it on a new invocation or supported spawn surface; never claim retroactive application.

If the active tool surface does not expose named roles, per-agent overrides, or effective sandbox metadata, report the configuration level that is accepted, the assignment actually resolved for each agent, the sandbox value that cannot be verified, and any role assignment that cannot be enforced. A worker fallback is a recorded decision, not silent substitution.

## 5. Discover repository conventions

Inspect only enough documentation and files to determine:

- Where specifications, plans, ADRs, and durable context belong.
- Whether an ADR repository is configured, which decisions it covers, and whether its policy requires a doctor/approval check. Do not initialize one or infer its directory, format, status, or CLI syntax.
- Whether plan creation or implementation requires explicit human approval.
- Branch and commit naming conventions.
- Pull-request templates and required body sections.
- Test-boundary and scenario ownership rules.
- Package manager and commands for lint, typecheck, tests, build, migrations, E2E, and VRT.
- CI workflows, required checks, protected branches, and release constraints.

Use actual files as the source of truth: package scripts, Makefiles, task runners, CI YAML, and repository docs. For an ADR operation, also use the installed `adrs --help` and `adrs <subcommand> --help` output. Do not invent a command from ecosystem defaults. Do not create an ADR for every feature or put temporary hypotheses into durable context.

## 6. Inspect GitHub CLI and stacking support when selected

When submission, stabilization, or stack operations are in scope, run current help rather than relying on remembered syntax:

```text
gh --version
gh auth status
gh extension list
gh stack --help
gh pr create --help
```

If `gh-stack` is selected and the command is unavailable, tell the user that the required extension is missing and stop before stack mutation. A local implementation checkpoint may continue only when the user explicitly requested that partial outcome and no other gate is blocked.

## 7. Other blockers

Apply these gates after core capability and triage-selected dependency checks:

| Blocker | Behavior |
| --- | --- |
| independent subagent support | Small may continue only if its route still has the required independent diff review; Normal/High-risk stop before an independent review or final audit that cannot be separated |
| implementation worker routing | Use the configured worker by default; if unavailable, stop or obtain explicit fallback authorization and report the actual assignment |
| `gh` or GitHub authentication | Permit local planning/implementation only when the user wants that partial outcome; stop before push or PR creation |
| repository command | Mark it unavailable; do not substitute an assumed equivalent |
| dirty overlapping worktree | Preserve the existing change and stop until ownership/scope is resolved |

## 8. Report before implementation

Give a short preflight result containing:

- Task classification candidate and selected gate matrix.
- Applicable repository rules and approval gates.
- Core capabilities and selected direct dependencies, with transitive dependencies clearly separated.
- Runtime role configuration, current-session applicability, actual assignment evidence, and any limitation.
- Discovered verification commands.
- Stacking mechanism, if selected.
- Dirty-worktree or permission blockers.
- Proposed responsibility boundary and artifacts.
- Architecture Decision Gate outcome, applicable ADR CLI/config dependency, and whether `adrs doctor` is only being recorded as repository-health evidence.
- Recovered phase and evidence that makes earlier phases current or stale.
- Requested milestone and phases that remain deferred at that checkpoint.

Continue automatically only when the user request and repository rules authorize the next mutation and no selected gate requires a stop.
