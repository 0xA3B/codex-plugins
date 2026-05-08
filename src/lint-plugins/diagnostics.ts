export type Severity = "error" | "warning";

export type Diagnostic = {
  filePath: string;
  message: string;
  ruleId: string;
  severity: Severity;
  pointer?: string;
};

export type ValidationContext = {
  diagnostics: Diagnostic[];
  externalValidationEnabled: boolean;
  repoRoot: string;
};

export type ValidationOptions = {
  externalValidationEnabled?: boolean;
  repoRoot?: string;
};

export function createValidationContext(options: ValidationOptions = {}): ValidationContext {
  return {
    diagnostics: [],
    externalValidationEnabled: options.externalValidationEnabled ?? false,
    repoRoot: options.repoRoot ?? process.cwd(),
  };
}

function report(
  context: ValidationContext,
  severity: Severity,
  ruleId: string,
  filePath: string,
  message: string,
  pointer?: string,
): void {
  context.diagnostics.push({
    filePath,
    message,
    ruleId,
    severity,
    ...(pointer === undefined ? {} : { pointer }),
  });
}

export function error(
  context: ValidationContext,
  ruleId: string,
  filePath: string,
  message: string,
  pointer?: string,
): void {
  report(context, "error", ruleId, filePath, message, pointer);
}

export function warning(
  context: ValidationContext,
  ruleId: string,
  filePath: string,
  message: string,
  pointer?: string,
): void {
  report(context, "warning", ruleId, filePath, message, pointer);
}
