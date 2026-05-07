import { validateCatalogCoverage, validateLocalRepositoryAlignment } from "./coverage.js";
import { createValidationContext } from "./diagnostics.js";
import { validateExternalReferences } from "./external.js";
import { validateMarketplace } from "./marketplace.js";
import { printDiagnostics } from "./output.js";
import { validatePlugin } from "./plugin-manifest.js";
import { validateSkillsForEntry } from "./skills/index.js";
import type { JsonObject } from "./types.js";
import { errorMessage } from "./utils.js";

export async function runLintPlugins(): Promise<void> {
  const context = createValidationContext();
  const catalog = await validateMarketplace(context);
  const manifestsByPath = new Map<string, JsonObject>();
  validateLocalRepositoryAlignment(context, catalog);
  await validateCatalogCoverage(context, catalog);

  for (const entry of catalog.localEntries.values()) {
    const manifest = await validatePlugin(context, entry);
    if (manifest !== undefined) {
      manifestsByPath.set(entry.manifestPath, manifest);
      await validateSkillsForEntry(context, entry, manifest);
    }
  }

  await validateExternalReferences(context, catalog, manifestsByPath);

  const errorCount = context.diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  ).length;
  const warningCount = context.diagnostics.length - errorCount;
  if (context.diagnostics.length > 0) {
    const status = errorCount > 0 ? "failed" : "completed";
    console.error(
      `Plugin lint ${status} with ${errorCount} error(s) and ${warningCount} warning(s):`,
    );
    printDiagnostics(context);
    process.exitCode = errorCount > 0 ? 1 : 0;
    return;
  }

  const externalLabel = context.externalValidationEnabled ? " with external checks" : "";
  console.log(`Linted ${catalog.localEntries.size} local plugin(s)${externalLabel}.`);
}

export function runCli(): void {
  runLintPlugins().catch((caught: unknown) => {
    console.error(errorMessage(caught));
    process.exitCode = 1;
  });
}
