---
name: zoom-out
description: >-
  Give a broader map of an unfamiliar code area, including relevant modules, callers, workflows, and
  how the area fits into the larger system. Use when the user asks to zoom out, needs orientation,
  or is unfamiliar with a section of code.
license: MIT
metadata:
  original_author: Matt Pocock
  original_source: https://github.com/mattpocock/skills/tree/b843cb5ea74b1fe5e58a0fc23cddef9e66076fb8/skills/engineering/zoom-out
---

# Zoom Out

Go up a layer of abstraction before diving into implementation details.

## Workflow

1. Identify the code area, feature, file, symbol, or behavior the user wants to understand.
2. Inspect the relevant repository structure, callers, tests, docs, and adjacent modules.
3. Use the project's own domain language from `CONTEXT.md`, ADRs, `AGENTS.md`, README files, and
   code names when those sources exist.
4. Explain the area as a map:
   - What responsibility this area owns.
   - The main modules and how they relate.
   - The important callers and entry points.
   - The data or control flow through the area.
   - The risks, constraints, or conventions that matter before editing.
5. Keep the explanation oriented toward the user's next action.

Prefer clear code references over broad architectural claims. If the map is uncertain, say what
evidence is missing.
