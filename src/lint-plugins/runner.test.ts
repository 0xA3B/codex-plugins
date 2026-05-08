import { rm } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { lintPlugins } from "./runner.js";
import { ruleIds, withTempRepo, writeValidPluginRepo } from "./test-utils.js";

describe("lint runner", () => {
  it("returns a clean result for a valid local plugin marketplace", async () => {
    await withTempRepo(async (repoRoot) => {
      await writeValidPluginRepo(repoRoot);

      const result = await lintPlugins({ repoRoot });

      expect(result.errorCount).toBe(0);
      expect(result.warningCount).toBe(0);
      expect(result.catalog.localEntries.size).toBe(1);
    });
  });

  it("reports repo-required OpenAI metadata through the result object", async () => {
    await withTempRepo(async (repoRoot) => {
      await writeValidPluginRepo(repoRoot);
      await rm(path.join(repoRoot, "plugins/demo-plugin/skills/hello/agents/openai.yaml"));

      const result = await lintPlugins({ repoRoot });

      expect(result.errorCount).toBe(1);
      expect(ruleIds(result.context)).toContain("repo/openai-metadata-required");
    });
  });
});
