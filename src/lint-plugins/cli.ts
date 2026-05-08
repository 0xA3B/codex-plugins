#!/usr/bin/env node

import { runCli } from "./runner.js";

runCli({ externalValidationEnabled: process.argv.includes("--external") });
