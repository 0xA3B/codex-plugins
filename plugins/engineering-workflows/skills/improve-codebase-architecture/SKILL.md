---
name: improve-codebase-architecture
description: >-
  Find architectural deepening opportunities in a codebase, informed by domain language and ADRs.
  Use when the user wants refactoring opportunities, better module design, simpler interfaces,
  stronger testability, or a codebase architecture review.
license: MIT
metadata:
  original_author: Matt Pocock
  original_source: https://github.com/mattpocock/skills/tree/b843cb5ea74b1fe5e58a0fc23cddef9e66076fb8/skills/engineering/improve-codebase-architecture
---

# Improve Codebase Architecture

Surface architectural friction and propose deepening opportunities: refactors that put more useful
behavior behind simpler interfaces. The goal is better locality, leverage, testability, and
agent-navigability.

## Language

Use this vocabulary consistently in every suggestion. The full definitions live in
[LANGUAGE.md](references/LANGUAGE.md).

- **Module**: anything with an interface and an implementation.
- **Interface**: everything a caller must know to use a module, including types, invariants, error
  modes, ordering, and configuration.
- **Implementation**: the code inside the module.
- **Depth**: leverage at the interface. A deep module provides a lot of behavior behind a simple
  interface. A shallow module exposes nearly as much complexity as it hides.
- **Seam**: where an interface lives; a place behavior can be changed without editing callers in
  place.
- **Adapter**: a concrete thing satisfying an interface at a seam.
- **Leverage**: what callers get from depth.
- **Locality**: what maintainers get from depth: change, bugs, and knowledge concentrated in one
  place.

Key principles:

- Deletion test: if deleting a module makes complexity disappear, it was probably pass-through. If
  deleting it spreads complexity into callers, it was earning its keep.
- The interface is the test surface.
- One adapter usually means a hypothetical seam; two adapters usually means a real seam.

## Workflow

### 1. Explore

Read the project's domain glossary and relevant ADRs first when they exist:

- `CONTEXT.md` or the relevant context from `CONTEXT-MAP.md`
- `docs/adr/` and context-specific ADR folders
- `AGENTS.md`, README files, and nearby module docs

Then inspect the codebase using normal Codex tools. Follow the friction:

- Where does understanding one concept require bouncing through many small modules?
- Where are modules shallow?
- Where was code extracted for testability, but the real bugs live in orchestration?
- Where do tightly coupled modules leak across seams?
- Which parts are untested or hard to test through the current interface?
- Which names in code fail to match the domain language?

Apply the deletion test to suspected shallow modules.

### 2. Present Candidates

Present a numbered list of deepening opportunities. For each candidate include:

- **Files**: the files or modules involved.
- **Problem**: the architectural friction.
- **Solution**: what would change in plain English.
- **Benefits**: why locality, leverage, or tests improve.
- **Risks**: migration cost, compatibility issues, or uncertainty.

Use the project's domain language from `CONTEXT.md` when available. If an idea conflicts with an
existing ADR, surface it only when the friction is strong enough to justify revisiting that
decision.

Do not implement the refactor during this first pass unless the user explicitly asked for changes.
Ask which candidate they want to explore or implement.

### 3. Grill The Selected Candidate

Once the user picks a candidate, run a focused grilling loop:

- What exact behavior belongs behind the new or deepened interface?
- Which callers should know less after the change?
- Which tests should survive a refactor?
- What data, errors, ordering, or configuration are part of the interface?
- Which compatibility or migration constraints matter?

If new stable domain terms emerge, update `CONTEXT.md` using the same discipline as
`engineering-workflows:grill-with-docs`.

If the user rejects a candidate for a durable reason, offer to record the reason as an ADR so future
architecture reviews do not re-suggest it.

For deeper interface exploration, use [INTERFACE-DESIGN.md](references/INTERFACE-DESIGN.md). For the
full deepening model, use [DEEPENING.md](references/DEEPENING.md).

## Completion

End with either:

- A prioritized architecture review and the next decision to make, or
- A concrete implementation plan for the selected refactor, including validation steps.
