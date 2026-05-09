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

Codex-adapted engineering workflow skills for diagnosis, TDD, planning interviews, architecture
review, and codebase orientation. These are adapted from Matt Pocock's MIT-licensed
[`mattpocock/skills`](https://github.com/mattpocock/skills) repository with source attribution
preserved in each skill's Agent Skills frontmatter metadata.

- `engineering-workflows:diagnose`: Runs a disciplined diagnosis loop for bugs, flaky behavior, and
  performance regressions.
- `engineering-workflows:tdd`: Builds features or fixes with a red-green-refactor loop.
- `engineering-workflows:grill-me`: Stress-tests a plan or design through focused questions.
- `engineering-workflows:zoom-out`: Maps an unfamiliar code area at a higher level of abstraction.
- `engineering-workflows:improve-codebase-architecture`: Finds module deepening and architecture
  improvement opportunities.
