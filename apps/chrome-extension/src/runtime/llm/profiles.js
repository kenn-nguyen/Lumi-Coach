import { DEFAULT_CHATGPT_TARGET_URL } from "../constants.js";

const DEFAULT_CLAUDE_INCOGNITO_TARGET_URL = "https://claude.ai/new?incognito";
const DEFAULT_GEMINI_TARGET_URL = "https://gemini.google.com/app";

export const DEFAULT_ACTIVE_LLM_PROFILE_ID = "chatgpt:api";

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
    model: "claude-sonnet-4-5",
    apiKey: "",
  },
  {
    id: "chatgpt:api",
    vendor: "chatgpt",
    mode: "api",
    label: "ChatGPT API",
    apiBaseUrl: "https://api.openai.com/v1/responses",
    model: "gpt-5-mini",
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
      merged.profiles[profileId] =
        storedProfile && typeof storedProfile === "object"
          ? withoutProviderPatchKey({
              ...baseProfile,
              ...cloneValue(storedProfile),
            })
          : cloneValue(baseProfile);
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
