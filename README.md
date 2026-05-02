# Codex Plugins

Personal Codex plugin marketplace for skills and workflows I want to keep centralized across Codex
sessions.

## Setup

Install dependencies:

```fish
pnpm install
```

Check formatting:

```fish
pnpm format:check
```

Format supported files:

```fish
pnpm format
```

## Repository Layout

- `.agents/plugins/marketplace.json`: Codex marketplace catalog for the plugins in this repository.
- `plugins/<plugin-name>/.codex-plugin/plugin.json`: Codex plugin manifest.
- `plugins/<plugin-name>/skills/<skill-name>/SKILL.md`: Skill instructions loaded by Codex.
- `plugins/<plugin-name>/skills/<skill-name>/agents/openai.yaml`: Codex UI and invocation metadata.

## Plugins

### `conventional-commits`

Skills for planning, writing, validating, and executing Conventional Commits.

- `conventional-commits:writing-conventional-commits`: Reusable commit message policy and split
  guidance.
- `conventional-commits:draft-message`: Drafts Conventional Commit messages without staging or
  committing.
- `conventional-commits:commit`: Reviews current changes, stages logical units, and creates
  Conventional Commit commits.

## Adding Skills

Add new skills under the relevant plugin:

```text
plugins/<plugin-name>/skills/<skill-name>/
├── SKILL.md
└── agents/
    └── openai.yaml
```

Use `SKILL.md` for the runtime instructions and `agents/openai.yaml` for Codex-specific metadata
such as display name, default prompt, and implicit invocation policy.

When a new plugin is added, include it in `.agents/plugins/marketplace.json` and give it a
`.codex-plugin/plugin.json` manifest.
