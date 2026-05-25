import { STORAGE_KEYS } from "./constants.js";

export const SYSTEM_GUARDRAILS_ARTIFACT_KEY = "system.guardrails";
export const PROMPT_PROFILE_IDS = ["profile1", "profile2", "profile3", "profile4"];
export const USER_EDITABLE_PROMPT_TEMPLATE_NAMES = [
  "prompt1",
  "prompt2",
  "prompt3",
  "systemPrompt",
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
    promptFileName: "system-prompt.txt",
    contractFileName: null,
    downloadName: "system-prompt.default.zip",
  },
};

const PROFILE_DEFAULT_PROMPT_PATHS = {
  profile1: {
    prompt1: "src/prompts/prompt1.txt",
    prompt2: "src/prompts/prompt2.txt",
    prompt3: "src/prompts/prompt3.txt",
    systemPrompt: "src/prompts/system-prompt.txt",
  },
  profile2: {
    prompt1: "src/prompts/profiles/profile2/prompt1.txt",
    prompt2: "src/prompts/profiles/profile2/prompt2.txt",
    prompt3: "src/prompts/profiles/profile2/prompt3.txt",
    systemPrompt: "src/prompts/system-prompt.txt",
  },
  profile3: {
    prompt1: "src/prompts/profiles/profile3/prompt1.txt",
    prompt2: "src/prompts/profiles/profile3/prompt2.txt",
    prompt3: "src/prompts/profiles/profile3/prompt3.txt",
    systemPrompt: "src/prompts/system-prompt.txt",
  },
  profile4: {
    prompt3: "src/prompts/profiles/profile4/prompt3.txt",
  },
};

const PROFILE_TEMPLATE_ARTIFACT_PATTERN =
  /^(profile[1234])\.(prompt1|prompt2|prompt3|systemPrompt)\.template$/;

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
  "systemPrompt.template": {
    path: "src/prompts/system-prompt.txt",
    fileName: "system-prompt.txt",
    storageKey: "systemPromptTemplateAsset",
  },
  [SYSTEM_GUARDRAILS_ARTIFACT_KEY]: {
    path: "src/prompts/patches/system.guardrails.txt",
    fileName: "system-prompt.guardrails.txt",
  },
};

const packagedArtifactCache = new Map();

export function getPromptTemplateArtifactKey(templateName) {
  return `${templateName}.template`;
}

export function getProfilePromptTemplateArtifactKey(templateName, profileId) {
  if (!PROMPT_PROFILE_IDS.includes(profileId)) {
    return getPromptTemplateArtifactKey(templateName);
  }
  return `${profileId}.${templateName}.template`;
}

export function getDefaultPromptTemplateArtifactKey(
  templateName,
  promptProfileId = null,
) {
  if (
    promptProfileId &&
    PROMPT_PROFILE_IDS.includes(promptProfileId) &&
    PROFILE_DEFAULT_PROMPT_PATHS[promptProfileId]?.[templateName]
  ) {
    return getProfilePromptTemplateArtifactKey(templateName, promptProfileId);
  }
  return getPromptTemplateArtifactKey(templateName);
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
  const profileMatch = PROFILE_TEMPLATE_ARTIFACT_PATTERN.exec(artifactKey);
  if (profileMatch) {
    const [, profileId, templateName] = profileMatch;
    const path = PROFILE_DEFAULT_PROMPT_PATHS[profileId]?.[templateName];
    if (!path) {
      return null;
    }
    return {
      path,
      fileName:
        templateName === "systemPrompt"
          ? "system-prompt.txt"
          : `${templateName}.txt`,
    };
  }
  return PROMPT_ARTIFACT_DEFINITIONS[artifactKey] ?? null;
}

export function getPromptArtifactKeysForTemplate(
  templateName,
  promptProfileId = null,
) {
  const templateArtifactKey = getDefaultPromptTemplateArtifactKey(
    templateName,
    promptProfileId,
  );
  if (
    templateName === "systemPrompt" ||
    !shouldAppendSharedPromptOutputContract(templateName, promptProfileId)
  ) {
    return [templateArtifactKey];
  }

  return [templateArtifactKey, getPromptOutputContractArtifactKey(templateName)];
}

export function shouldAppendSharedPromptOutputContract(
  templateName,
  promptProfileId = null,
) {
  if (templateName === "systemPrompt") {
    return false;
  }

  return !(
    promptProfileId === "profile3" &&
    (templateName === "prompt1" || templateName === "prompt2")
  );
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
