export const AGENT_SKILL_FRONTMATTER_KEYS = new Set([
  "allowed-tools",
  "compatibility",
  "description",
  "license",
  "metadata",
  "name",
]);

export const OPENAI_METADATA_ROOT_KEYS = new Set([
  "dependencies",
  "interface",
  "policy",
  "version",
]);

export const OPENAI_METADATA_INTERFACE_KEYS = new Set([
  "brand_color",
  "default_prompt",
  "display_name",
  "icon_large",
  "icon_small",
  "short_description",
]);

export const OPENAI_METADATA_POLICY_KEYS = new Set(["allow_implicit_invocation"]);
