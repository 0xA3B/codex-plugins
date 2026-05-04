---
name: validate-plugin
description:
  Validates Codex marketplace plugin structure, manifests, skill metadata, formatting, linting, and
  type checks in this repository. Use when the user asks to check a plugin, verify metadata, run
  plugin linting, or confirm plugin changes are ready.
---

# Validate Plugin

Repo-local workflow for validating plugin and skill-authoring changes.

## Source Of Truth

- `pnpm validate:plugins` validates the marketplace catalog, plugin manifests, skill frontmatter,
  and skill `agents/openai.yaml` metadata.
- `pnpm format:check` validates supported Markdown, JSON, YAML, and TypeScript formatting.
- `pnpm lint` runs Oxlint on TypeScript.
- `pnpm typecheck` runs TypeScript type checking.
- `pnpm check` runs the full format, lint, typecheck, and plugin validation gate.
- `plugins/AGENTS.md` defines plugin structure and compatibility rules.

## Workflow

1. Inspect current changes with `git status --short`.
2. Run the narrowest relevant validation:

   ```bash
   pnpm validate:plugins
   ```

3. Run format validation when Markdown, JSON, YAML, TypeScript, or skill files changed:

   ```bash
   pnpm format:check
   ```

4. Run TypeScript validation when scripts, validators, package config, or CI changed:

   ```bash
   pnpm lint
   pnpm typecheck
   ```

5. For broad repo changes or pre-commit readiness, run:

   ```bash
   pnpm check
   ```

6. If a check fails, fix the issue when the cause is clear and rerun the failed check.
7. Report checks run, pass/fail result, files changed by any formatter, and remaining risks or
   skipped checks.

## Boundaries

- Do not stage or commit changes unless the user asks.
- Do not use unsafe lint fixes.
- Do not hide formatter changes; report them in the final answer.
