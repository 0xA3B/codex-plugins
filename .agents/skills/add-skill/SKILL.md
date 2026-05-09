---
name: add-skill
description:
  Adds a new skill to an existing Codex marketplace plugin in this repository. Use when the user
  asks to add another skill, workflow, or reusable capability under an existing plugin; pair with
  the built-in skill-creator guidance for general skill authoring.
license: MIT
---

# Add Skill

Repo-local wrapper for adding a skill under `plugins/<plugin-name>/skills/`.

Use the built-in `skill-creator` guidance for drafting or materially revising `SKILL.md`. This skill
adds only this repository's plugin placement, metadata, documentation, and validation conventions.

## Outcome

Create a complete skill in an existing plugin with the expected repo layout, Codex metadata,
plugin-facing docs when useful, and passing plugin validation.

Stop when the new skill is present, relevant metadata/docs are updated, and validation has passed.
If the target plugin is ambiguous, the skill already exists, or validation fails for a reason that
is not clearly caused by this change, report the blocker and the safest next action.

## Source Of Truth

- Follow `plugins/AGENTS.md` for skill metadata placement and authoring rules.
- Follow the built-in `skill-creator` skill for general skill design, progressive disclosure, and
  skill-body drafting.
- Use existing skills in the target plugin as local style examples.
- Keep plugin manifests pointed at `./skills/`; do not add per-skill manifest paths.
- Keep runtime instructions in `SKILL.md`.
- Keep Codex UI metadata and invocation policy in `agents/openai.yaml`.

## Workflow

1. Identify the target plugin and normalize the skill name to lowercase kebab-case.
2. Confirm the skill does not already exist at `plugins/<plugin-name>/skills/<skill-name>/`.
3. Create:

   ```text
   plugins/<plugin-name>/skills/<skill-name>/SKILL.md
   plugins/<plugin-name>/skills/<skill-name>/agents/openai.yaml
   ```

4. Use `skill-creator` guidance to draft `SKILL.md`; apply `plugins/AGENTS.md` for this repo's
   frontmatter and placement rules.
5. Write `agents/openai.yaml` with `interface.display_name`, `interface.short_description`,
   `interface.default_prompt`, and `policy.allow_implicit_invocation`.
6. Update the plugin README when the new skill should be visible to plugin users.
7. Update Codex plugin default prompts when the new skill is a primary user workflow.
8. Run validation:

   ```bash
   pnpm lint:plugins
   pnpm format:check
   ```

## Boundaries

- Do not create a new plugin unless the user explicitly asks for one.
- Do not change plugin metadata unless the new skill affects plugin descriptions, prompts, keywords,
  or visible docs.
- Do not duplicate broad skill-authoring guidance here; keep repo-wide review guidance in
  `plugins/AGENTS.md` and use `skill-creator` for general authoring details.
- Do not stage or commit changes unless the user asks.
