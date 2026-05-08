import type { RunTriggerEvalOptions } from "./runner.js";

export function parseTriggerEvalCliOptions(argv: string[]): RunTriggerEvalOptions {
  const options: Partial<RunTriggerEvalOptions> = {};
  const positionals: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined) {
      continue;
    }

    if (arg === "--") {
      continue;
    }

    if (arg === "--fixture") {
      options.fixturePath = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--case") {
      options.caseId = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--model") {
      options.model = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--timeout-ms") {
      options.timeoutMs = Number.parseInt(readOptionValue(argv, index, arg), 10);
      if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
        throw new Error("--timeout-ms must be a positive integer.");
      }
      index += 1;
      continue;
    }

    if (arg === "--codex-home") {
      options.sourceCodexHome = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--force") {
      options.force = true;
      continue;
    }

    if (arg === "-h" || arg === "--help") {
      throw new HelpRequested();
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    positionals.push(arg);
  }

  if (positionals.length !== 1 || positionals[0] === undefined) {
    throw new Error("Usage: pnpm eval:trigger -- <plugins/<plugin>/skills/<skill>> [options]");
  }

  return { ...options, skillPath: positionals[0] };
}

export class HelpRequested extends Error {
  constructor() {
    super("Help requested.");
  }
}

export function usage(): string {
  return [
    "Usage: pnpm eval:trigger -- <plugins/<plugin>/skills/<skill>> [options]",
    "",
    "Options:",
    "  --fixture <path>      Use a fixture file other than evals/triggers.yaml.",
    "  --case <id>           Run one trigger fixture case.",
    "  --model <model>       Override the Codex model for the eval run.",
    "  --timeout-ms <ms>     Per-case timeout. Defaults to 120000.",
    "  --codex-home <path>   Source Codex home to copy auth/config from. Defaults to ~/.codex.",
    "  --force               Run even when allow_implicit_invocation is false.",
  ].join("\n");
}

function readOptionValue(argv: string[], index: number, optionName: string): string {
  const value = argv[index + 1];
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing value for ${optionName}.`);
  }

  return value;
}
