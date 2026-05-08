import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CodexRunOptions = {
  codexHome: string;
  workspacePath: string;
  prompt: string;
  caseDir: string;
  timeoutMs: number;
  model?: string;
  abortSignal?: AbortSignal;
};

export type CodexRunResult = {
  exitCode: number | null;
  finalMessage: string;
  stderr: string;
  stdoutPath: string;
  stderrPath: string;
  finalMessagePath: string;
  error?: string;
};

export async function runCodexExec(options: CodexRunOptions): Promise<CodexRunResult> {
  await mkdir(options.caseDir, { recursive: true });
  const stdoutPath = path.join(options.caseDir, "events.jsonl");
  const stderrPath = path.join(options.caseDir, "stderr.log");
  const finalMessagePath = path.join(options.caseDir, "final.txt");

  const args = [
    "-a",
    "never",
    "-s",
    "read-only",
    "exec",
    "--json",
    "--ephemeral",
    "--skip-git-repo-check",
    "--ignore-rules",
    "--color",
    "never",
    "-C",
    options.workspacePath,
    "-o",
    finalMessagePath,
  ];

  if (options.model !== undefined) {
    args.push("--model", options.model);
  }

  args.push("--", options.prompt);

  const result = await spawnCodex(args, {
    CODEX_HOME: options.codexHome,
    timeoutMs: options.timeoutMs,
    ...(options.abortSignal === undefined ? {} : { abortSignal: options.abortSignal }),
  });

  await writeFile(stdoutPath, result.stdout);
  await writeFile(stderrPath, result.stderr);

  const finalMessage = await readFinalMessage(finalMessagePath, result.stdout);
  const baseResult = {
    exitCode: result.exitCode,
    finalMessage,
    stderr: result.stderr,
    stdoutPath,
    stderrPath,
    finalMessagePath,
  };

  if (result.error === undefined && result.exitCode === 0) {
    return baseResult;
  }

  return {
    ...baseResult,
    error: result.error ?? `codex exec exited with code ${result.exitCode}.`,
  };
}

type SpawnCodexResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error?: string;
};

function spawnCodex(
  args: string[],
  options: {
    CODEX_HOME: string;
    timeoutMs: number;
    abortSignal?: AbortSignal;
  },
): Promise<SpawnCodexResult> {
  return new Promise((resolve) => {
    const resolveResult = (exitCode: number | null, error?: string): void => {
      resolve({
        exitCode,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        ...(error === undefined ? {} : { error }),
      });
    };

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const child = spawn("codex", args, {
      env: { ...process.env, CODEX_HOME: options.CODEX_HOME },
      killSignal: "SIGTERM",
      ...(options.abortSignal === undefined ? {} : { signal: options.abortSignal }),
      stdio: ["ignore", "pipe", "pipe"],
      timeout: options.timeoutMs,
    });

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
    child.on("error", (caught) => {
      const error = options.abortSignal?.aborted === true ? "codex exec aborted." : caught.message;
      resolveResult(null, error);
    });

    child.on("close", (exitCode, signal) => {
      const aborted = options.abortSignal?.aborted === true;
      const timedOut = exitCode === null && signal === "SIGTERM" && !aborted;
      const error = aborted
        ? "codex exec aborted."
        : timedOut
          ? `codex exec timed out after ${options.timeoutMs}ms.`
          : undefined;
      resolveResult(exitCode, error);
    });
  });
}

async function readFinalMessage(finalMessagePath: string, stdout: string): Promise<string> {
  try {
    return await readFile(finalMessagePath, "utf8");
  } catch {
    return parseLastAgentMessage(stdout);
  }
}

function parseLastAgentMessage(stdout: string): string {
  let finalMessage = "";
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.startsWith("{")) {
      continue;
    }

    try {
      const parsed = JSON.parse(line) as { type?: string; item?: { type?: string; text?: string } };
      if (parsed.type === "item.completed" && parsed.item?.type === "agent_message") {
        finalMessage = parsed.item.text ?? "";
      }
    } catch {
      // Ignore non-event output.
    }
  }

  return finalMessage;
}
