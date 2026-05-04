import { STORAGE_KEYS } from "./constants.js";

export const SYSTEM_GUARDRAILS_ARTIFACT_KEY = "system.guardrails";
export const USER_EDITABLE_PROMPT_TEMPLATE_NAMES = [
  "prompt1",
  "prompt2",
  "prompt3",
];

const PROMPT_DOWNLOAD_CONFIG = {
  prompt1: {
    promptFileName: "prompt1.txt",
    contractFileName: "prompt1.output-contract.txt",
    downloadName: "prompt1.default.zip",
  },
  prompt2: {
    promptFileName: "prompt2.txt",
    contractFileName: "prompt2.output-contract.txt",
    downloadName: "prompt2.default.zip",
  },
  prompt3: {
    promptFileName: "prompt3.txt",
    contractFileName: "prompt3.output-contract.txt",
    downloadName: "prompt3.default.zip",
  },
  systemPrompt: {
    promptFileName: "system-prompt.guardrails.txt",
    contractFileName: null,
    downloadName: "system-prompt.guardrails.zip",
  },
};

export const PROMPT_ARTIFACT_DEFINITIONS = {
  "prompt1.template": {
    path: "src/prompts/prompt1.txt",
    fileName: "prompt1.txt",
    storageKey: STORAGE_KEYS.prompt1TemplateAsset,
  },
  "prompt1.output_contract": {
    path: "src/prompts/patches/prompt1.output-contract.txt",
    fileName: "prompt1.output-contract.txt",
  },
  "prompt2.template": {
    path: "src/prompts/prompt2.txt",
    fileName: "prompt2.txt",
    storageKey: STORAGE_KEYS.prompt2TemplateAsset,
  },
  "prompt2.output_contract": {
    path: "src/prompts/patches/prompt2.output-contract.txt",
    fileName: "prompt2.output-contract.txt",
  },
  "prompt3.template": {
    path: "src/prompts/prompt3.txt",
    fileName: "prompt3.txt",
    storageKey: STORAGE_KEYS.prompt3TemplateAsset,
  },
  "prompt3.output_contract": {
    path: "src/prompts/patches/prompt3.output-contract.txt",
    fileName: "prompt3.output-contract.txt",
  },
  "prompt4.template": {
    path: "src/prompts/prompt4.txt",
    fileName: "prompt4.txt",
  },
  "prompt4.output_contract": {
    path: "src/prompts/patches/prompt4.output-contract.txt",
    fileName: "prompt4.output-contract.txt",
  },
  [SYSTEM_GUARDRAILS_ARTIFACT_KEY]: {
    path: "src/prompts/patches/system.guardrails.txt",
    fileName: "system-prompt.guardrails.txt",
    storageKey: "systemPromptTemplateAsset",
  },
};

const packagedArtifactCache = new Map();

export function getPromptTemplateArtifactKey(templateName) {
  return `${templateName}.template`;
}

export function getPromptOutputContractArtifactKey(templateName) {
  return `${templateName}.output_contract`;
}

export function getPromptOverrideAssetField(templateName) {
  if (templateName === "systemPrompt") {
    return "systemPromptTemplateAsset";
  }
  return `${templateName}TemplateAsset`;
}

export function isUserEditablePromptTemplateName(templateName) {
  return USER_EDITABLE_PROMPT_TEMPLATE_NAMES.includes(templateName);
}

export function getPromptDownloadConfig(templateName) {
  return PROMPT_DOWNLOAD_CONFIG[templateName] ?? null;
}

export function getPromptArtifactDefinition(artifactKey) {
  return PROMPT_ARTIFACT_DEFINITIONS[artifactKey] ?? null;
}

export function getPromptArtifactKeysForTemplate(templateName) {
  if (templateName === "systemPrompt") {
    return [SYSTEM_GUARDRAILS_ARTIFACT_KEY];
  }

  return [
    getPromptTemplateArtifactKey(templateName),
    getPromptOutputContractArtifactKey(templateName),
  ];
}

function resolveExtensionAssetUrl(path) {
  return chrome.runtime.getURL(path);
}

export async function getPackagedPromptArtifactText(artifactKey) {
  const cached = packagedArtifactCache.get(artifactKey);
  if (cached) {
    return cached;
  }

  const definition = getPromptArtifactDefinition(artifactKey);
  if (!definition?.path) {
    return "";
  }

  const response = await fetch(resolveExtensionAssetUrl(definition.path));
  if (!response.ok) {
    throw new Error(
      `Failed to load packaged prompt artifact "${artifactKey}" (status ${response.status}).`,
    );
  }

  const text = await response.text();
  packagedArtifactCache.set(artifactKey, text);
  return text;
}
