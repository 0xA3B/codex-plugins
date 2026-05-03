---
name: grill-with-docs
description: >-
  Stress-test a plan against the repository's domain language and architectural decisions, then
  update CONTEXT.md and ADRs as decisions crystallize. Use when the user wants a planning interview
  that also preserves durable project knowledge.
license: MIT
metadata:
  original_author: Matt Pocock
  original_source: https://github.com/mattpocock/skills/tree/b843cb5ea74b1fe5e58a0fc23cddef9e66076fb8/skills/engineering/grill-with-docs
---

# Grill With Docs

Run a grilling session that resolves a plan and captures durable project knowledge as it emerges.
This skill combines `engineering-workflows:grill-me` with active repository inspection and careful
updates to domain docs and ADRs.

## Core Behavior

- Ask one question at a time and wait for the user's answer.
- Include the recommended answer for each question and the tradeoff it resolves.
- If a question can be answered from code or docs, inspect those sources instead of asking.
- Challenge vague, overloaded, or conflicting terms immediately.
- Update docs inline as decisions become stable. Do not batch all documentation until the end.
- Do not create docs just to satisfy the skill. Create them only when there is real terminology or a
  durable decision to preserve.

## Domain Awareness

Look for existing project knowledge before asking broad questions:

- `CONTEXT.md`
- `CONTEXT-MAP.md`
- `docs/adr/`
- context-specific docs such as `src/*/CONTEXT.md` and `src/*/docs/adr/`
- `AGENTS.md`, README files, and nearby package docs

Most repositories have one context:

```text
/
├── CONTEXT.md
├── docs/
│   └── adr/
└── src/
```

Some repositories have multiple contexts. If `CONTEXT-MAP.md` exists, use it to find the relevant
context before updating docs:

```text
/
├── CONTEXT-MAP.md
├── docs/
│   └── adr/
└── src/
    ├── ordering/
    │   ├── CONTEXT.md
    │   └── docs/adr/
    └── billing/
        ├── CONTEXT.md
        └── docs/adr/
```

## During The Session

### Challenge Against The Glossary

When the user's language conflicts with `CONTEXT.md`, surface the mismatch directly:

```text
Your glossary defines "cancellation" as X, but this plan seems to use it as Y. Which meaning should
we use here?
```

### Sharpen Fuzzy Language

When the user uses vague or overloaded terms, propose a canonical term and ask for confirmation. For
example:

```text
You are saying "account"; do you mean the Customer or the User? Those are different concepts in this
codebase.
```

### Discuss Concrete Scenarios

Use specific scenarios to test boundaries between concepts, state transitions, and ownership. Prefer
examples that expose edge cases rather than examples that merely confirm the happy path.

### Cross-Reference With Code

When the user states how something works, verify it against the implementation if the claim matters.
If the code disagrees, pause and resolve the contradiction before continuing.

### Update `CONTEXT.md`

When a stable domain term is resolved, update the right `CONTEXT.md` using
[CONTEXT-FORMAT.md](references/CONTEXT-FORMAT.md). Keep domain docs about concepts meaningful to
domain experts, not incidental implementation details.

Create `CONTEXT.md` lazily if no context file exists and a meaningful term has been resolved.

### Offer ADRs Sparingly

Only offer to create an ADR when all of these are true:

- A real architectural decision was made or rejected.
- Future agents or maintainers would otherwise reopen the same question.
- The decision is durable enough to outlive the current task.

Use [ADR-FORMAT.md](references/ADR-FORMAT.md). Create `docs/adr/` lazily if needed.

## Completion

End with a concise summary:

- Decisions made.
- Terms added or changed.
- ADRs added or intentionally deferred.
- Remaining open questions.
- Recommended next action.
