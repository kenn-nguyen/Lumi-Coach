import { DEFAULT_CHATGPT_TARGET_URL } from "../constants.js";

const DEFAULT_CLAUDE_INCOGNITO_TARGET_URL = "https://claude.ai/new?incognito";
const DEFAULT_GEMINI_TARGET_URL = "https://gemini.google.com/app";

export const DEFAULT_ACTIVE_LLM_PROFILE_ID = "chatgpt:api";

export const DEFAULT_CHATGPT_API_STAGE_MODELS = {
  prompt1: {
    model: "gpt-5.4-mini",
    reasoning: {
      effort: "low",
    },
  },
  prompt2: {
    model: "gpt-5.4",
    reasoning: {
      effort: "high",
    },
  },
  prompt3: {
    model: "gpt-5.4",
    reasoning: {
      effort: "low",
    },
  },
};

export const DEFAULT_CLAUDE_API_STAGE_MODELS = {
  prompt1: {
    model: "claude-sonnet-4-6",
  },
  prompt2: {
    model: "claude-sonnet-4-6",
    maxTokens: 18000,
    thinking: {
      type: "enabled",
      budget_tokens: 8192,
    },
  },
  prompt3: {
    model: "claude-sonnet-4-6",
  },
};

export const DEFAULT_DEEPSEEK_API_STAGE_MODELS = {
  prompt1: {
    model: "deepseek-v4-pro",
  },
  prompt2: {
    model: "deepseek-v4-pro",
  },
  prompt3: {
    model: "deepseek-v4-pro",
    thinking: {
      type: "enabled",
    },
    reasoning_effort: "medium",
  },
};

const BASE_PROFILE_DEFS = [
  {
    id: "chatgpt:web_automation",
    vendor: "chatgpt",
    mode: "web_automation",
    label: "ChatGPT Web Automation",
    targetUrl: DEFAULT_CHATGPT_TARGET_URL,
  },
  {
    id: "claude:web_automation",
    vendor: "claude",
    mode: "web_automation",
    label: "Claude Web Automation",
    targetUrl: DEFAULT_CLAUDE_INCOGNITO_TARGET_URL,
  },
  {
    id: "claude:api",
    vendor: "claude",
    mode: "api",
    label: "Claude API",
    apiBaseUrl: "https://api.anthropic.com/v1/messages",
    model: DEFAULT_CLAUDE_API_STAGE_MODELS.prompt1.model,
    promptCache: {
      enabled: true,
    },
    stageModels: DEFAULT_CLAUDE_API_STAGE_MODELS,
    apiKey: "",
  },
  {
    id: "chatgpt:api",
    vendor: "chatgpt",
    mode: "api",
    label: "ChatGPT API",
    apiBaseUrl: "https://api.openai.com/v1/responses",
    model: DEFAULT_CHATGPT_API_STAGE_MODELS.prompt1.model,
    promptCache: {
      enabled: true,
    },
    stageModels: DEFAULT_CHATGPT_API_STAGE_MODELS,
    apiKey: "",
  },
  {
    id: "deepseek:api",
    vendor: "deepseek",
    mode: "api",
    label: "DeepSeek API",
    apiBaseUrl: "https://api.deepseek.com/chat/completions",
    model: DEFAULT_DEEPSEEK_API_STAGE_MODELS.prompt1.model,
    promptCache: {
      enabled: true,
      mode: "automatic-prefix",
    },
    stageModels: DEFAULT_DEEPSEEK_API_STAGE_MODELS,
    apiKey: "",
  },
  {
    id: "gemini:web_automation",
    vendor: "gemini",
    mode: "web_automation",
    label: "Gemini Web Automation",
    targetUrl: DEFAULT_GEMINI_TARGET_URL,
  },
  {
    id: "gemini:api",
    vendor: "gemini",
    mode: "api",
    label: "Gemini API",
    apiBaseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
    model: "gemini-2.5-flash",
    apiKey: "",
  },
];

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function withoutProviderPatchKey(profile) {
  const nextProfile = cloneValue(profile);
  delete nextProfile.patchKey;
  return nextProfile;
}

function toProfileMap(profileList) {
  return Object.fromEntries(
    profileList.map((profile) => [profile.id, cloneValue(profile)]),
  );
}

function mergeNestedObject(baseValue, storedValue) {
  if (!baseValue || typeof baseValue !== "object") {
    return cloneValue(storedValue);
  }
  if (!storedValue || typeof storedValue !== "object") {
    return cloneValue(baseValue);
  }
  const merged = cloneValue(baseValue);
  for (const [key, value] of Object.entries(storedValue)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      merged[key] &&
      typeof merged[key] === "object" &&
      !Array.isArray(merged[key])
    ) {
      merged[key] = mergeNestedObject(merged[key], value);
    } else {
      merged[key] = cloneValue(value);
    }
  }
  return merged;
}

