import type { ValidationOptions } from "./diagnostics.js";

export function parseCliOptions(args: readonly string[]): ValidationOptions {
  let externalValidationEnabled = false;

  for (const arg of args) {
    if (arg === "--") {
      continue;
    }

    if (arg === "--external") {
      externalValidationEnabled = true;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return { externalValidationEnabled };
}
