# PR reviewer guide and conversation protocol

Treat the PR body, selected inline comments, and review threads as an interface for discussing implementation intent. Apply repository PR templates and language conventions first, then add the sections below. A single meaningful PR is the default; include stack details only when a selected stack exists.

## PR body

Choose the smallest body that satisfies the task class and repository template. Every PR needs a clear Purpose and exact Verification. Add Scope when it clarifies what is included or intentionally deferred; include Depends on and Stack only when they apply.

### Small

For an obvious isolated change, the minimum body is:

```markdown
## Purpose

<What changed and why>

## Verification

- `<exact command or manual check>` — PASS/FAIL/not run with reason
```

When useful, add a separate `## Scope` section for the included or intentionally deferred boundary. Add a Reviewer Guide only when it materially helps the review: explaining the diff reading order, a non-obvious decision, a concrete reviewer focus, or a repository policy requirement. A missing guide alone must not block Small-task human-review readiness.

### Normal / High-risk

Use the repository template plus the following compact contract. Keep the Reviewer Guide to information needed to review the current diff; do not add ceremony merely to complete a section.

```markdown
## Purpose

<What this PR accomplishes and why this layer exists>

## Scope

- <What is included>
- <What is intentionally deferred>

## Depends on

- <Parent PR/branch, or none>

## Verification

- `<exact command>` — PASS/FAIL/not run with reason

## Stack

<Single PR: none. Stack: ordered layer list and current status.>

## Reviewer Guide

### Review order

1. `<entry point>`
2. `<supporting implementation>`
3. `<tests>`

### Key decisions

- <Decision and short reason>

### Reviewer focus

- <Concrete invariant, trade-off, or risk to challenge>

### Ask the AI

- Question: `[SHIP:Q] <question>`
- Change request: `[SHIP:CHANGE] <request>`
- Re-verification: `[SHIP:VERIFY] <question>`
```

When the repository mandates other headings, merge this content into them without deleting required sections. Explain only the current PR’s diff plus minimum parent context needed to review it; do not repeat lower-layer implementation details. Do not claim checks or audits that were not run.

For Normal and High-risk work, maintain the Reviewer Guide unless the repository policy explicitly permits a different reviewability artifact. Keep it to the current diff’s entry point, key decisions, reviewer focus, and exact verification. It is not a replacement for the independent implementation review or a reason to add a stack. `[SHIP:NOTE]` remains optional and belongs only on non-obvious lines.

## Inline explanations

Start every AI-authored explanation with `[SHIP:NOTE]`.

Add notes only where explaining why materially reduces review effort, such as:

- Domain invariants and state transitions.
- Validation or API boundaries.
- Authorization, security, or data-integrity checks.
- Error mapping and recovery behavior.
- Async, concurrency, caching, or performance decisions.
- DB schema/query decisions.
- Non-obvious abstractions or ADR/spec decisions embodied in code.

Do not comment on imports, formatting, simple renames, obvious annotations, boilerplate, or trivial markup. A task may legitimately have no `[SHIP:NOTE]` comments; record that no non-obvious explanation was needed.

Write a short natural explanation using the relevant subset of:

- What boundary or invariant this line establishes.
- Why this location or approach was chosen.
- Trade-off or rejected alternative.
- What the reviewer should challenge.

Bad:

```text
[SHIP:NOTE]
This filters invalid items.
```

Good:

```text
[SHIP:NOTE]
This is the single normalization boundary, so downstream code can rely on every item being valid instead of repeating validation. Please check whether silently excluding any input category would violate the product rules.
```

Before posting, resolve the current PR head SHA, path, side, and diff line. Use the available GitHub connector or current `gh api` help. Never guess a line location. Posting these comments is an external communication; ensure the `$ship` invocation and active platform policy authorize it.

## Human prefixes

### `[SHIP:Q]`

Treat as a question. Do not change code. Investigate enough context to explain:

- Current design intent.
- Relevant trade-offs.
- Plausible alternatives.
- A recommendation, including when the reviewer’s alternative is better.

Offer what a change would look like, but wait for `[SHIP:CHANGE]` or equivalent explicit authorization before implementing it.

### `[SHIP:CHANGE]`

Treat as an explicit implementation request. Before editing, confirm:

- Exact requested behavior.
- Affected PR or stack layers and descendants.
- Consistency with the specification, ADRs, and repository rules.

Implement the smallest coherent change, run affected verification, restack descendants when applicable, and synchronize explanations. If the request conflicts with the approved specification or creates material new scope, stop and ask rather than silently redefining the task.

### `[SHIP:VERIFY]`

Treat as a request to investigate, not edit. Compare current code, specification, tests, and edge cases. Answer with exactly one leading classification:

- `PASS`: evidence supports the claimed property.
- `RISK`: evidence is incomplete or the property depends on an unresolved assumption.
- `FAIL`: evidence demonstrates the property does not hold.

Give evidence and a fix proposal for `RISK` or `FAIL`. Change code only after an explicit change request.

### No prefix

Infer intent conservatively. Treat “why?”, “is this needed?”, “what is the intent?”, “what about another approach?”, and “is this safe?” as questions. When question versus change is ambiguous, answer or ask for clarification; do not edit.

## Thread behavior

When a human replies to `[SHIP:NOTE]`, use the code at that line, the explanation, the full thread, and the applicable spec/ADR as context. Continue in the same thread when platform policy permits.

Do not defend the current implementation as a goal. State the current approach, alternative, trade-off, and recommendation honestly. If the human’s proposal is better, say so.

Respect stricter policies from delegated skills. If posting a human-facing reply requires approval of the exact text, draft the response in chat and wait for that approval.

## Synchronization

After review fixes, lower-stack changes, restacks, architecture changes, or error-handling changes:

1. Re-read every `[SHIP:NOTE]` against the current diff.
2. Update an authored comment when supported and still attached to a relevant line.
3. Otherwise add a new current explanation and make the old one clearly obsolete when the platform permits.
4. When a Reviewer Guide exists or the explanation gate selects one, update it so it describes the current PR head, current stack position (or single-PR status), and exact verification. Do not create one for a Small task solely to satisfy this synchronization step.
5. Do not leave a misleading explanation merely because it is already published.

Questions and verification requests never become code changes solely because synchronization is needed.
