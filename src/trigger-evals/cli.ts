#!/usr/bin/env node

import { HelpRequested, parseTriggerEvalCliOptions, usage } from "./cli-options.js";
import { printTriggerEvalResult } from "./output.js";
import { runTriggerEval } from "./runner.js";

const abortController = new AbortController();
const handleSignal = (signal: NodeJS.Signals): void => {
  process.exitCode = signal === "SIGINT" ? 130 : 143;
  abortController.abort();
};
process.once("SIGINT", handleSignal);
process.once("SIGTERM", handleSignal);

let options;
try {
  options = parseTriggerEvalCliOptions(process.argv.slice(2));
} catch (caught: unknown) {
  if (caught instanceof HelpRequested) {
    console.log(usage());
    process.exit(0);
  }

  console.error(caught instanceof Error ? caught.message : String(caught));
  process.exitCode = 1;
}

if (options !== undefined) {
  runTriggerEval({ ...options, abortSignal: abortController.signal })
    .then((result) => {
      printTriggerEvalResult(result);
    })
    .catch((caught: unknown) => {
      console.error(caught instanceof Error ? caught.message : String(caught));
      process.exitCode = 1;
    });
}
