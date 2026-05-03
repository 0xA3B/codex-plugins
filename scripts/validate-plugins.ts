import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { parse as parseYaml } from "yaml";

type JsonObject = Record<string, unknown>;

type ValidationIssue = {
  path: string;
  message: string;
};

const repoRoot = process.cwd();
const issues: ValidationIssue[] = [];

function fail(filePath: string, message: string): void {
  issues.push({ path: path.relative(repoRoot, filePath), message });
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getObject(parent: JsonObject, key: string, filePath: string): JsonObject | undefined {
  const value = parent[key];

  if (!isObject(value)) {
    fail(filePath, `Expected "${key}" to be an object.`);
    return undefined;
  }

  return value;
}

function getString(parent: JsonObject, key: string, filePath: string): string | undefined {
  const value = parent[key];

  if (typeof value !== "string" || value.length === 0) {
    fail(filePath, `Expected "${key}" to be a non-empty string.`);
    return undefined;
  }

  return value;
}

function getBoolean(parent: JsonObject, key: string, filePath: string): boolean | undefined {
  const value = parent[key];

  if (typeof value !== "boolean") {
    fail(filePath, `Expected "${key}" to be a boolean.`);
    return undefined;
  }

  return value;
}

function getOptionalString(parent: JsonObject, key: string, filePath: string): string | undefined {
  const value = parent[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || value.length === 0) {
    fail(filePath, `Expected "${key}" to be a non-empty string when provided.`);
    return undefined;
  }

  return value;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isDirectory();
  } catch {
    return false;
  }
}

async function readJsonObject(filePath: string): Promise<JsonObject | undefined> {
  try {
    const parsed: unknown = JSON.parse(await readFile(filePath, "utf8"));

    if (!isObject(parsed)) {
      fail(filePath, "Expected root value to be an object.");
      return undefined;
    }

    return parsed;
  } catch (error) {
    fail(filePath, `Unable to parse JSON: ${errorMessage(error)}`);
    return undefined;
  }
}

