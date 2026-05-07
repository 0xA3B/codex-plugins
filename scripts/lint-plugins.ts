import { execFile } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { parse as parseYaml } from "yaml";

type JsonObject = Record<string, unknown>;
type Severity = "error" | "warning";

type Diagnostic = {
  filePath: string;
  message: string;
  ruleId: string;
  severity: Severity;
  pointer?: string;
};

type ValidationContext = {
  diagnostics: Diagnostic[];
  externalValidationEnabled: boolean;
  repoRoot: string;
};

type LocalCatalogEntry = {
  category: string | undefined;
  manifestPath: string;
  name: string;
  pluginPath: string;
  pointer: string;
  sourcePath: string;
};

type RemoteCatalogEntry = {
  name: string;
  pointer: string;
  source: JsonObject;
};

type Catalog = {
  localEntries: Map<string, LocalCatalogEntry>;
  marketplacePath: string;
  remoteEntries: RemoteCatalogEntry[];
};

type ComponentPathRule = {
  expectedKind: "directory" | "file";
  fieldName: string;
  pointer: string;
  value: unknown;
};

const execFileAsync = promisify(execFile);

function createValidationContext(): ValidationContext {
  return {
    diagnostics: [],
    externalValidationEnabled: process.argv.includes("--external"),
    repoRoot: process.cwd(),
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

function error(
  context: ValidationContext,
  ruleId: string,
  filePath: string,
  message: string,
  pointer?: string,
): void {
  report(context, "error", ruleId, filePath, message, pointer);
}

function warning(
  context: ValidationContext,
  ruleId: string,
  filePath: string,
  message: string,
  pointer?: string,
): void {
  report(context, "warning", ruleId, filePath, message, pointer);
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getObject(
  context: ValidationContext,
  parent: JsonObject,
  key: string,
  filePath: string,
  pointer: string,
): JsonObject | undefined {
  const value = parent[key];

  if (!isObject(value)) {
    error(context, "schema/object", filePath, `Expected "${key}" to be an object.`, pointer);
    return undefined;
  }

  return value;
}

function getOptionalObject(
  context: ValidationContext,
  parent: JsonObject,
  key: string,
  filePath: string,
  pointer: string,
): JsonObject | undefined {
  const value = parent[key];

  if (value === undefined) {
    return undefined;
  }

  if (!isObject(value)) {
    error(
      context,
      "schema/object",
      filePath,
      `Expected "${key}" to be an object when provided.`,
      pointer,
    );
    return undefined;
  }

  return value;
}

function getString(
  context: ValidationContext,
  parent: JsonObject,
  key: string,
  filePath: string,
  pointer: string,
): string | undefined {
  const value = parent[key];

  if (typeof value !== "string" || value.length === 0) {
    error(
      context,
      "schema/string",
      filePath,
      `Expected "${key}" to be a non-empty string.`,
      pointer,
    );
    return undefined;
  }

  return value;
}

function getOptionalString(
  context: ValidationContext,
  parent: JsonObject,
  key: string,
  filePath: string,
  pointer: string,
): string | undefined {
  const value = parent[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || value.length === 0) {
    error(
      context,
      "schema/string",
      filePath,
      `Expected "${key}" to be a non-empty string when provided.`,
      pointer,
    );
    return undefined;
  }

  return value;
}

function getBoolean(
  context: ValidationContext,
  parent: JsonObject,
  key: string,
  filePath: string,
  pointer: string,
): boolean | undefined {
  const value = parent[key];

  if (typeof value !== "boolean") {
    error(context, "schema/boolean", filePath, `Expected "${key}" to be a boolean.`, pointer);
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

async function isFile(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

async function readJsonObject(
  context: ValidationContext,
  filePath: string,
): Promise<JsonObject | undefined> {
  try {
    const parsed: unknown = JSON.parse(await readFile(filePath, "utf8"));

    if (!isObject(parsed)) {
      error(context, "schema/root-object", filePath, "Expected root value to be an object.");
      return undefined;
    }

    return parsed;
  } catch (readError) {
    error(context, "parse/json", filePath, `Unable to parse JSON: ${errorMessage(readError)}`);
    return undefined;
  }
}

async function readYamlObject(
  context: ValidationContext,
  filePath: string,
): Promise<JsonObject | undefined> {
  try {
    const parsed: unknown = parseYaml(await readFile(filePath, "utf8"));

    if (!isObject(parsed)) {
      error(context, "schema/root-object", filePath, "Expected root value to be an object.");
      return undefined;
    }

    return parsed;
  } catch (readError) {
    error(context, "parse/yaml", filePath, `Unable to parse YAML: ${errorMessage(readError)}`);
    return undefined;
  }
}

function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}

function relativeDisplay(context: ValidationContext, filePath: string, pointer?: string): string {
  const relativePath = path.relative(context.repoRoot, filePath);
  return pointer === undefined ? relativePath : `${relativePath}${pointer}`;
}

function isInside(baseDir: string, targetPath: string): boolean {
  const relativePath = path.relative(baseDir, targetPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function resolveRelativePath(
  context: ValidationContext,
  reference: string,
  baseDir: string,
  filePath: string,
  pointer: string,
  ruleId: string,
): string | undefined {
  if (!reference.startsWith("./")) {
    error(context, ruleId, filePath, `Path must start with "./": ${reference}`, pointer);
    return undefined;
  }

  if (path.isAbsolute(reference)) {
    error(context, ruleId, filePath, `Path must be relative, not absolute: ${reference}`, pointer);
    return undefined;
  }

  const resolved = path.resolve(baseDir, reference);
  if (!isInside(baseDir, resolved)) {
    const baseLabel = path.relative(context.repoRoot, baseDir) || ".";
    error(context, ruleId, filePath, `Path must stay inside ${baseLabel}: ${reference}`, pointer);
    return undefined;
  }

  return resolved;
}

function marketplaceRootFromPath(marketplacePath: string): string {
  return path.resolve(path.dirname(marketplacePath), "..", "..");
}

function validateStringArray(
  context: ValidationContext,
  value: unknown,
  key: string,
  filePath: string,
  pointer: string,
  options: { required: boolean },
): string[] | undefined {
  if (value === undefined && !options.required) {
    return undefined;
  }

  if (!Array.isArray(value) || value.length === 0) {
    error(
      context,
      "schema/string-array",
      filePath,
      `Expected "${key}" to be a non-empty string array.`,
      pointer,
    );
    return undefined;
  }

  const strings: string[] = [];
  for (const [index, item] of value.entries()) {
    if (typeof item !== "string" || item.length === 0) {
      error(
        context,
        "schema/string-array",
        filePath,
        `Expected "${key}[${index}]" to be a non-empty string.`,
        `${pointer}/${index}`,
      );
      continue;
    }

    strings.push(item);
  }

  return strings;
}

function parseHttpUrlString(
  context: ValidationContext,
  value: string | undefined,
  filePath: string,
  pointer: string,
  ruleId: string,
): URL | undefined {
  if (value === undefined) {
    return undefined;
  }

  try {
    const parsedUrl = new URL(value);
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      error(context, ruleId, filePath, `Expected an HTTP(S) URL: ${value}`, pointer);
      return undefined;
    }

    return parsedUrl;
  } catch {
    error(context, ruleId, filePath, `Expected a valid URL: ${value}`, pointer);
    return undefined;
  }
}

function validateUrlString(
  context: ValidationContext,
  value: string | undefined,
  filePath: string,
  pointer: string,
  ruleId: string,
): void {
  parseHttpUrlString(context, value, filePath, pointer, ruleId);
}

function validateGitUrlString(
  context: ValidationContext,
  value: string | undefined,
  filePath: string,
  pointer: string,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    value.startsWith("git@") ||
    value.startsWith("ssh://") ||
    value.startsWith("https://") ||
    value.startsWith("http://")
  ) {
    return value;
  }

  error(context, "url/git", filePath, `Expected a Git URL or SSH Git shorthand: ${value}`, pointer);
  return undefined;
}

async function validateMarketplace(context: ValidationContext): Promise<Catalog> {
  const marketplacePath = path.join(context.repoRoot, ".agents", "plugins", "marketplace.json");
  const marketplaceRoot = marketplaceRootFromPath(marketplacePath);
  const marketplace = await readJsonObject(context, marketplacePath);
  const localEntries = new Map<string, LocalCatalogEntry>();
  const remoteEntries: RemoteCatalogEntry[] = [];
  const seenNames = new Set<string>();

  if (marketplace === undefined) {
    return { localEntries, marketplacePath, remoteEntries };
  }

  getString(context, marketplace, "name", marketplacePath, "/name");
  const marketplaceInterface = getObject(
    context,
    marketplace,
    "interface",
    marketplacePath,
    "/interface",
  );
  if (marketplaceInterface !== undefined) {
    getString(
      context,
      marketplaceInterface,
      "displayName",
      marketplacePath,
      "/interface/displayName",
    );
  }

  const plugins = marketplace.plugins;
  if (!Array.isArray(plugins)) {
    error(
      context,
      "marketplace/plugins",
      marketplacePath,
      'Expected "plugins" to be an array.',
      "/plugins",
    );
    return { localEntries, marketplacePath, remoteEntries };
  }

  for (const [index, plugin] of plugins.entries()) {
    const pointer = `/plugins/${index}`;

    if (!isObject(plugin)) {
      error(
        context,
        "schema/object",
        marketplacePath,
        `Expected plugins[${index}] to be an object.`,
        pointer,
      );
      continue;
    }

    const name = getString(context, plugin, "name", marketplacePath, `${pointer}/name`);
    const category = getString(context, plugin, "category", marketplacePath, `${pointer}/category`);
    const policy = getObject(context, plugin, "policy", marketplacePath, `${pointer}/policy`);

    if (policy !== undefined) {
      validatePolicy(context, policy, marketplacePath, `${pointer}/policy`);
    }

    if (name !== undefined && seenNames.has(name)) {
      error(
        context,
        "marketplace/duplicate-name",
        marketplacePath,
        `Duplicate marketplace plugin name "${name}".`,
        `${pointer}/name`,
      );
    }

    if (name === undefined) {
      continue;
    }
    seenNames.add(name);

    const source = plugin.source;
    if (typeof source === "string") {
      const pluginPath = await validateLocalMarketplacePath(
        context,
        name,
        source,
        category,
        marketplacePath,
        marketplaceRoot,
        `${pointer}/source`,
      );
      if (pluginPath !== undefined) {
        localEntries.set(name, pluginPath);
      }
      continue;
    }

    if (!isObject(source)) {
      error(
        context,
        "schema/object",
        marketplacePath,
        'Expected "source" to be an object or local path string.',
        `${pointer}/source`,
      );
      continue;
    }

    const sourceType = getString(
      context,
      source,
      "source",
      marketplacePath,
      `${pointer}/source/source`,
    );
    if (sourceType === "local") {
      const sourcePath = getString(
        context,
        source,
        "path",
        marketplacePath,
        `${pointer}/source/path`,
      );
      if (sourcePath === undefined) {
        continue;
      }

      const pluginPath = await validateLocalMarketplacePath(
        context,
        name,
        sourcePath,
        category,
        marketplacePath,
        marketplaceRoot,
        `${pointer}/source/path`,
      );
      if (pluginPath !== undefined) {
        localEntries.set(name, pluginPath);
      }
    } else if (sourceType === "url" || sourceType === "git-subdir") {
      validateRemoteMarketplaceSource(context, source, sourceType, marketplacePath, pointer);
      remoteEntries.push({ name, pointer, source });
    } else if (sourceType !== undefined) {
      error(
        context,
        "marketplace/source-type",
        marketplacePath,
        'Expected source.source to be "local", "url", or "git-subdir".',
        `${pointer}/source/source`,
      );
    }
  }

  return { localEntries, marketplacePath, remoteEntries };
}

function validatePolicy(
  context: ValidationContext,
  policy: JsonObject,
  filePath: string,
  pointer: string,
): void {
  const installation = getString(
    context,
    policy,
    "installation",
    filePath,
    `${pointer}/installation`,
  );
  const authentication = getString(
    context,
    policy,
    "authentication",
    filePath,
    `${pointer}/authentication`,
  );

  if (
    installation !== undefined &&
    !["AVAILABLE", "INSTALLED_BY_DEFAULT", "NOT_AVAILABLE"].includes(installation)
  ) {
    error(
      context,
      "marketplace/policy-installation",
      filePath,
      'Expected policy.installation to be "AVAILABLE", "INSTALLED_BY_DEFAULT", or "NOT_AVAILABLE".',
      `${pointer}/installation`,
    );
  }

  if (authentication !== undefined && !["ON_INSTALL", "ON_FIRST_USE"].includes(authentication)) {
    error(
      context,
      "marketplace/policy-authentication",
      filePath,
      'Expected policy.authentication to be "ON_INSTALL" or "ON_FIRST_USE".',
      `${pointer}/authentication`,
    );
  }
}

async function validateLocalMarketplacePath(
  context: ValidationContext,
  name: string,
  sourcePath: string,
  category: string | undefined,
  marketplacePath: string,
  marketplaceRoot: string,
  pointer: string,
): Promise<LocalCatalogEntry | undefined> {
  const pluginPath = resolveRelativePath(
    context,
    sourcePath,
    marketplaceRoot,
    marketplacePath,
    pointer,
    "marketplace/source-path",
  );

  if (pluginPath === undefined) {
    return undefined;
  }

  if (!(await isDirectory(pluginPath))) {
    error(
      context,
      "marketplace/source-exists",
      marketplacePath,
      `Plugin path does not exist or is not a directory: ${sourcePath}`,
      pointer,
    );
    return undefined;
  }

  const manifestPath = path.join(pluginPath, ".codex-plugin", "plugin.json");
  if (!(await isFile(manifestPath))) {
    error(
      context,
      "marketplace/source-manifest",
      marketplacePath,
      `Plugin path is missing .codex-plugin/plugin.json: ${sourcePath}`,
      pointer,
    );
    return undefined;
  }

  return { category, manifestPath, name, pluginPath, pointer, sourcePath };
}

function validateRemoteMarketplaceSource(
  context: ValidationContext,
  source: JsonObject,
  sourceType: string,
  marketplacePath: string,
  pluginPointer: string,
): void {
  const sourcePointer = `${pluginPointer}/source`;
  const url = getString(context, source, "url", marketplacePath, `${sourcePointer}/url`);
  validateGitUrlString(context, url, marketplacePath, `${sourcePointer}/url`);

  const pathValue = getOptionalString(
    context,
    source,
    "path",
    marketplacePath,
    `${sourcePointer}/path`,
  );
  if (sourceType === "git-subdir") {
    if (pathValue === undefined) {
      error(
        context,
        "marketplace/git-subdir-path",
        marketplacePath,
        'Expected git-subdir source to include a "./"-prefixed path.',
        `${sourcePointer}/path`,
      );
    } else {
      resolveRelativePath(
        context,
        pathValue,
        context.repoRoot,
        marketplacePath,
        `${sourcePointer}/path`,
        "marketplace/git-subdir-path",
      );
    }
  }

  const ref = getOptionalString(context, source, "ref", marketplacePath, `${sourcePointer}/ref`);
  const sha = getOptionalString(context, source, "sha", marketplacePath, `${sourcePointer}/sha`);
  if (ref !== undefined && sha !== undefined) {
    error(
      context,
      "marketplace/ref-or-sha",
      marketplacePath,
      "Use either source.ref or source.sha, not both.",
      sourcePointer,
    );
  }
}

async function validatePlugin(
  context: ValidationContext,
  entry: LocalCatalogEntry,
): Promise<JsonObject | undefined> {
  const manifest = await readJsonObject(context, entry.manifestPath);

  if (manifest === undefined) {
    return undefined;
  }

  const manifestName = getString(context, manifest, "name", entry.manifestPath, "/name");
  getString(context, manifest, "version", entry.manifestPath, "/version");
  getString(context, manifest, "description", entry.manifestPath, "/description");

  const repository = getOptionalString(
    context,
    manifest,
    "repository",
    entry.manifestPath,
    "/repository",
  );
  validateUrlString(context, repository, entry.manifestPath, "/repository", "url/http");

  const homepage = getOptionalString(
    context,
    manifest,
    "homepage",
    entry.manifestPath,
    "/homepage",
  );
  validateUrlString(context, homepage, entry.manifestPath, "/homepage", "url/http");

  if (manifestName !== undefined && manifestName !== entry.name) {
    error(
      context,
      "alignment/name",
      entry.manifestPath,
      `Manifest name "${manifestName}" does not match marketplace name "${entry.name}".`,
      "/name",
    );
  }

  if (manifestName !== undefined && path.basename(entry.pluginPath) !== manifestName) {
    error(
      context,
      "alignment/directory-name",
      entry.manifestPath,
      `Plugin directory "${path.basename(entry.pluginPath)}" does not match manifest name "${manifestName}".`,
      "/name",
    );
  }

  const author = getOptionalObject(context, manifest, "author", entry.manifestPath, "/author");
  if (author !== undefined) {
    getString(context, author, "name", entry.manifestPath, "/author/name");
    const authorUrl = getOptionalString(context, author, "url", entry.manifestPath, "/author/url");
    validateUrlString(context, authorUrl, entry.manifestPath, "/author/url", "url/http");
    getOptionalString(context, author, "email", entry.manifestPath, "/author/email");
  }

  getOptionalString(context, manifest, "license", entry.manifestPath, "/license");
  validateStringArray(context, manifest.keywords, "keywords", entry.manifestPath, "/keywords", {
    required: false,
  });

  const manifestInterface = getOptionalObject(
    context,
    manifest,
    "interface",
    entry.manifestPath,
    "/interface",
  );
  if (manifestInterface !== undefined) {
    validatePluginInterface(context, manifestInterface, entry);
  }

  await validateComponentPaths(context, manifest, entry);
  return manifest;
}

function validatePluginInterface(
  context: ValidationContext,
  manifestInterface: JsonObject,
  entry: LocalCatalogEntry,
): void {
  getString(
    context,
    manifestInterface,
    "displayName",
    entry.manifestPath,
    "/interface/displayName",
  );
  getString(
    context,
    manifestInterface,
    "shortDescription",
    entry.manifestPath,
    "/interface/shortDescription",
  );
  getString(
    context,
    manifestInterface,
    "longDescription",
    entry.manifestPath,
    "/interface/longDescription",
  );
  getString(
    context,
    manifestInterface,
    "developerName",
    entry.manifestPath,
    "/interface/developerName",
  );
  const interfaceCategory = getString(
    context,
    manifestInterface,
    "category",
    entry.manifestPath,
    "/interface/category",
  );

  if (
    entry.category !== undefined &&
    interfaceCategory !== undefined &&
    entry.category !== interfaceCategory
  ) {
    error(
      context,
      "alignment/category",
      entry.manifestPath,
      `Plugin interface category "${interfaceCategory}" does not match marketplace category "${entry.category}".`,
      "/interface/category",
    );
  }

  validateStringArray(
    context,
    manifestInterface.capabilities,
    "interface.capabilities",
    entry.manifestPath,
    "/interface/capabilities",
    { required: true },
  );
  validateStringArray(
    context,
    manifestInterface.defaultPrompt,
    "interface.defaultPrompt",
    entry.manifestPath,
    "/interface/defaultPrompt",
    { required: false },
  );

  for (const fieldName of ["websiteURL", "privacyPolicyURL", "termsOfServiceURL"]) {
    const url = getOptionalString(
      context,
      manifestInterface,
      fieldName,
      entry.manifestPath,
      `/interface/${fieldName}`,
    );
    validateUrlString(context, url, entry.manifestPath, `/interface/${fieldName}`, "url/http");
  }

  const brandColor = getOptionalString(
    context,
    manifestInterface,
    "brandColor",
    entry.manifestPath,
    "/interface/brandColor",
  );
  if (brandColor !== undefined && !/^#[0-9a-fA-F]{6}$/.test(brandColor)) {
    error(
      context,
      "manifest/brand-color",
      entry.manifestPath,
      "Expected interface.brandColor to be a 6-digit hex color.",
      "/interface/brandColor",
    );
  }
}

async function validateComponentPaths(
  context: ValidationContext,
  manifest: JsonObject,
  entry: LocalCatalogEntry,
): Promise<void> {
  const pathRules: ComponentPathRule[] = [
    {
      expectedKind: "directory",
      fieldName: "skills",
      pointer: "/skills",
      value: manifest.skills,
    },
    {
      expectedKind: "file",
      fieldName: "mcpServers",
      pointer: "/mcpServers",
      value: manifest.mcpServers,
    },
    {
      expectedKind: "file",
      fieldName: "apps",
      pointer: "/apps",
      value: manifest.apps,
    },
  ];

  const manifestInterface = isObject(manifest.interface) ? manifest.interface : undefined;
  if (manifestInterface !== undefined) {
    pathRules.push(
      {
        expectedKind: "file",
        fieldName: "interface.composerIcon",
        pointer: "/interface/composerIcon",
        value: manifestInterface.composerIcon,
      },
      {
        expectedKind: "file",
        fieldName: "interface.logo",
        pointer: "/interface/logo",
        value: manifestInterface.logo,
      },
    );

    if (manifestInterface.screenshots !== undefined) {
      const screenshots = validateStringArray(
        context,
        manifestInterface.screenshots,
        "interface.screenshots",
        entry.manifestPath,
        "/interface/screenshots",
        { required: true },
      );
      if (screenshots !== undefined) {
        for (const [index, screenshot] of screenshots.entries()) {
          pathRules.push({
            expectedKind: "file",
            fieldName: `interface.screenshots[${index}]`,
            pointer: `/interface/screenshots/${index}`,
            value: screenshot,
          });
        }
      }
    }
  }

  await validateManifestPathRules(context, pathRules, entry);
  await validateHooksPath(context, manifest.hooks, entry);
}

async function validateManifestPathRules(
  context: ValidationContext,
  pathRules: ComponentPathRule[],
  entry: LocalCatalogEntry,
): Promise<void> {
  for (const rule of pathRules) {
    if (rule.value === undefined) {
      if (rule.fieldName === "skills") {
        error(
          context,
          "manifest/required-path",
          entry.manifestPath,
          'Expected "skills" to be provided.',
          rule.pointer,
        );
      }
      continue;
    }

    if (typeof rule.value !== "string" || rule.value.length === 0) {
      error(
        context,
        "manifest/path-type",
        entry.manifestPath,
        `Expected "${rule.fieldName}" to be a non-empty string path.`,
        rule.pointer,
      );
      continue;
    }

    const resolved = resolveRelativePath(
      context,
      rule.value,
      entry.pluginPath,
      entry.manifestPath,
      rule.pointer,
      "manifest/path",
    );
    if (resolved === undefined) {
      continue;
    }

    if (rule.expectedKind === "directory" && !(await isDirectory(resolved))) {
      error(
        context,
        "manifest/path-exists",
        entry.manifestPath,
        `Expected "${rule.fieldName}" to point to an existing directory: ${rule.value}`,
        rule.pointer,
      );
    }

    if (rule.expectedKind === "file" && !(await isFile(resolved))) {
      error(
        context,
        "manifest/path-exists",
        entry.manifestPath,
        `Expected "${rule.fieldName}" to point to an existing file: ${rule.value}`,
        rule.pointer,
      );
    }
  }
}

async function validateHooksPath(
  context: ValidationContext,
  value: unknown,
  entry: LocalCatalogEntry,
): Promise<void> {
  if (value === undefined) {
    return;
  }

  if (typeof value === "string") {
    await validateManifestPathRules(
      context,
      [{ expectedKind: "file", fieldName: "hooks", pointer: "/hooks", value }],
      entry,
    );
    return;
  }

  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      if (typeof item === "string") {
        await validateManifestPathRules(
          context,
          [
            {
              expectedKind: "file",
              fieldName: `hooks[${index}]`,
              pointer: `/hooks/${index}`,
              value: item,
            },
          ],
          entry,
        );
      } else if (!isObject(item)) {
        error(
          context,
          "manifest/hooks",
          entry.manifestPath,
          "Expected hooks array items to be file paths or inline lifecycle objects.",
          `/hooks/${index}`,
        );
      }
    }
    return;
  }

  if (!isObject(value)) {
    error(
      context,
      "manifest/hooks",
      entry.manifestPath,
      "Expected hooks to be a file path, inline lifecycle object, or array of those values.",
      "/hooks",
    );
  }
}

async function validateSkillsForEntry(
  context: ValidationContext,
  entry: LocalCatalogEntry,
  manifest: JsonObject,
): Promise<void> {
  const skillsReference = typeof manifest.skills === "string" ? manifest.skills : "./skills/";
  const skillsPath = resolveRelativePath(
    context,
    skillsReference,
    entry.pluginPath,
    entry.manifestPath,
    "/skills",
    "manifest/path",
  );

  if (skillsPath === undefined || !(await isDirectory(skillsPath))) {
    return;
  }

  await validateSkills(context, skillsPath);
}

async function validateSkills(context: ValidationContext, skillsPath: string): Promise<void> {
  const entries = await readdir(skillsPath, { withFileTypes: true });
  const skillDirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (skillDirs.length === 0) {
    error(context, "skills/non-empty", skillsPath, "Expected at least one skill directory.");
  }

  for (const skillName of skillDirs) {
    const skillPath = path.join(skillsPath, skillName);
    await validateSkill(context, skillName, skillPath);
  }
}

async function validateSkill(
  context: ValidationContext,
  skillName: string,
  skillPath: string,
): Promise<void> {
  const skillFilePath = path.join(skillPath, "SKILL.md");
  if (!(await pathExists(skillFilePath))) {
    error(context, "skill/missing-file", skillFilePath, "Missing SKILL.md.");
    return;
  }

  await validateSkillFrontmatter(context, skillName, skillFilePath);
  const metadataPath = path.join(skillPath, "agents", "openai.yaml");
  if (await pathExists(metadataPath)) {
    await validateOpenAiMetadata(context, skillName, metadataPath);
  }
}

async function validateSkillFrontmatter(
  context: ValidationContext,
  skillName: string,
  skillFilePath: string,
): Promise<void> {
  const content = await readFile(skillFilePath, "utf8");
  const frontmatter = content.match(/^---\n(?<yaml>[\s\S]*?)\n---\n/);

  if (frontmatter?.groups?.yaml === undefined) {
    error(context, "skill/frontmatter", skillFilePath, "Missing YAML frontmatter.");
    return;
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(frontmatter.groups.yaml);
  } catch (parseError) {
    error(
      context,
      "parse/yaml",
      skillFilePath,
      `Unable to parse YAML frontmatter: ${errorMessage(parseError)}`,
      "/frontmatter",
    );
    return;
  }

  if (!isObject(parsed)) {
    error(context, "skill/frontmatter", skillFilePath, "Expected frontmatter to be an object.");
    return;
  }

  const name = getString(context, parsed, "name", skillFilePath, "/frontmatter/name");
  const description = getString(
    context,
    parsed,
    "description",
    skillFilePath,
    "/frontmatter/description",
  );
  const license = getOptionalString(
    context,
    parsed,
    "license",
    skillFilePath,
    "/frontmatter/license",
  );
  const compatibility = getOptionalString(
    context,
    parsed,
    "compatibility",
    skillFilePath,
    "/frontmatter/compatibility",
  );
  getOptionalString(context, parsed, "allowed-tools", skillFilePath, "/frontmatter/allowed-tools");

  if (name !== undefined && name !== skillName) {
    error(
      context,
      "skill/name",
      skillFilePath,
      `Frontmatter name "${name}" does not match directory "${skillName}".`,
      "/frontmatter/name",
    );
  }

  if (name !== undefined && !/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(name)) {
    error(
      context,
      "skill/name-format",
      skillFilePath,
      'Frontmatter "name" must be 1-64 lowercase letters, numbers, or hyphens.',
      "/frontmatter/name",
    );
  }

  if (name !== undefined && name.includes("--")) {
    error(
      context,
      "skill/name-format",
      skillFilePath,
      'Frontmatter "name" must not contain consecutive hyphens.',
      "/frontmatter/name",
    );
  }

  if (description !== undefined && description.length > 1024) {
    error(
      context,
      "skill/description-length",
      skillFilePath,
      'Frontmatter "description" must be 1024 characters or fewer.',
      "/frontmatter/description",
    );
  }

  if (license !== undefined && license.length > 200) {
    error(
      context,
      "skill/license-length",
      skillFilePath,
      'Frontmatter "license" should be a short license name or file reference.',
      "/frontmatter/license",
    );
  }

  if (compatibility !== undefined && compatibility.length > 500) {
    error(
      context,
      "skill/compatibility-length",
      skillFilePath,
      'Frontmatter "compatibility" must be 500 characters or fewer.',
      "/frontmatter/compatibility",
    );
  }

  if (Object.hasOwn(parsed, "disable-model-invocation")) {
    error(
      context,
      "skill/unsupported-key",
      skillFilePath,
      'Unsupported frontmatter key "disable-model-invocation"; use agents/openai.yaml policy.allow_implicit_invocation instead.',
      "/frontmatter/disable-model-invocation",
    );
  }

  const metadata = parsed.metadata;
  if (metadata !== undefined) {
    if (!isObject(metadata)) {
      error(
        context,
        "skill/metadata",
        skillFilePath,
        'Expected frontmatter "metadata" to be an object when provided.',
        "/frontmatter/metadata",
      );
      return;
    }

    for (const [key, value] of Object.entries(metadata)) {
      if (typeof value !== "string") {
        error(
          context,
          "skill/metadata",
          skillFilePath,
          `Expected frontmatter "metadata.${key}" to be a string.`,
          `/frontmatter/metadata/${key}`,
        );
      }
    }
  }
}

async function validateOpenAiMetadata(
  context: ValidationContext,
  skillName: string,
  metadataPath: string,
): Promise<void> {
  const metadata = await readYamlObject(context, metadataPath);

  if (metadata === undefined) {
    return;
  }

  if (metadata.version !== 1) {
    error(
      context,
      "openai-metadata/version",
      metadataPath,
      'Expected "version" to be 1.',
      "/version",
    );
  }

  const metadataInterface = getObject(context, metadata, "interface", metadataPath, "/interface");
  if (metadataInterface !== undefined) {
    getString(context, metadataInterface, "display_name", metadataPath, "/interface/display_name");
    getString(
      context,
      metadataInterface,
      "short_description",
      metadataPath,
      "/interface/short_description",
    );
    const defaultPrompt = metadataInterface.default_prompt;
    const isValidPrompt =
      typeof defaultPrompt === "string" ||
      (Array.isArray(defaultPrompt) &&
        defaultPrompt.every((item) => typeof item === "string" && item.length > 0));

    if (!isValidPrompt) {
      error(
        context,
        "openai-metadata/default-prompt",
        metadataPath,
        'Expected "interface.default_prompt" to be a string or string array.',
        "/interface/default_prompt",
      );
    }
  }

  const policy = getObject(context, metadata, "policy", metadataPath, "/policy");
  if (policy !== undefined) {
    getBoolean(
      context,
      policy,
      "allow_implicit_invocation",
      metadataPath,
      "/policy/allow_implicit_invocation",
    );
  }

  const frontmatterName = path.basename(path.dirname(path.dirname(metadataPath)));
  if (frontmatterName !== skillName) {
    error(
      context,
      "openai-metadata/path",
      metadataPath,
      `Metadata path does not match skill directory "${skillName}".`,
    );
  }
}

async function validateCatalogCoverage(
  context: ValidationContext,
  catalog: Catalog,
): Promise<void> {
  const catalogPaths = new Set(
    [...catalog.localEntries.values()].map((entry) => path.resolve(entry.pluginPath)),
  );
  const catalogNames = new Set([
    ...catalog.localEntries.keys(),
    ...catalog.remoteEntries.map((entry) => entry.name),
  ]);
  const manifests = await findPluginManifests(context.repoRoot);

  for (const manifestPath of manifests) {
    const pluginPath = path.dirname(path.dirname(manifestPath));
    if (!catalogPaths.has(pluginPath)) {
      const manifest = await readJsonObject(context, manifestPath);
      const manifestName =
        manifest !== undefined && typeof manifest.name === "string"
          ? manifest.name
          : path.basename(pluginPath);
      const nameHint = catalogNames.has(manifestName)
        ? ` Marketplace has "${manifestName}", but it points somewhere else.`
        : "";
      error(
        context,
        "coverage/manifest-listed",
        manifestPath,
        `Plugin manifest is missing from the marketplace catalog.${nameHint}`,
      );
    }
  }
}

async function findPluginManifests(searchRoot: string): Promise<string[]> {
  const skippedDirectoryNames = new Set([".cache", ".git", ".local", "node_modules"]);
  const manifests: string[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (skippedDirectoryNames.has(entry.name)) {
          continue;
        }
        await visit(entryPath);
      } else if (entry.isFile() && entry.name === "plugin.json") {
        if (path.basename(path.dirname(entryPath)) === ".codex-plugin") {
          manifests.push(entryPath);
        }
      }
    }
  }

  await visit(searchRoot);
  return manifests.sort();
}

async function validateExternalReferences(
  context: ValidationContext,
  catalog: Catalog,
  manifestsByPath: Map<string, JsonObject>,
): Promise<void> {
  if (!context.externalValidationEnabled) {
    return;
  }

  for (const entry of catalog.remoteEntries) {
    const url = typeof entry.source.url === "string" ? entry.source.url : undefined;
    if (url === undefined) {
      continue;
    }

    await validateGitRemote(context, url, catalog.marketplacePath, `${entry.pointer}/source/url`);

    const selector =
      typeof entry.source.sha === "string"
        ? entry.source.sha
        : typeof entry.source.ref === "string"
          ? entry.source.ref
          : undefined;
    if (selector !== undefined) {
      await validateGitRemote(
        context,
        url,
        catalog.marketplacePath,
        `${entry.pointer}/source/url`,
        selector,
      );
    }
  }

  for (const entry of catalog.localEntries.values()) {
    const manifest = manifestsByPath.get(entry.manifestPath);
    if (manifest === undefined) {
      continue;
    }

    await validateReachableUrl(context, manifest.repository, entry.manifestPath, "/repository");
    await validateReachableUrl(context, manifest.homepage, entry.manifestPath, "/homepage");

    const author = isObject(manifest.author) ? manifest.author : undefined;
    if (author !== undefined) {
      await validateReachableUrl(context, author.url, entry.manifestPath, "/author/url");
    }

    const manifestInterface = isObject(manifest.interface) ? manifest.interface : undefined;
    if (manifestInterface !== undefined) {
      for (const fieldName of ["websiteURL", "privacyPolicyURL", "termsOfServiceURL"]) {
        await validateReachableUrl(
          context,
          manifestInterface[fieldName],
          entry.manifestPath,
          `/interface/${fieldName}`,
        );
      }
    }
  }
}

async function validateReachableUrl(
  context: ValidationContext,
  value: unknown,
  filePath: string,
  pointer: string,
): Promise<void> {
  if (typeof value !== "string" || value.length === 0) {
    return;
  }

  const parsedUrl = parseHttpUrlString(context, value, filePath, pointer, "url/http");
  if (parsedUrl === undefined) {
    return;
  }

  const reachable = await fetchUrl(parsedUrl, "HEAD");
  if (reachable) {
    return;
  }

  if (await fetchUrl(parsedUrl, "GET")) {
    return;
  }

  warning(
    context,
    "external/url-reachable",
    filePath,
    `URL did not respond successfully: ${value}`,
    pointer,
  );
}

async function fetchUrl(url: URL, method: "GET" | "HEAD"): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      method,
      redirect: "follow",
      signal: controller.signal,
    });
    return response.status >= 200 && response.status < 400;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function validateGitRemote(
  context: ValidationContext,
  url: string,
  filePath: string,
  pointer: string,
  selector?: string,
): Promise<void> {
  const args = selector === undefined ? ["ls-remote", url] : ["ls-remote", url, selector];

  try {
    const result = await execFileAsync("git", args, { timeout: 15_000 });
    if (selector !== undefined && result.stdout.trim().length === 0) {
      warning(
        context,
        "external/git-selector",
        filePath,
        `Git remote did not contain selector "${selector}": ${url}`,
        pointer,
      );
    }
  } catch {
    warning(
      context,
      "external/git-reachable",
      filePath,
      `Git remote was not reachable: ${url}`,
      pointer,
    );
  }
}

function validateLocalRepositoryAlignment(context: ValidationContext, catalog: Catalog): void {
  for (const entry of catalog.localEntries.values()) {
    if (entry.sourcePath !== `./plugins/${entry.name}`) {
      warning(
        context,
        "alignment/source-path",
        catalog.marketplacePath,
        `Local source path usually matches "./plugins/<name>"; found "${entry.sourcePath}".`,
        entry.pointer,
      );
    }
  }
}

function printDiagnostics(context: ValidationContext): void {
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

async function main(): Promise<void> {
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

main().catch((caught: unknown) => {
  console.error(errorMessage(caught));
  process.exitCode = 1;
});
