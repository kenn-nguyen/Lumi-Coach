import { getUserAssets } from "./storage.js";

const TEMPLATE_PATHS = {
  prompt1: "src/prompts/prompt1.txt",
  prompt2: "src/prompts/prompt2.txt",
  prompt3: "src/prompts/prompt3.txt",
  prompt4: "src/prompts/prompt4.txt",
};

const PATCH_PATHS = {
  prompt1: {
    "chatgpt-web": "src/prompts/patches/prompt1.chatgpt-web.txt",
    "claude-web": "src/prompts/patches/prompt1.claude-web.txt",
    "claude-api": "src/prompts/patches/prompt1.claude-api.txt",
    "chatgpt-api": "src/prompts/patches/prompt1.chatgpt-api.txt",
    "gemini-web": "src/prompts/patches/prompt1.gemini-web.txt",
    "gemini-api": "src/prompts/patches/prompt1.gemini-api.txt",
  },
  prompt2: {
    "chatgpt-web": "src/prompts/patches/prompt2.chatgpt-web.txt",
    "claude-web": "src/prompts/patches/prompt2.claude-web.txt",
    "claude-api": "src/prompts/patches/prompt2.claude-api.txt",
    "chatgpt-api": "src/prompts/patches/prompt2.chatgpt-api.txt",
    "gemini-web": "src/prompts/patches/prompt2.gemini-web.txt",
    "gemini-api": "src/prompts/patches/prompt2.gemini-api.txt",
  },
  prompt3: {
    "chatgpt-web": "src/prompts/patches/prompt3.chatgpt-web.txt",
    "claude-web": "src/prompts/patches/prompt3.claude-web.txt",
    "claude-api": "src/prompts/patches/prompt3.claude-api.txt",
    "chatgpt-api": "src/prompts/patches/prompt3.chatgpt-api.txt",
    "gemini-web": "src/prompts/patches/prompt3.gemini-web.txt",
    "gemini-api": "src/prompts/patches/prompt3.gemini-api.txt",
  },
};

const SHARED_APPEND_PATHS = {
  prompt1: "src/prompts/patches/prompt1.output-contract.txt",
  prompt2: "src/prompts/patches/prompt2.output-contract.txt",
  prompt3: "src/prompts/patches/prompt3.output-contract.txt",
  prompt4: "src/prompts/patches/prompt4.output-contract.txt",
};

const PLACEHOLDER_PATTERN = /\{\{([A-Z0-9_]+)\}\}/g;
const templateCache = new Map();

function getTemplateAssetKey(templateName) {
  return `${templateName}TemplateAsset`;
}

function resolveExtensionAssetUrl(path) {
  return chrome.runtime.getURL(path);
}

async function fetchTemplateText(path) {
  const response = await fetch(resolveExtensionAssetUrl(path));
  if (!response.ok) {
    throw new Error(
      `Failed to load prompt template at "${path}" (status ${response.status}).`,
    );
  }
  return await response.text();
}

export function clearPromptTemplateCache() {
  templateCache.clear();
}

function getTemplateCacheKey(templateName, patchKey, promptProfileId) {
  const profileKey = promptProfileId || "profile1";
  return patchKey
    ? `${templateName}:${patchKey}:${profileKey}`
    : `${templateName}:${profileKey}`;
}

async function loadPromptPatch(templateName, patchKey) {
  const patchPath = patchKey ? PATCH_PATHS[templateName]?.[patchKey] : null;
  if (!patchPath) {
    return "";
  }

  const patchResponse = await fetch(resolveExtensionAssetUrl(patchPath));
  if (!patchResponse.ok) {
    throw new Error(
      `Failed to load prompt patch at "${patchPath}" (status ${patchResponse.status}).`,
    );
  }

  return (await patchResponse.text()).trim();
}

async function loadSharedAppendBlock(templateName) {
  const sharedPath = SHARED_APPEND_PATHS[templateName];
  if (!sharedPath) {
    return "";
  }
  const response = await fetch(resolveExtensionAssetUrl(sharedPath));
  if (!response.ok) {
    throw new Error(
      `Failed to load shared prompt block at "${sharedPath}" (status ${response.status}).`,
    );
  }
  return (await response.text()).trim();
}

