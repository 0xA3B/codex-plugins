---
name: grill-me
description: >-
  Interview the user about a plan or design until the important decisions, dependencies, and edge
  cases are clear. Use when the user explicitly asks to be grilled, wants a plan stress-tested, or
  wants help resolving an ambiguous design before implementation.
license: MIT
metadata:
  original_author: Matt Pocock
  original_source: https://github.com/mattpocock/skills/tree/b843cb5ea74b1fe5e58a0fc23cddef9e66076fb8/skills/productivity/grill-me
---

# Grill Me

Interview the user about the plan until there is a shared understanding of the shape of the work.
Walk the decision tree one branch at a time, resolving dependencies before moving deeper.

## Behavior

- Ask one question at a time and wait for the user's answer.
- For each question, include the answer you recommend and the tradeoff it resolves.
- If a question can be answered by inspecting the repository, inspect the relevant code or docs
  instead of asking.
- Keep the session focused on decisions that affect implementation, risk, scope, product behavior,
  or validation.
- Stop when the plan is specific enough to implement, defer, or reject.

## Output

When the grilling session is complete, summarize:

- The decisions that were made.
- The assumptions that remain.
- The next implementation or planning step.