function mergeProfile(baseProfile, storedProfile) {
  if (!storedProfile || typeof storedProfile !== "object") {
    return cloneValue(baseProfile);
  }
  const merged = {
    ...baseProfile,
    ...cloneValue(storedProfile),
  };
  if (baseProfile.stageModels || storedProfile.stageModels) {
    merged.stageModels = mergeNestedObject(
      baseProfile.stageModels ?? {},
      storedProfile.stageModels ?? {},
    );
  }
  if (baseProfile.promptCache || storedProfile.promptCache) {
    merged.promptCache = mergeNestedObject(
      baseProfile.promptCache ?? {},
      storedProfile.promptCache ?? {},
    );
  }
  return withoutProviderPatchKey(merged);
}

export function getDefaultLlmSettings() {
  return {
    activeProfileId: DEFAULT_ACTIVE_LLM_PROFILE_ID,
    profiles: toProfileMap(BASE_PROFILE_DEFS),
  };
}

export function mergeLlmSettings(storedSettings, legacyChatGptTargetUrl = "") {
  const defaults = getDefaultLlmSettings();
  const merged = {
    activeProfileId: defaults.activeProfileId,
    profiles: defaults.profiles,
  };

  if (storedSettings && typeof storedSettings === "object") {
    const storedProfiles =
      storedSettings.profiles && typeof storedSettings.profiles === "object"
        ? storedSettings.profiles
        : {};
    for (const [profileId, baseProfile] of Object.entries(defaults.profiles)) {
      const storedProfile = storedProfiles[profileId];
      merged.profiles[profileId] = mergeProfile(baseProfile, storedProfile);
    }

    if (
      typeof storedSettings.activeProfileId === "string" &&
      storedSettings.activeProfileId in merged.profiles
    ) {
      merged.activeProfileId = storedSettings.activeProfileId;
    }
  }

  const normalizedLegacyUrl =
    typeof legacyChatGptTargetUrl === "string"
      ? legacyChatGptTargetUrl.trim()
      : "";
  if (normalizedLegacyUrl) {
    merged.profiles["chatgpt:web_automation"] = {
      ...merged.profiles["chatgpt:web_automation"],
      targetUrl: normalizedLegacyUrl,
    };
  }

  if (!(merged.activeProfileId in merged.profiles)) {
    merged.activeProfileId = DEFAULT_ACTIVE_LLM_PROFILE_ID;
  }

  return merged;
}

export function listLlmProfiles(settings) {
  const resolved = mergeLlmSettings(settings);
  return BASE_PROFILE_DEFS.map((profile) => resolved.profiles[profile.id]);
}

export function getActiveLlmProfile(settings) {
  const resolved = mergeLlmSettings(settings);
  return resolved.profiles[resolved.activeProfileId];
}

export function resolveLlmStageSettings(profile, promptStage = "") {
  const normalizedStage =
    typeof promptStage === "string" ? promptStage.trim() : "";
  const stageModels =
    profile?.stageModels && typeof profile.stageModels === "object"
      ? profile.stageModels
      : {};
  const stageSettings =
    normalizedStage && stageModels[normalizedStage]
      ? stageModels[normalizedStage]
      : null;
  const merged = {
    ...(profile && typeof profile === "object" ? cloneValue(profile) : {}),
    ...(stageSettings && typeof stageSettings === "object"
      ? cloneValue(stageSettings)
      : {}),
  };
  if (
    stageSettings?.reasoning &&
    typeof stageSettings.reasoning === "object"
  ) {
    merged.reasoning = cloneValue(stageSettings.reasoning);
  }
  if (stageSettings?.thinking && typeof stageSettings.thinking === "object") {
    merged.thinking = cloneValue(stageSettings.thinking);
  }
  if (normalizedStage) {
    merged.promptStage = normalizedStage;
  }
  return withoutProviderPatchKey(merged);
}

export function updateLlmSettings(
  currentSettings,
  activeProfileId,
  profileUpdates,
) {
  const resolved = mergeLlmSettings(currentSettings);
  const nextActiveProfileId =
    typeof activeProfileId === "string" && activeProfileId in resolved.profiles
      ? activeProfileId
      : resolved.activeProfileId;
  const nextProfile = resolved.profiles[nextActiveProfileId];

  if (profileUpdates && typeof profileUpdates === "object") {
    resolved.profiles[nextActiveProfileId] = withoutProviderPatchKey({
      ...nextProfile,
      ...profileUpdates,
      id: nextProfile.id,
      vendor: nextProfile.vendor,
      mode: nextProfile.mode,
      label: nextProfile.label,
    });
  }

  resolved.activeProfileId = nextActiveProfileId;
  return resolved;
}