export async function loadPromptTemplate(templateName, profile) {
  const assets = await getUserAssets();
  const patchKey = profile?.patchKey ?? "";
  const cacheKey = getTemplateCacheKey(
    templateName,
    patchKey,
    assets?.activePromptProfileId,
  );
  const cached = templateCache.get(cacheKey);
  if (cached) return cached;

  const overrideAsset = assets?.[getTemplateAssetKey(templateName)];
  const template = overrideAsset?.content?.trim()
    ? overrideAsset.content
    : await fetchTemplateText(TEMPLATE_PATHS[templateName]);
  const patch = await loadPromptPatch(templateName, patchKey);
  const sharedAppend = await loadSharedAppendBlock(templateName);
  const mergedParts = [template.trim(), patch, sharedAppend].filter(Boolean);
  const merged = mergedParts.join("\n\n");

  templateCache.set(cacheKey, merged);
  return merged;
}

function normalizeText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return JSON.stringify(value, null, 2);
}

function stringifyJson(value) {
  if (value == null) return "";
  return JSON.stringify(value, null, 2);
}

function buildPromptReplacements(input = {}) {
  const jobSnapshot = input.jobSnapshot ?? {};
  const customInstruction = normalizeText(input.customInstruction);
  const currentResume =
    typeof input.currentResume === "string"
      ? input.currentResume.trim()
      : stringifyJson(input.currentResume);
  const storyboard =
    typeof input.storyboard === "string"
      ? input.storyboard.trim()
      : stringifyJson(input.storyboard);

  return {
    JOB_TITLE: normalizeText(input.jobTitle ?? jobSnapshot.title),
    COMPANY: normalizeText(input.company ?? jobSnapshot.company),
    LOCATION: normalizeText(input.location ?? jobSnapshot.location),
    SOURCE_URL: normalizeText(input.sourceUrl ?? jobSnapshot.sourceUrl),
    EXTRACTED_AT: normalizeText(input.extractedAt ?? jobSnapshot.extractedAt),
    JOB_DESCRIPTION: normalizeText(
      input.jobDescriptionRawText ?? jobSnapshot.rawText,
    ),
    JOB_SNAPSHOT_JSON: stringifyJson(jobSnapshot),
    CUSTOM_INSTRUCTION: customInstruction,
    CUSTOM_INSTRUCTION_BLOCK: customInstruction
      ? `Additional instruction:\n${customInstruction}`
      : "",
    PROMPT1_JSON: stringifyJson(input.prompt1Json),
    PROMPT2_JSON: stringifyJson(input.prompt2Json),
    CURRENT_RESUME: currentResume,
    MASTER_RESUME: currentResume,
    MASTER_RESUME_MARKDOWN: currentResume,
    STORYBOARD: storyboard,
    SYSTEM_PROMPT: normalizeText(input.systemPrompt),
  };
}

function renderTemplate(template, replacements) {
  const rendered = template.replace(
    PLACEHOLDER_PATTERN,
    (match, placeholder) => {
      return placeholder in replacements ? replacements[placeholder] : match;
    },
  );

  const unresolved = rendered.match(PLACEHOLDER_PATTERN);
  if (unresolved?.length) {
    throw new Error(
      `Unresolved prompt placeholders remain: ${unresolved.join(", ")}`,
    );
  }
  return rendered.trim();
}

async function renderPrompt(templateName, input, profile) {
  const template = await loadPromptTemplate(templateName, profile);
  return renderTemplate(template, buildPromptReplacements(input));
}

export async function renderPrompt1(input, profile) {
  const rendered = await renderPrompt("prompt1", input, profile);
  const customInstruction = normalizeText(input.customInstruction);
  if (!customInstruction || rendered.includes(customInstruction)) {
    return rendered;
  }
  return `${rendered}\n\nAdditional Prompt 1 instruction:\nTreat these user-provided keywords or concepts as extra screening signals to evaluate for importance, but do not force them into the output if the JD does not support them.\n${customInstruction}`;
}

export async function renderPrompt2(input, profile) {
  return renderPrompt("prompt2", input, profile);
}

export async function renderPrompt3(input, profile) {
  return renderPrompt("prompt3", input, profile);
}

export async function renderPrompt4(input, profile) {
  return renderPrompt("prompt4", input, profile);
}
