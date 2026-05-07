import type { ValidationContext } from "./diagnostics.js";
import { relativeDisplay } from "./paths.js";

export function printDiagnostics(context: ValidationContext): void {
  const sortedDiagnostics = context.diagnostics.sort((left, right) =>
    relativeDisplay(context, left.filePath, left.pointer).localeCompare(
      relativeDisplay(context, right.filePath, right.pointer),
    ),
  );

  for (const diagnostic of sortedDiagnostics) {
    console.error(
      `- ${diagnostic.severity.toUpperCase()} ${diagnostic.ruleId} ${relativeDisplay(
        context,
        diagnostic.filePath,
        diagnostic.pointer,
      )}: ${diagnostic.message}`,
    );
  }
}
