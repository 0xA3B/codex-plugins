# Codex Plugins

Personal Codex plugin marketplace for skills and workflows I want to keep centralized across Codex
sessions.

## Install

Add marketplace to Codex:

```bash
codex plugin marketplace add 0xA3B/codex-plugins
```

Upgrade the marketplace later:

```bash
codex plugin marketplace upgrade 0xa3b-marketplace
```

After adding or upgrading the marketplace, install the desired plugins from Codex.

## Plugins

### `conventional-commits`

Skills for planning, writing, validating, and executing Conventional Commits.

- `conventional-commits:writing-conventional-commits`: Reusable commit message policy and split
  guidance.
- `conventional-commits:draft-message`: Drafts Conventional Commit messages without staging or
  committing.
- `conventional-commits:commit`: Reviews current changes, stages logical units, and creates
  Conventional Commit commits.

### `engineering-workflows`

Engineering workflow skills for brainstorming, planning, building, TDD, diagnosis, architecture
review, and codebase orientation. Some skills are adapted from Matt Pocock's MIT-licensed
[`mattpocock/skills`](https://github.com/mattpocock/skills) repository with source attribution
preserved in each adapted skill's Agent Skills frontmatter metadata.

Typical implementation flow: `brainstorm` when solution direction is unclear, `plan` once a
direction is selected, then `build` for greenfield or high-churn implementation and `tdd` for stable
behavior. `diagnose`, `zoom-out`, and `improve-codebase-architecture` are ad hoc workflows for
specific needs.

- `engineering-workflows:brainstorm`: Researches and compares solution options before planning.
- `engineering-workflows:build`: Implements working slices with pragmatic validation.
- `engineering-workflows:diagnose`: Runs a disciplined diagnosis loop for bugs, flaky behavior, and
  performance regressions.
- `engineering-workflows:tdd`: Builds features or fixes with a red-green-refactor loop.
- `engineering-workflows:plan`: Turns a direction into an implementation-ready plan.
- `engineering-workflows:zoom-out`: Maps an unfamiliar code area at a higher level of abstraction.
- `engineering-workflows:improve-codebase-architecture`: Finds module deepening and architecture
  improvement opportunities.
