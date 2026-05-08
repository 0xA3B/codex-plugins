import { describe, expect, it } from "vitest";

import {
  createTestContext,
  diagnosticPointers,
  ruleIds,
  validSkillMarkdown,
  withTempRepo,
  writeText,
} from "../test-utils.js";
import { validateSkillFrontmatter } from "./agentskills.js";

describe("Agent Skills frontmatter validation", () => {
  it("accepts a spec-shaped SKILL.md", async () => {
    await withTempRepo(async (repoRoot) => {
      const skillPath = await writeText(
        repoRoot,
        "skills/hello/SKILL.md",
        validSkillMarkdown({
          body: "# Hello\n\nFollow the fixture workflow.",
          frontmatter: {
            "allowed-tools": "Bash",
            compatibility: "Codex",
            description: "Use when a test needs a valid skill.",
            license: "MIT",
            metadata: { source: "fixture" },
            name: "hello",
          },
        }),
      );
      const context = createTestContext(repoRoot);

      await validateSkillFrontmatter(context, "hello", skillPath);

      expect(context.diagnostics).toEqual([]);
    });
  });

  it("reports official spec field and body problems by rule ID", async () => {
    await withTempRepo(async (repoRoot) => {
      const skillPath = await writeText(
        repoRoot,
        "skills/Bad--Name/SKILL.md",
        validSkillMarkdown({
          body: "",
          frontmatter: {
            description: "Use when a test needs an invalid skill.",
            metadata: { source: { nested: "value" } },
            name: "Bad--Name",
            unknown: "value",
          },
        }),
      );
      const context = createTestContext(repoRoot);

      await validateSkillFrontmatter(context, "Bad--Name", skillPath);

      expect(ruleIds(context)).toEqual(
        expect.arrayContaining([
          "agentskills/body",
          "agentskills/frontmatter-key",
          "agentskills/name-format",
          "agentskills/metadata",
        ]),
      );
      expect(diagnosticPointers(context, "agentskills/frontmatter-key")).toContain(
        "/frontmatter/unknown",
      );
    });
  });

  it("keeps repo-specific invocation policy out of SKILL.md", async () => {
    await withTempRepo(async (repoRoot) => {
      const skillPath = await writeText(
        repoRoot,
        "skills/manual/SKILL.md",
        validSkillMarkdown({
          body: "# Manual",
          frontmatter: {
            "disable-model-invocation": true,
            description: "Use when a test needs an invalid repo policy key.",
            name: "manual",
          },
        }),
      );
      const context = createTestContext(repoRoot);

      await validateSkillFrontmatter(context, "manual", skillPath);

      expect(ruleIds(context)).toEqual(["repo/unsupported-skill-key"]);
    });
  });
});
