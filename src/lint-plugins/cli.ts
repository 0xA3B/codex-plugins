#!/usr/bin/env node

import { parseCliOptions } from "./cli-options.js";
import { runCli } from "./runner.js";
import { errorMessage } from "./utils.js";

try {
  runCli(parseCliOptions(process.argv.slice(2)));
} catch (caught: unknown) {
  console.error(errorMessage(caught));
  process.exitCode = 1;
}
