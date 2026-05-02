# Project Overview

## Purpose

This project is a personal Codex plugin marketplace to provide a centralized place to capture my set
of personal skills.

## Tech Stack

- Typescript
- Oxfmt
- Oxlint
- husky
- commitlint
- lint-staged

## Development Commands

- `pnpm exec oxfmt [--write, --check] ...`: Use oxfmt to format/check targeted files
- `pnpm exec oxlint [--fix] ...`: Use oxlint to lint/fix targeted files
- `pnpm check`: Run format, lint, typecheck, and plugin validation
- `pnpm format`: Use oxfmt to format all supported filetypes in the repo
- `pnpm format:check`: Use oxfmt to check all supported filetypes in the repo
- `pnpm lint`: Use Oxlint to lint TypeScript
- `pnpm typecheck`: Use TypeScript to typecheck scripts
- `pnpm validate:plugins`: Validate the Codex marketplace, plugin manifests, and skill metadata

## Project Conventions

- Commit messages must follow Conventional Commits.