async function readYamlObject(filePath: string): Promise<JsonObject | undefined> {
  try {
    const parsed: unknown = parseYaml(await readFile(filePath, "utf8"));

    if (!isObject(parsed)) {
      fail(filePath, "Expected root value to be an object.");
      return undefined;
    }

    return parsed;
  } catch (error) {
    fail(filePath, `Unable to parse YAML: ${errorMessage(error)}`);
    return undefined;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function resolveRepoPath(reference: string): string | undefined {
  const resolved = path.resolve(repoRoot, reference);
  const relative = path.relative(repoRoot, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return undefined;
  }

  return resolved;
}

async function validateMarketplace(): Promise<Map<string, string>> {
  const marketplacePath = path.join(repoRoot, ".agents", "plugins", "marketplace.json");
  const marketplace = await readJsonObject(marketplacePath);
  const catalogEntries = new Map<string, string>();

  if (marketplace === undefined) {
    return catalogEntries;
  }

  getString(marketplace, "name", marketplacePath);
  const marketplaceInterface = getObject(marketplace, "interface", marketplacePath);
  if (marketplaceInterface !== undefined) {
    getString(marketplaceInterface, "displayName", marketplacePath);
  }

  const plugins = marketplace.plugins;
  if (!Array.isArray(plugins)) {
    fail(marketplacePath, 'Expected "plugins" to be an array.');
    return catalogEntries;
  }

  for (const [index, plugin] of plugins.entries()) {
    const entryPath = `${marketplacePath}#plugins[${index}]`;

    if (!isObject(plugin)) {
      fail(marketplacePath, `Expected plugins[${index}] to be an object.`);
      continue;
    }

    const name = getString(plugin, "name", entryPath);
    const category = getString(plugin, "category", entryPath);
    const source = getObject(plugin, "source", entryPath);
    const policy = getObject(plugin, "policy", entryPath);

    if (category !== undefined && category !== "Productivity") {
      fail(entryPath, 'Expected "category" to be "Productivity".');
    }

    if (policy !== undefined) {
      getString(policy, "installation", entryPath);
      getString(policy, "authentication", entryPath);
    }

    if (name === undefined || source === undefined) {
      continue;
    }

    if (catalogEntries.has(name)) {
      fail(entryPath, `Duplicate marketplace plugin name "${name}".`);
    }

    const sourceType = getString(source, "source", entryPath);
    const sourcePath = getString(source, "path", entryPath);

    if (sourceType !== undefined && sourceType !== "local") {
      fail(entryPath, 'Expected source.source to be "local".');
    }

    if (sourcePath === undefined) {
      continue;
    }

    const pluginPath = resolveRepoPath(sourcePath);
    if (pluginPath === undefined) {
      fail(entryPath, `Plugin path escapes the repository: ${sourcePath}`);
      continue;
    }

    if (!(await isDirectory(pluginPath))) {
      fail(entryPath, `Plugin path does not exist or is not a directory: ${sourcePath}`);
      continue;
    }

    catalogEntries.set(name, pluginPath);
  }

  return catalogEntries;
}

async function validatePlugin(catalogName: string, pluginPath: string): Promise<void> {
  const manifestPath = path.join(pluginPath, ".codex-plugin", "plugin.json");
  const manifest = await readJsonObject(manifestPath);

  if (manifest === undefined) {
    return;
  }

  const manifestName = getString(manifest, "name", manifestPath);
  getString(manifest, "version", manifestPath);
  getString(manifest, "description", manifestPath);
  getString(manifest, "repository", manifestPath);
  getString(manifest, "skills", manifestPath);

  if (manifestName !== undefined && manifestName !== catalogName) {
    fail(
      manifestPath,
      `Manifest name "${manifestName}" does not match catalog name "${catalogName}".`,
    );
  }

  const author = getObject(manifest, "author", manifestPath);
  if (author !== undefined) {
    getString(author, "name", manifestPath);
  }

  const manifestInterface = getObject(manifest, "interface", manifestPath);
  if (manifestInterface !== undefined) {
    getString(manifestInterface, "displayName", manifestPath);
    getString(manifestInterface, "shortDescription", manifestPath);
    getString(manifestInterface, "longDescription", manifestPath);
    getString(manifestInterface, "developerName", manifestPath);
    getString(manifestInterface, "category", manifestPath);
    validateStringArray(manifestInterface.capabilities, "interface.capabilities", manifestPath);
    validateStringArray(manifestInterface.defaultPrompt, "interface.defaultPrompt", manifestPath);
  }

  const skillsReference = typeof manifest.skills === "string" ? manifest.skills : "./skills/";
  const skillsPath = resolveRepoPath(
    path.join(path.relative(repoRoot, pluginPath), skillsReference),
  );

  if (skillsPath === undefined || !(await isDirectory(skillsPath))) {
    fail(manifestPath, `Skills path does not exist or is not a directory: ${skillsReference}`);
    return;
  }

  await validateSkills(skillsPath);
}

function validateStringArray(value: unknown, key: string, filePath: string): void {
  if (!Array.isArray(value) || value.length === 0) {
    fail(filePath, `Expected "${key}" to be a non-empty string array.`);
    return;
  }

  for (const [index, item] of value.entries()) {
    if (typeof item !== "string" || item.length === 0) {
      fail(filePath, `Expected "${key}[${index}]" to be a non-empty string.`);
    }
  }
}

async function validateSkills(skillsPath: string): Promise<void> {
  const entries = await readdir(skillsPath, { withFileTypes: true });
  const skillDirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (skillDirs.length === 0) {
    fail(skillsPath, "Expected at least one skill directory.");
  }

  for (const skillName of skillDirs) {
    const skillPath = path.join(skillsPath, skillName);
    await validateSkill(skillName, skillPath);
  }
}

async function validateSkill(skillName: string, skillPath: string): Promise<void> {
  const skillFilePath = path.join(skillPath, "SKILL.md");
  if (!(await pathExists(skillFilePath))) {
    fail(skillFilePath, "Missing SKILL.md.");
    return;
  }

  await validateSkillFrontmatter(skillName, skillFilePath);
  await validateOpenAiMetadata(skillName, path.join(skillPath, "agents", "openai.yaml"));
}

async function validateSkillFrontmatter(skillName: string, skillFilePath: string): Promise<void> {
  const content = await readFile(skillFilePath, "utf8");
  const frontmatter = content.match(/^---\n(?<yaml>[\s\S]*?)\n---\n/);

  if (frontmatter?.groups?.yaml === undefined) {
    fail(skillFilePath, "Missing YAML frontmatter.");
    return;
  }

  const parsed: unknown = parseYaml(frontmatter.groups.yaml);
  if (!isObject(parsed)) {
    fail(skillFilePath, "Expected frontmatter to be an object.");
    return;
  }

  const name = getString(parsed, "name", skillFilePath);
  const description = getString(parsed, "description", skillFilePath);
  const license = getOptionalString(parsed, "license", skillFilePath);
  const compatibility = getOptionalString(parsed, "compatibility", skillFilePath);
  getOptionalString(parsed, "allowed-tools", skillFilePath);

  if (name !== undefined && name !== skillName) {
    fail(skillFilePath, `Frontmatter name "${name}" does not match directory "${skillName}".`);
  }

  if (name !== undefined && !/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(name)) {
    fail(skillFilePath, 'Frontmatter "name" must be 1-64 lowercase letters, numbers, or hyphens.');
  }

  if (name !== undefined && name.includes("--")) {
    fail(skillFilePath, 'Frontmatter "name" must not contain consecutive hyphens.');
  }

  if (description !== undefined && description.length > 1024) {
    fail(skillFilePath, 'Frontmatter "description" must be 1024 characters or fewer.');
  }

  if (license !== undefined && license.length > 200) {
    fail(skillFilePath, 'Frontmatter "license" should be a short license name or file reference.');
  }

  if (compatibility !== undefined && compatibility.length > 500) {
    fail(skillFilePath, 'Frontmatter "compatibility" must be 500 characters or fewer.');
  }

  if (Object.hasOwn(parsed, "disable-model-invocation")) {
    fail(
      skillFilePath,
      'Unsupported frontmatter key "disable-model-invocation"; use agents/openai.yaml policy.allow_implicit_invocation instead.',
    );
  }

  const metadata = parsed.metadata;
  if (metadata !== undefined) {
    if (!isObject(metadata)) {
      fail(skillFilePath, 'Expected frontmatter "metadata" to be an object when provided.');
      return;
    }

    for (const [key, value] of Object.entries(metadata)) {
      if (typeof value !== "string") {
        fail(skillFilePath, `Expected frontmatter "metadata.${key}" to be a string.`);
      }
    }
  }
}

async function validateOpenAiMetadata(skillName: string, metadataPath: string): Promise<void> {
  const metadata = await readYamlObject(metadataPath);

  if (metadata === undefined) {
    return;
  }

  if (metadata.version !== 1) {
    fail(metadataPath, 'Expected "version" to be 1.');
  }

  const metadataInterface = getObject(metadata, "interface", metadataPath);
  if (metadataInterface !== undefined) {
    getString(metadataInterface, "display_name", metadataPath);
    getString(metadataInterface, "short_description", metadataPath);
    const defaultPrompt = metadataInterface.default_prompt;
    const isValidPrompt =
      typeof defaultPrompt === "string" ||
      (Array.isArray(defaultPrompt) &&
        defaultPrompt.every((item) => typeof item === "string" && item.length > 0));

    if (!isValidPrompt) {
      fail(metadataPath, 'Expected "interface.default_prompt" to be a string or string array.');
    }
  }

  const policy = getObject(metadata, "policy", metadataPath);
  if (policy !== undefined) {
    getBoolean(policy, "allow_implicit_invocation", metadataPath);
  }

  const frontmatterName = path.basename(path.dirname(path.dirname(metadataPath)));
  if (frontmatterName !== skillName) {
    fail(metadataPath, `Metadata path does not match skill directory "${skillName}".`);
  }
}

async function validateCatalogCoverage(catalogEntries: Map<string, string>): Promise<void> {
  const pluginsRoot = path.join(repoRoot, "plugins");
  const pluginDirs = await readdir(pluginsRoot, { withFileTypes: true });
  const catalogPaths = new Set(
    [...catalogEntries.values()].map((pluginPath) => path.resolve(pluginPath)),
  );

  for (const pluginDir of pluginDirs) {
    if (!pluginDir.isDirectory()) {
      continue;
    }

    const pluginPath = path.join(pluginsRoot, pluginDir.name);
    const manifestPath = path.join(pluginPath, ".codex-plugin", "plugin.json");

    if ((await pathExists(manifestPath)) && !catalogPaths.has(pluginPath)) {
      fail(pluginPath, "Plugin has a Codex manifest but is missing from the marketplace catalog.");
    }
  }
}

async function main(): Promise<void> {
  const catalogEntries = await validateMarketplace();
  await validateCatalogCoverage(catalogEntries);

  for (const [pluginName, pluginPath] of catalogEntries) {
    await validatePlugin(pluginName, pluginPath);
  }

  if (issues.length > 0) {
    console.error(`Plugin validation failed with ${issues.length} issue(s):`);
    for (const issue of issues) {
      console.error(`- ${issue.path}: ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Validated ${catalogEntries.size} plugin(s).`);
}

main().catch((error: unknown) => {
  console.error(errorMessage(error));
  process.exitCode = 1;
});
