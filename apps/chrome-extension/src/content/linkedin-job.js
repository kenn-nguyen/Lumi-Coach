(() => {
const CONTENT_SCRIPT_INSTANCE_KEY =
  "__LUMI_COACH_FLOATING_BOARD_CONTENT_SCRIPT__";
const previousContentScriptInstance =
  globalThis[CONTENT_SCRIPT_INSTANCE_KEY] || null;
if (typeof previousContentScriptInstance?.destroy === "function") {
  try {
    previousContentScriptInstance.destroy("reinjected");
  } catch (error) {
    console.warn(
      "[ResumeMatcherExt][FloatingBoard] Failed to destroy previous content script instance.",
      error,
    );
  }
}

let contentScriptDisposed = false;

function isContentScriptDisposed() {
  return contentScriptDisposed;
}

function isExtensionContextInvalidatedError(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /extension context invalidated/i.test(message);
}

function isLoopbackApiBaseUrl(apiBaseUrl) {
  if (typeof apiBaseUrl !== "string" || !apiBaseUrl.trim()) return false;
  try {
    const parsed = new URL(apiBaseUrl.trim());
    return ["127.0.0.1", "localhost", "::1", "[::1]"].includes(
      parsed.hostname,
    );
  } catch {
    return false;
  }
}

function requiresApiKeyForApiBaseUrl(apiBaseUrl) {
  return !isLoopbackApiBaseUrl(apiBaseUrl);
}

const ROOT_ID = "resume-matcher-floating-action";
const LAUNCHER_ID = "resume-matcher-launcher";
const LAUNCHER_CLOSE_ID = "resume-matcher-launcher-close";
const LAUNCHER_ALERT_ID = "resume-matcher-launcher-alert";
const LAUNCHER_LOCK_NOTICE_ID = "resume-matcher-launcher-lock-notice";
const BOARD_ID = "resume-matcher-board";
const BOARD_WEBSITE_ID = "resume-matcher-board-website";
const BOARD_TITLE_ID = "resume-matcher-board-title-link";
const BOARD_HOME_ID = "resume-matcher-board-home";
const BOARD_SETTINGS_ID = "resume-matcher-board-settings";
const BOARD_MINIMIZE_ID = "resume-matcher-board-minimize";
const RUN_VIEW_ID = "resume-matcher-run-view";
const RUN_SOURCE_LINKEDIN_ID = "resume-matcher-run-source-linkedin";
const RUN_SOURCE_MANUAL_ID = "resume-matcher-run-source-manual";
const RUN_SOURCE_TOGGLE_ID = "resume-matcher-run-source-toggle";
const RUN_READY_ID = "resume-matcher-job-ready";
const RUN_META_ID = "resume-matcher-job-meta";
const RUN_ONBOARDING_ID = "resume-matcher-run-onboarding";
const RUN_NOTES_ID = "resume-matcher-run-notes";
const RUN_MANUAL_JD_FIELD_ID = "resume-matcher-manual-jd-field";
const RUN_MANUAL_JD_ID = "resume-matcher-manual-jd";
const RUN_MANUAL_DETAILS_TOGGLE_ID =
  "resume-matcher-manual-details-toggle";
const RUN_MANUAL_DETAILS_PANEL_ID = "resume-matcher-manual-details-panel";
const RUN_MANUAL_TITLE_ID = "resume-matcher-manual-title";
const RUN_MANUAL_COMPANY_ID = "resume-matcher-manual-company";
const RUN_MANUAL_SOURCE_URL_ID = "resume-matcher-manual-source-url";
const RUN_PRIMARY_ID = "resume-matcher-run-primary";
const RUN_CANCEL_ROW_ID = "resume-matcher-run-cancel-row";
const RUN_CANCEL_ID = "resume-matcher-run-cancel";
const RUN_ACTIONS_ID = "resume-matcher-run-actions";
const RUN_STATUS_ID = "resume-matcher-run-status";
const RUN_STATUS_ACTIONS_ID = "resume-matcher-run-status-actions";
const RUN_PROMPT_PROFILE_FIELD_ID = "resume-matcher-run-prompt-profile-field";
const RUN_PROMPT_PROFILE_TABS_ID = "resume-matcher-run-prompt-profile-tabs";
const RUN_PROMPT_PROFILE_INFO_ID = "resume-matcher-run-prompt-profile-info";
const RUN_PROMPT_PROFILE_POPUP_ID = "resume-matcher-run-prompt-profile-popup";
const RUN_PROMPT_PROFILE_HINT_ID = "resume-matcher-run-prompt-profile-hint";
const HISTORY_VIEW_ID = "resume-matcher-history-view";
const HISTORY_LIST_ID = "resume-matcher-history-list";
const HISTORY_SEARCH_ID = "resume-matcher-history-search";
const HISTORY_FILTER_ID = "resume-matcher-history-filter";
const HISTORY_FILTER_MENU_ID = "resume-matcher-history-filter-menu";
const HISTORY_SORT_ASC_ID = "resume-matcher-history-sort-asc";
const HISTORY_SORT_DESC_ID = "resume-matcher-history-sort-desc";
const HISTORY_PREV_ID = "resume-matcher-history-prev";
const HISTORY_PAGE_ID = "resume-matcher-history-page";
const HISTORY_NEXT_ID = "resume-matcher-history-next";
const SETTINGS_VIEW_ID = "resume-matcher-settings-view";
const MASTER_RESUME_LABEL_ID = "resume-matcher-master-resume-label";
const MASTER_RESUME_INPUT_ID = "resume-matcher-master-resume-input";
const MASTER_RESUME_ACTION_ID = "resume-matcher-master-resume-action";
const MASTER_RESUME_REPLACE_ID = "resume-matcher-master-resume-replace";
const MASTER_RESUME_REPLACE_PANEL_ID =
  "resume-matcher-master-resume-replace-panel";
const MASTER_RESUME_CANCEL_REPLACE_ID =
  "resume-matcher-master-resume-cancel-replace";
const BACKEND_MASTER_REFRESH_MAX_AGE_MS = 60_000;
const SETTINGS_HEALTH_ID = "resume-matcher-settings-health";
const STORYBOARD_LABEL_ID = "resume-matcher-storyboard-label";
const STORYBOARD_INPUT_ID = "resume-matcher-storyboard-input";
const STORYBOARD_ACTION_ID = "resume-matcher-storyboard-action";
const STORYBOARD_DELETE_ID = "resume-matcher-storyboard-delete";
const STORYBOARD_UPLOAD_ID = "resume-matcher-storyboard-upload";
const STORYBOARD_CANCEL_ID = "resume-matcher-storyboard-cancel";
const STORYBOARD_PANEL_ID = "resume-matcher-storyboard-panel";
const ACCOUNT_ACTION_ID = "resume-matcher-account-action";
const ACCOUNT_DETAIL_ID = "resume-matcher-account-detail";
const ACCOUNT_STATUS_ID = "resume-matcher-account-status";
const PROVIDER_SELECT_ID = "resume-matcher-provider-select";
const PROVIDER_ROW_ID = "resume-matcher-provider-row";
const PROVIDER_STATUS_ID = "resume-matcher-provider-status";
const PROVIDER_VALUE_ID = "resume-matcher-provider-value";
const PROVIDER_DETAIL_ID = "resume-matcher-provider-detail";
const PROVIDER_CHANGE_ID = "resume-matcher-provider-change";
const PROVIDER_PANEL_ID = "resume-matcher-provider-panel";
const PROVIDER_CANCEL_ID = "resume-matcher-provider-cancel";
const PROVIDER_WEB_ROW_ID = "resume-matcher-provider-web-row";
const PROVIDER_WEB_INPUT_ID = "resume-matcher-provider-web-input";
const PROVIDER_API_BASE_ROW_ID = "resume-matcher-provider-api-base-row";
const PROVIDER_API_BASE_INPUT_ID = "resume-matcher-provider-api-base-input";
const PROVIDER_API_GRID_ID = "resume-matcher-provider-api-grid";
const PROVIDER_MODEL_ROW_ID = "resume-matcher-provider-model-row";
const PROVIDER_MODEL_INPUT_ID = "resume-matcher-provider-model-input";
const PROVIDER_API_KEY_ROW_ID = "resume-matcher-provider-api-key-row";
const PROVIDER_API_KEY_INPUT_ID = "resume-matcher-provider-api-key-input";
const PROVIDER_API_KEY_HINT_ID = "resume-matcher-provider-api-key-hint";
const PROVIDER_SAVE_ID = "resume-matcher-provider-save";
const ONBOARDING_PROVIDER_API_KEY_INPUT_ID =
  "resume-matcher-onboarding-provider-api-key-input";
const ONBOARDING_PROVIDER_API_KEY_HINT_ID =
  "resume-matcher-onboarding-provider-api-key-hint";
const APIFY_ENABLED_INPUT_ID = "resume-matcher-apify-enabled";
const APIFY_TOKEN_ROW_ID = "resume-matcher-apify-token-row";
const APIFY_TOKEN_INPUT_ID = "resume-matcher-apify-token-input";
const APIFY_TOKEN_TOGGLE_ID = "resume-matcher-apify-token-toggle";
const APIFY_SAVE_ID = "resume-matcher-apify-save";
const PROMPT_REFRESH_ID = "resume-matcher-prompt-refresh";
const PROMPT_PROFILE_TABS_ID = "resume-matcher-prompt-profile-tabs";
const PROMPT_PROFILE_DETAIL_ID = "resume-matcher-prompt-profile-detail";
const ADVANCED_TOGGLE_ID = "resume-matcher-advanced-toggle";
const RESET_LOCAL_ID = "resume-matcher-reset-local";
const RESET_DEFAULTS_ID = "resume-matcher-reset-defaults";
const EXPORT_DATA_ID = "resume-matcher-export-data";
const EXPORT_LOGS_ID = "resume-matcher-export-logs";
const LLM_CONFIG_BADGE_ID = "resume-matcher-llm-config-badge";
const LLM_CONFIG_DOWNLOAD_ID = "resume-matcher-llm-config-download";
const LLM_CONFIG_IMPORT_BTN_ID = "resume-matcher-llm-config-import-btn";
const LLM_CONFIG_IMPORT_INPUT_ID = "resume-matcher-llm-config-import-input";
const LLM_CONFIG_RESET_ID = "resume-matcher-llm-config-reset";
const STYLE_ID = "resume-matcher-floating-style";
const POSITION_KEY = "resumeMatcherFloatingPosition";
const DISMISSED_KEY = "resumeMatcherFloatingButtonDismissed";
const ICON_PATH = "src/assets/rocket.png";
const STAR_ICON_PATH = "src/assets/star.png";
const UPLOAD_ICON_PATH = "src/assets/upload.png";
const DOWNLOAD_ICON_PATH = "src/assets/direct-download.png";
const DELETE_ICON_PATH = "src/assets/delete.png";
const LOG_PREFIX = "[ResumeMatcherExt][FloatingBoard]";
const LLM_CONFIG_TEMPLATE_YAML = `\
# Determines which AI provider handles each prompt stage.
# Valid profile IDs: claude:api, deepseek:api, openai:api, gemini:api
# Remove or reset this file to return to single-provider mode.
stageProviders:
  prompt1: deepseek:api
  prompt2: claude:api
  prompt3: claude:api

# Per-provider model and API call settings for each stage.
# The API key and endpoint still come from the Settings panel.
# Settings here override the model for the tailor pipeline only.
profiles:
  claude:api:
    # Claude models: claude-opus-4-8, claude-sonnet-4-6, claude-haiku-4-5-20251001
    # Thinking: budget_tokens 1024-16000 (higher = deeper reasoning)
    stageModels:
      prompt1:
        model: claude-sonnet-4-6
      prompt2:
        model: claude-sonnet-4-6
        thinking:
          type: enabled
          budget_tokens: 8192
        maxTokens: 18000
      prompt3:
        model: claude-sonnet-4-6

  deepseek:api:
    # DeepSeek models: deepseek-v4-pro, deepseek-chat
    # reasoning_effort: high | max (medium silently maps to high)
    stageModels:
      prompt1:
        model: deepseek-v4-pro
      prompt2:
        model: deepseek-v4-pro
        thinking:
          type: enabled
        reasoning_effort: medium
      prompt3:
        model: deepseek-v4-pro
        thinking:
          type: enabled
        reasoning_effort: medium

  # Uncomment to enable OpenAI per-stage routing:
  # openai:api:
  #   # Models: gpt-5.4-mini, gpt-5.4, gpt-4.1, gpt-4o-mini
  #   # reasoning.effort: low | medium | high
  #   stageModels:
  #     prompt1:
  #       model: gpt-5.4-mini
  #       reasoning:
  #         effort: low
  #     prompt2:
  #       model: gpt-5.4
  #       reasoning:
  #         effort: high
  #     prompt3:
  #       model: gpt-5.4
  #       reasoning:
  #         effort: low

  # Uncomment to enable Gemini per-stage routing:
  # gemini:api:
  #   # Models: gemini-2.5-flash, gemini-2.5-pro
  #   # Flash: thinkingBudget 0-24576 (0 disables thinking)
  #   # Pro: thinkingBudget 128-32768 (cannot be disabled)
  #   # Use -1 for dynamic budget. includeThoughts: false recommended.
  #   stageModels:
  #     prompt1:
  #       model: gemini-2.5-flash
  #       thinkingConfig:
  #         thinkingBudget: 0
  #     prompt2:
  #       model: gemini-2.5-pro
  #       thinkingConfig:
  #         thinkingBudget: 8192
  #         includeThoughts: false
  #     prompt3:
  #       model: gemini-2.5-flash
`;
const EDGE_PADDING = 8;
const VIEWPORT_PADDING = 20;
const RUN_BOARD_WIDTH = 390;
const WIDE_BOARD_WIDTH = 390;
const JOB_LOAD_RETRY_MS = 300;
const JOB_LOAD_TIMEOUT_MS = 7000;
const EDGE_GAP_TOTAL = EDGE_PADDING * 2;
const APP_URL = "https://lumi.ceo/";
const EXTENSION_VERSION = (() => {
  try {
    return chrome.runtime?.getManifest?.().version || "0.0.0";
  } catch {
    return "0.0.0";
  }
})();
const STORY_BANK_GUIDE_URL = `${APP_URL}story-bank`;
const DEFAULT_ACTIVE_PROMPT_PROFILE_ID = "profile2";
const CHOOSE_AI_PROVIDER_MESSAGE = "Choose your AI provider to continue.";
const PROVIDER_SAVE_REQUIRED_MESSAGE =
  "Save your AI setup before uploading your Master Resume.";
const UNSUPPORTED_PROVIDER_MESSAGE =
  "Choose a supported AI provider before uploading your Master Resume.";
const NON_RESUME_UPLOAD_MESSAGE =
  "This file does not look like a resume. Choose a resume file and try again.";
const RUN_WAIT_MESSAGE_INTERVAL_MS = 10000;
const RUN_PROGRESS_HEARTBEAT_FRESH_MS = 15000;
const RUN_WAIT_MESSAGE_POOLS = {
  default: [
    "Still working on this step.",
    "Reviewing the current pass.",
    "Taking another pass through the response.",
    "Cleaning up the current output.",
    "Checking the latest result before moving on.",
  ],
  setup: [
    "Checking your setup.",
    "Connecting the run.",
    "Preparing the workspace.",
    "Getting the extension and workspace aligned.",
    "Making sure everything is ready to hand off.",
    "Finishing the run setup.",
  ],
  bootstrap: [
    "Reading your uploaded resume.",
    "Structuring the main sections.",
    "Saving your base resume.",
    "Normalizing the resume content.",
    "Checking the extracted structure.",
    "Preparing the base version for tailoring.",
  ],
  fitCheck: [
    "Reading the role.",
    "Pulling out the key requirements.",
    "Checking what matters most.",
    "Separating must-haves from nice-to-haves.",
    "Looking for the strongest recruiter signals.",
    "Comparing the role against your background.",
  ],
  positioning: [
    "Matching your experience to the role.",
    "Choosing the strongest angles.",
    "Tightening the positioning.",
    "Deciding what to emphasize first.",
    "Looking for the best evidence to support the fit.",
    "Shaping the narrative around the role.",
  ],
  draft: [
    "Writing the tailored resume.",
    "Sharpening the strongest bullets.",
    "Checking the draft for consistency.",
    "Reworking the draft around the role priorities.",
    "Tightening the wording and evidence.",
    "Checking that the draft stays grounded in your background.",
  ],
  saving: [
    "Saving your resume.",
    "Finalizing the workspace.",
    "Opening your workspace.",
    "Packaging the latest draft.",
    "Applying the last updates before handoff.",
    "Finishing the web handoff.",
  ],
};
let adapterModulePromise = null;
let zipModulePromise = null;
let runStatusHelpers = {
  createExplicitRunStatus(kind, tone, title, detail = "", actions = []) {
    if (!kind || kind === "none") return null;
    return {
      kind,
      tone: tone || "neutral",
      title: title || "",
      detail: detail || "",
      actions: Array.isArray(actions) ? actions : [],
    };
  },
  resolveRunStatusBox({
    explicitStatus = null,
    preflightStatus = null,
    runningDetail = "",
  } = {}) {
    if (explicitStatus?.kind && explicitStatus.kind !== "none") {
      return {
        ...explicitStatus,
        detail:
          explicitStatus.kind === "running" && runningDetail
            ? runningDetail
            : explicitStatus.detail || "",
        actions: Array.isArray(explicitStatus.actions)
          ? explicitStatus.actions
          : [],
      };
    }
    if (preflightStatus) {
      return {
        kind: "preflight",
        actions: Array.isArray(preflightStatus.actions)
          ? preflightStatus.actions
          : [],
        ...preflightStatus,
      };
    }
    return null;
  },
  shouldRotateRunningStatus(explicitStatus) {
    return explicitStatus?.kind === "running";
  },
  shouldClearExplicitStatusOnJobChange(explicitStatus) {
    return ["success", "error", "interrupted"].includes(
      explicitStatus?.kind || "",
    );
  },
  isRehydratableExtensionSessionStatus(status) {
    return new Set([
      "starting",
      "bootstrap_master",
      "scraped",
      "prompt1_done",
      "prompt2_done",
      "prompt3_done",
      "validated",
    ]).has(String(status || "").trim());
  },
};

function loadAdapterModule() {
  if (!adapterModulePromise) {
    adapterModulePromise = import(
      chrome.runtime.getURL("src/content/site-adapters/index.js")
    );
  }
  return adapterModulePromise;
}

function loadZipModule() {
  if (!zipModulePromise) {
    zipModulePromise = import(chrome.runtime.getURL("src/shared/zip.js"));
  }
  return zipModulePromise;
}

async function loadRunStatusHelpers() {
  try {
    runStatusHelpers = await import(
      chrome.runtime.getURL("src/content/run-status.js")
    );
  } catch (error) {
    logError("Failed to load run-status helpers.", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const PROMPT_FILE_DESCRIPTORS = [
  {
    templateName: "prompt1",
    label: "Role fit check",
    promptFileName: "prompt1.txt",
    downloadName: "prompt1.default.zip",
    editable: true,
  },
  {
    templateName: "prompt2",
    label: "Positioning plan",
    promptFileName: "prompt2.txt",
    downloadName: "prompt2.default.zip",
    editable: true,
  },
  {
    templateName: "prompt3",
    label: "Resume draft",
    promptFileName: "prompt3.txt",
    downloadName: "prompt3.default.zip",
    editable: true,
  },
  {
    templateName: "systemPrompt",
    label: "System prompt body",
    promptFileName: "system-prompt.txt",
    downloadName: "system-prompt.default.zip",
    editable: true,
  },
];

const USER_FACING_PROMPT_LABELS = new Map([
  ["Prompt 1", "Role fit check"],
  ["Prompt 2", "Positioning plan"],
  ["Prompt 3", "Resume draft"],
  ["Prompt 4", "Base resume setup"],
]);

const PROMPT_PROFILE_UI = {
  profile1: {
    label: "Safe",
  },
  profile2: {
    label: "Competitive",
  },
  profile3: {
    label: "Lean",
  },
  profile4: {
    label: "Direct",
  },
  profile5: {
    label: "Competitive+",
  },
};

// Prompt profiles that remain loadable/selectable in storage but are hidden
// from the tailoring-style picker UI. Existing selections still resolve.
const HIDDEN_PROMPT_PROFILE_IDS = new Set(["profile3"]);

// Display order for the tailoring-style picker. Profiles not listed here are
// appended after, in their existing key order. Hidden profiles still respect
// this order if they are surfaced (e.g. when currently selected).
const PROMPT_PROFILE_DISPLAY_ORDER = [
  "profile1",
  "profile2",
  "profile5",
  "profile4",
  "profile3",
];

function comparePromptProfileDisplayOrder(left, right) {
  const leftIndex = PROMPT_PROFILE_DISPLAY_ORDER.indexOf(left);
  const rightIndex = PROMPT_PROFILE_DISPLAY_ORDER.indexOf(right);
  const leftRank = leftIndex === -1 ? Number.POSITIVE_INFINITY : leftIndex;
  const rightRank = rightIndex === -1 ? Number.POSITIVE_INFINITY : rightIndex;
  return leftRank - rightRank;
}

const TAILORING_STYLE_INFO = [
  {
    profileId: "profile1",
    title: "Safe",
    lines: [
      "Closest to your original resume.",
      "Stretch: Low",
      "Truth safety: 9-10/10",
      "Hiring-manager fit: 7-8/10",
      "Interview risk: Low",
      "Best for conservative roles or when evidence is thin.",
    ],
  },
  {
    profileId: "profile2",
    title: "Competitive",
    lines: [
      "Recommended for most applications.",
      "Stretch: Medium-high",
      "Truth safety: 8-8.5/10",
      "Hiring-manager fit: 9-9.5/10",
      "Interview risk: Medium-low",
      "Best for competitive PM, tech, startup, and platform roles.",
    ],
  },
  {
    profileId: "profile5",
    title: "Competitive+",
    lines: [
      "Previous Competitive method (instruction/synthesis).",
      "Stretch: Medium-high",
      "Truth safety: 8-8.5/10",
      "Hiring-manager fit: 9-9.5/10",
      "Prompt 2 writes bullet instructions; Prompt 3 synthesizes them.",
      "Freely rewritten, mechanism-forward phrasing (review closely).",
      "Strong senior-level positioning (senior, not over-inflated).",
      "Best when you want bolder phrasing than source-bullet rewriting.",
    ],
  },
  {
    profileId: "profile4",
    title: "Direct",
    lines: [
      "Single prompt tailoring.",
      "Stretch: Medium",
      "Token spend: Lowest",
      "Prompt structure: One-shot writer only",
      "Prompt 3: Still strict JSON",
      "Model freedom: Highest",
      "Best when you want the shortest tailoring flow and are comfortable reviewing the final draft closely.",
    ],
  },
];

const TAILORING_STYLE_DISCLAIMER =
  "We never invent employers, dates, degrees, metrics, or unsupported skills. Higher stretch changes positioning language, not facts.";

function getPromptProfileLabel(profileId = "") {
  const normalized = String(profileId || "").trim();
  if (!normalized) return "Competitive";
  if (PROMPT_PROFILE_UI[normalized]?.label) {
    return PROMPT_PROFILE_UI[normalized].label;
  }
  return normalized;
}

function getPromptProfileRecord(promptTemplateProfiles, profileId) {
  return promptTemplateProfiles?.profiles?.[profileId] ?? null;
}

function profileHasCustomPromptBodies(promptTemplateProfiles, profileId) {
  const profile = getPromptProfileRecord(promptTemplateProfiles, profileId);
  if (!profile || typeof profile !== "object") {
    return false;
  }
  return [
    profile.prompt1TemplateAsset,
    profile.prompt2TemplateAsset,
    profile.prompt3TemplateAsset,
    profile.systemPromptTemplateAsset,
  ].some(
    (asset) =>
      asset &&
      typeof asset === "object" &&
      (typeof asset.content === "string" || typeof asset.filename === "string"),
  );
}

function isUsingExtensionPromptDefaultsMode(assets = state.assets) {
  return (assets?.promptDefaultsMode || "server") === "extension";
}

function isBoldPromptProfileEnabled(promptTemplateProfiles = state.assets?.promptTemplateProfiles) {
  return true;
}

function isPromptProfileSelectableInRunView(
  profileId,
  promptTemplateProfiles = state.assets?.promptTemplateProfiles,
) {
  if (profileId !== "profile3") {
    return true;
  }
  return isBoldPromptProfileEnabled(promptTemplateProfiles);
}

function getEditablePromptTemplateNamesForProfile(profileId = "") {
  if (String(profileId || "").trim() === "profile4") {
    return ["prompt3", "systemPrompt"];
  }

  return PROMPT_FILE_DESCRIPTORS.filter(
    ({ editable }) => editable !== false,
  ).map(({ templateName }) => templateName);
}

function isPromptTemplateEditableForProfile(templateName, profileId = "") {
  return getEditablePromptTemplateNamesForProfile(profileId).includes(
    templateName,
  );
}

function isPromptTemplateEditableForActiveProfile(templateName) {
  return isPromptTemplateEditableForProfile(
    templateName,
    state.assets?.activePromptProfileId || DEFAULT_ACTIVE_PROMPT_PROFILE_ID,
  );
}

function getRunnablePromptProfileId(
  promptTemplateProfiles = state.assets?.promptTemplateProfiles,
  selectedProfileId = state.assets?.activePromptProfileId || DEFAULT_ACTIVE_PROMPT_PROFILE_ID,
) {
  const normalizedProfileId = String(selectedProfileId || "").trim() || DEFAULT_ACTIVE_PROMPT_PROFILE_ID;
  if (isPromptProfileSelectableInRunView(normalizedProfileId, promptTemplateProfiles)) {
    return normalizedProfileId;
  }
  return DEFAULT_ACTIVE_PROMPT_PROFILE_ID;
}

function applyPromptTemplateProfilesState(promptTemplateProfiles) {
  if (!state.assets) {
    state.assets = {};
  }
  const nextPromptTemplateProfiles =
    promptTemplateProfiles && typeof promptTemplateProfiles === "object"
      ? promptTemplateProfiles
      : state.assets.promptTemplateProfiles || { profiles: {} };
  const nextActivePromptProfileId =
    String(nextPromptTemplateProfiles.activeProfileId || "").trim() ||
    DEFAULT_ACTIVE_PROMPT_PROFILE_ID;
  const activeProfile =
    nextPromptTemplateProfiles.profiles?.[nextActivePromptProfileId] ?? {};
  state.assets = {
    ...state.assets,
    promptTemplateProfiles: nextPromptTemplateProfiles,
    activePromptProfileId: nextActivePromptProfileId,
    prompt1TemplateAsset: activeProfile.prompt1TemplateAsset ?? null,
    prompt2TemplateAsset: activeProfile.prompt2TemplateAsset ?? null,
    prompt3TemplateAsset: activeProfile.prompt3TemplateAsset ?? null,
    systemPromptTemplateAsset: activeProfile.systemPromptTemplateAsset ?? null,
  };
}

async function ensureRunnablePromptProfileSelection() {
  const promptTemplateProfiles = state.assets?.promptTemplateProfiles;
  const activePromptProfileId =
    state.assets?.activePromptProfileId || DEFAULT_ACTIVE_PROMPT_PROFILE_ID;
  const nextRunnableProfileId = getRunnablePromptProfileId(
    promptTemplateProfiles,
    activePromptProfileId,
  );
  if (nextRunnableProfileId === activePromptProfileId) {
    return false;
  }
  await persistPromptProfileSelection(nextRunnableProfileId, { refresh: false });
  return true;
}

const ICONS = {
  home: `
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M2.5 8.9 10 2.5l7.5 6.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M5 7.5v7a1 1 0 0 0 1 1h2.6a.9.9 0 0 0 .9-.9V11a.7.7 0 0 1 .7-.7h0a.7.7 0 0 1 .7.7v3.6a.9.9 0 0 0 .9.9H14a1 1 0 0 0 1-1v-7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  aiStar: `<img src="${chrome.runtime.getURL(STAR_ICON_PATH)}" alt="" aria-hidden="true" />`,
  run: `
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M6 4.5h4.8a2 2 0 0 1 1.6.8l1.7 2.2H16a1.5 1.5 0 0 1 0 3h-1.3l-1.1 5H6.4l-1.1-5H4a1.5 1.5 0 0 1 0-3h1.9l1.7-2.2A2 2 0 0 1 9.2 4.5Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M8 15.5h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
      <path d="M7.2 8.2h5.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
    </svg>`,
  history: `
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2.2" y="4" width="15.6" height="12" rx="2.4" stroke="currentColor" stroke-width="1.7"/>
      <path d="M4.5 6.6 10 11.2l5.5-4.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M4.6 13.6 8 10.5M15.4 13.6 12 10.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
    </svg>`,
  settings: `
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="2.9" stroke="currentColor" stroke-width="1.7"/>
      <path d="M10 2.6c.8 0 1.5.1 2.2.3l.4 2.1c.5.2.9.4 1.4.8l1.9-.9c.5.5.9 1.2 1.2 1.9l-1.5 1.5c.1.5.2 1 .2 1.6s-.1 1.1-.2 1.6l1.5 1.5c-.3.7-.7 1.4-1.2 1.9l-1.9-.9c-.4.3-.9.6-1.4.8l-.4 2.1c-.7.2-1.4.3-2.2.3s-1.5-.1-2.2-.3l-.4-2.1c-.5-.2-.9-.4-1.4-.8l-1.9.9a6.7 6.7 0 0 1-1.2-1.9L4.7 11.6a6 6 0 0 1-.2-1.6c0-.6.1-1.1.2-1.6L3.2 6.9c.3-.7.7-1.4 1.2-1.9l1.9.9c.4-.3.9-.6 1.4-.8l.4-2.1c.7-.2 1.4-.3 2.2-.3Z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  minimize: `
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5 10h10" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
    </svg>`,
  current: `
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 4.2 15.2 7v6L10 15.8 4.8 13V7L10 4.2Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M10 4.2v11.6M4.8 7 10 10l5.2-3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  google: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>`,
  info: `
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="7.2" stroke="currentColor" stroke-width="1.6"/>
      <path d="M10 8.4v4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="10" cy="5.9" r="1" fill="currentColor"/>
    </svg>`,
  warning: `<img src="${chrome.runtime.getURL("src/assets/warning.png")}" alt="" aria-hidden="true" />`,
  eye: `
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M2.5 10s2.5-4.5 7.5-4.5 7.5 4.5 7.5 4.5-2.5 4.5-7.5 4.5S2.5 10 2.5 10Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      <circle cx="10" cy="10" r="2.2" stroke="currentColor" stroke-width="1.5"/>
    </svg>`,
  eyeOff: `
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 3 17 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M7.1 5.6A8.5 8.5 0 0 1 10 5.1c5 0 7.5 4.4 7.5 4.4a12.7 12.7 0 0 1-3 3.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12.2 12.3a2.3 2.3 0 0 1-3.1-3.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M5.3 7.1A13.1 13.1 0 0 0 2.5 9.5S5 14 10 14c1 0 1.9-.2 2.7-.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  upload: `
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 13.8V5.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
      <path d="M7.2 8.5 10 5.7l2.8 2.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M5.6 14.8h8.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
    </svg>`,
  download: `
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 5.2v7.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
      <path d="M7.2 9.6 10 12.4l2.8-2.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M5.6 14.8h8.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
    </svg>`,
  filter: `
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4.2 5.5h11.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
      <path d="M6.8 10h6.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
      <path d="M8.8 14.5h2.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
    </svg>`,
  chevronLeft: `
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M11.8 5.5 7.2 10l4.6 4.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  chevronRight: `
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M8.2 5.5 12.8 10l-4.6 4.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  refresh: `
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M15.7 8.2A5.8 5.8 0 0 0 5.1 6.3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M4.7 3.9v3.3H8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M4.3 11.8a5.8 5.8 0 0 0 10.6 1.9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M15.3 16.1v-3.3H12" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
};

let selectedJobDetailObserver = null;
let selectedJobDetailObservedRoot = null;
let selectedJobDetailObserverThrottle = null;
let lastUrl = location.href;
let routePollTimer = null;
let lastRouteSignature = "";
let pointerDragState = null;
let suppressNextClick = false;
let jobLoadTimer = null;
let selectedJobRefreshTimer = null;
let runningStatusMessageTimer = null;
let launcherLockNoticeTimer = null;
let selectedJobClickListenerAttached = false;
let promptStyleInfoClickListenerAttached = false;
const secretEditingState = {
  [PROVIDER_API_KEY_INPUT_ID]: false,
  [ONBOARDING_PROVIDER_API_KEY_INPUT_ID]: false,
  [APIFY_TOKEN_INPUT_ID]: false,
};
const secretDraftState = {
  [PROVIDER_API_KEY_INPUT_ID]: "",
  [ONBOARDING_PROVIDER_API_KEY_INPUT_ID]: "",
  [APIFY_TOKEN_INPUT_ID]: "",
};
const secretRevealState = {
  [APIFY_TOKEN_INPUT_ID]: false,
};
let providerDraftState = null;
let apifyDraftState = null;

const state = {
  boardOpen: false,
  currentView: "run",
  dismissed: false,
  dockSide: "right",
  launcherAlert: false,
  isRunning: false,
  isCanceling: false,
  awaitingAuth: false,
  awaitingStoryboard: false,
  popupStallHint: false,
  explicitRunStatus: null,
  statusTone: "neutral",
  statusTitle: "",
  statusDetail: "",
  rotatingStatusDetail: "",
  rotatingStatusIndex: -1,
  rotatingStatusPoolKey: "",
  statusActions: [],
  assets: null,
  setupState: null,
  history: [],
  extensionState: null,
  runLock: null,
  launcherLockNoticeVisible: false,
  routeMode: "hidden",
  connectionState: "signed_out",
  websiteAuthenticated: false,
  extensionConnected: false,
  jobLoadState: "idle",
  jobLoadStartedAt: null,
  customMessage: "",
  manualJobDescription: "",
  manualJobDetailsOpen: false,
  manualJobTitle: null,
  manualJobCompany: null,
  manualJobSourceUrl: null,
  scrapeIssue: "",
  storyboardHelpOpen: false,
  currentJob: null,
  jobInspectionRequested: false,
  selectedJobRefreshing: false,
  selectedJobExpectedSourceUrl: "",
  selectedJobRefreshAttempts: 0,
  activeRunJob: null,
  activeRunId: null,
  ownedRunId: null,
  previewHandoffComplete: false,
  lastProgressHeartbeatAt: 0,
  runningDetailSource: "",
  historySearch: "",
  historySortDirection: "desc",
  historyPage: 1,
  historyFilterOpen: false,
  historyConnecting: false,
  deletingHistoryRunId: null,
  promptStyleInfoOpen: false,
  promptSyncPromise: null,
  connectionCheckPromise: null,
  runSourceMode: null,
  masterResumeReplaceOpen: false,
  storyboardReplaceOpen: false,
  providerSettingsEditOpen: false,
  masterResumeImportInFlight: false,
  masterResumeImportMessage: "",
  masterResumeImportTone: "neutral",
  providerValidationAttempted: false,
  providerValidationMissingFields: [],
};

function logError(message, data) {
  if (data === undefined) {
    console.error(`${LOG_PREFIX} ${message}`);
    return;
  }
  console.error(`${LOG_PREFIX} ${message}`, data);
}

function hasVisibleLauncherRoute() {
  return state.routeMode !== "hidden";
}

function hasActiveSelectedJobRoute() {
  return state.routeMode === "active";
}

function isNonLinkedInManualRoute() {
  return state.routeMode === "manual" && location.hostname !== "www.linkedin.com";
}

function setRouteMode(nextMode) {
  const normalizedMode = nextMode || "hidden";
  if (state.routeMode === normalizedMode) {
    return;
  }
  state.routeMode = normalizedMode;
  state.runSourceMode = null;
}

function deriveFallbackRouteModeFromLocation() {
  if (!/^https?:$/.test(location.protocol || "")) {
    return "hidden";
  }

  const pathname = location.pathname || "";
  if (location.hostname !== "www.linkedin.com") {
    return "manual";
  }

  if (!pathname.startsWith("/jobs")) {
    return "manual";
  }

  if (extractLinkedInViewJobIdFromPathname(pathname)) {
    return "active";
  }

  try {
    const parsed = new URL(location.href);
    const currentJobId = parsed.searchParams.get("currentJobId")?.trim() || "";
    if (/^\d+$/.test(currentJobId)) {
      return "active";
    }

    if (
      parsed.pathname.startsWith("/jobs/search") ||
      parsed.pathname.startsWith("/jobs/collections/")
    ) {
      return "waiting";
    }
  } catch {
    return "manual";
  }

  return "manual";
}

function getCurrentRouteSignature() {
  const routeMode = deriveFallbackRouteModeFromLocation();
  let selectedJobId = "";
  try {
    const parsed = new URL(location.href);
    selectedJobId =
      parsed.searchParams.get("currentJobId")?.trim() ||
      extractLinkedInViewJobIdFromPathname(parsed.pathname) ||
      "";
  } catch {
    selectedJobId = "";
  }
  return `${routeMode}|${selectedJobId}|${location.pathname}|${location.search}`;
}

function $(id) {
  return document.getElementById(id);
}

async function sendMessage(type, payload) {
  if (isContentScriptDisposed()) {
    throw new Error("Extension context invalidated.");
  }
  try {
    return await chrome.runtime.sendMessage({ type, payload });
  } catch (error) {
    if (isExtensionContextInvalidatedError(error)) {
      destroyContentScriptInstance("extension-context-invalidated");
    }
    throw error;
  }
}

function trackAnalyticsEvent(event, properties = {}) {
  return sendMessage("TRACK_ANALYTICS_EVENT", { event, properties }).catch(
    () => {},
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeSecretValue(value) {
  return String(value || "").trim();
}

function shouldEndSecretEdit(draftValue, savedValue) {
  const normalizedDraft = normalizeSecretValue(draftValue);
  if (!normalizedDraft) {
    return true;
  }
  return normalizedDraft === normalizeSecretValue(savedValue);
}

function getProviderSecretInputPresentation({
  savedValue,
  draftValue,
  isEditing,
}) {
  if (isEditing) {
    return {
      type: "password",
      readOnly: false,
      placeholder: "API key",
      value: draftValue || "",
    };
  }

  if (normalizeSecretValue(savedValue)) {
    return {
      type: "password",
      readOnly: true,
      placeholder: "Saved API key. Focus to replace.",
      value: "",
    };
  }

  return {
    type: "password",
    readOnly: false,
    placeholder: "API key required",
    value: "",
  };
}

function getProviderSecretHint({ savedValue, isEditing }) {
  if (isEditing) {
    return "";
  }

  const normalizedSaved = normalizeSecretValue(savedValue);
  if (!normalizedSaved) {
    return "";
  }

  const tailLength = Math.min(4, normalizedSaved.length);
  return `Saved API key ending in ${normalizedSaved.slice(-tailLength)}. Focus to replace.`;
}

function truncateDisplayText(value, maxLength = 28) {
  const normalized = String(value || "").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(1, maxLength - 3))}...`;
}

function truncateFilenameForDisplay(value, maxLength = 40) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length <= maxLength) {
    return normalized;
  }

  const extensionIndex = normalized.lastIndexOf(".");
  const hasExtension =
    extensionIndex > 0 && extensionIndex < normalized.length - 1;
  const extension = hasExtension ? normalized.slice(extensionIndex) : "";

  const reservedTailLength = extension
    ? Math.min(Math.max(extension.length, 8), maxLength - 4)
    : Math.min(8, maxLength - 4);
  const headLength = Math.max(3, maxLength - 3 - reservedTailLength);
  const tail = extension
    ? normalized.slice(-reservedTailLength)
    : normalized.slice(-Math.max(3, reservedTailLength));

  return `${normalized.slice(0, headLength)}...${tail}`;
}

function formatMasterResumeImportError(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/AI API error|API request failed|API returned|status\s+\d{3}/i.test(message)) {
    return message;
  }
  if (/not implemented|not available|unsupported/i.test(message)) {
    return UNSUPPORTED_PROVIDER_MESSAGE;
  }
  if (/not_resume|not a resume|does not look like a resume|does not contain enough resume/i.test(message)) {
    return NON_RESUME_UPLOAD_MESSAGE;
  }
  if (
    /active LLM profile|LLM runner|API key|required for the active runner|auth_required|Please log into|provider|AI setup/i.test(
      message,
    )
  ) {
    return "AI setup needs attention. Save or change your provider, then upload your Master Resume again.";
  }
  if (/prompt\s*4|resumedata|validation|json|schema|extract/i.test(message)) {
    return "Resume extraction failed. Check that the file contains resume text, then try again.";
  }
  return message || "Unable to save Master Resume.";
}

function getSecretPlaceholder(inputId) {
  if (inputId === APIFY_TOKEN_INPUT_ID) {
    return "Paste your Apify API token";
  }
  return "API key required";
}

function getSavedProfileById(profileId, settings = null) {
  const resolvedSettings = settings || state.assets?.llmSettings;
  if (!resolvedSettings?.profiles || !profileId) return null;
  return resolvedSettings.profiles[profileId] ?? null;
}

function isUnsupportedLlmProfile(profile) {
  return false;
}

function isLlmProfileReady(profile) {
  if (!profile || isUnsupportedLlmProfile(profile)) return false;
  if (profile.mode === "web_automation") {
    return Boolean(String(profile.targetUrl || "").trim());
  }
  if (profile.mode === "api") {
    return Boolean(
      String(profile.apiBaseUrl || "").trim() &&
        String(profile.model || "").trim() &&
        normalizeSecretValue(profile.apiKey),
    );
  }
  return false;
}

function getDefaultProviderDraftProfileId(settings) {
  const activeProfile = getSavedProfileById(settings?.activeProfileId, settings);
  if (isLlmProfileReady(activeProfile)) return activeProfile.id || "";
  const chatgptWeb = getSavedProfileById("chatgpt:web_automation", settings);
  if (chatgptWeb) return "chatgpt:web_automation";
  return "";
}

function createProviderDraftState(profileId = null, settings = null) {
  const resolvedSettings = settings || state.assets?.llmSettings;
  if (!resolvedSettings?.profiles) {
    return {
      selectedProfileId: "",
      targetUrl: "",
      apiBaseUrl: "",
      model: "",
      apiKey: "",
      dirty: false,
    };
  }

  const resolvedProfileId =
    typeof profileId === "string"
      ? profileId
      : getDefaultProviderDraftProfileId(resolvedSettings);
  const profile =
    getSavedProfileById(resolvedProfileId, resolvedSettings) || {};
  return {
    selectedProfileId: resolvedProfileId,
    targetUrl: profile.targetUrl || "",
    apiBaseUrl: profile.apiBaseUrl || "",
    model: profile.model || "",
    apiKey: profile.apiKey || "",
    dirty: false,
  };
}

function hasProviderDraftChanges(draft, settings = null) {
  const resolvedSettings = settings || state.assets?.llmSettings;
  if (!resolvedSettings?.profiles || !draft) return false;
  if (!draft.selectedProfileId) return false;
  if (
    (draft.selectedProfileId || "") !== (resolvedSettings.activeProfileId || "")
  ) {
    return true;
  }
  const savedProfile = getSavedProfileById(
    draft.selectedProfileId,
    resolvedSettings,
  );
  if (!savedProfile) return true;
  if (savedProfile.mode === "web_automation") {
    return (savedProfile.targetUrl || "") !== (draft.targetUrl || "");
  }
  return (
    (savedProfile.apiBaseUrl || "") !== (draft.apiBaseUrl || "") ||
    (savedProfile.model || "") !== (draft.model || "") ||
    normalizeSecretValue(savedProfile.apiKey) !==
      normalizeSecretValue(draft.apiKey)
  );
}

function syncProviderDraftState({ force = false } = {}) {
  const settings = state.assets?.llmSettings;
  const selectedProfile = getSavedProfileById(
    providerDraftState?.selectedProfileId,
    settings,
  );
  if (
    force ||
    !providerDraftState ||
    !providerDraftState.dirty ||
    !selectedProfile
  ) {
    providerDraftState = createProviderDraftState(
      selectedProfile ? providerDraftState?.selectedProfileId : null,
      settings,
    );
  }
  providerDraftState.dirty = hasProviderDraftChanges(
    providerDraftState,
    settings,
  );
  return providerDraftState;
}

function setProviderDraftState(updates = {}, { replace = false } = {}) {
  const next = replace
    ? { ...createProviderDraftState(updates.selectedProfileId), ...updates }
    : { ...syncProviderDraftState(), ...updates };
  next.dirty = hasProviderDraftChanges(next);
  providerDraftState = next;
  return providerDraftState;
}

function createApifyDraftState() {
  return {
    enabled: state.assets?.apifyFallbackSettings?.enabled === true,
    apiToken: state.assets?.apifyFallbackSettings?.apiToken || "",
    dirty: false,
  };
}

function hasApifyDraftChanges(draft) {
  const saved = state.assets?.apifyFallbackSettings || {};
  return (
    Boolean(draft?.enabled) !== (saved.enabled === true) ||
    normalizeSecretValue(draft?.apiToken) !==
      normalizeSecretValue(saved.apiToken)
  );
}

function syncApifyDraftState({ force = false } = {}) {
  if (force || !apifyDraftState || !apifyDraftState.dirty) {
    apifyDraftState = createApifyDraftState();
  }
  apifyDraftState.dirty = hasApifyDraftChanges(apifyDraftState);
  return apifyDraftState;
}

function setApifyDraftState(updates = {}) {
  apifyDraftState = { ...syncApifyDraftState(), ...updates };
  apifyDraftState.dirty = hasApifyDraftChanges(apifyDraftState);
  return apifyDraftState;
}

function isProviderSecretInputId(inputId) {
  return (
    inputId === PROVIDER_API_KEY_INPUT_ID ||
    inputId === ONBOARDING_PROVIDER_API_KEY_INPUT_ID
  );
}

function getSavedSecretValue(inputId) {
  if (inputId === APIFY_TOKEN_INPUT_ID) {
    return state.assets?.apifyFallbackSettings?.apiToken || "";
  }
  if (isProviderSecretInputId(inputId)) {
    const settings = state.assets?.llmSettings;
    const selectedProfileId = syncProviderDraftState().selectedProfileId;
    return getSavedProfileById(selectedProfileId, settings)?.apiKey || "";
  }
  return "";
}

function getDraftSecretValue(inputId) {
  if (inputId === APIFY_TOKEN_INPUT_ID) {
    return syncApifyDraftState().apiToken || "";
  }
  if (isProviderSecretInputId(inputId)) {
    return syncProviderDraftState().apiKey || "";
  }
  return "";
}

function getSavedProviderImportReadiness() {
  const settings = state.assets?.llmSettings;
  const profile = getSavedProfileById(settings?.activeProfileId, settings);
  if (!profile) {
    return {
      ready: false,
      message: CHOOSE_AI_PROVIDER_MESSAGE,
    };
  }
  if (isUnsupportedLlmProfile(profile)) {
    return {
      ready: false,
      message: UNSUPPORTED_PROVIDER_MESSAGE,
    };
  }
  if (profile.mode === "web_automation") {
    return {
      ready: isLlmProfileReady(profile),
      message: PROVIDER_SAVE_REQUIRED_MESSAGE,
    };
  }
  if (profile.mode === "api") {
    return {
      ready: isLlmProfileReady(profile),
      message: PROVIDER_SAVE_REQUIRED_MESSAGE,
    };
  }
  return {
    ready: false,
    message: PROVIDER_SAVE_REQUIRED_MESSAGE,
  };
}

function syncSecretInput(inputId) {
  const input = $(inputId);
  if (!(input instanceof HTMLInputElement)) return;

  const savedValue = getSavedSecretValue(inputId);
  const draftValue = getDraftSecretValue(inputId);
  const isEditing = secretEditingState[inputId] === true;
  input.dataset.secretInput = "true";
  input.autocomplete = "off";
  input.spellcheck = false;

  if (isEditing) {
    if (isProviderSecretInputId(inputId)) {
      const presentation = getProviderSecretInputPresentation({
        savedValue,
        draftValue: secretDraftState[inputId] || draftValue,
        isEditing: true,
      });
      input.type = presentation.type;
      input.readOnly = presentation.readOnly;
      input.placeholder = presentation.placeholder;
      input.value = presentation.value;
      return;
    }

    input.type = "password";
    input.readOnly = false;
    input.placeholder = getSecretPlaceholder(inputId);
    input.value = secretDraftState[inputId] || "";
    return;
  }

  if (savedValue) {
    if (inputId === APIFY_TOKEN_INPUT_ID) {
      input.type = secretRevealState[inputId] === true ? "text" : "password";
      input.readOnly = true;
      input.placeholder = "";
      input.value = savedValue;
    } else {
      const presentation = getProviderSecretInputPresentation({
        savedValue,
        draftValue,
        isEditing: false,
      });
      input.type = presentation.type;
      input.readOnly = presentation.readOnly;
      input.placeholder = presentation.placeholder;
      input.value = presentation.value;
    }
    return;
  }

  input.type = "password";
  input.readOnly = false;
  input.placeholder = getSecretPlaceholder(inputId);
  input.value = "";
}

function syncSecretRevealToggle(inputId) {
  if (inputId !== APIFY_TOKEN_INPUT_ID) return;
  const button = $(APIFY_TOKEN_TOGGLE_ID);
  if (!(button instanceof HTMLButtonElement)) return;
  const actualValue = getSavedSecretValue(inputId);
  const isEditing = secretEditingState[inputId] === true;
  const isVisible = secretRevealState[inputId] === true;
  button.hidden = !actualValue || isEditing;
  button.setAttribute("aria-label", isVisible ? "Hide token" : "Show token");
  button.setAttribute("title", isVisible ? "Hide token" : "Show token");
  button.innerHTML = icon(isVisible ? "eyeOff" : "eye");
}

function beginSecretEdit(input) {
  if (!(input instanceof HTMLInputElement) || input.readOnly !== true) return;
  const inputId = input.id;
  secretEditingState[inputId] = true;
  secretDraftState[inputId] = isProviderSecretInputId(inputId)
    ? ""
    : getDraftSecretValue(inputId);
  secretRevealState[inputId] = false;
  syncSecretInput(inputId);
  syncSecretRevealToggle(inputId);
  if (inputId === PROVIDER_API_KEY_INPUT_ID) {
    syncProviderSecretHint(inputId, PROVIDER_API_KEY_HINT_ID);
  } else if (inputId === ONBOARDING_PROVIDER_API_KEY_INPUT_ID) {
    syncProviderSecretHint(inputId, ONBOARDING_PROVIDER_API_KEY_HINT_ID);
  }
  const next = $(inputId);
  if (next instanceof HTMLInputElement) {
    next.focus();
    next.select();
  }
}

function endSecretEdit(inputId) {
  secretEditingState[inputId] = false;
  secretDraftState[inputId] = "";
  secretRevealState[inputId] = false;
  syncSecretInput(inputId);
  syncSecretRevealToggle(inputId);
  if (inputId === PROVIDER_API_KEY_INPUT_ID) {
    syncProviderSecretHint(inputId, PROVIDER_API_KEY_HINT_ID);
  } else if (inputId === ONBOARDING_PROVIDER_API_KEY_INPUT_ID) {
    syncProviderSecretHint(inputId, ONBOARDING_PROVIDER_API_KEY_HINT_ID);
  }
}

function toggleSecretReveal(inputId) {
  if (inputId !== APIFY_TOKEN_INPUT_ID) return;
  if (secretEditingState[inputId] === true) return;
  if (!getSavedSecretValue(inputId)) return;
  secretRevealState[inputId] = !secretRevealState[inputId];
  syncSecretInput(inputId);
  syncSecretRevealToggle(inputId);
}

function syncProviderSecretHint(inputId, hintId) {
  const hint = $(hintId);
  if (!(hint instanceof HTMLElement)) return;
  const message = getProviderSecretHint({
    savedValue: getSavedSecretValue(inputId),
    isEditing: secretEditingState[inputId] === true,
  });
  hint.hidden = !message;
  hint.textContent = message;
}

function getOnboardingProviderDraftState() {
  const providerSettings = state.assets?.llmSettings;
  const providerDraft = syncProviderDraftState();
  const selectedProfile = getSavedProfileById(
    providerDraft.selectedProfileId,
    providerSettings,
  );
  if (!selectedProfile) {
    return {
      ready: false,
      selectedProfile: null,
      message: "",
    };
  }

  if (isUnsupportedLlmProfile(selectedProfile)) {
    return {
      ready: false,
      selectedProfile,
      message: "",
    };
  }

  if (selectedProfile.mode === "web_automation") {
    return {
      ready: Boolean(providerDraft.targetUrl.trim()),
      selectedProfile,
      message: PROVIDER_SAVE_REQUIRED_MESSAGE,
    };
  }

  if (selectedProfile.mode === "api") {
    const requiresApiKey = requiresApiKeyForApiBaseUrl(
      providerDraft.apiBaseUrl,
    );
    return {
      ready: Boolean(
        providerDraft.apiBaseUrl.trim() &&
        providerDraft.model.trim() &&
        (!requiresApiKey || normalizeSecretValue(providerDraft.apiKey)),
      ),
      selectedProfile,
      message: PROVIDER_SAVE_REQUIRED_MESSAGE,
    };
  }

  return {
    ready: false,
    selectedProfile,
    message: PROVIDER_SAVE_REQUIRED_MESSAGE,
  };
}

function syncOnboardingProviderContinueState() {
  const onboardingRoot = $(RUN_ONBOARDING_ID);
  if (!(onboardingRoot instanceof HTMLElement)) return;
  const nextButton = onboardingRoot.querySelector(
    '[data-onboarding-action="save_provider_continue"]',
  );
  if (!(nextButton instanceof HTMLButtonElement)) return;
  nextButton.disabled = !getOnboardingProviderDraftState().ready;
  syncProviderValidationIndicators();
}

function getProviderDraftMissingFields(draft = syncProviderDraftState()) {
  const profile = getSavedProfileById(draft?.selectedProfileId);
  if (!profile) return ["provider"];
  if (profile.mode === "web_automation") {
    return String(draft.targetUrl || "").trim() ? [] : ["targetUrl"];
  }
  if (profile.mode === "api") {
    const missing = [];
    if (!String(draft.apiBaseUrl || "").trim()) missing.push("apiBaseUrl");
    if (!String(draft.model || "").trim()) missing.push("model");
    if (
      requiresApiKeyForApiBaseUrl(draft.apiBaseUrl) &&
      !normalizeSecretValue(draft.apiKey)
    ) {
      missing.push("apiKey");
    }
    return missing;
  }
  return ["provider"];
}

function getProviderMissingFieldsMessage(missingFields) {
  const labels = {
    provider: "AI provider",
    targetUrl: "provider URL",
    apiBaseUrl: "API endpoint",
    model: "model",
    apiKey: "API key",
  };
  const names = missingFields.map((field) => labels[field] || field);
  if (names.length === 1) return `Add ${names[0]} before saving.`;
  return `Add ${names.slice(0, -1).join(", ")} and ${names.at(-1)} before saving.`;
}

function setProviderValidationState(missingFields = [], attempted = true) {
  state.providerValidationAttempted = attempted;
  state.providerValidationMissingFields = [...missingFields];
}

function refreshProviderValidationState() {
  if (!state.providerValidationAttempted) return;
  state.providerValidationMissingFields = getProviderDraftMissingFields();
}

function syncProviderValidationIndicators() {
  if (state.providerValidationAttempted) {
    refreshProviderValidationState();
  }
  const missingFields = state.providerValidationAttempted
    ? new Set(state.providerValidationMissingFields)
    : new Set();
  const requiredEmptyFields = new Set(getProviderDraftMissingFields());
  const mark = (id, field) => {
    const node = $(id);
    if (node instanceof HTMLElement) {
      const isInvalid = missingFields.has(field);
      node.dataset.invalid = isInvalid ? "true" : "false";
      node.dataset.requiredEmpty = !isInvalid && requiredEmptyFields.has(field)
        ? "true"
        : "false";
    }
  };
  mark(PROVIDER_SELECT_ID, "provider");
  mark(PROVIDER_WEB_ROW_ID, "targetUrl");
  mark(PROVIDER_API_BASE_ROW_ID, "apiBaseUrl");
  mark(PROVIDER_MODEL_ROW_ID, "model");
  mark(PROVIDER_API_KEY_ROW_ID, "apiKey");
  mark("resume-matcher-onboarding-provider-select", "provider");
  mark("resume-matcher-onboarding-provider-web-row", "targetUrl");
  mark("resume-matcher-onboarding-provider-api-row", "apiBaseUrl");
  mark("resume-matcher-onboarding-provider-model-row", "model");
  mark("resume-matcher-onboarding-provider-key-row", "apiKey");
}

function syncProviderSaveButtonState() {
  const button = $(PROVIDER_SAVE_ID);
  if (!(button instanceof HTMLButtonElement)) return;
  button.disabled =
    !state.providerSettingsEditOpen ||
    !state.assets?.activeAccountKey ||
    !syncProviderDraftState().dirty;
  syncProviderValidationIndicators();
}

function syncApifySaveButtonState() {
  const button = $(APIFY_SAVE_ID);
  if (!(button instanceof HTMLButtonElement)) return;
  const draft = syncApifyDraftState();
  button.hidden = !draft.enabled && !draft.dirty;
  button.disabled = !draft.dirty;
}

function isSecretInputId(inputId) {
  return [
    PROVIDER_API_KEY_INPUT_ID,
    ONBOARDING_PROVIDER_API_KEY_INPUT_ID,
    APIFY_TOKEN_INPUT_ID,
  ].includes(inputId);
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function icon(name) {
  return ICONS[name] || "";
}

function renderGoogleButtonLabel(label) {
  return `<span class="resume-matcher-button__icon resume-matcher-button__icon--google">${icon("google")}</span><span>${escapeHtml(label)}</span>`;
}

function getAppOrigin() {
  return (state.assets?.appOrigin || APP_URL).trim().replace(/\/+$/, "");
}

function toAbsoluteAppUrl(url) {
  if (!url) return "";
  try {
    return new URL(url, getAppOrigin()).toString();
  } catch {
    return String(url || "");
  }
}

function getBackendMasterResume() {
  return state.assets?.backendMasterResume ?? null;
}

function hasBackendMasterResume() {
  return Boolean(getBackendMasterResume()?.resumeId);
}

function getBackendMasterResumeLabel() {
  const master = getBackendMasterResume();
  return (
    master?.title?.trim?.() ||
    master?.filename?.trim?.() ||
    "Master Resume"
  );
}

function getBackendMasterResumeUrl() {
  const resumeId = getBackendMasterResume()?.resumeId;
  return resumeId
    ? `${getAppOrigin()}/resumes/${encodeURIComponent(resumeId)}`
    : getAppOrigin();
}

function isProviderReadyForMasterImport() {
  return getSavedProviderImportReadiness().ready === true;
}

function getResolvedOnboardingStep() {
  const setupState = state.setupState;
  if (!setupState || setupState.mode !== "onboarding") {
    return null;
  }
  if (setupState.step === "assets" && !isProviderReadyForMasterImport()) {
    return "provider";
  }
  if (
    setupState.step === "provider" &&
    isProviderReadyForMasterImport()
  ) {
    return "assets";
  }
  return setupState.step;
}

function getResolvedOnboardingTitle() {
  const resolvedStep = getResolvedOnboardingStep();
  if (resolvedStep === "assets") {
    return "Master Resume";
  }
  if (resolvedStep === "provider") {
    return "Choose your AI setup";
  }
  return state.setupState?.title || "Welcome";
}

function renderFileActionIcon(action) {
  if (action === "upload") {
    return `<img class="resume-matcher-file-chip__icon-image" src="${chrome.runtime.getURL(UPLOAD_ICON_PATH)}" alt="" />`;
  }
  return `<img class="resume-matcher-file-chip__icon-image" src="${chrome.runtime.getURL(DELETE_ICON_PATH)}" alt="" />`;
}

function renderPromptActionButtons(
  templateName,
  hasFile,
  canDownloadDefault,
  label,
  editable = true,
) {
  const downloadButton = canDownloadDefault
    ? `<button id="${promptDownloadId(templateName)}" type="button" class="resume-matcher-file-chip__action" aria-label="Download default ${label}" title="Download default ${label}"><img class="resume-matcher-file-chip__icon-image" src="${chrome.runtime.getURL(DOWNLOAD_ICON_PATH)}" alt="" /></button>`
    : "";
  const actionButton = editable
    ? `<button id="${promptActionId(templateName)}" type="button" class="resume-matcher-file-chip__action" aria-label="${hasFile ? `Delete ${label}` : `Upload ${label}`}" title="${hasFile ? `Delete ${label}` : `Upload ${label}`}">${renderFileActionIcon(hasFile ? "delete" : "upload")}</button>`
    : "";
  return `${downloadButton}${actionButton}`;
}

function promptLabelId(templateName) {
  return `resume-matcher-${templateName}-label`;
}

function promptRowId(templateName) {
  return `resume-matcher-${templateName}-row`;
}

function promptActionId(templateName) {
  return `resume-matcher-${templateName}-action`;
}

function promptDownloadId(templateName) {
  return `resume-matcher-${templateName}-download`;
}

function promptInputId(templateName) {
  return `resume-matcher-${templateName}-input`;
}

function sanitizeDownloadTimestamp(value = new Date()) {
  return value.toISOString().replace(/[:.]/g, "-");
}

function downloadJsonFile(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

// Fetch the most recent run's diagnostic logs from the background and download
// them as JSON. Used by the inline "Save logs" link on failure cards and the
// "Download logs" button in advanced settings.
async function downloadDiagnosticLogs() {
  const payload = await sendMessage("EXPORT_LOGS", {});
  downloadJsonFile(
    `lumi-coach-logs-${sanitizeDownloadTimestamp()}.json`,
    payload,
  );
  return payload;
}

function getMatchingCurrentSession(entry) {
  const session = state.extensionState;
  if (!entry?.runId || !session?.sessionId) return null;
  return entry.runId === session.sessionId ? session : null;
}

function coalesceRunField(entry, session, entryKey, sessionKey = entryKey) {
  return entry?.[entryKey] ?? session?.[sessionKey] ?? null;
}

function buildPromptDebugExport(entry, session) {
  return {
    promptMetadata: coalesceRunField(entry, session, "promptMetadata"),
    prompt4Input: coalesceRunField(entry, session, "prompt4Input"),
    prompt4Raw: coalesceRunField(entry, session, "prompt4Raw"),
    prompt4Output: entry?.prompt4Result ?? session?.prompt4Result ?? null,
    prompt1Input: coalesceRunField(entry, session, "prompt1Input"),
    prompt1Raw: coalesceRunField(entry, session, "prompt1Raw"),
    prompt1Output: entry?.prompt1Result ?? session?.prompt1Result ?? null,
    prompt2Input: coalesceRunField(entry, session, "prompt2Input"),
    prompt2Raw: coalesceRunField(entry, session, "prompt2Raw"),
    prompt2Output: entry?.prompt2Result ?? session?.prompt2Result ?? null,
    prompt3Input: coalesceRunField(entry, session, "prompt3Input"),
    prompt3Raw: coalesceRunField(entry, session, "prompt3Raw"),
    prompt3Output: entry?.prompt3Parsed ?? session?.prompt3Parsed ?? null,
    prompt3Feedback: coalesceRunField(entry, session, "prompt3Feedback"),
  };
}

function exportHistoryData() {
  const exportedAt = new Date().toISOString();
  const items = (Array.isArray(state.history) ? state.history : []).map((entry) => {
    const currentSession = getMatchingCurrentSession(entry);
    return {
      runId: entry?.runId ?? null,
      jdLink: entry?.sourceUrl ?? null,
      jobTitle: entry?.title ?? null,
      company: entry?.company ?? null,
      location: entry?.location ?? null,
      datePosted: entry?.datePosted ?? null,
      generatedAt: entry?.generatedAt ?? null,
      status: entry?.status ?? null,
      resumeId: entry?.resumeId ?? null,
      previewUrl: entry?.previewUrl ?? null,
      providerId: entry?.providerId ?? null,
      providerLabel: entry?.providerLabel ?? null,
      providerVendor: entry?.providerVendor ?? null,
      providerMode: entry?.providerMode ?? null,
      jobSource: entry?.jobSource ?? null,
      jobReadiness: entry?.jobReadiness ?? null,
      descriptionProvenance: entry?.descriptionProvenance ?? null,
      descriptionLength: entry?.descriptionLength ?? null,
      scrapeConfidence: entry?.scrapeConfidence ?? null,
      manualJobInputUsed: entry?.manualJobInputUsed ?? null,
      customContextProvided: entry?.customContextProvided ?? null,
      customContextLength: entry?.customContextLength ?? null,
      storyboardPresent: entry?.storyboardPresent ?? null,
      prompt1DurationMs: entry?.prompt1DurationMs ?? null,
      prompt2DurationMs: entry?.prompt2DurationMs ?? null,
      prompt3DurationMs: entry?.prompt3DurationMs ?? null,
      patchDurationMs: entry?.patchDurationMs ?? null,
      totalDurationMs: entry?.totalDurationMs ?? null,
      prompt3ValidationErrorCount: entry?.prompt3ValidationErrorCount ?? null,
      ...buildPromptDebugExport(entry, currentSession),
    };
  });
  const currentSessionPromptDebug = state.extensionState
    ? buildPromptDebugExport({}, state.extensionState)
    : null;

  downloadJsonFile(
    `lumi-coach-runs-${sanitizeDownloadTimestamp()}.json`,
    {
      appName: "Lumi Coach",
      exportedAt,
      format: "json",
      itemCount: items.length,
      currentSessionPromptDebug,
      items,
    },
  );
}

async function downloadDefaultPrompt(templateName) {
  if (!isPromptTemplateEditableForActiveProfile(templateName)) {
    throw new Error(
      `${templateName} is not available for ${getPromptProfileLabel(
        state.assets?.activePromptProfileId || DEFAULT_ACTIVE_PROMPT_PROFILE_ID,
      )}.`,
    );
  }
  const descriptor = PROMPT_FILE_DESCRIPTORS.find((item) => item.templateName === templateName);
  if (!descriptor?.downloadName) {
    return;
  }

  const response = await sendMessage("GET_DEFAULT_PROMPT_DOWNLOAD", {
    templateName,
    promptProfileId:
      state.assets?.activePromptProfileId || DEFAULT_ACTIVE_PROMPT_PROFILE_ID,
  });
  if (!response?.ok || !Array.isArray(response.entries) || !response.entries.length) {
    throw new Error(response?.error || `Failed to load default ${descriptor.label}.`);
  }

  const { createZipArchive } = await loadZipModule();
  const archive = createZipArchive(response.entries);
  const blob = new Blob([archive], { type: "application/zip" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = response.downloadName || descriptor.downloadName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

async function refreshDefaultPromptsManually() {
  if (state.promptSyncPromise) {
    await state.promptSyncPromise.catch(() => {});
  }

  setRunStatus(
    "interrupted",
    "Refreshing prompts",
    "Syncing the latest default prompts from Lumi Coach.",
  );

  const syncPromise = sendMessage("SYNC_DEFAULT_PROMPTS");
  state.promptSyncPromise = syncPromise;
  renderSettings();

  let response;
  try {
    response = await syncPromise;
  } finally {
    if (state.promptSyncPromise === syncPromise) {
      state.promptSyncPromise = null;
    }
    renderSettings();
  }

  if (!response?.ok) {
    throw new Error(response?.error || "Failed to refresh prompt defaults.");
  }

  await refreshBoardData();

  if (response.promptDefaultsMode === "extension") {
    setRunStatus(
      "success",
      "Extension prompts active",
      "Server prompt sync is off. Lumi Coach is using the packaged extension prompts.",
    );
    return;
  }

  if (response.degraded) {
    setRunStatus(
      "interrupted",
      "Using cached prompts",
      "Prompt sync was unavailable, so Lumi Coach kept the current cached defaults.",
    );
    return;
  }

  const changedCount = Array.isArray(response.changedKeys)
    ? response.changedKeys.length
    : 0;
  setRunStatus(
    "success",
    "Prompts refreshed",
    changedCount > 0
      ? `Synced ${changedCount} updated prompt file${changedCount === 1 ? "" : "s"} from the server.`
      : "Default prompts were already up to date.",
  );
}

let panelStylesPromise = null;
function loadPanelStyles() {
  if (!panelStylesPromise) {
    panelStylesPromise = import(
      chrome.runtime.getURL("src/content/panel-styles.js")
    );
  }
  return panelStylesPromise;
}

async function injectStyles() {
  if ($(STYLE_ID)) return;
  // The ~78KB of panel CSS lives in a separate module so it isn't parsed/held
  // on every LinkedIn tab — only fetched here, lazily, when the panel is built
  // (job pages). ROOT_ID etc. stay defined here (single source of truth) and
  // are passed into the builder.
  const { buildPanelStyles } = await loadPanelStyles();
  if ($(STYLE_ID)) return; // re-check after await — ensureRoot may have run again
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = buildPanelStyles({
    ROOT_ID,
    LAUNCHER_ID,
    BOARD_ID,
    LAUNCHER_CLOSE_ID,
    LAUNCHER_LOCK_NOTICE_ID,
    LAUNCHER_ALERT_ID,
    BOARD_MINIMIZE_ID,
    ACCOUNT_DETAIL_ID,
    PROVIDER_WEB_INPUT_ID,
    PROVIDER_SELECT_ID,
    PROVIDER_MODEL_INPUT_ID,
    PROVIDER_API_KEY_INPUT_ID,
    PROVIDER_API_BASE_INPUT_ID,
    EDGE_PADDING,
    EDGE_GAP_TOTAL,
    WIDE_BOARD_WIDTH,
    RUN_BOARD_WIDTH,
  });
  document.documentElement.appendChild(style);
}

function getRootHeight(root) {
  if (!root) return 0;
  const rect = root.getBoundingClientRect();
  return rect.height || 0;
}

function getRootWidth(root) {
  if (!root) return 0;
  const rect = root.getBoundingClientRect();
  return rect.width || 0;
}

function getDefaultTop(root) {
  const rootHeight = getRootHeight(root);
  return Math.max(
    EDGE_PADDING,
    Math.round((window.innerHeight - rootHeight) / 2),
  );
}

function clampFreeLeft(left, root) {
  const rootWidth = getRootWidth(root);
  const maxLeft = Math.max(
    EDGE_PADDING,
    window.innerWidth - rootWidth - EDGE_PADDING,
  );
  return Math.min(Math.max(Math.round(left), EDGE_PADDING), maxLeft);
}

function clampTop(top, root) {
  const rootHeight = getRootHeight(root);
  const maxTop = Math.max(
    EDGE_PADDING,
    window.innerHeight - rootHeight - EDGE_PADDING,
  );
  return Math.min(Math.max(Math.round(top), EDGE_PADDING), maxTop);
}

function applyDockedHorizontalPosition(root, side) {
  if (!root) return;
  if (side === "left") {
    root.style.left = `${EDGE_PADDING}px`;
    root.style.right = "auto";
    return;
  }
  root.style.left = "auto";
  root.style.right = `${EDGE_PADDING}px`;
}

function getPreviewSide(root, left) {
  const rootWidth = getRootWidth(root);
  const centerX = left + rootWidth / 2;
  return centerX <= window.innerWidth / 2 ? "left" : "right";
}

function syncDockedPosition(root) {
  if (!root) return;
  const currentTop = Number.parseFloat(root.style.top);
  root.style.top = `${Number.isFinite(currentTop) ? clampTop(currentTop, root) : getDefaultTop(root)}px`;
  applyDockedHorizontalPosition(root, state.dockSide);
  positionPromptStyleInfoPopup();
}

async function persistPosition(position) {
  try {
    await chrome.storage.local.set({ [POSITION_KEY]: position });
  } catch (error) {
    logError("Failed to persist floating position.", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function persistDismissed(dismissed) {
  try {
    await chrome.storage.local.set({ [DISMISSED_KEY]: dismissed });
  } catch (error) {
    logError("Failed to persist launcher visibility.", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function applyStoredRootState(root) {
  if (!root) return;
  try {
    const stored = await chrome.storage.local.get([
      POSITION_KEY,
      DISMISSED_KEY,
    ]);
    const savedPosition = stored?.[POSITION_KEY];
    state.dismissed = false;
    const savedTop =
      typeof savedPosition === "number" ? savedPosition : savedPosition?.top;
    const savedSide =
      typeof savedPosition === "object" && savedPosition
        ? savedPosition.side ||
          (savedPosition.left <= window.innerWidth / 2 ? "left" : "right")
        : "right";
    state.dockSide = savedSide;
    root.style.top = `${typeof savedTop === "number" ? clampTop(savedTop, root) : getDefaultTop(root)}px`;
    applyDockedHorizontalPosition(root, savedSide);
    render();
  } catch (error) {
    logError("Failed to restore launcher state.", {
      error: error instanceof Error ? error.message : String(error),
    });
    state.dockSide = "right";
    root.style.top = `${getDefaultTop(root)}px`;
    applyDockedHorizontalPosition(root, state.dockSide);
  }
}

function updateDraggedPosition(root, nextLeft, nextTop) {
  const clampedLeft = clampFreeLeft(nextLeft, root);
  const clampedTop = clampTop(nextTop, root);
  const side = getPreviewSide(root, clampedLeft);
  root.style.right = "auto";
  root.style.left = `${clampedLeft}px`;
  root.style.top = `${clampedTop}px`;
  root.dataset.dockPreview = side;
  return { side, top: clampedTop, left: clampedLeft };
}

function handlePointerMove(event) {
  if (!pointerDragState) return;
  const root = $(ROOT_ID);
  if (!root) return;
  const nextLeft =
    pointerDragState.originLeft + (event.clientX - pointerDragState.startX);
  const nextTop =
    pointerDragState.originTop + (event.clientY - pointerDragState.startY);
  const clamped = updateDraggedPosition(root, nextLeft, nextTop);
  const moved = Math.max(
    Math.abs(event.clientX - pointerDragState.startX),
    Math.abs(event.clientY - pointerDragState.startY),
  );
  pointerDragState.lastTop = clamped.top;
  pointerDragState.lastSide = clamped.side;
  pointerDragState.lastLeft = clamped.left;
  if (moved > 4) {
    pointerDragState.dragged = true;
  }
}

async function finishPointerDrag() {
  if (!pointerDragState) return;
  const root = $(ROOT_ID);
  if (root) {
    const finalSide = pointerDragState.lastSide ?? pointerDragState.originSide;
    state.dockSide = finalSide;
    root.dataset.dragging = "false";
    root.dataset.dockPreview = finalSide;
    root.style.top = `${clampTop(pointerDragState.lastTop ?? pointerDragState.originTop, root)}px`;
    applyDockedHorizontalPosition(root, finalSide);
    positionPromptStyleInfoPopup();
  }
  if (pointerDragState.dragged && !state.boardOpen) {
    suppressNextClick = true;
    await persistPosition({
      side: state.dockSide,
      top: pointerDragState.lastTop ?? pointerDragState.originTop,
    });
  } else if (pointerDragState.dragged) {
    await persistPosition({
      side: state.dockSide,
      top: pointerDragState.lastTop ?? pointerDragState.originTop,
    });
  }
  pointerDragState = null;
  window.removeEventListener("pointermove", handlePointerMove);
  window.removeEventListener("pointerup", finishPointerDrag);
  window.removeEventListener("pointercancel", finishPointerDrag);
}

function startPointerDrag(event) {
  const root = $(ROOT_ID);
  if (!root || event.button !== 0 || state.boardOpen) return;
  const currentTop = Number.parseFloat(root.style.top) || getDefaultTop(root);
  const currentLeft = root.getBoundingClientRect().left;
  pointerDragState = {
    startX: event.clientX,
    startY: event.clientY,
    originLeft: currentLeft,
    originSide:
      currentLeft <= (window.innerWidth - getRootWidth(root)) / 2
        ? "left"
        : "right",
    originTop: currentTop,
    lastSide:
      currentLeft <= (window.innerWidth - getRootWidth(root)) / 2
        ? "left"
        : "right",
    lastLeft: currentLeft,
    lastTop: currentTop,
    dragged: false,
  };
  root.dataset.dragging = "true";
  root.dataset.dockPreview = pointerDragState.originSide;
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", finishPointerDrag);
  window.addEventListener("pointercancel", finishPointerDrag);
}

function startBoardDrag(event) {
  const root = $(ROOT_ID);
  if (!root || event.button !== 0 || !state.boardOpen) return;
  if (
    event.target.closest("button, input, textarea, select, label, summary, a")
  )
    return;
  event.preventDefault();
  const currentTop = Number.parseFloat(root.style.top) || getDefaultTop(root);
  const currentLeft = root.getBoundingClientRect().left;
  pointerDragState = {
    startX: event.clientX,
    startY: event.clientY,
    originLeft: currentLeft,
    originSide:
      currentLeft <= (window.innerWidth - getRootWidth(root)) / 2
        ? "left"
        : "right",
    originTop: currentTop,
    lastSide:
      currentLeft <= (window.innerWidth - getRootWidth(root)) / 2
        ? "left"
        : "right",
    lastLeft: currentLeft,
    lastTop: currentTop,
    dragged: false,
  };
  root.dataset.dragging = "true";
  root.dataset.dockPreview = pointerDragState.originSide;
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", finishPointerDrag);
  window.addEventListener("pointercancel", finishPointerDrag);
}

function showLauncher() {
  state.dismissed = false;
  state.boardOpen = false;
  state.currentView = "run";
  state.launcherAlert = false;
  void persistDismissed(false);
  render();
  syncDockedPosition($(ROOT_ID));
}

function dismissLauncher() {
  state.dismissed = true;
  state.boardOpen = false;
  state.launcherAlert = false;
  void persistDismissed(true);
  render();
}

function openBoard(view = "run", options = {}) {
  if (isLockedToAnotherTab()) {
    state.boardOpen = false;
    state.currentView = "run";
    showLauncherLockNotice();
    return false;
  }
  const requestedView = view;
  const resolvedView = resolveAllowedBoardView(requestedView);
  const previousOpen = state.boardOpen;
  const previousView = state.currentView;
  state.boardOpen = true;
  state.currentView = resolvedView;
  state.launcherAlert = false;
  render();
  syncDockedPosition($(ROOT_ID));
  if (!previousOpen || previousView !== resolvedView) {
    const eventName =
      resolvedView === "settings"
        ? "extension_settings_viewed"
        : resolvedView === "history"
          ? "extension_runs_viewed"
          : "extension_board_opened";
    const surface =
      resolvedView === "settings"
        ? "settings_view"
        : resolvedView === "history"
          ? "runs_view"
          : "run_view";
    void trackAnalyticsEvent(
      eventName,
      { surface },
    );
  }
  void syncPromptDefaultsForOpen(resolvedView, previousOpen, previousView);
  const shouldRunSetupCheck =
    options.refreshSetup === true || previousOpen === false;
  const shouldRefreshBackendMaster =
    options.refreshBackendMaster === true ||
    shouldRunSetupCheck ||
    resolvedView === "settings" ||
    (isOnboardingMode() && getResolvedOnboardingStep() === "assets");
  const shouldCheckConnection =
    resolvedView === "settings" ? true : hasSelectedJobTarget();
  if (
    !options.skipConnectionCheck &&
    shouldCheckConnection &&
    (resolvedView === "run" ||
      resolvedView === "history" ||
      resolvedView === "settings")
  ) {
    void reconcileConnectionStatus({
      refreshBackendMaster: shouldRefreshBackendMaster,
      backendMasterMaxAgeMs: BACKEND_MASTER_REFRESH_MAX_AGE_MS,
    });
    return;
  }
  void refreshBoardData({
    refreshBackendMaster: shouldRefreshBackendMaster,
    backendMasterMaxAgeMs: BACKEND_MASTER_REFRESH_MAX_AGE_MS,
  });
  return true;
}

function minimizeBoard() {
  state.boardOpen = false;
  render();
  syncDockedPosition($(ROOT_ID));
}

function extractText(selectors) {
  for (const selector of selectors) {
    const node = document.querySelector(selector);
    const text = node?.textContent?.trim();
    if (text) return text;
  }
  return "";
}

function extractMetaCandidates() {
  const selectors = [
    ".job-details-jobs-unified-top-card__primary-description-container",
    ".job-details-jobs-unified-top-card__tertiary-description-container",
    ".jobs-unified-top-card__subtitle-primary-grouping",
    ".jobs-unified-top-card__primary-description-container",
    ".job-details-jobs-unified-top-card__job-insight",
    ".job-details-jobs-unified-top-card__job-insight-view-model-secondary",
    '[class*="primary-description"]',
    '[class*="job-insight"]',
  ];
  return Array.from(document.querySelectorAll(selectors.join(",")))
    .flatMap((node) => {
      const raw = (node.textContent || "")
        .replace(/([a-z])([A-Z][a-z])/g, "$1 • $2")
        .replace(/\s+/g, " ")
        .trim();
      return raw.split(/[·•\n]/g);
    })
    .map((value) => value.replace(/\s+/g, " ").trim())
    .map((value) => value.replace(/^[|–—-]\s*/, "").trim())
    .filter(Boolean);
}

function guessLocation(values) {
  for (const value of values) {
    if (
      /applicant|clicked apply|promoted by hirer|responses managed/i.test(value)
    )
      continue;
    const compact = value.replace(/\s+/g, " ").trim();
    const extracted = compact.match(
      /^(.*?)(?=\s+(?:Reposted|Over \d+|Promoted by hirer|Responses managed))/i,
    );
    const candidate = (extracted?.[1] || compact).trim();
    if (
      /remote|hybrid|on-site|onsite|,/.test(candidate.toLowerCase()) &&
      candidate.length <= 48
    ) {
      return candidate;
    }
  }
  return "";
}

function guessApplicants(values) {
  const explicit = values.find((value) => /applicant|applied/i.test(value));
  return explicit || "";
}

function guessHighlights(values, location) {
  const parts = [];
  if (location) {
    parts.push(location);
  }

  const reposted = values.find((value) => /^reposted\b/i.test(value));
  if (reposted) {
    parts.push(reposted);
  }

  const clickedApply = values.find((value) => /clicked apply/i.test(value));
  if (clickedApply) {
    parts.push(clickedApply);
  }

  return Array.from(new Set(parts.filter(Boolean)));
}

function readInlineJobDescriptionText() {
  const node = document.querySelector('[data-testid="expandable-text-box"]');
  return (node?.innerText || node?.textContent || "")
    .replace(/\s+/g, " ")
    .trim();
}

function inferJobTitleFromDocumentTitle(company = "") {
  const withoutLinkedInSuffix = (document.title || "")
    .replace(/\s*\|\s*LinkedIn.*$/i, "")
    .trim();
  if (!withoutLinkedInSuffix) return "";

  const raw = withoutLinkedInSuffix.split(/\s+\|\s+/)[0]?.trim() || "";
  if (!raw) return "";

  const normalizedCompany = company.trim().toLowerCase();
  if (normalizedCompany) {
    const suffix = ` - ${company.trim()}`.toLowerCase();
    if (raw.toLowerCase().endsWith(suffix)) {
      return raw.slice(0, raw.length - suffix.length).trim();
    }
  }

  return raw;
}

function hasUsableJobContext(job) {
  if (!job) return false;
  return Boolean(
    job.title ||
    job.company ||
    job.location ||
    (job.descriptionText || "").length > 120,
  );
}

function hasEnoughJobContext(job) {
  if (!job) return false;
  const sourceUrl = normalizeJobSourceUrl(job.sourceUrl);
  const currentSourceUrl = resolveSelectedJobSourceUrl();
  if (sourceUrl && currentSourceUrl && sourceUrl === currentSourceUrl) {
    return true;
  }
  if (job.title && (job.company || job.location || job.highlights?.length)) {
    return true;
  }
  return Boolean(job.company && (job.descriptionText || "").length > 200);
}

function clearJobLoadTimer() {
  if (jobLoadTimer) {
    window.clearTimeout(jobLoadTimer);
    jobLoadTimer = null;
  }
}

function resetJobLoadingState() {
  clearJobLoadTimer();
  if (selectedJobRefreshTimer) {
    window.clearTimeout(selectedJobRefreshTimer);
    selectedJobRefreshTimer = null;
  }
  state.jobLoadState = "idle";
  state.jobLoadStartedAt = null;
  state.scrapeIssue = "";
  state.selectedJobRefreshing = false;
  state.selectedJobExpectedSourceUrl = "";
  state.selectedJobRefreshAttempts = 0;
}

function scheduleJobReadinessCheck() {
  if (jobLoadTimer || state.jobLoadState !== "loading") return;
  jobLoadTimer = window.setTimeout(() => {
    jobLoadTimer = null;
    updateJobReadiness();
    render();
  }, JOB_LOAD_RETRY_MS);
}

function updateJobReadiness(nextJob = extractCurrentJob()) {
  const previousJobSignature = getCurrentJobSignature(state.currentJob);
  const nextJobSignature = getCurrentJobSignature(nextJob);
  state.currentJob = nextJob;

  if (
    previousJobSignature &&
    nextJobSignature &&
    previousJobSignature !== nextJobSignature &&
    !state.isRunning &&
    !state.awaitingAuth &&
    !state.awaitingStoryboard &&
    runStatusHelpers.shouldClearExplicitStatusOnJobChange(state.explicitRunStatus)
  ) {
    clearExplicitRunStatus("job-change", { renderNow: false });
  }

  if (!hasSelectedJobTarget()) {
    clearJobLoadTimer();
    state.jobLoadState = "idle";
    state.jobLoadStartedAt = null;
    state.selectedJobRefreshing = false;
    state.selectedJobExpectedSourceUrl = "";
    state.selectedJobRefreshAttempts = 0;
    return false;
  }

  if (hasEnoughJobContext(nextJob)) {
    clearJobLoadTimer();
    state.jobLoadState = "ready";
    state.jobLoadStartedAt = null;
    state.selectedJobRefreshing = false;
    state.selectedJobExpectedSourceUrl = "";
    state.selectedJobRefreshAttempts = 0;
    if (!state.isRunning) {
      state.scrapeIssue = "";
    }
    return true;
  }

  const now = Date.now();
  if (!state.jobLoadStartedAt) {
    state.jobLoadStartedAt = now;
  }

  const elapsed = now - state.jobLoadStartedAt;
  state.jobLoadState = elapsed >= JOB_LOAD_TIMEOUT_MS ? "timed_out" : "loading";
  if (state.jobLoadState === "timed_out") {
    state.selectedJobRefreshing = false;
    state.selectedJobExpectedSourceUrl = "";
    state.selectedJobRefreshAttempts = 0;
  }

  if (state.jobLoadState === "loading") {
    scheduleJobReadinessCheck();
  } else {
    clearJobLoadTimer();
  }

  return false;
}

function getCurrentJobSignature(job) {
  if (!job) return "";
  const sourceUrl = normalizeJobSourceUrl(job.sourceUrl);
  if (sourceUrl) return sourceUrl;
  return [
    String(job.title || "").trim(),
    String(job.company || "").trim(),
    String(job.location || "").trim(),
  ].join("|");
}

function getSelectedJobClickSourceUrl(target) {
  const clickable = target?.closest?.(
    'a[href*="/jobs/view/"], a[href*="currentJobId="], [data-job-id], .job-card-container, .jobs-search-results__list-item, .scaffold-layout__list-item',
  );
  if (!clickable) return "";
  const href =
    clickable.href ||
    clickable.getAttribute?.("href") ||
    clickable
      .querySelector?.('a[href*="/jobs/view/"], a[href*="currentJobId="]')
      ?.getAttribute?.("href") ||
    "";
  return normalizeJobSourceUrl(href);
}

function isCurrentJobExpectedSelection(nextJob) {
  const expectedUrl = normalizeJobSourceUrl(state.selectedJobExpectedSourceUrl);
  if (!expectedUrl) return true;
  return normalizeJobSourceUrl(nextJob?.sourceUrl) === expectedUrl;
}

function performSelectedJobRefresh() {
  selectedJobRefreshTimer = null;
  if (!hasVisibleLauncherRoute()) return;

  const nextJob = extractCurrentJob();
  const matchesExpected = isCurrentJobExpectedSelection(nextJob);
  const nextHasEnoughContext = hasEnoughJobContext(nextJob);

  updateJobReadiness(nextJob);

  if (matchesExpected && nextHasEnoughContext) {
    render();
    void reconcileConnectionStatus(state.currentView);
    return;
  }

  state.selectedJobRefreshAttempts += 1;
  if (state.selectedJobRefreshAttempts >= 6) {
    state.selectedJobRefreshing = false;
    state.selectedJobExpectedSourceUrl = "";
    render();
    return;
  }

  selectedJobRefreshTimer = window.setTimeout(performSelectedJobRefresh, 250);
  render();
}

function scheduleSelectedJobRefresh(options = {}) {
  if (!hasVisibleLauncherRoute()) return;

  const nextExpectedUrl = normalizeJobSourceUrl(
    options.expectedSourceUrl || "",
  );
  const currentSignature = getCurrentJobSignature(state.currentJob);

  if (nextExpectedUrl && nextExpectedUrl === currentSignature) {
    return;
  }

  if (
    nextExpectedUrl &&
    nextExpectedUrl !== state.selectedJobExpectedSourceUrl
  ) {
    state.selectedJobRefreshAttempts = 0;
  }

  state.selectedJobRefreshing = true;
  state.selectedJobExpectedSourceUrl = nextExpectedUrl;
  state.jobLoadState = "loading";
  state.jobLoadStartedAt = Date.now();

  if (selectedJobRefreshTimer) {
    window.clearTimeout(selectedJobRefreshTimer);
  }
  selectedJobRefreshTimer = window.setTimeout(
    performSelectedJobRefresh,
    options.delayMs ?? 420,
  );
  render();
}

function getSetupRequirementStatus(messageOverride = "") {
  if (
    state.connectionState === "signed_out" &&
    !state.websiteAuthenticated &&
    !state.extensionConnected
  ) {
    return {
      tone: "blocked",
      title: "You’ve been signed out",
      detail:
        messageOverride ||
        "Sign in to continue tailoring this job. Each account keeps its own local extension workspace.",
      actions: [
        {
          id: "connect",
          label: "Continue with Google",
          variant: "primary",
        },
      ],
    };
  }

  const setupState = state.setupState;
  if (!setupState) {
    return null;
  }

  if (setupState.state === "ready") {
    return null;
  }

  const actions = [];
  if (setupState.primaryAction?.id && setupState.primaryAction?.label) {
    actions.push({
      id: setupState.primaryAction.id,
      label: setupState.primaryAction.label,
      variant: "primary",
    });
  }
  if (setupState.secondaryAction?.id && setupState.secondaryAction?.label) {
    actions.push({
      id: setupState.secondaryAction.id,
      label: setupState.secondaryAction.label,
    });
  }

  return {
    tone: "blocked",
    title: setupState.title || "Finish setup",
    detail: messageOverride || setupState.detail || "Finish setup to continue.",
    actions,
  };
}

function hasManualJobDescription() {
  return Boolean(state.manualJobDescription.trim());
}

function getDefaultRunSourceMode() {
  return canUseLinkedInRunMode() ? "linkedin" : "manual";
}

function canUseLinkedInRunMode() {
  return state.routeMode === "active" || state.routeMode === "waiting";
}

function syncRunSourceModeForRoute() {
  if (
    !state.runSourceMode ||
    (state.runSourceMode === "linkedin" && !canUseLinkedInRunMode())
  ) {
    state.runSourceMode = getDefaultRunSourceMode();
  }
}

function isManualRunMode() {
  syncRunSourceModeForRoute();
  return state.runSourceMode === "manual";
}

function isScrapeProblemMessage(message) {
  const normalized = String(message || "").toLowerCase();
  return (
    /unable to extract|readable linkedin job description|scrape|job details unavailable|we could not read this job|does not look like a usable job description|does not appear to be a job description|paste the full job description manually/i.test(
      normalized,
    ) || /refresh the linkedin page/i.test(normalized)
  );
}

function getScrapeRequirementStatus(messageOverride = "") {
  const hasApifyToken = Boolean(
    state.assets?.apifyFallbackSettings?.apiToken?.trim(),
  );
  return {
    tone: "warning",
    title: "Couldn’t read full JD",
    detail:
      messageOverride ||
      (hasApifyToken
        ? "Try refreshing LinkedIn first. If it still misses, I’ll keep trying fallback extraction or you can paste the JD below."
        : "Try refreshing LinkedIn first. If it still misses, enable Apify in Settings or paste the JD below."),
    actions: [],
  };
}

function isHardPrerequisiteBlocker() {
  if (isOnboardingMode()) return false;
  if (
    state.connectionState === "signed_out" &&
    !state.websiteAuthenticated &&
    !state.extensionConnected
  ) {
    return true;
  }

  return [
    "signed_out_returning",
    "missing_resume",
    "missing_provider_config",
  ].includes(state.setupState?.state);
}

function shouldShowManualJdFallback() {
  return !getSetupRequirementStatus() && Boolean(state.scrapeIssue);
}

function shouldShowManualJdInput() {
  return isManualRunMode() || shouldShowManualJdFallback();
}

function pickManualJobMetadataValue(manualValue = null, fallbackValue = "") {
  if (manualValue == null) {
    return String(fallbackValue || "").trim();
  }
  return String(manualValue).trim();
}

function resolveManualJobSourceUrl(
  manualValue = null,
  fallbackValue = "",
  locationHref = "",
) {
  const fallbackSourceUrl =
    pickManualJobMetadataValue(fallbackValue, locationHref);

  if (manualValue == null) {
    return normalizeJobSourceUrl(fallbackSourceUrl);
  }

  const trimmedManualValue = String(manualValue).trim();
  if (!trimmedManualValue) {
    return "";
  }

  try {
    return normalizeJobSourceUrl(new URL(trimmedManualValue).toString());
  } catch {
    return normalizeJobSourceUrl(fallbackSourceUrl);
  }
}

function createManualJobInput({
  rawText = "",
  currentJob = null,
  manualTitle = null,
  manualCompany = null,
  manualSourceUrl = null,
  locationHref = "",
} = {}) {
  const normalizedRawText = String(rawText || "").trim();
  if (!normalizedRawText) {
    return null;
  }

  const baseJob = currentJob && typeof currentJob === "object" ? currentJob : {};

  return {
    source: "manual_text",
    rawText: normalizedRawText,
    title: pickManualJobMetadataValue(manualTitle, baseJob.title || ""),
    company: pickManualJobMetadataValue(manualCompany, baseJob.company || ""),
    location: String(baseJob.location || "").trim(),
    datePosted: baseJob.datePosted || "",
    sourceUrl: resolveManualJobSourceUrl(
      manualSourceUrl,
      baseJob.sourceUrl || "",
      locationHref,
    ),
  };
}

function buildManualJobInput() {
  return createManualJobInput({
    rawText: state.manualJobDescription,
    currentJob: state.currentJob,
    manualTitle: state.manualJobTitle,
    manualCompany: state.manualJobCompany,
    manualSourceUrl: state.manualJobSourceUrl,
    locationHref: window.location.href,
  });
}

function extractLinkedInViewJobIdFromPathname(pathname) {
  const match = String(pathname || "").match(/^\/jobs\/view\/([^/?#]+)\/?$/);
  const slugOrId = match?.[1] || "";
  const trailingIdMatch = slugOrId.match(/(\d+)$/);
  return /^\d+$/.test(trailingIdMatch?.[1] || "") ? trailingIdMatch[1] : "";
}

function normalizeJobSourceUrl(url) {
  const normalized = String(url || "").trim();
  if (!normalized) return "";
  try {
    const parsed = new URL(normalized);
    const currentJobId = parsed.searchParams.get("currentJobId")?.trim();
    if (currentJobId) {
      return `${parsed.origin}/jobs/view/${currentJobId}/`;
    }
    const directJobId = extractLinkedInViewJobIdFromPathname(parsed.pathname);
    if (directJobId) {
      return `${parsed.origin}/jobs/view/${directJobId}/`;
    }
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString();
  } catch {
    return normalized;
  }
}

function resolveSelectedJobSourceUrl() {
  const href = window.location.href;
  try {
    const parsed = new URL(href);
    const currentJobId = parsed.searchParams.get("currentJobId")?.trim();
    if (currentJobId) {
      return `${parsed.origin}/jobs/view/${currentJobId}/`;
    }
    const directJobId = extractLinkedInViewJobIdFromPathname(parsed.pathname);
    if (directJobId) {
      return `${parsed.origin}/jobs/view/${directJobId}/`;
    }
  } catch {}

  return "";
}

function hasSelectedJobTarget() {
  return Boolean(resolveSelectedJobSourceUrl());
}

function isWaitingForJobSelection() {
  return state.routeMode === "waiting" && !isManualRunMode();
}

function cloneJobForRun(job) {
  if (!job) return null;
  return {
    title: job.title || "",
    company: job.company || "",
    location: job.location || "",
    datePosted: job.datePosted || "",
    sourceUrl: normalizeJobSourceUrl(job.sourceUrl || window.location.href),
  };
}

function getRunStateFromExtensionSession() {
  const session = state.extensionState;
  if (!session) return null;

  const status = session.status || "";
  const activeRunJob = cloneJobForRun(
    session.jobSnapshot || session.activeRunJob || null,
  );
  const runId = session.sessionId || null;
  const matchesCurrentContext = doesRunJobMatchCurrentContext(activeRunJob);

  if (status === "canceling") {
    return {
      isRunning: false,
      isCanceling: true,
      tone: "info",
      kind: "interrupted",
      title: "Canceling...",
      detail: "Stopping this run.",
      activeRunJob,
      runId,
    };
  }

  if (runStatusHelpers.isRehydratableExtensionSessionStatus(status)) {
    const byStatus = {
      starting: {
        title: "Starting run",
        detail: "Getting things ready.",
      },
      bootstrap_master: {
        title: "Base resume setup",
        detail: "Reading your uploaded resume.",
      },
      scraped: {
        title: "Job captured",
        detail: "Job details are ready.",
      },
      prompt1_done: {
        title: "Role fit check",
        detail: "Reading the role.",
      },
      prompt2_done: {
        title: "Positioning plan",
        detail: "Choosing the strongest angles.",
      },
      prompt3_done: {
        title: "Resume draft",
        detail: "Writing the tailored resume.",
      },
      validated: {
        title: "Saving draft",
        detail: "Saving your resume.",
      },
    };
    return {
      isRunning: true,
      isCanceling: status === "canceling",
      tone: "running",
      activeRunJob,
      runId,
      ...(byStatus[status] || byStatus.starting),
    };
  }

  if (status === "canceled") {
    if (session.cancelReason === "browser_closed") {
      return null;
    }
    if (!matchesCurrentContext) {
      return null;
    }
    return {
      isRunning: false,
      isCanceling: false,
      tone: "info",
      kind: "canceled",
      title: "Run canceled",
      detail: "This run was stopped before the resume was opened.",
      activeRunJob,
      runId,
    };
  }

  // Error sessions are persisted for history and diagnostics, but rehydrating
  // them or the post-preview success state on a fresh board load creates
  // misleading stale banners. Live failures/success still surface through
  // the active response/log paths.
  if (status === "error" || status === "patched") {
    return null;
  }

  return null;
}

function syncVisibleRunStateFromExtensionSession() {
  if (getSetupRequirementStatus() || isHardPrerequisiteBlocker()) {
    state.isRunning = false;
    state.isCanceling = false;
    state.awaitingAuth = false;
    state.awaitingStoryboard = false;
    state.activeRunJob = null;
    return;
  }
  const sessionState = getRunStateFromExtensionSession();
  const hasLocalTransientRunState =
    state.isRunning ||
    state.isCanceling ||
    state.awaitingAuth ||
    state.awaitingStoryboard;
  const sessionStateStillInFlight =
    sessionState?.isRunning === true || sessionState?.isCanceling === true;

  if (
    hasLocalTransientRunState &&
    sessionStateStillInFlight &&
    (!state.activeRunId || sessionState.runId === state.activeRunId)
  ) {
    return;
  }

  if (!sessionState) {
    if (hasLocalTransientRunState) {
      state.isRunning = false;
      state.isCanceling = false;
      state.awaitingAuth = false;
      state.awaitingStoryboard = false;
      state.previewHandoffComplete = false;
      state.lastProgressHeartbeatAt = 0;
      state.runningDetailSource = "";
      stopRunningStatusRotation();
      if (
        state.explicitRunStatus?.kind === "running" ||
        state.explicitRunStatus?.kind === "interrupted"
      ) {
        clearExplicitRunStatus("session-cleared", { renderNow: false });
      }
    }
    state.isCanceling = false;
    state.activeRunId = null;
    state.activeRunJob = null;
    clearOwnedRun();
    return;
  }

  state.isRunning = sessionState.isRunning;
  state.isCanceling = sessionState.isCanceling === true;
  state.activeRunJob = sessionState.activeRunJob;
  state.activeRunId = sessionState.runId || state.activeRunId || null;
  applyExplicitRunStatus(
    runStatusHelpers.createExplicitRunStatus(
      sessionState.kind || "running",
      sessionState.tone,
      sessionState.title,
      sessionState.detail,
      [],
    ),
    { renderNow: false },
  );
}

function getJobDisplayLabel(job) {
  if (!job) return "another job";
  const title = String(job.title || "").trim();
  const company = String(job.company || "").trim();
  if (title && company) return `${title} at ${company}`;
  return title || company || "another job";
}

function doesRunJobMatchCurrentContext(runJob = null) {
  if (!runJob) return true;
  const activeUrl = normalizeJobSourceUrl(runJob.sourceUrl);
  const currentUrl = normalizeJobSourceUrl(
    state.currentJob?.sourceUrl ||
      (isManualRunMode() ? window.location.href : ""),
  );
  if (activeUrl && currentUrl) {
    return activeUrl === currentUrl;
  }
  if (!state.currentJob) return false;
  return (
    String(runJob.title || "").trim() ===
      String(state.currentJob.title || "").trim() &&
    String(runJob.company || "").trim() ===
      String(state.currentJob.company || "").trim()
  );
}

function doesActiveRunMatchCurrentJob() {
  return doesRunJobMatchCurrentContext(state.activeRunJob);
}

function canAttemptRecoveryRun() {
  if (!hasVisibleLauncherRoute()) return false;
  if (hasManualJobDescription()) return true;

  const job = state.currentJob || {};
  return Boolean(
    job.sourceUrl ||
    job.title ||
    job.company ||
    resolveSelectedJobSourceUrl(),
  );
}

function getRunBlockingState() {
  const setupRequirement = getSetupRequirementStatus();

  if (isManualRunMode()) {
    if (isSignedOutNavigationLocked() && setupRequirement) {
      return setupRequirement;
    }

    if (hasManualJobDescription()) {
      return null;
    }

    return {
      tone: "info",
      title: "Paste a job description",
      detail: "Paste the full job description to start tailoring.",
      actions: [],
    };
  }

  if (setupRequirement) {
    return setupRequirement;
  }

  if (isWaitingForJobSelection()) {
    return {
      tone: "info",
      title: "Select a job to start",
      detail: "Choose a job from the list, then I’ll load it here.",
      actions: [],
    };
  }

  if (hasManualJobDescription()) {
    return null;
  }

  const hasJob = hasEnoughJobContext(state.currentJob);

  if (!hasJob) {
    if (state.jobLoadState !== "timed_out") {
      return {
        tone: "info",
        title: "Loading job",
        detail: "Waiting for enough job details to start.",
        actions: [],
      };
    }
    if (!canAttemptRecoveryRun()) {
      return getScrapeRequirementStatus();
    }
    return null;
  }

  if (state.scrapeIssue) {
    if (!canAttemptRecoveryRun()) {
      return getScrapeRequirementStatus(state.scrapeIssue);
    }
    return null;
  }

  return null;
}

function getManualSetupAction(requirement = getSetupRequirementStatus()) {
  if (!requirement) return null;
  const primaryAction = Array.isArray(requirement.actions)
    ? requirement.actions[0]
    : null;
  const actionId = primaryAction?.id || "";

  if (actionId === "connect") {
    return {
      id: "connect",
      label: "Connect and tailor",
    };
  }

  if (actionId === "upload_resume") {
    return {
      id: "upload_resume",
      label: "Add Master Resume",
    };
  }

  if (
    actionId === "open_settings" ||
    actionId === "open-settings" ||
    actionId === "configure_provider" ||
    state.setupState?.state === "missing_provider_config"
  ) {
    return {
      id: actionId || "open_settings",
      label: "Finish AI setup",
    };
  }

  return {
    id: actionId || "",
    label: primaryAction?.label || "Finish setup",
  };
}

function getManualPrimaryButtonLabel() {
  if (!isManualRunMode() || !hasManualJobDescription()) {
    return "Tailor";
  }
  const setupAction = getManualSetupAction();
  return setupAction?.label || "Tailor";
}

function getPreflightRunStatus() {
  const blocked = getRunBlockingState();
  if (blocked) {
    return {
      kind: "preflight",
      ...blocked,
    };
  }

  if (shouldShowManualJdFallback()) {
    return {
      kind: "preflight",
      ...getScrapeRequirementStatus(state.scrapeIssue),
    };
  }

  return null;
}

function isRunReady() {
  return (
    !getRunBlockingState() && !state.awaitingAuth && !state.awaitingStoryboard
  );
}

function extractCurrentJob() {
  const normalizedSourceUrl = resolveSelectedJobSourceUrl();
  if (!normalizedSourceUrl) {
    return null;
  }

  const company = extractText([
    ".job-details-jobs-unified-top-card__company-name a",
    ".job-details-jobs-unified-top-card__company-name",
    ".jobs-unified-top-card__company-name a",
    ".jobs-unified-top-card__company-name",
    '#workspace a[href*="/company/"]',
  ]);
  const title =
    extractText([
      ".job-details-jobs-unified-top-card__job-title h1",
      ".jobs-unified-top-card__job-title h1",
      '[data-test-id="job-details-job-title"]',
      "#workspace h1",
      "main h1",
    ]) || inferJobTitleFromDocumentTitle(company);
  const values = extractMetaCandidates();
  const jobLocation = guessLocation(values);
  const applicants = guessApplicants(values);
  const highlights = guessHighlights(values, jobLocation);
  const descriptionText = readInlineJobDescriptionText();
  return {
    title,
    company,
    location: jobLocation,
    applicants,
    highlights,
    descriptionText,
    sourceUrl: normalizedSourceUrl,
  };
}

function getStrictLinkedInJobDetailRoot() {
  return document.querySelector(
    ".jobs-search__job-details--container, .jobs-search__job-details, .scaffold-layout__detail, [data-testid='job-details']",
  );
}

function getLinkedInJobDetailRoot() {
  return getStrictLinkedInJobDetailRoot() || document.querySelector("main");
}

function getHistoryTitle(entry) {
  const title = typeof entry?.title === "string" ? entry.title.trim() : "";
  const company =
    typeof entry?.company === "string" ? entry.company.trim() : "";
  if (company && title) return `${company} - ${title}`;
  return title || company || "Untitled role";
}

function getHistoryStatus(entry) {
  const status = typeof entry?.status === "string" ? entry.status.trim() : "";
  if (!status) return "";
  return status
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function compareHistoryEntries(left, right, sortDirection) {
  const direction = sortDirection === "asc" ? 1 : -1;
  const leftTime = new Date(left?.generatedAt || 0).getTime();
  const rightTime = new Date(right?.generatedAt || 0).getTime();
  return (leftTime - rightTime) * direction;
}

function getVisibleHistory() {
  const search = state.historySearch.trim().toLowerCase();
  const baseItems = Array.isArray(state.history) ? state.history : [];
  const filtered = baseItems
    .map((entry, originalIndex) => ({ entry, originalIndex }))
    .filter(({ entry }) => {
      if (!search) return true;
      const haystack =
        `${entry?.title || ""} ${entry?.company || ""}`.toLowerCase();
      return haystack.includes(search);
    })
    .sort((left, right) =>
      compareHistoryEntries(
        left.entry,
        right.entry,
        state.historySortDirection,
      ),
    );

  const totalPages = Math.max(1, Math.ceil(filtered.length / 5));
  if (state.historyPage > totalPages) {
    state.historyPage = totalPages;
  }

  const start = (state.historyPage - 1) * 5;
  const items = filtered.slice(start, start + 5);

  return {
    items,
    totalItems: filtered.length,
    totalPages,
  };
}

function getHistorySourceUrl(entry) {
  if (typeof entry?.sourceUrl === "string" && entry.sourceUrl.trim()) {
    return entry.sourceUrl.trim();
  }
  if (typeof entry?.jobKey === "string" && entry.jobKey.trim()) {
    return entry.jobKey.trim();
  }
  return "";
}

function getHistoryEntryByIndex(index) {
  const parsedIndex = Number.parseInt(String(index || ""), 10);
  if (Number.isNaN(parsedIndex) || parsedIndex < 0) return null;
  return Array.isArray(state.history) ? state.history[parsedIndex] ?? null : null;
}

function openHistoryJob(index) {
  const entry = getHistoryEntryByIndex(index);
  const sourceUrl = getHistorySourceUrl(entry);
  if (!sourceUrl) return;
  window.open(sourceUrl, "_blank", "noopener,noreferrer");
}

function openHistoryResume(index) {
  const entry = getHistoryEntryByIndex(index);
  const previewUrl = toAbsoluteAppUrl(entry?.previewUrl || "");
  if (!previewUrl) return;
  window.open(previewUrl, "_blank", "noopener,noreferrer");
}

async function deleteHistoryEntry(index) {
  const entry = getHistoryEntryByIndex(index);
  const runId = typeof entry?.runId === "string" ? entry.runId.trim() : "";
  if (!entry || !runId) {
    setRunStatus(
      "error",
      "Cannot delete run",
      "This history item is missing a run id.",
    );
    return;
  }

  const title = getHistoryTitle(entry);
  if (
    !window.confirm(
      `Delete "${title}" from this browser and delete its backend resume?`,
    )
  ) {
    return;
  }

  state.deletingHistoryRunId = runId;
  renderHistory();
  setRunStatus(
    "running",
    "Deleting run",
    "Deleting the backend resume and removing the local history item.",
  );

  try {
    const response = await sendMessage("DELETE_HISTORY_ENTRY", {
      runId,
      resumeId: entry.resumeId ?? null,
    });
    if (!response?.ok) {
      throw new Error(response?.error || "Failed to delete run history.");
    }

    state.history = Array.isArray(response.history) ? response.history : state.history;
    state.deletingHistoryRunId = null;
    renderHistory();
    setRunStatus(
      "success",
      "Run deleted",
      response.deletedBackendResume
        ? "Deleted the backend resume and removed the local history item."
        : "Removed the local history item.",
    );
    await refreshBoardData();
  } catch (error) {
    state.deletingHistoryRunId = null;
    renderHistory();
    setRunStatus(
      "error",
      "Delete failed",
      error instanceof Error
        ? error.message
        : "Unable to delete this run history item.",
    );
  }
}

function getSelectedProfile(selectId = PROVIDER_SELECT_ID, settings = null) {
  const resolvedSettings = settings || state.assets?.llmSettings;
  if (!resolvedSettings?.profiles) return null;
  const select = $(selectId);
  const profileId =
    select instanceof HTMLSelectElement
      ? select.value
      : resolvedSettings.activeProfileId;
  return resolvedSettings.profiles[profileId] ?? null;
}

function isOnboardingMode() {
  return state.setupState?.mode === "onboarding";
}

function isSignedOutNavigationLocked() {
  return (
    state.connectionState !== "connected" ||
    ["signed_out", "signed_out_returning"].includes(state.setupState?.state)
  );
}

function isMasterResumeUploadNavigationLocked() {
  if (isSignedOutNavigationLocked()) return false;
  if (state.setupState?.state === "missing_resume") return true;
  return isOnboardingMode() && !hasBackendMasterResume();
}

function isHistoryNavigationLocked() {
  return isSignedOutNavigationLocked();
}

function isTailoringParameterChangeLocked() {
  const sessionStatus = state.extensionState?.status || "";
  return (
    state.isRunning ||
    state.isCanceling ||
    sessionStatus === "canceling" ||
    runStatusHelpers.isRehydratableExtensionSessionStatus(sessionStatus)
  );
}

function isSettingsNavigationLocked() {
  return isSignedOutNavigationLocked() || isTailoringParameterChangeLocked();
}

function canOpenBoardView(view) {
  if (view === "settings") return !isSettingsNavigationLocked();
  return true;
}

function resolveAllowedBoardView(view = "run") {
  return canOpenBoardView(view) ? view : "run";
}

function resolveBackendMasterResumeForRender({
  shouldRefreshBackendMaster,
  previousBackendMaster,
  nextBackendMaster,
  fallbackBackendMaster,
} = {}) {
  if (nextBackendMaster?.resumeId) return nextBackendMaster;
  if (fallbackBackendMaster?.resumeId) return fallbackBackendMaster;
  if (!shouldRefreshBackendMaster && previousBackendMaster?.resumeId) {
    return previousBackendMaster;
  }
  return nextBackendMaster ?? null;
}

function renderPrimaryButtonMarkup(label, actionId, extraAttrs = "") {
  return `<button type="button" class="resume-matcher-button is-primary" data-onboarding-action="${escapeHtml(actionId)}" ${extraAttrs}>${escapeHtml(label)}</button>`;
}

function renderSettingsStatusPill(label, tone = "neutral") {
  return `<span class="resume-matcher-settings-status-pill" data-tone="${escapeHtml(tone)}">${escapeHtml(label)}</span>`;
}

function setSettingsStatusPill(node, label, tone = "neutral") {
  if (!(node instanceof HTMLElement)) return;
  if (!label) {
    node.hidden = true;
    node.textContent = "";
    return;
  }
  node.hidden = false;
  node.textContent = label;
  node.dataset.tone = tone;
}

function renderSettingsActionButton(id, label, { variant = "secondary", disabled = false } = {}) {
  const variantClass =
    variant === "primary"
      ? " is-primary"
      : variant === "danger"
        ? " is-danger"
        : variant === "quiet"
          ? " is-quiet"
          : "";
  return `<button id="${escapeHtml(id)}" type="button" class="resume-matcher-button${variantClass}"${disabled ? " disabled" : ""}>${escapeHtml(label)}</button>`;
}

function renderProviderOptions(settings, selectedProfileId = "") {
  const normalizedSelectedProfileId = String(selectedProfileId || "");
  const options = Object.values(settings?.profiles || {})
    .sort((left, right) =>
      (left?.label || "").localeCompare(right?.label || "", undefined, {
        sensitivity: "base",
      }),
    )
    .map(
      (profile) =>
        `<option value="${escapeHtml(profile.id)}"${profile.id === normalizedSelectedProfileId ? " selected" : ""}>${escapeHtml(profile.label)}</option>`,
    )
    .join("");
  return `<option value="" disabled${normalizedSelectedProfileId ? "" : " selected"}>Choose your AI provider</option>${options}`;
}

function renderPromptProfileTabs(
  promptTemplateProfiles,
  selectedProfileId = "",
  {
    containerId = "",
    disabled = false,
    compact = false,
    extraClassName = "",
    allowDisabledSelection = true,
    ariaLabel = "Tailoring style",
  } = {},
) {
  const normalizedSelectedProfileId = String(selectedProfileId || "");
  const buttons = Object.keys(promptTemplateProfiles?.profiles || {})
    .filter(
      (profileId) =>
        !HIDDEN_PROMPT_PROFILE_IDS.has(profileId) ||
        profileId === normalizedSelectedProfileId,
    )
    .sort(comparePromptProfileDisplayOrder)
    .map((profileId) => {
      const profileSelectable = allowDisabledSelection
        ? true
        : isPromptProfileSelectableInRunView(profileId, promptTemplateProfiles);
      const isActive =
        profileId === normalizedSelectedProfileId &&
        (allowDisabledSelection || profileSelectable);
      const buttonDisabled = disabled || !profileSelectable;
      return `
        <button
          type="button"
          class="resume-matcher-profile-tabs__button${isActive ? " is-active" : ""}${!profileSelectable ? " is-disabled" : ""}"
          data-prompt-profile-id="${escapeHtml(profileId)}"
          data-profile-selectable="${profileSelectable ? "true" : "false"}"
          aria-pressed="${isActive ? "true" : "false"}"
          ${buttonDisabled ? "disabled" : ""}
        >${escapeHtml(getPromptProfileLabel(profileId))}</button>
      `;
    })
    .join("");

  if (!containerId) {
    return buttons;
  }

  const extraClasses = String(extraClassName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
  const className = `resume-matcher-profile-tabs${compact ? " is-compact" : ""}${extraClasses ? ` ${extraClasses}` : ""}`;
  return `<div id="${escapeHtml(containerId)}" class="${escapeHtml(className)}" role="tablist" aria-label="${escapeHtml(ariaLabel)}">${buttons}</div>`;
}

function renderTailoringStyleInfoPopup() {
  return `
    <div class="resume-matcher-style-info__title">Choose your tailoring style</div>
    <div class="resume-matcher-style-info__stack">
      ${TAILORING_STYLE_INFO.map(
        ({ title, lines }) => `
          <section class="resume-matcher-style-info__section">
            <div class="resume-matcher-style-info__section-title">${escapeHtml(title)}</div>
            ${lines
              .map(
                (line) =>
                  `<div class="resume-matcher-style-info__line">${escapeHtml(line)}</div>`,
              )
              .join("")}
          </section>
        `,
      ).join("")}
    </div>
    <div class="resume-matcher-style-info__footer">${escapeHtml(TAILORING_STYLE_DISCLAIMER)}</div>
  `;
}

function positionPromptStyleInfoPopup() {
  const popup = $(RUN_PROMPT_PROFILE_POPUP_ID);
  const root = $(ROOT_ID);
  const board = $(BOARD_ID);
  const field = $(RUN_PROMPT_PROFILE_FIELD_ID);
  if (
    !(popup instanceof HTMLElement) ||
    !(root instanceof HTMLElement) ||
    !(board instanceof HTMLElement) ||
    !(field instanceof HTMLElement) ||
    popup.hidden
  ) {
    return;
  }

  const rootRect = root.getBoundingClientRect();
  const boardRect = board.getBoundingClientRect();
  const fieldRect = field.getBoundingClientRect();
  const leftSpace = Math.max(0, boardRect.left - EDGE_PADDING);
  const rightSpace = Math.max(0, window.innerWidth - boardRect.right - EDGE_PADDING);
  const preferredSide = state.dockSide === "left" ? "right" : "left";
  const popupWidth = popup.offsetWidth || 300;

  let side = preferredSide;
  if (preferredSide === "right" && rightSpace < popupWidth && leftSpace > rightSpace) {
    side = "left";
  } else if (
    preferredSide === "left" &&
    leftSpace < popupWidth &&
    rightSpace > leftSpace
  ) {
    side = "right";
  }

  popup.dataset.side = side;

  const rawTop = Math.round(fieldRect.top - rootRect.top);
  const popupHeight = popup.offsetHeight || 0;
  const maxTop = Math.max(
    0,
    Math.floor(window.innerHeight - EDGE_PADDING - rootRect.top - popupHeight),
  );
  popup.style.top = `${Math.min(Math.max(rawTop, 0), maxTop)}px`;
}

function getOnboardingStepIndex(step) {
  switch (step) {
    case "sign_in":
      return 1;
    case "provider":
      return 2;
    case "assets":
    case "done":
      return 3;
    case "intro":
    default:
      return 0;
  }
}

function renderOnboardingProgress(currentStep) {
  const currentIndex = getOnboardingStepIndex(currentStep);
  const steps = [
    { label: "Sign in", index: 1 },
    { label: "Choose AI", index: 2 },
    { label: "Master Resume", index: 3 },
  ];

  return `
    <div class="resume-matcher-onboarding__progress" aria-hidden="true">
      ${steps
        .map((step) => {
          const stateClass =
            step.index < currentIndex
              ? "is-complete"
              : step.index === currentIndex
                ? "is-active"
                : "";
          return `
            <div class="resume-matcher-onboarding__progress-step ${stateClass}">
              <div class="resume-matcher-onboarding__progress-bar"></div>
              <div class="resume-matcher-onboarding__progress-label">${escapeHtml(step.label)}</div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderOnboardingStatusPill(label, tone = "optional") {
  return `<span class="resume-matcher-onboarding__status-pill is-${escapeHtml(tone)}">${escapeHtml(label)}</span>`;
}

function renderOnboardingStep() {
  const setupState = state.setupState;
  if (!setupState || setupState.mode !== "onboarding") {
    return "";
  }

  const hasResume = hasBackendMasterResume();
  const masterLabel = getBackendMasterResumeLabel();
  const compactMasterLabel = truncateDisplayText(masterLabel, 28);
  const providerReadyForImport = isProviderReadyForMasterImport();
  let importStatus = "";
  if (state.masterResumeImportInFlight || state.masterResumeImportMessage) {
    importStatus = `<span class="resume-matcher-onboarding__status">${escapeHtml(state.masterResumeImportMessage || "Extracting and saving...")}</span>`;
  } else if (!providerReadyForImport) {
    importStatus =
      '<span class="resume-matcher-onboarding__status">Choose AI before uploading.</span>';
  }
  const providerSettings = state.assets?.llmSettings;
  const providerDraft = syncProviderDraftState();
  const selectedProfile = getSavedProfileById(
    providerDraft.selectedProfileId,
    providerSettings,
  );

  const resolvedStep = getResolvedOnboardingStep() || setupState.step;

  switch (resolvedStep) {
    case "sign_in":
      return `
        ${renderOnboardingProgress(resolvedStep)}
        <p class="resume-matcher-onboarding__text">${escapeHtml(setupState.detail)}</p>
        ${
          state.connectionState === "connected"
            ? '<div class="resume-matcher-onboarding__badge">Connected</div>'
            : ""
        }
        <div class="resume-matcher-onboarding__actions">
          ${
            state.connectionState === "connected"
              ? renderPrimaryButtonMarkup(
                  "Next",
                  "onboarding_next",
                  'data-next-step="provider"',
                )
              : `<button type="button" class="resume-matcher-button is-primary resume-matcher-google-button" data-onboarding-action="connect">${renderGoogleButtonLabel("Continue with Google")}</button>`
          }
        </div>
      `;
    case "assets":
      return `
        ${renderOnboardingProgress(resolvedStep)}
        <div class="resume-matcher-onboarding__row">
          <div class="resume-matcher-onboarding__file">
            <div class="resume-matcher-onboarding__file-top">
              <span class="resume-matcher-onboarding__label">Master Resume</span>
              ${hasResume ? renderOnboardingStatusPill("Ready", "complete") : renderOnboardingStatusPill("Required", "required")}
            </div>
            ${
              hasResume
                ? ""
                : '<p class="resume-matcher-onboarding__help">Add your Master Resume to Lumi Coach. Use PDF, DOCX, TXT, MD, or JSON.</p>'
            }
            ${
              hasResume
                ? `<span class="resume-matcher-onboarding__status" title="${escapeHtml(masterLabel)}">${escapeHtml(compactMasterLabel)}</span>`
                : ""
            }
            ${importStatus}
            <button type="button" class="resume-matcher-button" data-onboarding-action="upload_resume"${!providerReadyForImport || state.masterResumeImportInFlight ? " disabled" : ""}>${hasResume ? "Replace" : "Add Master Resume"}</button>
          </div>
        </div>
        <div class="resume-matcher-onboarding__actions">
          ${renderPrimaryButtonMarkup("Start tailoring", "complete_onboarding", `${hasResume && !state.masterResumeImportInFlight ? "" : " disabled"}`)}
        </div>
      `;
    case "provider": {
      const effectiveProviderState = getOnboardingProviderDraftState();
      const isWeb = selectedProfile?.mode === "web_automation";
      const isApi = selectedProfile?.mode === "api";
      const missingFields = state.providerValidationAttempted
        ? new Set(state.providerValidationMissingFields)
        : new Set();
      const requiredEmptyFields = new Set(getProviderDraftMissingFields(providerDraft));
      return `
        ${renderOnboardingProgress(resolvedStep)}
        <div class="resume-matcher-onboarding__provider-grid">
          <p class="resume-matcher-onboarding__provider-note"><strong>API key</strong> is more stable.</p>
          <p class="resume-matcher-onboarding__provider-note"><strong>Web automation</strong> uses your browser login and is less stable.</p>
          <div class="resume-matcher-field">
            <select id="resume-matcher-onboarding-provider-select" data-invalid="${missingFields.has("provider") ? "true" : "false"}" data-required-empty="${!missingFields.has("provider") && requiredEmptyFields.has("provider") ? "true" : "false"}">${renderProviderOptions(providerSettings, providerDraft.selectedProfileId)}</select>
          </div>
          <div id="resume-matcher-onboarding-provider-web-row" class="resume-matcher-field" data-invalid="${missingFields.has("targetUrl") ? "true" : "false"}" data-required-empty="${!missingFields.has("targetUrl") && requiredEmptyFields.has("targetUrl") ? "true" : "false"}"${isWeb ? "" : " hidden"}>
            <input id="resume-matcher-onboarding-provider-web-input" type="url" placeholder="Provider URL" value="${escapeHtml(isWeb ? providerDraft.targetUrl || "" : "")}" />
          </div>
          <div id="resume-matcher-onboarding-provider-api-row" class="resume-matcher-field" data-invalid="${missingFields.has("apiBaseUrl") ? "true" : "false"}" data-required-empty="${!missingFields.has("apiBaseUrl") && requiredEmptyFields.has("apiBaseUrl") ? "true" : "false"}"${isApi ? "" : " hidden"}>
            <input id="resume-matcher-onboarding-provider-api-base-input" type="url" placeholder="API endpoint" value="${escapeHtml(isApi ? providerDraft.apiBaseUrl || "" : "")}" />
          </div>
          <div id="resume-matcher-onboarding-provider-model-row" class="resume-matcher-field" data-invalid="${missingFields.has("model") ? "true" : "false"}" data-required-empty="${!missingFields.has("model") && requiredEmptyFields.has("model") ? "true" : "false"}" hidden>
            <input id="resume-matcher-onboarding-provider-model-input" type="text" placeholder="Model" value="${escapeHtml(isApi ? providerDraft.model || "" : "")}" />
          </div>
          <div id="resume-matcher-onboarding-provider-key-row" class="resume-matcher-field" data-invalid="${missingFields.has("apiKey") ? "true" : "false"}" data-required-empty="${!missingFields.has("apiKey") && requiredEmptyFields.has("apiKey") ? "true" : "false"}"${isApi ? "" : " hidden"}>
            <input id="${ONBOARDING_PROVIDER_API_KEY_INPUT_ID}" type="password" placeholder="API key" value="" />
            <div id="${ONBOARDING_PROVIDER_API_KEY_HINT_ID}" class="resume-matcher-field__hint" hidden></div>
          </div>
        </div>
        <p class="resume-matcher-onboarding__help resume-matcher-onboarding__help--subtle"><em>Most tested: ChatGPT web automation and Claude API.</em></p>
        ${
          !effectiveProviderState.ready && effectiveProviderState.message
            ? `<p class="resume-matcher-onboarding__help">${escapeHtml(effectiveProviderState.message)}</p>`
            : ""
        }
        <div class="resume-matcher-onboarding__actions">
          ${renderPrimaryButtonMarkup("Save and continue", "save_provider_continue", `${effectiveProviderState.ready ? "" : " disabled"}`)}
        </div>
      `;
    }
    case "done":
      return `
        ${renderOnboardingProgress(resolvedStep)}
        <p class="resume-matcher-onboarding__text">${escapeHtml(setupState.detail)}</p>
        <div class="resume-matcher-onboarding__actions">
          ${renderPrimaryButtonMarkup("Start tailoring", "complete_onboarding")}
        </div>
      `;
    case "intro":
    default:
      return `
        ${renderOnboardingProgress(resolvedStep)}
        <p class="resume-matcher-onboarding__text">${escapeHtml(setupState.detail)}</p>
        <div class="resume-matcher-onboarding__actions">
          ${renderPrimaryButtonMarkup("Continue", "onboarding_next", 'data-next-step="sign_in"')}
        </div>
      `;
  }
}

function getVisibleExplicitRunStatus() {
  const explicitStatus = state.explicitRunStatus;
  if (!explicitStatus) return null;

  const isDifferentJob =
    state.activeRunJob &&
    !state.isCanceling &&
    (state.isRunning || state.awaitingAuth) &&
    !doesActiveRunMatchCurrentJob();

  if (!isDifferentJob) {
    return explicitStatus;
  }

  if (explicitStatus.kind === "success") {
    return {
      ...explicitStatus,
      title: "Workspace ready",
      detail: `Opened the tailored resume for ${getJobDisplayLabel(state.activeRunJob)}.`,
    };
  }

  if (explicitStatus.kind === "interrupted") {
    return {
      ...explicitStatus,
      tone: "info",
      title: "Sign-in needed for another job",
      detail: `Sign in to continue ${getJobDisplayLabel(state.activeRunJob)}.`,
    };
  }

  if (explicitStatus.kind === "running") {
    return {
      ...explicitStatus,
      tone: "info",
      title: "Tailoring in background",
      detail: `${explicitStatus.title || "Still working"} for ${getJobDisplayLabel(state.activeRunJob)}.`,
    };
  }

  return explicitStatus;
}

function getRunStatusCopy() {
  return runStatusHelpers.resolveRunStatusBox({
    explicitStatus: getVisibleExplicitRunStatus(),
    preflightStatus: getPreflightRunStatus(),
    runningDetail: state.rotatingStatusDetail,
  });
}

function stopRunningStatusRotation() {
  if (runningStatusMessageTimer) {
    window.clearTimeout(runningStatusMessageTimer);
    runningStatusMessageTimer = null;
  }
  state.rotatingStatusIndex = -1;
  state.rotatingStatusDetail = "";
  state.rotatingStatusPoolKey = "";
}

function getRunWaitPoolKey(title) {
  const normalized = String(title || "")
    .trim()
    .toLowerCase();
  if (normalized === "starting run" || normalized === "loading assets") {
    return "setup";
  }
  if (
    normalized === "creating your base resume" ||
    normalized === "base resume setup"
  ) {
    return "bootstrap";
  }
  if (normalized === "role fit check") {
    return "fitCheck";
  }
  if (normalized === "positioning plan") {
    return "positioning";
  }
  if (normalized === "resume draft") {
    return "draft";
  }
  if (
    normalized === "saving draft" ||
    normalized === "saving resume" ||
    normalized === "opening workspace" ||
    normalized === "naming resume"
  ) {
    return "saving";
  }
  return "default";
}

function getRunWaitMessagesForTitle(title) {
  const key = getRunWaitPoolKey(title);
  return {
    key,
    messages: RUN_WAIT_MESSAGE_POOLS[key] || RUN_WAIT_MESSAGE_POOLS.default,
  };
}

function getUserFacingPromptLabel(promptLabel) {
  const normalized = String(promptLabel || "").trim();
  return USER_FACING_PROMPT_LABELS.get(normalized) || normalized || "Working";
}

function getPromptStageDetail(title, message) {
  if (title === "Base resume setup") {
    if (/validat/i.test(message || "")) return "Checking the extracted resume.";
    if (/pars/i.test(message || "")) return "Structuring the main sections.";
    return "Reading your uploaded resume.";
  }

  if (title === "Role fit check") {
    if (/pars/i.test(message || "")) return "Summarizing what the role needs.";
    return "Reading the role.";
  }

  if (title === "Positioning plan") {
    if (/pars/i.test(message || "")) return "Shaping the positioning plan.";
    return "Choosing the strongest angles.";
  }

  if (title === "Resume draft") {
    if (/validat/i.test(message || "")) return "Checking the draft.";
    if (/pars/i.test(message || "")) return "Reviewing the drafted sections.";
    return "Writing the tailored resume.";
  }

  return "Working through this step.";
}

function seedRunningStatusRotation(title, fallbackDetail = "") {
  const { key } = getRunWaitMessagesForTitle(title);
  state.rotatingStatusPoolKey = key;
  state.rotatingStatusIndex = -1;
  state.rotatingStatusDetail = fallbackDetail || "";
}

function hasFreshProgressHeartbeat() {
  return (
    state.lastProgressHeartbeatAt > 0 &&
    Date.now() - state.lastProgressHeartbeatAt < RUN_PROGRESS_HEARTBEAT_FRESH_MS
  );
}

function scheduleNextRunningStatusRotation() {
  if (
    !state.isRunning ||
    !runStatusHelpers.shouldRotateRunningStatus(state.explicitRunStatus)
  ) {
    return;
  }
  runningStatusMessageTimer = window.setTimeout(() => {
    runningStatusMessageTimer = null;
    if (
      !state.isRunning ||
      !runStatusHelpers.shouldRotateRunningStatus(state.explicitRunStatus)
    ) {
      return;
    }
    if (hasFreshProgressHeartbeat()) {
      scheduleNextRunningStatusRotation();
      return;
    }
    const { key, messages } = getRunWaitMessagesForTitle(
      state.explicitRunStatus?.title,
    );
    if (state.rotatingStatusPoolKey !== key) {
      seedRunningStatusRotation(
        state.explicitRunStatus?.title,
        state.explicitRunStatus?.detail,
      );
      render();
      scheduleNextRunningStatusRotation();
      return;
    }
    if (!messages.length) return;
    const nextIndex =
      state.rotatingStatusIndex < 0
        ? 0
        : (state.rotatingStatusIndex + 1) % messages.length;
    state.rotatingStatusIndex = nextIndex;
    state.rotatingStatusDetail =
      messages[nextIndex] ||
      state.explicitRunStatus?.detail ||
      state.rotatingStatusDetail;
    render();
    scheduleNextRunningStatusRotation();
  }, RUN_WAIT_MESSAGE_INTERVAL_MS);
}

function startRunningStatusRotation() {
  if (
    !state.isRunning ||
    !runStatusHelpers.shouldRotateRunningStatus(state.explicitRunStatus)
  ) {
    stopRunningStatusRotation();
    return;
  }
  const nextPoolKey = getRunWaitPoolKey(state.explicitRunStatus?.title);
  if (
    !state.rotatingStatusDetail ||
    state.rotatingStatusPoolKey !== nextPoolKey
  ) {
    seedRunningStatusRotation(
      state.explicitRunStatus?.title,
      state.explicitRunStatus?.detail,
    );
  }
  if (!runningStatusMessageTimer) {
    scheduleNextRunningStatusRotation();
  }
}

function clearScrapeRecoveryState() {
  state.scrapeIssue = "";
}

function markPreviewHandoffComplete() {
  state.previewHandoffComplete = true;
  state.isRunning = false;
  state.isCanceling = false;
  state.awaitingAuth = false;
  state.awaitingStoryboard = false;
  state.activeRunId = null;
  state.ownedRunId = null;
  state.lastProgressHeartbeatAt = 0;
  state.runningDetailSource = "";
  stopRunningStatusRotation();
}

function claimOwnedRun(runId = null) {
  const nextRunId = String(runId || "").trim();
  if (!nextRunId) return;
  state.ownedRunId = nextRunId;
}

function clearOwnedRun(runId = null) {
  const scopedRunId = String(runId || "").trim();
  if (!scopedRunId || !state.ownedRunId || state.ownedRunId === scopedRunId) {
    state.ownedRunId = null;
  }
}

function getCurrentRunPhaseLabel() {
  if (state.awaitingStoryboard) return "awaiting_storyboard";
  if (state.awaitingAuth) return "awaiting_auth";
  if (state.isCanceling) return "canceling";
  return "running";
}

function isCancellationTeardownMessage(message = "") {
  const normalized = String(message || "").trim();
  if (!normalized) return false;
  return /run canceled|request aborted|operation was aborted|aborterror|frame with id \d+ was removed|target closed|tab was closed|window was closed/i.test(
    normalized,
  );
}

function isRunCancelable() {
  if (state.previewHandoffComplete) return false;
  if (state.explicitRunStatus?.kind === "success") return false;
  if (state.explicitRunStatus?.kind === "canceled") return false;
  return (
    state.isRunning ||
    state.isCanceling ||
    state.awaitingAuth ||
    state.awaitingStoryboard ||
    state.extensionState?.status === "canceling"
  );
}

function activateVisibleRunFromProgress(scopedRunId = null) {
  const session = state.extensionState || {};
  const nextRunId =
    scopedRunId || state.activeRunId || session.sessionId || null;
  const activeRunJob = cloneJobForRun(
    state.activeRunJob ||
      session.jobSnapshot ||
      session.activeRunJob ||
      state.currentJob ||
      null,
  );

  state.isRunning = true;
  state.isCanceling = false;
  state.popupStallHint = false;
  state.awaitingAuth = false;
  state.awaitingStoryboard = false;
  state.previewHandoffComplete = false;
  if (nextRunId) {
    state.activeRunId = nextRunId;
  }
  if (activeRunJob) {
    state.activeRunJob = activeRunJob;
  }
}

function shouldHandleRunScopedMessage(runId = null) {
  if (!runId) return true;
  if (state.activeRunId && state.activeRunId === runId) return true;
  if (state.extensionState?.sessionId && state.extensionState.sessionId === runId) {
    return true;
  }
  return !state.activeRunId;
}

function isRunStatusRelevantScope(scope = "") {
  return new Set([
    "Orchestrator",
    "ResumeApi",
    "LinkedInScrape",
    "LlmRunner",
    "ChatGptAutomation",
    "ClaudeApi",
    "GeminiApi",
    "WebAutomation",
  ]).has(String(scope || "").trim());
}

function applyCanceledRunState(runId = null, options = {}) {
  if (!shouldHandleRunScopedMessage(runId)) {
    return false;
  }

  state.isRunning = false;
  state.isCanceling = false;
  state.awaitingAuth = false;
  state.awaitingStoryboard = false;
  state.previewHandoffComplete = false;
  state.lastProgressHeartbeatAt = 0;
  state.runningDetailSource = "";
  stopRunningStatusRotation();
  state.activeRunId = null;
  state.activeRunJob = null;
  clearOwnedRun(runId);

  setExplicitRunStatus(
    "canceled",
    "info",
    "Run canceled",
    options.detail || "This run was stopped before the resume was opened.",
  );
  return true;
}

function applyExplicitRunStatus(nextStatus, options = {}) {
  const { renderNow = true, source = "explicit" } = options;
  const previousTitle = state.explicitRunStatus?.title || "";
  const previousDetail = state.explicitRunStatus?.detail || "";
  state.explicitRunStatus = nextStatus;
  state.statusTone = nextStatus?.tone || "neutral";
  state.statusTitle = nextStatus?.title || "";
  state.statusDetail = nextStatus?.detail || "";
  state.statusActions = Array.isArray(nextStatus?.actions)
    ? nextStatus.actions
    : [];

  if (
    runStatusHelpers.shouldRotateRunningStatus(nextStatus) &&
    state.isRunning
  ) {
    const titleChanged = nextStatus?.title !== previousTitle;
    if (source === "heartbeat") {
      state.lastProgressHeartbeatAt = Date.now();
      state.runningDetailSource = "heartbeat";
    } else if (titleChanged) {
      state.lastProgressHeartbeatAt = 0;
      state.runningDetailSource = source;
    } else if (source !== "heartbeat" && state.runningDetailSource !== "heartbeat") {
      state.runningDetailSource = source;
    }
    if (
      nextStatus?.detail &&
      (nextStatus.title !== previousTitle || nextStatus.detail !== previousDetail)
    ) {
      state.rotatingStatusDetail = nextStatus.detail;
    }
    startRunningStatusRotation();
  } else {
    state.lastProgressHeartbeatAt = 0;
    state.runningDetailSource = "";
    stopRunningStatusRotation();
  }

  if (!state.boardOpen && nextStatus?.kind === "error") {
    state.launcherAlert = true;
  }

  if (renderNow) {
    render();
  }
}

function setExplicitRunStatus(kind, tone, title, detail = "", actions = []) {
  applyExplicitRunStatus(
    runStatusHelpers.createExplicitRunStatus(kind, tone, title, detail, actions),
    { source: kind === "running" ? "stage" : "explicit" },
  );
}

function clearExplicitRunStatus(_reason = "", options = {}) {
  applyExplicitRunStatus(null, options);
}

function setRunStatus(tone, title, detail = "", actions = []) {
  const kind =
    tone === "running"
      ? "running"
      : tone === "error"
        ? "error"
        : tone === "success"
          ? "success"
          : "interrupted";
  setExplicitRunStatus(kind, tone, title, detail, actions);
}

function formatErrorText(message) {
  if (!message) return "Generation failed.";
  const raw = String(message || "");
  const normalized = message
    .replace(/^Prompt \d+ failed:\s*/i, "")
    .replace(/^Failed to /i, "")
    .trim();
  const hasResumeSchemaError =
    /produced invalid resumedata|personalinfo must|summary must|workexperience must|education must|projects must|skills must|certifications must|languages must|awards must|volunteer must|customsections must|sectionmeta\[|must be one of personalInfo, text, itemList, stringList/i.test(
      normalized,
    );

  if (/no master resume was found|upload your resume/i.test(normalized)) {
    return "Upload your resume first.";
  }
  if (
    /signed out|connect som career coach|reconnect som career coach/i.test(
      normalized,
    )
  ) {
    return "Sign in with Google to continue.";
  }
  if (/storyboard/i.test(normalized)) {
    return "Story bank required or continue without it.";
  }
  if (/extension context invalidated/i.test(normalized)) {
    return "Refresh the LinkedIn page and try again.";
  }
  if (/AI API error|API request failed|API returned|status\s+\d{3}/i.test(normalized)) {
    return normalized;
  }
  if (/Prompt 4/i.test(raw)) {
    return "Resume extraction failed. Check that the file contains resume text, then try again.";
  }
  if (hasResumeSchemaError) {
    return "The draft came back in the wrong format. Try again.";
  }
  return normalized;
}

function getProgressMessage(scope, message, data) {
  const promptLabel =
    typeof data?.promptLabel === "string" ? data.promptLabel : null;
  if (scope === "Orchestrator") {
    const byMessage = new Map([
      ["Generate flow started.", ["Starting run", "Getting things ready."]],
      ["Loading local assets.", ["Loading assets", "Checking your setup."]],
      [
        "Using active LinkedIn tab.",
        ["Checking job page", "Reading this job."],
      ],
      [
        "LinkedIn scrape completed.",
        ["Job captured", "Job details are ready."],
      ],
      [
        "Resolving base resume.",
        ["Finding resume", "Looking for your base resume."],
      ],
      [
        "Resolved base resume for cloning.",
        ["Resume ready", "Base resume found."],
      ],
      [
        "Cloned base resume and created job-specific resume.",
        ["Draft created", "Created the job draft."],
      ],
      ["Rendering Prompt 1.", ["Role fit check", "Preparing the role review."]],
      ["Running Prompt 1.", ["Role fit check", "Reading the role."]],
      [
        "Rendering Prompt 2.",
        ["Positioning plan", "Preparing the positioning plan."],
      ],
      [
        "Running Prompt 2.",
        ["Positioning plan", "Choosing the strongest angles."],
      ],
      [
        "Rendering Prompt 3.",
        ["Resume draft", "Preparing the tailored draft."],
      ],
      ["Running Prompt 3.", ["Resume draft", "Writing the tailored resume."]],
      [
        "Running Prompt 4.",
        ["Base resume setup", "Reading your uploaded resume."],
      ],
      [
        "Validating Prompt 3 output.",
        ["Validating output", "Checking the draft."],
      ],
      ["Patching generated resume.", ["Saving draft", "Saving your resume."]],
      ["Renaming generated resume.", ["Naming resume", "Updating the title."]],
      [
        "Opening generated resume preview.",
        ["Opening workspace", "Opening your resume."],
      ],
    ]);
    return byMessage.get(message) ?? null;
  }

  if (scope === "LinkedInScrape") {
    if (message === "Starting LinkedIn scrape.")
      return ["Reading job page", "Extracting job details."];
    if (message === "LinkedIn scrape normalized successfully.")
      return ["Job captured", "LinkedIn job is ready."];
  }

  if (scope === "ResumeApi") {
    if (message === "Listing resumes.")
      return ["Finding resume", "Loading your resumes."];
    if (message === "Cloning resume.")
      return ["Creating draft", "Cloning your base resume."];
    if (message === "Patch resume succeeded.")
      return ["Saved", "Resume saved."];
    if (message === "Rename resume succeeded.")
      return ["Named", "Title updated."];
  }

  if (promptLabel && scope !== "Background") {
    const title = getUserFacingPromptLabel(promptLabel);
    const phaseText =
      typeof data?.phaseText === "string" ? data.phaseText.trim() : "";
    return [title, phaseText || getPromptStageDetail(title, message)];
  }

  return null;
}

function renderHistory() {
  const historyRoot = $(HISTORY_LIST_ID);
  if (!historyRoot) return;
  const pageNode = $(HISTORY_PAGE_ID);
  const prevButton = $(HISTORY_PREV_ID);
  const nextButton = $(HISTORY_NEXT_ID);
  const filterRoot = $(HISTORY_FILTER_ID);
  const searchInput = $(HISTORY_SEARCH_ID);

  if (searchInput && searchInput.value !== state.historySearch) {
    searchInput.value = state.historySearch;
  }

  const connected = state.connectionState === "connected";
  if (searchInput) {
    searchInput.disabled = state.historyConnecting || !connected;
  }
  if (filterRoot) {
    filterRoot.dataset.open = state.historyFilterOpen ? "true" : "false";
  }
  $(HISTORY_SORT_ASC_ID)?.classList.toggle(
    "is-active",
    state.historySortDirection === "asc",
  );
  $(HISTORY_SORT_DESC_ID)?.classList.toggle(
    "is-active",
    state.historySortDirection === "desc",
  );

  const { items, totalItems, totalPages } = getVisibleHistory();

  if (state.historyConnecting || !connected) {
    state.historyFilterOpen = false;
    historyRoot.innerHTML = state.historyConnecting
      ? `<div class="resume-matcher-empty">Connecting to Lumi Coach...</div>`
      : `<div class="resume-matcher-empty">
          <div><strong>Connect Lumi Coach to view saved runs.</strong></div>
          <div>Your runs are saved in your Lumi workspace.</div>
          <button type="button" class="resume-matcher-button is-primary" data-history-connect>Continue with Google</button>
        </div>`;
    if (pageNode) pageNode.textContent = "0/0";
    if (prevButton) prevButton.disabled = true;
    if (nextButton) nextButton.disabled = true;
    return;
  }

  if (!totalItems) {
    historyRoot.innerHTML = `<div class="resume-matcher-empty">${state.historySearch.trim() ? "No matching runs." : "No runs yet."}</div>`;
    if (pageNode) pageNode.textContent = "0/0";
    if (prevButton) prevButton.disabled = true;
    if (nextButton) nextButton.disabled = true;
    return;
  }

  historyRoot.innerHTML = items
    .map(
      ({ entry, originalIndex }) => {
        const metaText = [formatDate(entry?.generatedAt), getHistoryStatus(entry)]
          .filter(Boolean)
          .join(" • ");
        const hasPreview = Boolean(entry?.previewUrl);
        const runId = typeof entry?.runId === "string" ? entry.runId : "";
        const isDeleting = runId && state.deletingHistoryRunId === runId;
        return `
      <article class="resume-matcher-history-item">
        <div class="resume-matcher-history-item__top">
          <div>
            ${
              getHistorySourceUrl(entry)
                ? `<button type="button" class="resume-matcher-history-item__title-button" data-history-job="${originalIndex}">${escapeHtml(entry?.title || "Untitled role")}</button>`
                : `<div class="resume-matcher-history-item__title">${escapeHtml(entry?.title || "Untitled role")}</div>`
            }
            <div class="resume-matcher-history-item__company">${escapeHtml(entry?.company || "Unknown company")}</div>
          </div>
        </div>
        <div class="resume-matcher-history-item__footer">
          <div class="resume-matcher-history-item__meta">${escapeHtml(metaText)}</div>
          <div class="resume-matcher-history-item__actions">
            ${
              hasPreview
                ? `<button type="button" class="resume-matcher-history-item__link" data-history-open="${originalIndex}">View resume</button>`
                : ""
            }
            <button type="button" class="resume-matcher-history-item__delete" data-history-delete="${originalIndex}" ${isDeleting ? "disabled" : ""}>${isDeleting ? "Deleting..." : "Delete"}</button>
          </div>
        </div>
      </article>
    `;
      },
    )
    .join("");

  if (pageNode) pageNode.textContent = `${state.historyPage}/${totalPages}`;
  if (prevButton) prevButton.disabled = state.historyPage <= 1;
  if (nextButton) nextButton.disabled = state.historyPage >= totalPages;
}

function renderProviderFields() {
  const settings = state.assets?.llmSettings;
  const providerDraft = syncProviderDraftState();
  const select = $(PROVIDER_SELECT_ID);
  if (!settings || !select) return;
  const panel = $(PROVIDER_PANEL_ID);
  if (panel) {
    panel.hidden = !state.providerSettingsEditOpen;
  }

  const options = renderProviderOptions(settings, providerDraft.selectedProfileId);
  select.innerHTML = options;
  select.value = providerDraft.selectedProfileId || "";

  const profile = getSavedProfileById(
    providerDraft.selectedProfileId,
    settings,
  );
  const isWeb = profile?.mode === "web_automation";
  const isApi = profile?.mode === "api";
  const missingFields = state.providerValidationAttempted
    ? new Set(state.providerValidationMissingFields)
    : new Set();
  const requiredEmptyFields = new Set(getProviderDraftMissingFields(providerDraft));

  const toggleRow = (id, visible) => {
    const node = $(id);
    if (!node) return;
    node.hidden = !visible;
  };
  const markInvalid = (id, field) => {
    const node = $(id);
    if (!(node instanceof HTMLElement)) return;
    node.dataset.invalid = missingFields.has(field) ? "true" : "false";
  };
  const markRequiredEmpty = (id, field) => {
    const node = $(id);
    if (!(node instanceof HTMLElement)) return;
    node.dataset.requiredEmpty =
      !missingFields.has(field) && requiredEmptyFields.has(field)
        ? "true"
        : "false";
  };

  const showModelInput = isApi && !profile?.stageModels;
  toggleRow(PROVIDER_WEB_ROW_ID, isWeb);
  toggleRow(PROVIDER_API_BASE_ROW_ID, isApi);
  toggleRow(PROVIDER_API_GRID_ID, isApi);
  toggleRow(PROVIDER_MODEL_ROW_ID, showModelInput);
  toggleRow(PROVIDER_API_KEY_ROW_ID, isApi);
  select.dataset.invalid = missingFields.has("provider") ? "true" : "false";
  select.dataset.requiredEmpty =
    !missingFields.has("provider") && requiredEmptyFields.has("provider")
      ? "true"
      : "false";
  markInvalid(PROVIDER_WEB_ROW_ID, "targetUrl");
  markInvalid(PROVIDER_API_BASE_ROW_ID, "apiBaseUrl");
  markInvalid(PROVIDER_MODEL_ROW_ID, "model");
  markInvalid(PROVIDER_API_KEY_ROW_ID, "apiKey");
  markRequiredEmpty(PROVIDER_WEB_ROW_ID, "targetUrl");
  markRequiredEmpty(PROVIDER_API_BASE_ROW_ID, "apiBaseUrl");
  markRequiredEmpty(PROVIDER_MODEL_ROW_ID, "model");
  markRequiredEmpty(PROVIDER_API_KEY_ROW_ID, "apiKey");

  const webInput = $(PROVIDER_WEB_INPUT_ID);
  if (webInput) webInput.value = isWeb ? providerDraft.targetUrl || "" : "";
  const apiBaseInput = $(PROVIDER_API_BASE_INPUT_ID);
  if (apiBaseInput)
    apiBaseInput.value = isApi ? providerDraft.apiBaseUrl || "" : "";
  const modelInput = $(PROVIDER_MODEL_INPUT_ID);
  if (modelInput) modelInput.value = isApi ? providerDraft.model || "" : "";
  syncSecretInput(PROVIDER_API_KEY_INPUT_ID);
  syncProviderSecretHint(PROVIDER_API_KEY_INPUT_ID, PROVIDER_API_KEY_HINT_ID);
}

function renderSettings() {
  const assets = state.assets;
  const accountLabel = assets?.extensionAuth?.user?.email?.trim() || "";
  const usingExtensionPromptDefaults =
    isUsingExtensionPromptDefaultsMode(assets);
  const hasMaster = hasBackendMasterResume();
  const providerReadiness = getSavedProviderImportReadiness();
  const providerReady = providerReadiness.ready === true;
  const connected = state.connectionState === "connected";
  const accountControlsDisabled = !connected;
  const activePromptProfileId =
    assets?.activePromptProfileId || DEFAULT_ACTIVE_PROMPT_PROFILE_ID;
  const editablePromptTemplateNames = new Set(
    getEditablePromptTemplateNamesForProfile(activePromptProfileId),
  );
  const readyToTailor = connected && providerReady && hasMaster;
  const settingsHealth = $(SETTINGS_HEALTH_ID);
  if (settingsHealth) {
    settingsHealth.textContent = readyToTailor ? "Ready to tailor" : "Finish setup";
    settingsHealth.dataset.state = readyToTailor ? "ready" : "incomplete";
  }
  const promptProfileTabs = $(PROMPT_PROFILE_TABS_ID);
  const promptProfileDetail = $(PROMPT_PROFILE_DETAIL_ID);
  if (promptProfileTabs instanceof HTMLElement) {
    promptProfileTabs.className = "resume-matcher-profile-tabs is-compact";
    promptProfileTabs.innerHTML = renderPromptProfileTabs(
      assets?.promptTemplateProfiles,
      activePromptProfileId,
      {
        disabled: accountControlsDisabled,
        compact: true,
      },
    );
  }
  if (promptProfileDetail) {
    promptProfileDetail.textContent = `You are editing ${getPromptProfileLabel(activePromptProfileId)}. Uploaded prompt bodies below belong only to this style.`;
  }

  const masterLabel = $(MASTER_RESUME_LABEL_ID);
  const storyboardLabel = $(STORYBOARD_LABEL_ID);
  if (masterLabel) {
    const label = getBackendMasterResumeLabel();
    const compactLabel = truncateDisplayText(label, 28);
    const canImportMasterResume = !state.masterResumeImportInFlight;
    const statusText = state.masterResumeImportInFlight
      ? "Extracting and saving..."
      : state.masterResumeImportTone === "error"
        ? state.masterResumeImportMessage
        : "";
    masterLabel.className = "resume-matcher-settings-row-card";
    masterLabel.innerHTML = `
      <div class="resume-matcher-settings-row-card__main">
        <div class="resume-matcher-settings-row-card__copy">
          <div class="resume-matcher-settings-row-card__topline">
            <div class="resume-matcher-settings-row-card__title">Master Resume</div>
            ${hasMaster ? "" : renderSettingsStatusPill("Needs setup", "needed")}
          </div>
          <div class="resume-matcher-settings-row-card__value" title="${escapeHtml(hasMaster ? label : "Not added")}">${hasMaster ? escapeHtml(compactLabel) : "Not added"}</div>
          <div class="resume-matcher-settings-row-card__detail">
            ${
              hasMaster
                ? `Saved in <a class="resume-matcher-secondary-link" href="${escapeHtml(getBackendMasterResumeUrl())}" target="_blank" rel="noopener noreferrer">Lumi Coach</a>`
                : "Required before tailoring."
            }
          </div>
        </div>
        <div class="resume-matcher-settings-row-card__actions">
          ${
            hasMaster
              ? renderSettingsActionButton(MASTER_RESUME_REPLACE_ID, "Replace", { disabled: !canImportMasterResume })
              : renderSettingsActionButton(MASTER_RESUME_ACTION_ID, "Add", { variant: "primary", disabled: !canImportMasterResume })
          }
        </div>
      </div>
      ${
        statusText
          ? `<div class="resume-matcher-settings-row-card__detail">${escapeHtml(statusText)}</div>`
          : ""
      }
      ${
        state.masterResumeReplaceOpen && hasMaster
          ? `<div id="${MASTER_RESUME_REPLACE_PANEL_ID}" class="resume-matcher-settings-row-card__panel">
              <div class="resume-matcher-settings-row-card__detail">Replace the Master Resume used for future tailoring. Existing generated resumes will not change.</div>
              <div class="resume-matcher-button-row">
                ${renderSettingsActionButton(MASTER_RESUME_ACTION_ID, "Upload resume", { variant: "primary", disabled: !canImportMasterResume })}
                ${renderSettingsActionButton(MASTER_RESUME_CANCEL_REPLACE_ID, "Cancel", { variant: "quiet", disabled: state.masterResumeImportInFlight })}
              </div>
            </div>`
          : ""
      }
    `;
  }
  if (storyboardLabel && !storyboardLabel.hidden) {
    const hasFile = Boolean(assets?.storyboardAsset?.filename);
    const label = assets?.storyboardAsset?.filename?.trim() || "Story bank";
    const compactLabel = truncateDisplayText(label, 28);
    storyboardLabel.className = "resume-matcher-settings-row-card";
    storyboardLabel.innerHTML = `
      <div class="resume-matcher-settings-row-card__main">
        <div class="resume-matcher-settings-row-card__copy">
          <div class="resume-matcher-settings-row-card__topline">
            <div class="resume-matcher-settings-row-card__title">Story bank</div>
            ${hasFile ? "" : `<span class="resume-matcher-settings-row-card__warning-icon" title="Optional, but useful">${icon("warning")}</span>`}
          </div>
          <div class="resume-matcher-settings-row-card__value" title="${escapeHtml(hasFile ? label : "Not added")}">${hasFile ? escapeHtml(compactLabel) : "Not added"}</div>
          <div class="resume-matcher-settings-row-card__detail">
            Add richer context for stronger bullets and extra wins. Optional.
            <a class="resume-matcher-secondary-link" href="${STORY_BANK_GUIDE_URL}" target="_blank" rel="noopener noreferrer">Learn more</a>
          </div>
        </div>
        <div class="resume-matcher-settings-row-card__actions">
          <div class="resume-matcher-settings-row-card__action-stack">
            ${renderSettingsActionButton(STORYBOARD_ACTION_ID, hasFile ? "Replace" : "Add")}
            ${
              hasFile
                ? `<button id="${STORYBOARD_DELETE_ID}" class="resume-matcher-settings-row-card__subtle-action" type="button">Delete</button>`
                : ""
            }
          </div>
        </div>
      </div>
      ${
        state.storyboardReplaceOpen
          ? `<div id="${STORYBOARD_PANEL_ID}" class="resume-matcher-settings-row-card__panel">
              <div class="resume-matcher-settings-row-card__detail">Upload TXT, MD, or JSON with achievements, project notes, and examples. It stays local to this browser.</div>
              <div class="resume-matcher-button-row">
                ${renderSettingsActionButton(STORYBOARD_UPLOAD_ID, "Upload story bank", { variant: "primary" })}
                ${renderSettingsActionButton(STORYBOARD_CANCEL_ID, "Cancel", { variant: "quiet" })}
              </div>
            </div>`
          : ""
      }
    `;
  }
  PROMPT_FILE_DESCRIPTORS.forEach(({ templateName, label, editable }) => {
    const row = $(promptRowId(templateName));
    if (row instanceof HTMLElement) {
      row.hidden = !editablePromptTemplateNames.has(templateName);
    }
    const chip = $(promptLabelId(templateName));
    if (!chip) return;
    const descriptor = PROMPT_FILE_DESCRIPTORS.find(
      (item) => item.templateName === templateName,
    );
    const asset =
      editable === false ? null : assets?.[`${templateName}TemplateAsset`];
    const hasFile = Boolean(asset?.filename);
    const filename = asset?.filename?.trim() || label;
    const displayFilename = hasFile
      ? truncateFilenameForDisplay(filename, 40)
      : filename;
    chip.innerHTML = `<span class="resume-matcher-file-chip__text" title="${escapeHtml(filename)}">${escapeHtml(displayFilename)}</span><span class="resume-matcher-file-chip__actions">${renderPromptActionButtons(templateName, hasFile, Boolean(descriptor?.downloadName), label, editable !== false)}</span>`;
    chip.classList.toggle("is-placeholder", !hasFile);
  });

  const apifyDraft = syncApifyDraftState();
  const apifyEnabled = $(APIFY_ENABLED_INPUT_ID);
  if (apifyEnabled) {
    apifyEnabled.checked = apifyDraft.enabled === true;
  }
  const apifyTokenRow = $(APIFY_TOKEN_ROW_ID);
  if (apifyTokenRow) {
    apifyTokenRow.hidden = apifyDraft.enabled !== true;
  }
  const apifyTokenInput = $(APIFY_TOKEN_INPUT_ID);
  if (apifyTokenInput) {
    syncSecretInput(APIFY_TOKEN_INPUT_ID);
    syncSecretRevealToggle(APIFY_TOKEN_INPUT_ID);
  }

  const savedProvider = getSavedProfileById(
    assets?.llmSettings?.activeProfileId,
    assets?.llmSettings,
  );
  const providerValue =
    providerReady && savedProvider?.label
      ? savedProvider.label
      : "Choose your AI provider";
  const providerStatus = $(PROVIDER_STATUS_ID);
  setSettingsStatusPill(
    providerStatus,
    providerReady ? "" : "Needs setup",
    "needed",
  );
  const providerValueNode = $(PROVIDER_VALUE_ID);
  if (providerValueNode) {
    providerValueNode.textContent = providerValue;
    providerValueNode.title = providerValue;
  }
  const providerDetail = $(PROVIDER_DETAIL_ID);
  if (providerDetail) {
    providerDetail.textContent = providerReady
      ? "Used for extraction and tailoring."
      : providerReadiness.message || "Required before tailoring.";
  }
  const providerChangeButton = $(PROVIDER_CHANGE_ID);
  if (providerChangeButton) {
    providerChangeButton.hidden = state.providerSettingsEditOpen;
  }
  const providerPanel = $(PROVIDER_PANEL_ID);
  if (providerPanel) {
    providerPanel.hidden = !state.providerSettingsEditOpen;
  }

  const accountButton = $(ACCOUNT_ACTION_ID);
  const accountDetail = $(ACCOUNT_DETAIL_ID);
  const accountStatus = $(ACCOUNT_STATUS_ID);
  setSettingsStatusPill(
    accountStatus,
    connected ? "" : "Needs setup",
    "needed",
  );
  if (accountButton) {
    accountButton.className = `resume-matcher-button resume-matcher-google-button${connected ? " is-quiet" : " is-primary"}`;
    accountButton.innerHTML = renderGoogleButtonLabel(
      connected ? "Sign out" : "Sign in",
    );
    accountButton.disabled = false;
  }
  if (accountDetail) {
    accountDetail.textContent =
      connected ? accountLabel || "Signed in" : "Not signed in";
    accountDetail.title = accountDetail.textContent;
  }

  const hasImportedLlmConfig = Boolean(assets?.importedLlmConfig);
  const llmConfigBadge = $(LLM_CONFIG_BADGE_ID);
  if (llmConfigBadge) llmConfigBadge.hidden = !hasImportedLlmConfig;
  const llmConfigResetBtn = $(LLM_CONFIG_RESET_ID);
  if (llmConfigResetBtn) llmConfigResetBtn.hidden = !hasImportedLlmConfig;

  [
    MASTER_RESUME_ACTION_ID,
    MASTER_RESUME_REPLACE_ID,
    MASTER_RESUME_CANCEL_REPLACE_ID,
    MASTER_RESUME_INPUT_ID,
    STORYBOARD_ACTION_ID,
    STORYBOARD_DELETE_ID,
    STORYBOARD_UPLOAD_ID,
    STORYBOARD_CANCEL_ID,
    STORYBOARD_INPUT_ID,
    PROVIDER_CHANGE_ID,
    PROVIDER_CANCEL_ID,
    PROVIDER_SELECT_ID,
    PROVIDER_WEB_INPUT_ID,
    PROVIDER_API_BASE_INPUT_ID,
    PROVIDER_MODEL_INPUT_ID,
    PROVIDER_API_KEY_INPUT_ID,
    PROVIDER_SAVE_ID,
    APIFY_ENABLED_INPUT_ID,
    APIFY_TOKEN_INPUT_ID,
    APIFY_TOKEN_TOGGLE_ID,
    APIFY_SAVE_ID,
    RESET_LOCAL_ID,
  ].forEach((id) => {
    const control = $(id);
    if (control) {
      const preserveMasterDisabledState =
        id === MASTER_RESUME_ACTION_ID ||
        id === MASTER_RESUME_REPLACE_ID ||
        id === MASTER_RESUME_CANCEL_REPLACE_ID;
      control.disabled =
        accountControlsDisabled ||
        (preserveMasterDisabledState && control.disabled);
    }
  });
  PROMPT_FILE_DESCRIPTORS.forEach(({ templateName, editable }) => {
    const promptInput = $(promptInputId(templateName));
    if (promptInput) {
      promptInput.disabled =
        accountControlsDisabled ||
        editable === false ||
        !editablePromptTemplateNames.has(templateName);
    }
    const promptAction = $(promptActionId(templateName));
    if (promptAction) {
      promptAction.disabled =
        accountControlsDisabled ||
        editable === false ||
        !editablePromptTemplateNames.has(templateName);
    }
    const promptDownload = $(promptDownloadId(templateName));
    if (promptDownload) {
      promptDownload.disabled =
        accountControlsDisabled || !editablePromptTemplateNames.has(templateName);
    }
  });
  const promptRefreshButton = $(PROMPT_REFRESH_ID);
  if (promptRefreshButton) {
    promptRefreshButton.disabled =
      accountControlsDisabled ||
      Boolean(state.promptSyncPromise) ||
      usingExtensionPromptDefaults;
  }
  $(MASTER_RESUME_ACTION_ID)?.addEventListener("click", async () => {
    if (
      accountControlsDisabled ||
      state.masterResumeImportInFlight
    )
      return;
    if (!(await ensureProviderReadyForMasterResumeImport())) return;
    $(MASTER_RESUME_INPUT_ID)?.click();
  });
  $(MASTER_RESUME_REPLACE_ID)?.addEventListener("click", () => {
    if (
      accountControlsDisabled ||
      state.masterResumeImportInFlight
    )
      return;
    state.masterResumeReplaceOpen = true;
    state.masterResumeImportMessage = "";
    renderSettings();
  });
  $(MASTER_RESUME_CANCEL_REPLACE_ID)?.addEventListener("click", () => {
    if (state.masterResumeImportInFlight) return;
    state.masterResumeReplaceOpen = false;
    state.masterResumeImportMessage = "";
    renderSettings();
  });
  $(STORYBOARD_ACTION_ID)?.addEventListener("click", async () => {
    if (accountControlsDisabled) return;
    state.storyboardReplaceOpen = true;
    renderSettings();
  });
  $(STORYBOARD_DELETE_ID)?.addEventListener("click", async () => {
    if (accountControlsDisabled) return;
    try {
      const response = await sendMessage("CLEAR_STORYBOARD");
      if (!response?.ok) {
        throw new Error(response?.error || "Failed to delete story bank.");
      }
      state.storyboardReplaceOpen = false;
      await refreshBoardData();
    } catch (error) {
      setRunStatus(
        "error",
        "Delete failed",
        error instanceof Error
          ? error.message
          : "Failed to delete story bank.",
      );
    }
  });
  $(STORYBOARD_UPLOAD_ID)?.addEventListener("click", () => {
    if (accountControlsDisabled) return;
    $(STORYBOARD_INPUT_ID)?.click();
  });
  $(STORYBOARD_CANCEL_ID)?.addEventListener("click", () => {
    state.storyboardReplaceOpen = false;
    renderSettings();
  });
  $(PROMPT_PROFILE_TABS_ID)?.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-prompt-profile-id]");
    if (!(target instanceof HTMLButtonElement)) return;
    try {
      await persistPromptProfileSelection(
        target.dataset.promptProfileId || "",
      );
      renderSettings();
      renderRunView();
    } catch (error) {
      setRunStatus(
        "error",
        "Save failed",
        error instanceof Error
          ? error.message
          : "Failed to switch prompt profile.",
      );
    }
  });
  PROMPT_FILE_DESCRIPTORS.forEach(({ templateName, label, editable }) => {
    $(promptActionId(templateName))?.addEventListener("click", async () => {
      if (
        accountControlsDisabled ||
        editable === false ||
        !isPromptTemplateEditableForActiveProfile(templateName)
      )
        return;
      try {
        const asset = state.assets?.[`${templateName}TemplateAsset`];
        if (asset?.filename) {
          const response = await sendMessage("DELETE_PROMPT_TEMPLATE", {
            templateName,
            promptProfileId:
              state.assets?.activePromptProfileId || DEFAULT_ACTIVE_PROMPT_PROFILE_ID,
          }).catch(() => {});
          if (!response?.ok) {
            throw new Error(response?.error || `Failed to delete ${label}.`);
          }
          await refreshBoardData();
          return;
        }
        $(promptInputId(templateName))?.click();
      } catch (error) {
        setRunStatus(
          "error",
          "Save failed",
          error instanceof Error ? error.message : `Failed to update ${label}.`,
        );
      }
    });
    $(promptDownloadId(templateName))?.addEventListener("click", async () => {
      if (!isPromptTemplateEditableForActiveProfile(templateName)) return;
      try {
        await downloadDefaultPrompt(templateName);
        void trackAnalyticsEvent("extension_prompt_downloaded", {
          surface: "settings_view",
          template_name: templateName,
        });
      } catch (error) {
        setRunStatus(
          "error",
          "Download failed",
          error instanceof Error
            ? error.message
            : `Failed to download default ${label}.`,
        );
      }
    });
  });
  $(PROMPT_REFRESH_ID)?.addEventListener("click", async () => {
    if (accountControlsDisabled) return;
    try {
      await refreshDefaultPromptsManually();
      void trackAnalyticsEvent("extension_prompt_defaults_refreshed", {
        surface: "settings_view",
      });
    } catch (error) {
      setRunStatus(
        "error",
        "Refresh failed",
        error instanceof Error
          ? error.message
          : "Failed to refresh prompt defaults.",
        );
    }
  });
  renderProviderFields();
  syncProviderSaveButtonState();
  syncApifySaveButtonState();
}

function autoGrowTextarea(textarea) {
  if (!(textarea instanceof HTMLTextAreaElement)) return;
  const styles = window.getComputedStyle(textarea);
  const lineHeight = Number.parseFloat(styles.lineHeight) || 18;
  const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
  const paddingBottom = Number.parseFloat(styles.paddingBottom) || 0;
  const borderTop = Number.parseFloat(styles.borderTopWidth) || 0;
  const borderBottom = Number.parseFloat(styles.borderBottomWidth) || 0;
  const maxHeight = Math.ceil(
    lineHeight * 6 + paddingTop + paddingBottom + borderTop + borderBottom,
  );

  textarea.style.height = "auto";
  const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
  textarea.style.height = `${nextHeight}px`;
  textarea.style.overflowY =
    textarea.scrollHeight > maxHeight ? "auto" : "hidden";
}

function renderRunView() {
  syncRunSourceModeForRoute();
  if (!state.boardOpen || state.currentView !== "run") {
    state.promptStyleInfoOpen = false;
  }
  const status = getRunStatusCopy();
  const setupRequirement = getSetupRequirementStatus();
  const nonLinkedInManualRoute = isNonLinkedInManualRoute();
  const readyPill = $(RUN_READY_ID);
  const jobMeta = $(RUN_META_ID);
  const onboardingRoot = $(RUN_ONBOARDING_ID);
  const manualJdField = $(RUN_MANUAL_JD_FIELD_ID);
  const manualJdInput = $(RUN_MANUAL_JD_ID);
  const manualDetailsToggle = $(RUN_MANUAL_DETAILS_TOGGLE_ID);
  const manualDetailsPanel = $(RUN_MANUAL_DETAILS_PANEL_ID);
  const manualTitleInput = $(RUN_MANUAL_TITLE_ID);
  const manualCompanyInput = $(RUN_MANUAL_COMPANY_ID);
  const manualSourceUrlInput = $(RUN_MANUAL_SOURCE_URL_ID);
  const promptProfileField = $(RUN_PROMPT_PROFILE_FIELD_ID);
  const promptProfileTabs = $(RUN_PROMPT_PROFILE_TABS_ID);
  const promptProfilePopup = $(RUN_PROMPT_PROFILE_POPUP_ID);
  const promptProfileHint = $(RUN_PROMPT_PROFILE_HINT_ID);
  const sourceToggle = $(RUN_SOURCE_TOGGLE_ID);
  const sourceLinkedInButton = $(RUN_SOURCE_LINKEDIN_ID);
  const sourceManualButton = $(RUN_SOURCE_MANUAL_ID);
  const notesField = $(RUN_NOTES_ID)?.closest(".resume-matcher-field");
  const manualMode = isManualRunMode();
  const isLoadingJob =
    state.jobLoadState === "loading" &&
    (state.selectedJobRefreshing || !hasEnoughJobContext(state.currentJob));
  const onboardingMode = isOnboardingMode();
  const signedOutBlocker = isSignedOutNavigationLocked();
  const showOnboarding = onboardingMode;
  const hardBlocker =
    (!manualMode || signedOutBlocker) &&
    (Boolean(setupRequirement) || isHardPrerequisiteBlocker());
  const missingMasterResumeBlocker =
    !onboardingMode &&
    !manualMode &&
    state.setupState?.state === "missing_resume";
  const waitingForSelection = isWaitingForJobSelection();
  const canRun = isRunReady();
  const runningDifferentJob =
    state.isRunning && !doesActiveRunMatchCurrentJob();
  const canRefreshJob = !manualMode && canManuallyRescrapeJob();
  const missingManualJdStatus =
    manualMode &&
    !hasManualJobDescription() &&
    status?.tone === "info" &&
    status?.title === "Paste a job description";

  if (onboardingRoot) {
    onboardingRoot.hidden = !showOnboarding;
    onboardingRoot.innerHTML = showOnboarding ? renderOnboardingStep() : "";
    if (showOnboarding && getResolvedOnboardingStep() === "provider") {
      const providerDraft = syncProviderDraftState();
      const onboardingProviderSelect = $(
        "resume-matcher-onboarding-provider-select",
      );
      if (onboardingProviderSelect) {
        onboardingProviderSelect.value = providerDraft.selectedProfileId;
      }
    }
    syncSecretInput(ONBOARDING_PROVIDER_API_KEY_INPUT_ID);
    syncProviderSecretHint(
      ONBOARDING_PROVIDER_API_KEY_INPUT_ID,
      ONBOARDING_PROVIDER_API_KEY_HINT_ID,
    );
    syncOnboardingProviderContinueState();
  }

  if (sourceLinkedInButton && sourceManualButton) {
    const linkedInEnabled = canUseLinkedInRunMode();
    sourceLinkedInButton.disabled = !linkedInEnabled || state.isRunning || state.isCanceling;
    sourceManualButton.disabled = state.isRunning || state.isCanceling;
    sourceLinkedInButton.classList.toggle("is-active", !manualMode);
    sourceManualButton.classList.toggle("is-active", manualMode);
    sourceLinkedInButton.setAttribute("aria-selected", String(!manualMode));
    sourceManualButton.setAttribute("aria-selected", String(manualMode));
  }
  if (sourceToggle) {
    sourceToggle.hidden = nonLinkedInManualRoute || missingMasterResumeBlocker;
  }
  if (promptProfileField) {
    promptProfileField.hidden =
      showOnboarding || hardBlocker || waitingForSelection;
    if (promptProfileField.hidden && state.promptStyleInfoOpen) {
      state.promptStyleInfoOpen = false;
    }
    promptProfileField.classList.toggle(
      "is-popup-open",
      !promptProfileField.hidden && state.promptStyleInfoOpen,
    );
  }
  if (promptProfileTabs instanceof HTMLElement) {
    const activePromptProfileId =
      state.assets?.activePromptProfileId || DEFAULT_ACTIVE_PROMPT_PROFILE_ID;
    const runnablePromptProfileId = getRunnablePromptProfileId(
      state.assets?.promptTemplateProfiles,
      activePromptProfileId,
    );
    promptProfileTabs.className =
      "resume-matcher-profile-tabs is-compact is-run-wide";
    promptProfileTabs.innerHTML = renderPromptProfileTabs(
      state.assets?.promptTemplateProfiles,
      runnablePromptProfileId,
      {
        disabled: state.isRunning || state.isCanceling,
        compact: true,
        allowDisabledSelection: false,
      },
    );
  }
  if (promptProfilePopup instanceof HTMLElement) {
    promptProfilePopup.hidden = !state.promptStyleInfoOpen;
    promptProfilePopup.innerHTML = state.promptStyleInfoOpen
      ? renderTailoringStyleInfoPopup()
      : "";
    if (state.promptStyleInfoOpen) {
      positionPromptStyleInfoPopup();
    }
  }
  const promptProfileInfoButton = $(RUN_PROMPT_PROFILE_INFO_ID);
  if (promptProfileInfoButton instanceof HTMLButtonElement) {
    promptProfileInfoButton.setAttribute(
      "aria-expanded",
      String(state.promptStyleInfoOpen),
    );
  }
  if (promptProfileHint instanceof HTMLElement) {
    const boldEnabled = isBoldPromptProfileEnabled(
      state.assets?.promptTemplateProfiles,
    );
    promptProfileHint.hidden =
      state.isRunning || state.isCanceling || boldEnabled;
    promptProfileHint.textContent = boldEnabled
      ? ""
      : "Lean is available by default.";
  }

  if (readyPill) {
    readyPill.hidden = showOnboarding || hardBlocker || waitingForSelection || manualMode;
    readyPill.innerHTML = canRefreshJob
      ? icon("refresh")
      : canRun
        ? "✓"
        : isLoadingJob
          ? "…"
          : "!";
    const toneClass = canRun
      ? ""
      : isLoadingJob
        ? " is-loading"
        : status?.tone === "error"
          ? " is-error"
          : status?.tone === "blocked" || status?.tone === "warning"
            ? " is-warning"
            : " is-muted";
    readyPill.className = `resume-matcher-run-ready${toneClass}${canRefreshJob ? " is-actionable" : ""}`;
    readyPill.disabled = !canRefreshJob;
    readyPill.setAttribute(
      "aria-label",
      canRefreshJob
        ? "Refresh job details"
        : canRun
          ? "Job ready"
          : isLoadingJob
            ? "Loading job"
            : "Needs setup",
    );
    readyPill.setAttribute(
      "title",
      canRefreshJob
        ? "Refresh job details"
        : canRun
          ? "Job ready"
          : isLoadingJob
            ? "Loading job"
            : "Needs setup",
    );
  }

  if (jobMeta) {
    jobMeta.hidden = showOnboarding || hardBlocker || waitingForSelection || manualMode;
    if (state.selectedJobRefreshing) {
      jobMeta.innerHTML = "";
    } else {
      const job = state.currentJob || {};
      const parts = [];
      if (job.company)
        parts.push(`<strong>${escapeHtml(job.company)}</strong>`);
      if (job.highlights?.length) {
        if (parts.length)
          parts.push('<span class="resume-matcher-run-meta__bullet">•</span>');
        parts.push(`<span>${escapeHtml(job.highlights.join(" · "))}</span>`);
      } else if (job.location) {
        if (parts.length)
          parts.push('<span class="resume-matcher-run-meta__bullet">•</span>');
        parts.push(`<span>${escapeHtml(job.location)}</span>`);
      }
      jobMeta.innerHTML = parts.join("");
    }
  }

  const notes = $(RUN_NOTES_ID);
  if (notes && notes.value !== state.customMessage) {
    notes.value = state.customMessage;
    autoGrowTextarea(notes);
  }
  if (manualJdField) {
    manualJdField.hidden =
      showOnboarding || hardBlocker || waitingForSelection || !shouldShowManualJdInput();
  }
  if (manualJdInput && manualJdInput.value !== state.manualJobDescription) {
    manualJdInput.value = state.manualJobDescription;
    autoGrowTextarea(manualJdInput);
  }
  if (manualDetailsToggle instanceof HTMLButtonElement) {
    const showManualDetails = !manualJdField?.hidden;
    manualDetailsToggle.hidden = !showManualDetails;
    manualDetailsToggle.setAttribute(
      "aria-expanded",
      String(Boolean(state.manualJobDetailsOpen)),
    );
    manualDetailsToggle.textContent = state.manualJobDetailsOpen
      ? "Hide details"
      : "Add details (optional)";
  }
  if (manualDetailsPanel) {
    manualDetailsPanel.hidden =
      manualJdField?.hidden || !state.manualJobDetailsOpen;
  }
  if (
    manualTitleInput instanceof HTMLInputElement &&
    manualTitleInput.value !==
      pickManualJobMetadataValue(
        state.manualJobTitle,
        state.currentJob?.title || "",
      )
  ) {
    manualTitleInput.value = pickManualJobMetadataValue(
      state.manualJobTitle,
      state.currentJob?.title || "",
    );
  }
  if (
    manualCompanyInput instanceof HTMLInputElement &&
    manualCompanyInput.value !==
      pickManualJobMetadataValue(
        state.manualJobCompany,
        state.currentJob?.company || "",
      )
  ) {
    manualCompanyInput.value = pickManualJobMetadataValue(
      state.manualJobCompany,
      state.currentJob?.company || "",
    );
  }
  if (
    manualSourceUrlInput instanceof HTMLInputElement &&
    manualSourceUrlInput.value !==
      pickManualJobMetadataValue(
        state.manualJobSourceUrl,
        state.currentJob?.sourceUrl || "",
      )
  ) {
    manualSourceUrlInput.value = pickManualJobMetadataValue(
      state.manualJobSourceUrl,
      state.currentJob?.sourceUrl || "",
    );
  }
  if (notesField) {
    notesField.hidden = showOnboarding || hardBlocker || waitingForSelection;
  }

  const primaryButton = $(RUN_PRIMARY_ID);
  if (primaryButton) {
    const manualReady = manualMode && hasManualJobDescription();
    primaryButton.disabled =
      showOnboarding ||
      waitingForSelection ||
      state.isRunning ||
      state.isCanceling ||
      (manualMode ? !manualReady : !canRun);
    primaryButton.textContent = state.isCanceling
      ? "Canceling..."
      : state.isRunning
        ? runningDifferentJob
          ? "Working on other job"
          : "Running…"
        : manualMode
          ? getManualPrimaryButtonLabel()
          : "Tailor";
    primaryButton.hidden = showOnboarding || hardBlocker || waitingForSelection;
  }

  const cancelRow = $(RUN_CANCEL_ROW_ID);
  const cancelButton = $(RUN_CANCEL_ID);
  if (cancelRow && cancelButton) {
    const showCancel =
      !showOnboarding &&
      !hardBlocker &&
      !waitingForSelection &&
      isRunCancelable();
    cancelRow.hidden = !showCancel;
    cancelButton.disabled = state.isCanceling;
    cancelButton.textContent = state.isCanceling ? "Canceling..." : "Cancel run";
  }

  const mainActions = $(RUN_ACTIONS_ID);
  const statusRoot = $(RUN_STATUS_ID);
  const statusActions = $(RUN_STATUS_ACTIONS_ID);
  const hideManualComposeStatus =
    manualMode &&
    hasManualJobDescription() &&
    !state.awaitingAuth &&
    !state.awaitingStoryboard &&
    status?.tone === "blocked";
  if (statusRoot && statusActions) {
    statusRoot.hidden = showOnboarding || missingManualJdStatus || hideManualComposeStatus;
    statusActions.hidden = showOnboarding || missingManualJdStatus || hideManualComposeStatus;
    statusRoot.classList.toggle(
      "is-visible",
      !showOnboarding &&
        !missingManualJdStatus &&
        !hideManualComposeStatus &&
        Boolean(status),
    );
    statusRoot.dataset.tone = status?.tone || "neutral";
    const saveLogsLink =
      status && (status.kind === "error" || status.kind === "interrupted")
        ? `<span class="resume-matcher-status-savelogs" data-status-action="save_logs" role="button" tabindex="0">Save logs</span>`
        : "";
    const stallHint =
      state.popupStallHint && state.isRunning
        ? `<div class="resume-matcher-status-detail">⚠️ ChatGPT looks paused — its popup window may be minimized or hidden behind another window. Keep it visible while tailoring. <span class="resume-matcher-status-savelogs" data-status-action="focus_popup" role="button" tabindex="0">Bring ChatGPT to front</span></div>`
        : "";
    statusRoot.innerHTML = status
      ? `
        <div class="resume-matcher-status-title">${status.tone === "info" && isLoadingJob ? '<span class="resume-matcher-status-spinner" aria-hidden="true"></span>' : ""}${escapeHtml(status.title)}</div>
        ${status.detail || saveLogsLink ? `<div class="resume-matcher-status-detail">${escapeHtml(status.detail)}${status.detail && saveLogsLink ? " " : ""}${saveLogsLink}</div>` : ""}
        ${stallHint}
      `
      : stallHint;
    statusActions.innerHTML =
      status?.actions
        ?.map(
          (action) => `
      <button
        type="button"
        class="resume-matcher-button${action.variant === "primary" ? " is-primary" : ""}${action.variant === "danger" ? " is-danger" : ""}"
        data-status-action="${escapeHtml(action.id)}"
      >${escapeHtml(action.label)}</button>
    `,
        )
        .join("") || "";
  }
  if (mainActions) {
    const shouldHideMainActions = Boolean(
      status?.actions?.length &&
      (status.tone === "blocked" || status.tone === "warning") &&
      !hideManualComposeStatus &&
      !state.awaitingAuth &&
      !state.awaitingStoryboard,
    );
    mainActions.classList.toggle(
      "is-hidden",
      showOnboarding || hardBlocker || waitingForSelection || shouldHideMainActions,
    );
  }

  const titleNode = document.querySelector("#resume-matcher-job-title");
  if (titleNode) {
    titleNode.textContent = showOnboarding
      ? getResolvedOnboardingTitle()
      : hardBlocker
        ? setupRequirement?.title || state.setupState?.title || "Finish setup"
      : waitingForSelection
        ? "Select a job"
      : manualMode
        ? "Paste job description"
      : isLoadingJob
        ? state.selectedJobRefreshing
          ? "Loading selected job"
            : "Loading job"
          : state.currentJob?.title ||
            (hasUsableJobContext(state.currentJob)
              ? "Current job"
              : "Job details unavailable");
  }
}

function renderRootFlags() {
  const root = $(ROOT_ID);
  if (!root) return;
  root.dataset.boardOpen = state.boardOpen ? "true" : "false";
  root.dataset.alert = state.launcherAlert ? "true" : "false";
  root.dataset.running = state.isRunning ? "true" : "false";
  root.dataset.launcherLockVisible = state.launcherLockNoticeVisible
    ? "true"
    : "false";
  root.dataset.hidden = state.dismissed && !state.boardOpen ? "true" : "false";
  root.dataset.dockSide = state.dockSide;
  root.dataset.currentView = state.currentView;
  root.dataset.onboardingMode = isOnboardingMode() ? "true" : "false";
  const lockNotice = $(LAUNCHER_LOCK_NOTICE_ID);
  if (lockNotice) {
    const message = state.runLock?.message || "Tailoring is running in another tab.";
    const detail =
      state.runLock?.detail ||
      "Finish or cancel that run before starting another one here.";
    lockNotice.innerHTML = `
      <div class="resume-matcher-launcher-lock-notice__title">${escapeHtml(message)}</div>
      <div class="resume-matcher-launcher-lock-notice__detail">${escapeHtml(detail)}</div>
    `;
  }
  if (!pointerDragState) {
    root.dataset.dragging = "false";
    root.dataset.dockPreview = state.dockSide;
  }
}

function syncRunningInteractivity() {
  const board = $(BOARD_ID);
  if (!board) return;

  const allowedIds = new Set([
    BOARD_HOME_ID,
    BOARD_SETTINGS_ID,
    BOARD_MINIMIZE_ID,
    RUN_CANCEL_ID,
  ]);

  const controls = board.querySelectorAll("button, input, textarea, select, a");
  controls.forEach((control) => {
    const id = control.id || "";
    const allowWhileRunning = allowedIds.has(id);
    const isInRunView = control.closest(`#${RUN_VIEW_ID}`) !== null;
    if (
      control instanceof HTMLButtonElement ||
      control instanceof HTMLInputElement ||
      control instanceof HTMLTextAreaElement ||
      control instanceof HTMLSelectElement
    ) {
      if ((state.isRunning || state.isCanceling) && isInRunView && !allowWhileRunning) {
        if (!control.dataset.runningDisabled) {
          control.dataset.runningDisabled = control.disabled ? "true" : "false";
        }
        control.disabled = true;
      } else if (control.dataset.runningDisabled) {
        control.disabled = control.dataset.runningDisabled === "true";
        delete control.dataset.runningDisabled;
      }
      return;
    }

    if (!(control instanceof HTMLAnchorElement)) return;
    if ((state.isRunning || state.isCanceling) && isInRunView && !allowWhileRunning) {
      control.dataset.runningPointerEvents = control.style.pointerEvents || "";
      control.dataset.runningOpacity = control.style.opacity || "";
      control.dataset.runningTabIndex = String(control.tabIndex);
      control.setAttribute("aria-disabled", "true");
      control.tabIndex = -1;
      control.style.pointerEvents = "none";
      control.style.opacity = "0.55";
    } else if (control.dataset.runningPointerEvents !== undefined) {
      control.removeAttribute("aria-disabled");
      control.style.pointerEvents = control.dataset.runningPointerEvents;
      control.style.opacity = control.dataset.runningOpacity;
      control.tabIndex = Number.parseInt(
        control.dataset.runningTabIndex || "0",
        10,
      );
      delete control.dataset.runningPointerEvents;
      delete control.dataset.runningOpacity;
      delete control.dataset.runningTabIndex;
    }
  });
}

function renderViews() {
  state.currentView = resolveAllowedBoardView(state.currentView);
  const runView = $(RUN_VIEW_ID);
  const settingsView = $(SETTINGS_VIEW_ID);
  const settingsLocked = isSettingsNavigationLocked();
  runView?.classList.toggle("is-active", state.currentView === "run");
  settingsView?.classList.toggle("is-active", state.currentView === "settings");
  $(BOARD_HOME_ID)?.classList.toggle("is-active", state.currentView === "run");
  const settingsButton = $(BOARD_SETTINGS_ID);
  settingsButton?.classList.toggle(
    "is-active",
    state.currentView === "settings",
  );
  if (settingsButton instanceof HTMLButtonElement) {
    settingsButton.disabled = settingsLocked;
    const title = isSignedOutNavigationLocked()
      ? "Sign in to change settings"
      : isTailoringParameterChangeLocked()
        ? "Settings are locked while tailoring"
        : "Settings";
    settingsButton.title = title;
    settingsButton.setAttribute("aria-label", title);
  }
}

function render() {
  if (isContentScriptDisposed()) {
    return;
  }
  const root = ensureRoot();
  if (!root) return;
  if (
    state.isRunning &&
    runStatusHelpers.shouldRotateRunningStatus(state.explicitRunStatus)
  ) {
    startRunningStatusRotation();
  } else {
    stopRunningStatusRotation();
  }
  state.currentView = resolveAllowedBoardView(state.currentView);
  renderRootFlags();
  renderViews();
  renderRunView();
  renderSettings();
  syncRunningInteractivity();
}

function syncPromptDefaultsForOpen(view, previousOpen, previousView) {
  const shouldSync =
    (view === "run" || view === "settings") &&
    (!previousOpen || previousView !== view);
  if (!shouldSync) {
    return Promise.resolve({ ok: true, skipped: true });
  }

  const syncPromise = sendMessage("SYNC_DEFAULT_PROMPTS")
    .catch((error) => {
      logError("Failed to sync default prompts.", {
        error: error instanceof Error ? error.message : String(error),
      });
      return { ok: false };
    })
    .finally(() => {
      if (state.promptSyncPromise === syncPromise) {
        state.promptSyncPromise = null;
      }
    });

  state.promptSyncPromise = syncPromise;
  return syncPromise;
}

async function refreshBoardData(options = {}) {
  if (isContentScriptDisposed()) {
    return;
  }
  try {
    const shouldRefreshBackendMaster = options.refreshBackendMaster === true;
    const previousBackendMaster = state.assets?.backendMasterResume ?? null;
    const fallbackBackendMaster =
      options.fallbackBackendMaster?.resumeId ? options.fallbackBackendMaster : null;
    const response = await sendMessage("GET_STATE", {
      refreshBackendMaster: shouldRefreshBackendMaster,
      backendMasterMaxAgeMs: Number.isFinite(options.backendMasterMaxAgeMs)
        ? options.backendMasterMaxAgeMs
        : 0,
    });
    if (!response?.ok) {
      throw new Error(response?.error || "Failed to load extension state.");
    }
    if (isContentScriptDisposed()) {
      return;
    }
    const nextAssets = response.assets ?? null;
    const resolvedBackendMaster = resolveBackendMasterResumeForRender({
      shouldRefreshBackendMaster,
      previousBackendMaster,
      nextBackendMaster: nextAssets?.backendMasterResume ?? null,
      fallbackBackendMaster,
    });
    const preservedBackendMaster =
      resolvedBackendMaster?.resumeId &&
      !nextAssets?.backendMasterResume?.resumeId;
    state.assets = {
      ...(nextAssets || {}),
      backendMasterResume: resolvedBackendMaster,
    };
    applyPromptTemplateProfilesState(state.assets.promptTemplateProfiles);
    const nextSetupState = response.setupState ?? state.setupState;
    state.setupState =
      preservedBackendMaster && nextSetupState?.state === "missing_resume"
        ? state.setupState
        : nextSetupState;
    state.extensionState = response.state ?? null;
    state.runLock = response.runLock ?? null;
    setRouteMode(response.route?.mode || "hidden");
    state.connectionState =
      response.connectionState ||
      (response.connected ? "connected" : "signed_out");
    state.websiteAuthenticated = response.websiteAuthenticated === true;
    state.extensionConnected = response.extensionConnected === true;
    if (state.jobInspectionRequested) {
      updateJobReadiness(extractCurrentJob());
    } else {
      state.currentJob = null;
      resetJobLoadingState();
    }
    if (isLockedToAnotherTab()) {
      state.boardOpen = false;
      state.currentView = "run";
    } else {
      hideLauncherLockNotice({ renderNow: false });
    }
    syncVisibleRunStateFromExtensionSession();
    syncFloatingAction({ recheckConnection: false });
  } catch (error) {
    logError("Failed to refresh board data.", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function reconcileConnectionStatus(options = {}) {
  if (state.connectionCheckPromise) {
    return state.connectionCheckPromise;
  }

  const refreshBackendMaster =
    typeof options === "object" && options?.refreshBackendMaster === true;
  const backendMasterMaxAgeMs =
    typeof options === "object" && Number.isFinite(options?.backendMasterMaxAgeMs)
      ? options.backendMasterMaxAgeMs
      : 0;
  const checkPromise = (async () => {
    try {
      const previousBackendMaster = state.assets?.backendMasterResume ?? null;
      const response = await sendMessage("CHECK_CONNECTION_STATUS", {
        refreshBackendMaster,
        backendMasterMaxAgeMs,
      });
      if (!response?.ok) {
        throw new Error(response?.error || "Failed to check connection status.");
      }
      const nextAssets = response.assets ?? state.assets;
      const preservedBackendMaster =
        !refreshBackendMaster &&
        previousBackendMaster?.resumeId &&
        !nextAssets?.backendMasterResume?.resumeId;
      state.assets = preservedBackendMaster
        ? {
            ...nextAssets,
            backendMasterResume: previousBackendMaster,
          }
        : nextAssets;
      applyPromptTemplateProfilesState(state.assets?.promptTemplateProfiles);
      const nextSetupState = response.setupState ?? state.setupState;
      state.setupState =
        preservedBackendMaster && nextSetupState?.state === "missing_resume"
          ? state.setupState
          : nextSetupState;
      state.extensionState = response.state ?? state.extensionState;
      state.runLock = response.runLock ?? state.runLock;
      setRouteMode(response.route?.mode || state.routeMode);
      state.connectionState =
        response.connectionState ||
        (response.connected ? "connected" : "signed_out");
      state.websiteAuthenticated = response.websiteAuthenticated === true;
      state.extensionConnected = response.extensionConnected === true;
      if (state.jobInspectionRequested) {
        updateJobReadiness(extractCurrentJob());
      } else {
        state.currentJob = null;
        resetJobLoadingState();
      }
      if (isLockedToAnotherTab()) {
        state.boardOpen = false;
        state.currentView = "run";
      } else {
        hideLauncherLockNotice({ renderNow: false });
      }
      syncVisibleRunStateFromExtensionSession();
      syncFloatingAction({ recheckConnection: false });
      return response.connected === true;
    } catch (error) {
      logError("Failed to reconcile connection status.", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    } finally {
      if (state.connectionCheckPromise === checkPromise) {
        state.connectionCheckPromise = null;
      }
    }
  })();

  state.connectionCheckPromise = checkPromise;
  return checkPromise;
}

async function saveTextAsset(file, type) {
  if (!file) return;
  try {
    const content = await file.text();
    const response = await sendMessage(type, {
      filename: file.name,
      content,
    });
    if (!response?.ok) {
      throw new Error(response?.error || "Failed to save file.");
    }
    await refreshBoardData();
  } catch (error) {
    setRunStatus(
      "error",
      "Save failed",
      error instanceof Error ? error.message : "Unable to save file.",
    );
  }
}

async function importMasterResumeFile(file) {
  if (!file) return;
  if (!(await ensureProviderReadyForMasterResumeImport())) {
    return;
  }
  state.masterResumeImportInFlight = true;
  state.masterResumeImportTone = "neutral";
  state.masterResumeImportMessage = "Extracting and saving...";
  clearExplicitRunStatus("master-resume-import-start");
  render();
  try {
    const isBinary = /\.(pdf|docx|doc)$/i.test(file.name);
    let payload;
    if (isBinary) {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      bytes.forEach((b) => (binary += String.fromCharCode(b)));
      payload = { filename: file.name, base64: btoa(binary), replaceExisting: true };
    } else {
      payload = { filename: file.name, content: await file.text(), replaceExisting: true };
    }
    const response = await sendMessage("IMPORT_MASTER_RESUME_CONTEXT", payload);
    if (!response?.ok) {
      throw new Error(response?.error || "Failed to save Master Resume.");
    }
    const importedMasterResume = response.masterResume?.resumeId
      ? response.masterResume
      : null;
    if (importedMasterResume) {
      state.assets = {
        ...(state.assets || {}),
        backendMasterResume: importedMasterResume,
      };
    }
    state.masterResumeImportTone = "success";
    state.masterResumeImportMessage = "Master Resume ready.";
    state.masterResumeReplaceOpen = false;
    await refreshBoardData({
      refreshBackendMaster: true,
      fallbackBackendMaster: importedMasterResume,
    });
  } catch (error) {
    state.masterResumeImportTone = "error";
    state.masterResumeImportMessage = formatMasterResumeImportError(error);
    setRunStatus("error", "Save failed", state.masterResumeImportMessage, [
      {
        id: "upload_resume",
        label: "Choose file again",
        variant: "primary",
      },
    ]);
  } finally {
    state.masterResumeImportInFlight = false;
    render();
  }
}

async function persistProviderSelection(selectId = PROVIDER_SELECT_ID) {
  const select = $(selectId);
  if (!(select instanceof HTMLSelectElement)) return;
  endSecretEdit(PROVIDER_API_KEY_INPUT_ID);
  endSecretEdit(ONBOARDING_PROVIDER_API_KEY_INPUT_ID);
  setProviderValidationState([], false);
  setProviderDraftState(createProviderDraftState(select.value), {
    replace: true,
  });
  renderSettings();
  renderRunView();
}

function getSelectedProviderSettingsPayload() {
  const providerDraft = syncProviderDraftState();
  const profile = getSavedProfileById(providerDraft.selectedProfileId);
  if (!profile) return null;

  const profileUpdates =
    profile.mode === "web_automation"
      ? { targetUrl: providerDraft.targetUrl.trim() }
      : {
          apiBaseUrl: providerDraft.apiBaseUrl.trim(),
          model: providerDraft.model.trim(),
          apiKey: normalizeSecretValue(providerDraft.apiKey),
        };

  return {
    profileId: providerDraft.selectedProfileId,
    profileUpdates,
  };
}

async function persistSelectedProviderSettings() {
  const payload = getSelectedProviderSettingsPayload();
  if (!payload) {
    const missingFields = ["provider"];
    setProviderValidationState(missingFields, true);
    renderSettings();
    renderRunView();
    throw new Error(getProviderMissingFieldsMessage(missingFields));
  }
  const providerDraft = syncProviderDraftState();
  const missingFields = getProviderDraftMissingFields(providerDraft);
  if (missingFields.length > 0) {
    setProviderValidationState(missingFields, true);
    renderSettings();
    renderRunView();
    throw new Error(getProviderMissingFieldsMessage(missingFields));
  }

  if (!providerDraft.dirty) {
    setProviderValidationState([], false);
    state.providerSettingsEditOpen = false;
    renderSettings();
    return true;
  }

  const response = await sendMessage("SAVE_LLM_SETTINGS", {
    activeProfileId: payload.profileId,
    profileUpdates: payload.profileUpdates,
  });
  if (!response?.ok) {
    throw new Error(response?.error || "Failed to save provider settings.");
  }
  state.assets = {
    ...(state.assets || {}),
    llmSettings: response.llmSettings,
  };
  providerDraftState = createProviderDraftState(
    payload.profileId,
    response.llmSettings,
  );
  setProviderValidationState([], false);
  state.providerSettingsEditOpen = false;
  endSecretEdit(PROVIDER_API_KEY_INPUT_ID);
  endSecretEdit(ONBOARDING_PROVIDER_API_KEY_INPUT_ID);
  renderSettings();
  renderRunView();
  return {
    ok: true,
    providerValidation: response.providerValidation || { ok: true },
  };
}

async function persistPromptProfileSelection(profileId, { refresh = true } = {}) {
  const nextProfileId = String(profileId || "").trim();
  if (!nextProfileId) {
    throw new Error("Choose a prompt profile.");
  }
  const response = await sendMessage("SAVE_PROMPT_PROFILE_SELECTION", {
    profileId: nextProfileId,
  });
  if (!response?.ok) {
    throw new Error(response?.error || "Failed to save prompt profile.");
  }
  applyPromptTemplateProfilesState(response.promptTemplateProfiles);
  if (refresh) {
    await refreshBoardData();
  }
  return true;
}

async function ensureProviderReadyForMasterResumeImport() {
  let readiness = getSavedProviderImportReadiness();
  if (readiness.ready) {
    return true;
  }

  const draftState = getOnboardingProviderDraftState();
  const providerDraft = syncProviderDraftState();
  if (draftState.ready && providerDraft.dirty) {
    await persistSelectedProviderSettings();
    readiness = getSavedProviderImportReadiness();
    if (readiness.ready) {
      return true;
    }
  }

  const message =
    draftState.message || readiness.message || PROVIDER_SAVE_REQUIRED_MESSAGE;
  state.masterResumeImportTone = "error";
  state.masterResumeImportMessage = message;
  setRunStatus("error", "AI setup needed", message);
  render();
  return false;
}

async function persistOnboardingProviderSettingsAndContinue() {
  const draftState = getOnboardingProviderDraftState();
  if (!draftState.ready) {
    return;
  }
  const saveResult = await persistSelectedProviderSettings();
  const response = await sendMessage("SET_ONBOARDING_STEP", {
    step: "assets",
  });
  if (!response?.ok) {
    throw new Error(response?.error || "Failed to continue onboarding.");
  }
  await refreshBoardData();
  if (saveResult?.providerValidation?.ok === false) {
    setRunStatus(
      "info",
      "Provider saved",
      saveResult.providerValidation.error ||
        "Saved the provider settings, but the connection check failed.",
    );
  }
}

async function persistApifyFallbackSettings() {
  const apifyDraft = syncApifyDraftState();
  if (!apifyDraft.dirty) {
    return;
  }
  const response = await sendMessage("SAVE_APIFY_FALLBACK_SETTINGS", {
    enabled: apifyDraft.enabled === true,
    apiToken: normalizeSecretValue(apifyDraft.apiToken),
  });
  if (!response?.ok) {
    throw new Error(
      response?.error || "Failed to save Apify fallback settings.",
    );
  }
  state.assets = {
    ...(state.assets || {}),
    apifyFallbackSettings:
      response.apifyFallbackSettings || state.assets?.apifyFallbackSettings,
  };
  apifyDraftState = createApifyDraftState();
  endSecretEdit(APIFY_TOKEN_INPUT_ID);
  renderSettings();
}

function canManuallyRescrapeJob() {
  if (
    isOnboardingMode() ||
    isHardPrerequisiteBlocker() ||
    isWaitingForJobSelection() ||
    state.isRunning
  ) {
    return false;
  }

  return Boolean(resolveSelectedJobSourceUrl());
}

function handleManualJobRescrape() {
  const targetUrl = resolveSelectedJobSourceUrl();
  if (!targetUrl || state.isRunning) {
    return;
  }

  window.location.reload();
}

async function requestCancelActiveRun() {
  if (!isRunCancelable() || state.isCanceling) {
    return;
  }

  state.isRunning = false;
  state.isCanceling = true;
  setExplicitRunStatus(
    "interrupted",
    "info",
    "Canceling...",
    "Stopping this run.",
  );

  try {
    const response = await sendMessage("CANCEL_ACTIVE_RUN", {
      runId: state.activeRunId,
      phase: getCurrentRunPhaseLabel(),
    });
    if (!response?.ok) {
      throw new Error(response?.error || "Failed to cancel the active run.");
    }
    if (response.canceled === false) {
      state.isCanceling = false;
      await refreshBoardData();
      return;
    }
    if (response.immediate) {
      applyCanceledRunState(response.runId || state.activeRunId);
    }
  } catch (error) {
    state.isCanceling = false;
    setExplicitRunStatus(
      "error",
      "error",
      "Cancel failed",
      error instanceof Error ? error.message : "Unable to cancel the active run.",
    );
  }
}

async function handleGenerateClick() {
  try {
    await handleGenerateClickInner();
  } catch (error) {
    // Safety net: a throw during pre-run setup (connection check, setup probe,
    // prompt sync, etc.) happens after `state.isRunning` is set but outside the
    // inner try/catch. Without this, the UI is left stuck — button locked as
    // "Running…", no cancel, no status. Reset and surface the error (the error
    // card carries the Save-logs link) so the user is never trapped.
    state.isRunning = false;
    state.isCanceling = false;
    state.activeRunId = null;
    state.activeRunJob = null;
    const message =
      error instanceof Error
        ? error.message
        : "Something went wrong starting the run.";
    setExplicitRunStatus("error", "error", "Run failed", formatErrorText(message));
    try {
      render();
    } catch {}
    console.error("[ResumeMatcherExt] Generate click failed.", error);
  }
}

async function handleGenerateClickInner() {
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }
  if (isLockedToAnotherTab()) {
    showLauncherLockNotice();
    state.boardOpen = false;
    render();
    return;
  }
  if (state.isRunning) return;

  const activePromptProfileId =
    state.assets?.activePromptProfileId || DEFAULT_ACTIVE_PROMPT_PROFILE_ID;
  const runnablePromptProfileId = getRunnablePromptProfileId(
    state.assets?.promptTemplateProfiles,
    activePromptProfileId,
  );
  if (runnablePromptProfileId !== activePromptProfileId) {
    try {
      await persistPromptProfileSelection(runnablePromptProfileId, {
        refresh: false,
      });
    } catch (error) {
      setExplicitRunStatus(
        "error",
        "error",
        "Save failed",
        error instanceof Error
          ? error.message
          : "Failed to switch prompt profile.",
      );
      return;
    }
  }

  const runId = crypto.randomUUID();
  state.currentView = "run";
  state.awaitingAuth = false;
  state.awaitingStoryboard = false;
  state.isCanceling = false;
  state.isRunning = true;
  state.popupStallHint = false;
  state.previewHandoffComplete = false;
  state.activeRunId = runId;
  claimOwnedRun(runId);
  state.activeRunJob = cloneJobForRun(state.currentJob);
  state.launcherAlert = false;
  clearScrapeRecoveryState();
  setExplicitRunStatus(
    "running",
    "running",
    "Starting run",
    "Checking your account and provider setup.",
  );

  openBoard("run", { skipConnectionCheck: true });
  activateRunInspection({ recheckConnection: false });
  const connected = await reconcileConnectionStatus("run");
  if (!connected) {
    state.isRunning = false;
    state.isCanceling = false;
    state.awaitingAuth = true;
    state.activeRunId = null;
    state.activeRunJob = null;
    clearOwnedRun(runId);
    const requirement = getSetupRequirementStatus() || {
      tone: "blocked",
      title: "Connect Lumi Coach",
      detail: "Connect your Lumi Coach account before tailoring.",
      actions: [
        {
          id: "connect",
          label: "Continue with Google",
          variant: "primary",
        },
      ],
    };
    setExplicitRunStatus(
      "interrupted",
      requirement.tone,
      requirement.title,
      requirement.detail,
      (requirement.actions || []).map((action) =>
        action.id === "connect"
          ? {
              ...action,
              label: "Connect and tailor",
            }
          : action,
      ),
    );
    return;
  }
  if (state.isCanceling) {
    return;
  }

  const manualSetupRequirement = isManualRunMode()
    ? getSetupRequirementStatus()
    : null;
  if (manualSetupRequirement) {
    state.isRunning = false;
    state.isCanceling = false;
    state.awaitingAuth = false;
    state.activeRunId = null;
    state.activeRunJob = null;
    clearOwnedRun(runId);
    const setupAction = getManualSetupAction(manualSetupRequirement);
    clearExplicitRunStatus("manual-setup-repair", { renderNow: false });
    if (setupAction?.id === "upload_resume") {
      await handleStatusAction("upload_resume");
      render();
      return;
    }
    if (
      setupAction?.id === "open_settings" ||
      setupAction?.id === "open-settings" ||
      setupAction?.id === "configure_provider"
    ) {
      state.providerSettingsEditOpen = true;
      await handleStatusAction(setupAction.id);
      render();
      return;
    }
    setExplicitRunStatus(
      "interrupted",
      manualSetupRequirement.tone,
      manualSetupRequirement.title,
      manualSetupRequirement.detail,
      manualSetupRequirement.actions,
    );
    return;
  }

  state.awaitingAuth = false;
  state.awaitingStoryboard = false;
  state.isCanceling = false;
  state.isRunning = true;
  state.popupStallHint = false;
  state.previewHandoffComplete = false;
  state.activeRunId = state.activeRunId || runId;
  claimOwnedRun(state.activeRunId);
  state.activeRunJob = cloneJobForRun(state.currentJob);
  state.launcherAlert = false;
  clearScrapeRecoveryState();
  setExplicitRunStatus(
    "running",
    "running",
    "Starting run",
    "Preparing your tailored resume.",
  );

  try {
    if (state.promptSyncPromise) {
      await state.promptSyncPromise.catch(() => {});
    }
    const prompt1CustomInstruction = state.customMessage.trim();
    const manualJobInput = (isManualRunMode() || shouldShowManualJdFallback())
      ? buildManualJobInput()
      : null;
    state.activeRunJob = cloneJobForRun(manualJobInput || state.currentJob);
    const response = await sendMessage("GENERATE_FOR_ACTIVE_JOB", {
      runId: state.activeRunId,
      prompt1CustomInstruction,
      jobInput: manualJobInput,
      activeRunJob: cloneJobForRun(manualJobInput || state.currentJob),
    });
    state.customMessage = "";
    const notes = $(RUN_NOTES_ID);
    if (notes) {
      notes.value = "";
      autoGrowTextarea(notes);
    }
    if (response?.runId) {
      state.activeRunId = response.runId;
      claimOwnedRun(response.runId);
    }
    if (response?.awaitingAuth) {
      state.isRunning = false;
      state.awaitingAuth = true;
      state.connectionState = response.connectionState || "signed_out";
      state.setupState = response.setupState ??
        state.setupState ?? { state: "signed_out" };
      const requirement = getSetupRequirementStatus(response.message) || {
        tone: "blocked",
        title: "Sign in with Google",
        detail:
          response.message ||
          "Sign in to continue tailoring this job. Each account keeps its own local extension workspace.",
        actions: [
          {
            id: "connect",
            label: "Sign in with Google",
            variant: "primary",
          },
        ],
      };
      setExplicitRunStatus(
        "interrupted",
        requirement.tone,
        requirement.title,
        response.message || requirement.detail,
        requirement.actions,
      );
      return;
    }
    if (response?.setupState) {
      state.isRunning = false;
      state.activeRunJob = null;
      clearOwnedRun(state.activeRunId);
      state.setupState = response.setupState;
      const requirement = getSetupRequirementStatus(response.message) || {
        tone: "blocked",
        title: "Finish setup",
        detail: response.message || "Finish setup to continue.",
        actions: [],
      };
      setExplicitRunStatus(
        "interrupted",
        requirement.tone,
        requirement.title,
        requirement.detail,
        requirement.actions,
      );
      return;
    }
    if (response?.awaitingStoryboard) {
      const continueResponse = await sendMessage(
        "CONTINUE_PENDING_GENERATION_WITHOUT_STORYBOARD",
      );
      if (!continueResponse?.ok) {
        throw new Error(
          continueResponse?.error || "Failed to continue run.",
        );
      }
      return;
    }
    if (response?.canceled) {
      applyCanceledRunState(response.runId || state.activeRunId);
      await refreshBoardData();
      return;
    }
    if (response?.blockedByActiveRun) {
      state.isRunning = false;
      state.isCanceling = false;
      state.activeRunId = response.runId || null;
      clearOwnedRun(runId);
      setExplicitRunStatus(
        "interrupted",
        "warning",
        "Tailoring already running",
        response.error ||
          "Cancel the current run before starting another tailored resume.",
      );
      await refreshBoardData();
      return;
    }
    if (!response?.ok) {
      if (state.isCanceling && isCancellationTeardownMessage(response?.error)) {
        applyCanceledRunState(response.runId || state.activeRunId);
        await refreshBoardData();
        return;
      }
      throw new Error(response?.error || "Failed to generate tailored resume.");
    }
    state.isRunning = false;
    state.isCanceling = false;
    clearScrapeRecoveryState();
    if (!state.previewHandoffComplete) {
      setExplicitRunStatus(
        "success",
        "success",
        "Opening workspace",
        `Your tailored resume for ${getJobDisplayLabel(state.activeRunJob)} is opening on the web.`,
      );
    }
    state.activeRunId = null;
    state.activeRunJob = null;
    await refreshBoardData();
  } catch (error) {
    state.isRunning = false;
    state.isCanceling = false;
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate tailored resume.";
    if (isScrapeProblemMessage(message)) {
      state.scrapeIssue = getScrapeRequirementStatus().detail;
      clearExplicitRunStatus("scrape-recovery");
      return;
    }
    state.activeRunId = null;
    state.activeRunJob = null;
    clearOwnedRun(runId);
    setExplicitRunStatus(
      "error",
      "error",
      "Run failed",
      formatErrorText(message),
    );
  }
}

async function handleStatusAction(actionId) {
  if (actionId === "save_logs") {
    try {
      await downloadDiagnosticLogs();
    } catch (error) {
      // Best-effort: a failed export must never disrupt the error card.
      console.error("[ResumeMatcherExt] Failed to save logs.", error);
    }
    return;
  }
  if (actionId === "focus_popup") {
    try {
      await sendMessage("FOCUS_CHATGPT_POPUP", {});
    } catch (error) {
      console.error("[ResumeMatcherExt] Failed to focus ChatGPT popup.", error);
    }
    return;
  }
  if (actionId === "open_settings" || actionId === "open-settings") {
    openBoard("settings");
    if (state.currentView !== "settings") {
      return;
    }
    const focusTarget =
      state.setupState?.primaryAction?.focusTarget ||
      state.setupState?.secondaryAction?.focusTarget ||
      "";
    if (focusTarget.startsWith("provider")) {
      state.providerSettingsEditOpen = true;
      renderSettings();
    }
    const targetId =
      focusTarget === "resume"
        ? MASTER_RESUME_ACTION_ID
        : focusTarget === "providerApiKey"
          ? PROVIDER_API_KEY_INPUT_ID
          : focusTarget === "providerModel"
            ? PROVIDER_MODEL_INPUT_ID
            : focusTarget === "providerApiBase"
              ? PROVIDER_API_BASE_INPUT_ID
              : focusTarget === "provider"
                ? PROVIDER_SELECT_ID
                : "";
    if (targetId) {
      const target = $(targetId);
      if (focusTarget === "resume") {
        target?.focus();
      } else {
        target?.focus();
      }
    }
    return;
  }

  if (actionId === "upload_resume") {
    if (state.masterResumeImportInFlight) return;
    if (!(await ensureProviderReadyForMasterResumeImport())) return;
    $(MASTER_RESUME_INPUT_ID)?.click();
    return;
  }

  if (actionId === "configure_provider") {
    openBoard("settings");
    if (state.currentView !== "settings") {
      return;
    }
    const focusTarget = state.setupState?.primaryAction?.focusTarget;
    const targetId =
      focusTarget === "providerApiKey"
        ? PROVIDER_API_KEY_INPUT_ID
        : focusTarget === "providerModel"
          ? PROVIDER_MODEL_INPUT_ID
          : focusTarget === "providerApiBase"
            ? PROVIDER_API_BASE_INPUT_ID
            : PROVIDER_SELECT_ID;
    $(targetId)?.focus();
    return;
  }

  if (actionId === "refresh-page") {
    window.location.reload();
    return;
  }

  if (actionId === "open_history_on_web") {
    window.open(getAppOrigin(), "_blank", "noopener,noreferrer");
    return;
  }

  if (actionId === "connect") {
    state.awaitingAuth = true;
    setExplicitRunStatus(
      "interrupted",
      "info",
      "Opening Google sign-in",
      "Checking your Google session.",
    );
    try {
      const response = await sendMessage("OPEN_SIGN_IN");
      if (!response?.ok) {
        throw new Error(response?.error || "Failed to open sign-in.");
      }
    } catch (error) {
      state.awaitingAuth = false;
      setExplicitRunStatus(
        "error",
        "error",
        "Connect failed",
        error instanceof Error ? error.message : "Unable to open sign-in.",
      );
    }
    return;
  }

}

async function handleOnboardingAction(actionId, nextStep = "") {
  if (!actionId) return;

  if (actionId === "connect") {
    const response = await sendMessage("OPEN_SIGN_IN");
    if (!response?.ok) {
      throw new Error(response?.error || "Failed to open Google sign-in.");
    }
    return;
  }

  if (actionId === "upload_resume") {
    if (state.masterResumeImportInFlight) return;
    if (!(await ensureProviderReadyForMasterResumeImport())) return;
    $(MASTER_RESUME_INPUT_ID)?.click();
    return;
  }

  if (actionId === "onboarding_next" && nextStep) {
    const response = await sendMessage("SET_ONBOARDING_STEP", {
      step: nextStep,
    });
    if (!response?.ok) {
      throw new Error(response?.error || "Failed to continue onboarding.");
    }
    await refreshBoardData();
    return;
  }

  if (actionId === "save_provider_continue") {
    await persistOnboardingProviderSettingsAndContinue();
    return;
  }

  if (actionId === "complete_onboarding") {
    const response = await sendMessage("COMPLETE_ONBOARDING");
    if (!response?.ok) {
      throw new Error(response?.error || "Failed to finish onboarding.");
    }
    clearExplicitRunStatus("onboarding-complete");
    await refreshBoardData();
  }
}

function ensureRoot() {
  if (isContentScriptDisposed()) {
    return null;
  }
  if (!hasVisibleLauncherRoute()) {
    removeRoot();
    return null;
  }

  let root = $(ROOT_ID);
  if (root) return root;

  injectStyles();

  root = document.createElement("div");
  root.id = ROOT_ID;
  root.innerHTML = `
    <div id="${LAUNCHER_ID}" role="button" tabindex="0" aria-label="Open Lumi" title="Open Lumi">
      <img src="${chrome.runtime.getURL(ICON_PATH)}" alt="" />
      <button id="${LAUNCHER_CLOSE_ID}" type="button" aria-label="Hide launcher">×</button>
      <span id="${LAUNCHER_ALERT_ID}">!</span>
    </div>
    <div id="${LAUNCHER_LOCK_NOTICE_ID}" aria-live="polite"></div>
    <section id="${BOARD_ID}" aria-label="Simplify board">
      <header class="resume-matcher-board__header">
        <div class="resume-matcher-board__brand">
          <div id="${BOARD_WEBSITE_ID}" class="resume-matcher-board__logo" aria-hidden="true">
            <img src="${chrome.runtime.getURL(ICON_PATH)}" alt="" />
          </div>
          <div id="${BOARD_TITLE_ID}" class="resume-matcher-board__brand-link">
            <span class="resume-matcher-board__brand-text">
              <span class="resume-matcher-board__title">Lumi Coach</span>
            </span>
          </div>
        </div>
        <div class="resume-matcher-board__header-actions">
          <button id="${BOARD_HOME_ID}" class="resume-matcher-icon-button" type="button" aria-label="Run" title="Run">${icon("aiStar")}</button>
          <button id="${BOARD_SETTINGS_ID}" class="resume-matcher-icon-button" type="button" aria-label="Settings" title="Settings">${icon("settings")}</button>
          <button id="${BOARD_MINIMIZE_ID}" class="resume-matcher-icon-button" type="button" aria-label="Minimize" title="Minimize">${icon("minimize")}</button>
        </div>
      </header>
      <div class="resume-matcher-board__body">
        <section id="${RUN_VIEW_ID}" class="resume-matcher-view is-active">
          <article class="resume-matcher-run-shell">
            <div class="resume-matcher-run-shell__body">
              <div id="${RUN_SOURCE_TOGGLE_ID}" class="resume-matcher-source-toggle" role="tablist" aria-label="Job source">
                <button id="${RUN_SOURCE_LINKEDIN_ID}" type="button" class="resume-matcher-source-toggle__button is-active" role="tab" aria-selected="true">LinkedIn job</button>
                <button id="${RUN_SOURCE_MANUAL_ID}" type="button" class="resume-matcher-source-toggle__button" role="tab" aria-selected="false">Paste JD</button>
              </div>
              <div class="resume-matcher-run-job">
                <h2 id="resume-matcher-job-title" class="resume-matcher-run-job__title">LinkedIn job</h2>
                <button id="${RUN_READY_ID}" type="button" class="resume-matcher-run-ready is-muted" aria-label="Needs setup" title="Needs setup">!</button>
              </div>
              <div id="${RUN_META_ID}" class="resume-matcher-run-meta"></div>
              <div id="${RUN_STATUS_ID}" class="resume-matcher-status-card" data-tone="neutral"></div>
              <div id="${RUN_ONBOARDING_ID}" class="resume-matcher-onboarding" hidden></div>
              <div id="${RUN_MANUAL_JD_FIELD_ID}" class="resume-matcher-field" hidden>
                <label for="${RUN_MANUAL_JD_ID}">Paste job description</label>
                <textarea id="${RUN_MANUAL_JD_ID}" rows="5" placeholder="Paste the full job description here to continue."></textarea>
                <div class="resume-matcher-run-manual-details">
                  <button id="${RUN_MANUAL_DETAILS_TOGGLE_ID}" type="button" class="resume-matcher-settings-row-card__subtle-action resume-matcher-run-manual-details__toggle" aria-expanded="false" aria-controls="${RUN_MANUAL_DETAILS_PANEL_ID}">
                    Add details (optional)
                  </button>
                  <div id="${RUN_MANUAL_DETAILS_PANEL_ID}" class="resume-matcher-run-manual-details__panel" hidden>
                    <div class="resume-matcher-field resume-matcher-field--manual-meta">
                      <label for="${RUN_MANUAL_TITLE_ID}">Job title</label>
                      <input id="${RUN_MANUAL_TITLE_ID}" type="text" placeholder="Job title" />
                    </div>
                    <div class="resume-matcher-field resume-matcher-field--manual-meta">
                      <label for="${RUN_MANUAL_COMPANY_ID}">Company</label>
                      <input id="${RUN_MANUAL_COMPANY_ID}" type="text" placeholder="Company" />
                    </div>
                    <div class="resume-matcher-field resume-matcher-field--manual-meta">
                      <label for="${RUN_MANUAL_SOURCE_URL_ID}">JD link</label>
                      <input id="${RUN_MANUAL_SOURCE_URL_ID}" type="url" placeholder="https://example.com/job" />
                    </div>
                  </div>
                </div>
              </div>
              <div class="resume-matcher-field resume-matcher-field--notes">
                <label for="${RUN_NOTES_ID}">Helpful context</label>
                <textarea id="${RUN_NOTES_ID}" rows="2" placeholder="Type ATS keywords, must-haves, recruiter hints, or LinkedIn signals."></textarea>
              </div>
              <div id="${RUN_PROMPT_PROFILE_FIELD_ID}" class="resume-matcher-field resume-matcher-field--style">
                <div class="resume-matcher-run-style-row">
                  <div class="resume-matcher-run-style-label">Tailoring style</div>
                  <button id="${RUN_PROMPT_PROFILE_INFO_ID}" type="button" class="resume-matcher-run-style-info-button" aria-label="About tailoring styles" aria-haspopup="dialog" aria-controls="${RUN_PROMPT_PROFILE_POPUP_ID}" aria-expanded="false" title="About tailoring styles">i</button>
                </div>
                ${renderPromptProfileTabs(
                  {
                    profiles: {
                      profile1: {},
                      profile2: {},
                      profile3: {},
                      profile4: {},
                    },
                  },
                  DEFAULT_ACTIVE_PROMPT_PROFILE_ID,
                  {
                    containerId: RUN_PROMPT_PROFILE_TABS_ID,
                    compact: true,
                    extraClassName: "is-run-wide",
                    allowDisabledSelection: false,
                  },
                )}
                <div id="${RUN_PROMPT_PROFILE_HINT_ID}" class="resume-matcher-run-style-hint" hidden></div>
              </div>
              <div id="${RUN_ACTIONS_ID}" class="resume-matcher-button-row">
                <button id="${RUN_PRIMARY_ID}" type="button" class="resume-matcher-button is-primary">Tailor</button>
              </div>
              <div id="${RUN_CANCEL_ROW_ID}" class="resume-matcher-run-cancel-row" hidden>
                <button id="${RUN_CANCEL_ID}" type="button" class="resume-matcher-run-cancel">Cancel run</button>
              </div>
              <div id="${RUN_STATUS_ACTIONS_ID}" class="resume-matcher-button-row"></div>
            </div>
          </article>
        </section>
        <section id="${SETTINGS_VIEW_ID}" class="resume-matcher-view">
          <div class="resume-matcher-settings-stack">
            <section class="resume-matcher-settings-group">
              <h3 class="resume-matcher-settings-title">Setup status</h3>
              <div id="${SETTINGS_HEALTH_ID}" class="resume-matcher-settings-health" data-state="incomplete">Finish setup</div>
              <div class="resume-matcher-settings-list">
                <div id="${MASTER_RESUME_LABEL_ID}" class="resume-matcher-settings-row-card"></div>
                <input id="${MASTER_RESUME_INPUT_ID}" class="resume-matcher-file-input" type="file" accept=".pdf,.docx,.doc,.txt,.md,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain,text/markdown,application/json" />
                <div id="${PROVIDER_ROW_ID}" class="resume-matcher-settings-row-card">
                  <div class="resume-matcher-settings-row-card__main">
                    <div class="resume-matcher-settings-row-card__copy">
                      <div class="resume-matcher-settings-row-card__topline">
                        <div class="resume-matcher-settings-row-card__title">AI Provider</div>
                        <span id="${PROVIDER_STATUS_ID}" class="resume-matcher-settings-status-pill" data-tone="needed">Needs setup</span>
                      </div>
                      <div id="${PROVIDER_VALUE_ID}" class="resume-matcher-settings-row-card__value">Choose provider</div>
                      <div id="${PROVIDER_DETAIL_ID}" class="resume-matcher-settings-row-card__detail">Required before tailoring.</div>
                    </div>
                    <div class="resume-matcher-settings-row-card__actions">
                      <button id="${PROVIDER_CHANGE_ID}" type="button" class="resume-matcher-button">Change</button>
                    </div>
                  </div>
                  <div id="${PROVIDER_PANEL_ID}" class="resume-matcher-settings-row-card__panel" hidden>
                    <div class="resume-matcher-settings-row-card__detail">Change the AI setup used for extraction and tailoring.</div>
                    <select id="${PROVIDER_SELECT_ID}"></select>
                    <div class="resume-matcher-settings-substack">
                      <div id="${PROVIDER_WEB_ROW_ID}" class="resume-matcher-settings-item" hidden>
                        <div class="resume-matcher-settings-item__title">Target</div>
                        <input id="${PROVIDER_WEB_INPUT_ID}" type="url" placeholder="Provider URL" />
                      </div>
                      <div id="${PROVIDER_API_BASE_ROW_ID}" class="resume-matcher-settings-item" hidden>
                        <div class="resume-matcher-settings-item__title">API</div>
                        <input id="${PROVIDER_API_BASE_INPUT_ID}" type="url" placeholder="API endpoint" />
                      </div>
                      <div id="${PROVIDER_API_GRID_ID}" class="resume-matcher-settings-grid" hidden>
                        <div id="${PROVIDER_MODEL_ROW_ID}" class="resume-matcher-field" hidden>
                          <input id="${PROVIDER_MODEL_INPUT_ID}" type="text" placeholder="Model" />
                        </div>
                        <div id="${PROVIDER_API_KEY_ROW_ID}" class="resume-matcher-field" hidden>
                          <input id="${PROVIDER_API_KEY_INPUT_ID}" type="password" placeholder="API key" />
                          <div id="${PROVIDER_API_KEY_HINT_ID}" class="resume-matcher-field__hint" hidden></div>
                        </div>
                      </div>
                      <div class="resume-matcher-button-row">
                        <button id="${PROVIDER_SAVE_ID}" type="button" class="resume-matcher-button is-primary">Save</button>
                        <button id="${PROVIDER_CANCEL_ID}" type="button" class="resume-matcher-button is-quiet">Cancel</button>
                      </div>
                    </div>
                  </div>
                </div>
                <div id="${STORYBOARD_LABEL_ID}" class="resume-matcher-settings-row-card" hidden></div>
                <input id="${STORYBOARD_INPUT_ID}" class="resume-matcher-file-input" type="file" accept=".txt,.md,.json,text/plain,text/markdown,application/json" hidden />
                <div class="resume-matcher-settings-row-card">
                  <div class="resume-matcher-settings-row-card__main">
                    <div class="resume-matcher-settings-row-card__copy">
                      <div class="resume-matcher-settings-row-card__topline">
                        <div class="resume-matcher-settings-row-card__title">Account</div>
                        <span id="${ACCOUNT_STATUS_ID}" class="resume-matcher-settings-status-pill" data-tone="needed">Needs setup</span>
                      </div>
                      <div id="${ACCOUNT_DETAIL_ID}" class="resume-matcher-settings-row-card__value">Not signed in</div>
                      <div class="resume-matcher-settings-row-card__detail">Used to save and open resumes in Lumi Coach.</div>
                    </div>
                    <div class="resume-matcher-settings-row-card__actions">
                      <button id="${ACCOUNT_ACTION_ID}" type="button" class="resume-matcher-button resume-matcher-google-button">${renderGoogleButtonLabel("Sign in")}</button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
            <details id="${ADVANCED_TOGGLE_ID}" class="resume-matcher-advanced">
              <summary>Support tools</summary>
              <section class="resume-matcher-settings-group">
                <div class="resume-matcher-settings-list">
                  <div class="resume-matcher-settings-item resume-matcher-field--full">
                    <div class="resume-matcher-settings-item__title">Apify fallback</div>
                    <div class="resume-matcher-settings-substack resume-matcher-settings-substack--compact">
                      <div class="resume-matcher-settings-item__detail">Used only if LinkedIn extraction fails.</div>
                      <a class="resume-matcher-settings-item__link" href="https://apify.com/apimaestro/linkedin-job-detail" target="_blank" rel="noopener noreferrer">Get API token</a>
                    </div>
                    <label class="resume-matcher-inline-action resume-matcher-inline-action--compact" for="${APIFY_ENABLED_INPUT_ID}">
                      <span class="resume-matcher-inline-action__label">Enable Apify</span>
                      <input id="${APIFY_ENABLED_INPUT_ID}" class="resume-matcher-checkbox" type="checkbox" />
                      <span class="resume-matcher-toggle" aria-hidden="true"></span>
                    </label>
                    <div id="${APIFY_TOKEN_ROW_ID}" class="resume-matcher-settings-substack" hidden>
                      <div class="resume-matcher-settings-item">
                        <div class="resume-matcher-settings-item__title">Apify API token</div>
                        <div class="resume-matcher-secret-field">
                          <input id="${APIFY_TOKEN_INPUT_ID}" type="password" placeholder="Paste your Apify API token" autocomplete="off" />
                          <button id="${APIFY_TOKEN_TOGGLE_ID}" type="button" class="resume-matcher-secret-toggle" aria-label="Show token" title="Show token" hidden>${icon("eye")}</button>
                        </div>
                      </div>
                    </div>
                    <button id="${APIFY_SAVE_ID}" type="button" class="resume-matcher-button is-primary">Save Apify</button>
                  </div>
                  <div class="resume-matcher-settings-item">
                    <div class="resume-matcher-settings-item__title-row">
                      <div class="resume-matcher-settings-item__title">Prompting</div>
                      <button id="${PROMPT_REFRESH_ID}" type="button" class="resume-matcher-settings-item__title-action" aria-label="Refresh default prompts" title="Refresh default prompts">${icon("refresh")}</button>
                    </div>
                    <div class="resume-matcher-settings-item__detail">Upload .txt only. Edit the main prompt wording only. Output contracts and guardrails stay fixed.</div>
                    <div id="${PROMPT_PROFILE_DETAIL_ID}" class="resume-matcher-settings-item__detail"></div>
                    <div class="resume-matcher-settings-substack">
                      <div class="resume-matcher-settings-item">
                        <div class="resume-matcher-settings-item__title">Active style</div>
                        <div class="resume-matcher-settings-item__detail">These uploaded prompt bodies apply to the selected style.</div>
                        <div class="resume-matcher-field">
                          ${renderPromptProfileTabs(
                            {
                              profiles: {
                                profile1: {},
                                profile2: {},
                                profile3: {},
                                profile4: {},
                              },
                            },
                            DEFAULT_ACTIVE_PROMPT_PROFILE_ID,
                            { containerId: PROMPT_PROFILE_TABS_ID, compact: true },
                          )}
                        </div>
                      </div>
                      ${PROMPT_FILE_DESCRIPTORS.map(
                        ({ templateName, label, downloadName, editable }) => `
                        <div id="${promptRowId(templateName)}" class="resume-matcher-settings-item">
                          <div class="resume-matcher-file-row">
                            <div id="${promptLabelId(templateName)}" class="resume-matcher-file-chip is-placeholder">
                              <span class="resume-matcher-file-chip__text">${label}</span>
                              <span class="resume-matcher-file-chip__actions">
                                ${downloadName ? `<button id="${promptDownloadId(templateName)}" type="button" class="resume-matcher-file-chip__action" aria-label="Download default ${label}" title="Download default ${label}">${icon("download")}</button>` : ""}
                                ${editable !== false ? `<button id="${promptActionId(templateName)}" type="button" class="resume-matcher-file-chip__action" aria-label="Upload ${label}" title="Upload ${label}">${renderFileActionIcon("upload")}</button>` : ""}
                              </span>
                            </div>
                            <input id="${promptInputId(templateName)}" class="resume-matcher-file-input" type="file" accept=".txt,text/plain" />
                          </div>
                        </div>
                      `,
                      ).join("")}
                    </div>
                  </div>
                  <div class="resume-matcher-settings-item resume-matcher-field--full">
                    <div class="resume-matcher-settings-item__title-row">
                      <div class="resume-matcher-settings-item__title">LLM config</div>
                      <span id="${LLM_CONFIG_BADGE_ID}" class="resume-matcher-settings-status-pill" data-tone="success" hidden>Custom active</span>
                    </div>
                    <div class="resume-matcher-settings-item__detail">Route different prompt stages to different AI providers. Download the template for instructions — edit it in a text editor, then import.</div>
                    <div class="resume-matcher-button-row">
                      <button id="${LLM_CONFIG_DOWNLOAD_ID}" type="button" class="resume-matcher-button">Download template</button>
                      <button id="${LLM_CONFIG_IMPORT_BTN_ID}" type="button" class="resume-matcher-button">Import config</button>
                      <button id="${LLM_CONFIG_RESET_ID}" type="button" class="resume-matcher-button is-quiet" hidden>Reset</button>
                    </div>
                    <input id="${LLM_CONFIG_IMPORT_INPUT_ID}" class="resume-matcher-file-input" type="file" accept=".yaml,.yml,text/yaml,text/plain" />
                  </div>
                  <div class="resume-matcher-advanced-actions resume-matcher-field--full">
                    <button id="${EXPORT_DATA_ID}" type="button" class="resume-matcher-button">Export run data</button>
                    <button id="${EXPORT_LOGS_ID}" type="button" class="resume-matcher-button">Download logs</button>
                    <button id="${RESET_DEFAULTS_ID}" type="button" class="resume-matcher-button">Reset settings</button>
                    <button id="${RESET_LOCAL_ID}" type="button" class="resume-matcher-button is-danger">Clear local storage</button>
                  </div>
                  <div class="resume-matcher-settings-item__detail resume-matcher-field--full">
                    Send me a message:
                    <a href="https://www.linkedin.com/in/kenn-nguyen/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
                  </div>
                  <div class="resume-matcher-settings-item__detail resume-matcher-field--full">
                    Give feedback:
                    <a href="https://lumicoach.userjot.com/?cursor=1&order=top&limit=10" target="_blank" rel="noopener noreferrer">UserJot</a>
                  </div>
                  <div class="resume-matcher-settings-item__detail resume-matcher-field--full">
                    Join our community:
                    <a href="https://chat.whatsapp.com/Ep41UDOTd3A4Lu78mxcEkQ?mode=gi_t" target="_blank" rel="noopener noreferrer">WhatsApp</a>
                  </div>
                  <div class="resume-matcher-settings-item__detail resume-matcher-field--full">
                    Lumi Coach extension v${EXTENSION_VERSION} · Include this version when reporting issues.
                  </div>
                </div>
              </section>
            </details>
          </div>
        </section>
      </div>
    </section>
    <div id="${RUN_PROMPT_PROFILE_POPUP_ID}" class="resume-matcher-run-style-popup" hidden></div>
  `;
  document.documentElement.appendChild(root);

  $(LAUNCHER_ID)?.addEventListener("click", handleGenerateClickOpenBoard);
  $(LAUNCHER_ID)?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleGenerateClickOpenBoard(event);
    }
  });
  $(LAUNCHER_ID)?.addEventListener("pointerdown", startPointerDrag);
  $(BOARD_ID)?.addEventListener("pointerdown", startBoardDrag);
  $(LAUNCHER_CLOSE_ID)?.addEventListener("click", (event) => {
    event.stopPropagation();
    dismissLauncher();
  });
  $(BOARD_HOME_ID)?.addEventListener("click", () => {
    openBoard("run", { skipConnectionCheck: true });
    activateRunInspection();
  });
  $(BOARD_SETTINGS_ID)?.addEventListener("click", () => {
    if (isSettingsNavigationLocked()) {
      return;
    }
    if (state.currentView === "settings") {
      openBoard("run", { skipConnectionCheck: true });
      activateRunInspection();
      return;
    }
    openBoard("settings");
  });
  $(BOARD_MINIMIZE_ID)?.addEventListener("click", minimizeBoard);
  $(RUN_SOURCE_LINKEDIN_ID)?.addEventListener("click", () => {
    if (!canUseLinkedInRunMode() || state.isRunning || state.isCanceling) return;
    state.runSourceMode = "linkedin";
    renderRunView();
  });
  $(RUN_SOURCE_MANUAL_ID)?.addEventListener("click", () => {
    if (state.isRunning || state.isCanceling) return;
    state.runSourceMode = "manual";
    renderRunView();
  });
  $(RUN_READY_ID)?.addEventListener("click", handleManualJobRescrape);
  $(RUN_PRIMARY_ID)?.addEventListener("click", handleGenerateClick);
  $(RUN_CANCEL_ID)?.addEventListener("click", requestCancelActiveRun);
  $(RUN_PROMPT_PROFILE_INFO_ID)?.addEventListener("click", (event) => {
    event.preventDefault();
    state.promptStyleInfoOpen = !state.promptStyleInfoOpen;
    renderRunView();
  });
  $(RUN_NOTES_ID)?.addEventListener("input", (event) => {
    state.customMessage = event.target.value || "";
    autoGrowTextarea(event.target);
  });
  $(RUN_ONBOARDING_ID)?.addEventListener("click", async (event) => {
    const actionButton = event.target.closest("[data-onboarding-action]");
    if (!actionButton) return;
    event.preventDefault();
    try {
      await handleOnboardingAction(
        actionButton.dataset.onboardingAction || "",
        actionButton.dataset.nextStep || "",
      );
    } catch (error) {
      setRunStatus(
        "error",
        "Setup failed",
        error instanceof Error
          ? error.message
          : "Unable to continue onboarding.",
      );
    }
  });
  $(RUN_ONBOARDING_ID)?.addEventListener("change", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    try {
      if (target.id === "resume-matcher-onboarding-provider-select") {
        await persistProviderSelection(target.id);
        renderRunView();
        syncOnboardingProviderContinueState();
      }
    } catch (error) {
      setRunStatus(
        "error",
        "Save failed",
        error instanceof Error ? error.message : "Unable to save provider.",
      );
    }
  });
  $(RUN_MANUAL_JD_ID)?.addEventListener("input", (event) => {
    state.manualJobDescription = event.target.value || "";
    autoGrowTextarea(event.target);
    render();
  });
  $(RUN_MANUAL_DETAILS_TOGGLE_ID)?.addEventListener("click", () => {
    state.manualJobDetailsOpen = !state.manualJobDetailsOpen;
    renderRunView();
  });
  $(RUN_MANUAL_TITLE_ID)?.addEventListener("input", (event) => {
    state.manualJobTitle = event.target.value || "";
  });
  $(RUN_MANUAL_COMPANY_ID)?.addEventListener("input", (event) => {
    state.manualJobCompany = event.target.value || "";
  });
  $(RUN_MANUAL_SOURCE_URL_ID)?.addEventListener("input", (event) => {
    state.manualJobSourceUrl = event.target.value || "";
  });
  $(RUN_PROMPT_PROFILE_TABS_ID)?.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-prompt-profile-id]");
    if (!(target instanceof HTMLButtonElement)) return;
    try {
      await persistPromptProfileSelection(
        target.dataset.promptProfileId || "",
      );
      renderRunView();
      renderSettings();
    } catch (error) {
      setRunStatus(
        "error",
        "Save failed",
        error instanceof Error
          ? error.message
          : "Failed to switch prompt profile.",
      );
    }
  });
  $(MASTER_RESUME_INPUT_ID)?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await importMasterResumeFile(file);
    event.target.value = "";
  });
  $(STORYBOARD_INPUT_ID)?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await saveTextAsset(file, "SAVE_STORYBOARD");
    state.storyboardReplaceOpen = false;
    event.target.value = "";
  });
  PROMPT_FILE_DESCRIPTORS.forEach(({ templateName, label, editable }) => {
    $(promptInputId(templateName))?.addEventListener(
      "change",
      async (event) => {
        if (
          editable === false ||
          !isPromptTemplateEditableForActiveProfile(templateName)
        )
          return;
        const file = event.target.files?.[0];
        if (!file) return;
        try {
          const response = await sendMessage("SAVE_PROMPT_TEMPLATE", {
            templateName,
            promptProfileId:
              state.assets?.activePromptProfileId || DEFAULT_ACTIVE_PROMPT_PROFILE_ID,
            filename: file.name,
            content: await file.text(),
          });
          if (!response?.ok) {
            throw new Error(response?.error || `Failed to save ${label}.`);
          }
          void trackAnalyticsEvent("extension_prompt_uploaded", {
            surface: "settings_view",
            template_name: templateName,
          });
          event.target.value = "";
          await refreshBoardData();
        } catch (error) {
          setRunStatus(
            "error",
            "Save failed",
            error instanceof Error ? error.message : `Failed to save ${label}.`,
          );
        }
      },
    );
  });
  $(ACCOUNT_ACTION_ID)?.addEventListener("click", async () => {
    const connected = state.connectionState === "connected";
    if (connected) {
      setRunStatus("info", "Opening sign-out", "Ending your Google session.");
      try {
        const response = await sendMessage("OPEN_SIGN_OUT");
        if (!response?.ok) {
          throw new Error(response?.error || "Failed to open sign-out.");
        }
      } catch (error) {
        setRunStatus(
          "error",
          "Sign out failed",
          error instanceof Error ? error.message : "Unable to open sign-out.",
        );
      }
      return;
    }
    await handleStatusAction("connect");
  });
  $(PROVIDER_SELECT_ID)?.addEventListener("change", () => {
    persistProviderSelection()
      .then(render)
      .catch((error) => {
        setRunStatus(
          "error",
          "Save failed",
          error instanceof Error
            ? error.message
            : "Unable to save provider selection.",
        );
      });
  });
  $(PROVIDER_CHANGE_ID)?.addEventListener("click", () => {
    state.providerSettingsEditOpen = true;
    setProviderValidationState([], false);
    syncProviderDraftState({ force: true });
    renderSettings();
  });
  $(PROVIDER_CANCEL_ID)?.addEventListener("click", () => {
    state.providerSettingsEditOpen = false;
    setProviderValidationState([], false);
    providerDraftState = createProviderDraftState(null, state.assets?.llmSettings);
    endSecretEdit(PROVIDER_API_KEY_INPUT_ID);
    renderSettings();
  });
  $(APIFY_ENABLED_INPUT_ID)?.addEventListener("change", () => {
    setApifyDraftState({
      enabled: $(APIFY_ENABLED_INPUT_ID)?.checked === true,
    });
    renderSettings();
  });
  $(APIFY_TOKEN_TOGGLE_ID)?.addEventListener("click", (event) => {
    event.preventDefault();
    toggleSecretReveal(APIFY_TOKEN_INPUT_ID);
  });
  $(PROVIDER_SAVE_ID)?.addEventListener("click", async () => {
    try {
      const result = await persistSelectedProviderSettings();
      await refreshBoardData();
      if (result?.providerValidation?.ok === false) {
        setRunStatus(
          "info",
          "Provider saved",
          result.providerValidation.error ||
            "Saved the provider settings, but the connection check failed.",
        );
      }
    } catch (error) {
      setRunStatus(
        "error",
        "Save failed",
        error instanceof Error
          ? error.message
          : "Unable to save provider settings.",
      );
    }
  });
  $(APIFY_SAVE_ID)?.addEventListener("click", async () => {
    try {
      await persistApifyFallbackSettings();
      await refreshBoardData();
    } catch (error) {
      setRunStatus(
        "error",
        "Save failed",
        error instanceof Error
          ? error.message
          : "Unable to save Apify fallback settings.",
      );
    }
  });
  $(RESET_LOCAL_ID)?.addEventListener("click", async () => {
    if (
      !window.confirm(
        "Clear this account’s local extension storage on this browser?",
      )
    ) {
      return;
    }
    await sendMessage("RESET_LOCAL_DATA").catch(() => {});
    state.customMessage = "";
    await refreshBoardData();
    setRunStatus(
      "info",
      "Local storage cleared",
      "This account’s local extension storage is now empty on this browser.",
    );
  });
  $(RESET_DEFAULTS_ID)?.addEventListener("click", async () => {
    await sendMessage("RESET_DEFAULT_SETTINGS").catch(() => {});
    await refreshBoardData();
  });
  $(EXPORT_DATA_ID)?.addEventListener("click", () => {
    try {
      exportHistoryData();
      setRunStatus(
        "info",
        "Export downloaded",
        "Downloaded this account’s run data as JSON.",
      );
    } catch (error) {
      setRunStatus(
        "error",
        "Export failed",
        error instanceof Error ? error.message : "Unable to export run data.",
      );
    }
  });
  $(EXPORT_LOGS_ID)?.addEventListener("click", async () => {
    try {
      const payload = await downloadDiagnosticLogs();
      if (payload?.stale) {
        const hours = payload.savedAtAgeHours;
        setRunStatus(
          "warning",
          "Downloaded older logs",
          `No recent run found — these logs are from a previous run${
            hours != null ? ` ~${hours}h ago` : ""
          }. Run a tailor, then download again for the latest.`,
        );
      } else {
        setRunStatus(
          "info",
          "Logs downloaded",
          "Downloaded the most recent run's diagnostic logs as JSON.",
        );
      }
    } catch (error) {
      setRunStatus(
        "error",
        "Log download failed",
        error instanceof Error ? error.message : "Unable to download logs.",
      );
    }
  });
  $(LLM_CONFIG_DOWNLOAD_ID)?.addEventListener("click", () => {
    try {
      const blob = new Blob([LLM_CONFIG_TEMPLATE_YAML], { type: "text/yaml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "lumi-llm-config.yaml";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      setRunStatus(
        "error",
        "Download failed",
        error instanceof Error ? error.message : "Unable to download template.",
      );
    }
  });
  $(LLM_CONFIG_IMPORT_BTN_ID)?.addEventListener("click", () => {
    $(LLM_CONFIG_IMPORT_INPUT_ID)?.click();
  });
  $(LLM_CONFIG_IMPORT_INPUT_ID)?.addEventListener("change", async (event) => {
    const file = event.target?.files?.[0];
    if (!file) return;
    event.target.value = "";
    try {
      const text = await file.text();
      const response = await sendMessage("SAVE_IMPORTED_LLM_CONFIG", { text });
      if (!response?.ok) {
        throw new Error(response?.error || "Invalid config file.");
      }
      await refreshBoardData();
      setRunStatus(
        "info",
        "Config imported",
        `"${file.name}" imported. Stages will use the custom routing.`,
      );
    } catch (error) {
      setRunStatus(
        "error",
        "Import failed",
        error instanceof Error ? error.message : "Unable to import config file.",
      );
    }
  });
  $(LLM_CONFIG_RESET_ID)?.addEventListener("click", async () => {
    await sendMessage("CLEAR_IMPORTED_LLM_CONFIG").catch(() => {});
    await refreshBoardData();
    setRunStatus("info", "Config reset", "Returned to single-provider mode.");
  });
  root.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const historyJobButton = target.closest("[data-history-job]");
    if (historyJobButton) {
      event.preventDefault();
      state.historyFilterOpen = false;
      openHistoryJob(historyJobButton.dataset.historyJob);
      return;
    }

    const historyOpenButton = target.closest("[data-history-open]");
    if (historyOpenButton) {
      event.preventDefault();
      state.historyFilterOpen = false;
      openHistoryResume(historyOpenButton.dataset.historyOpen);
      return;
    }

    const historyDeleteButton = target.closest("[data-history-delete]");
    if (historyDeleteButton) {
      event.preventDefault();
      state.historyFilterOpen = false;
      await deleteHistoryEntry(historyDeleteButton.dataset.historyDelete);
      return;
    }

    const historyFilterButton = target.closest(
      ".resume-matcher-history-filter__button",
    );
    if (historyFilterButton) {
      event.preventDefault();
      state.historyFilterOpen = !state.historyFilterOpen;
      renderHistory();
      return;
    }

    const historySortButton = target.closest("[data-history-sort]");
    if (historySortButton) {
      event.preventDefault();
      state.historySortDirection =
        historySortButton.dataset.historySort === "asc" ? "asc" : "desc";
      state.historyPage = 1;
      state.historyFilterOpen = false;
      renderHistory();
      return;
    }

    if (target.closest(`#${HISTORY_PREV_ID}`)) {
      event.preventDefault();
      state.historyPage = Math.max(1, state.historyPage - 1);
      renderHistory();
      return;
    }

    if (target.closest(`#${HISTORY_NEXT_ID}`)) {
      event.preventDefault();
      state.historyPage += 1;
      renderHistory();
      return;
    }

    const historyConnectButton = target.closest("[data-history-connect]");
    if (historyConnectButton) {
      event.preventDefault();
      await handleStatusAction("connect");
      return;
    }

    if (state.historyFilterOpen && !target.closest(`#${HISTORY_FILTER_ID}`)) {
      state.historyFilterOpen = false;
      renderHistory();
    }

    const button = target.closest("[data-status-action]");
    if (button) {
      await handleStatusAction(button.dataset.statusAction);
      return;
    }
    const guideLink = target.closest(`a[href="${STORY_BANK_GUIDE_URL}"]`);
    if (guideLink) {
      void trackAnalyticsEvent("extension_story_bank_guide_clicked", {
        surface:
          state.currentView === "settings" ? "settings_view" : "run_view",
      });
    }
  });
  root.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    if (target.id === HISTORY_SEARCH_ID) {
      state.historySearch = target.value || "";
      state.historyPage = 1;
      state.historyFilterOpen = false;
      renderHistory();
      return;
    }

    if (target.id === APIFY_TOKEN_INPUT_ID) {
      secretDraftState[APIFY_TOKEN_INPUT_ID] = target.value || "";
      setApifyDraftState({
        apiToken: target.value || "",
      });
      syncApifySaveButtonState();
      return;
    }

    if (target.id === PROVIDER_API_KEY_INPUT_ID) {
      secretDraftState[PROVIDER_API_KEY_INPUT_ID] = target.value || "";
      setProviderDraftState({
        apiKey: target.value || "",
      });
      syncProviderSaveButtonState();
      return;
    }

    if (target.id === ONBOARDING_PROVIDER_API_KEY_INPUT_ID) {
      secretDraftState[ONBOARDING_PROVIDER_API_KEY_INPUT_ID] =
        target.value || "";
      setProviderDraftState({
        apiKey: target.value || "",
      });
      syncOnboardingProviderContinueState();
      return;
    }

    if (target.id === PROVIDER_WEB_INPUT_ID) {
      setProviderDraftState({
        targetUrl: target.value || "",
      });
      syncProviderSaveButtonState();
      return;
    }

    if (target.id === PROVIDER_API_BASE_INPUT_ID) {
      setProviderDraftState({
        apiBaseUrl: target.value || "",
      });
      syncProviderSaveButtonState();
      return;
    }

    if (target.id === PROVIDER_MODEL_INPUT_ID) {
      setProviderDraftState({
        model: target.value || "",
      });
      syncProviderSaveButtonState();
      return;
    }

    if (target.id === "resume-matcher-onboarding-provider-web-input") {
      setProviderDraftState({
        targetUrl: target.value || "",
      });
      syncOnboardingProviderContinueState();
      return;
    }

    if (target.id === "resume-matcher-onboarding-provider-api-base-input") {
      setProviderDraftState({
        apiBaseUrl: target.value || "",
      });
      syncOnboardingProviderContinueState();
      return;
    }

    if (target.id === "resume-matcher-onboarding-provider-model-input") {
      setProviderDraftState({
        model: target.value || "",
      });
      syncOnboardingProviderContinueState();
    }
  });
  root.addEventListener("focusin", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!isSecretInputId(target.id)) return;
    beginSecretEdit(target);
  });
  root.addEventListener("mousedown", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!isSecretInputId(target.id)) return;
    beginSecretEdit(target);
  });
  root.addEventListener("copy", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!isSecretInputId(target.id)) return;
    event.preventDefault();
  });
  root.addEventListener("cut", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!isSecretInputId(target.id)) return;
    event.preventDefault();
  });
  root.addEventListener("contextmenu", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!isSecretInputId(target.id)) return;
    event.preventDefault();
  });
  root.addEventListener("focusout", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!isSecretInputId(target.id)) return;
    const draftValue = normalizeSecretValue(secretDraftState[target.id]);
    const savedValue = normalizeSecretValue(getSavedSecretValue(target.id));
    if (
      secretEditingState[target.id] === true &&
      shouldEndSecretEdit(draftValue, savedValue)
    ) {
      endSecretEdit(target.id);
    }
  });
  if (!selectedJobClickListenerAttached) {
    document.addEventListener("click", handleSelectedJobClick);
    selectedJobClickListenerAttached = true;
  }
  if (!promptStyleInfoClickListenerAttached) {
    document.addEventListener("click", handlePromptStyleInfoOutsideClick);
    promptStyleInfoClickListenerAttached = true;
  }

  void applyStoredRootState(root);
  return root;
}

function handleGenerateClickOpenBoard(event) {
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }
  event.preventDefault();
  if (!openBoard("run", { skipConnectionCheck: true })) {
    return;
  }
  activateRunInspection();
}

function removeRoot() {
  pointerDragState = null;
  $(ROOT_ID)?.remove();
}

function handleSelectedJobClick(event) {
  if (isContentScriptDisposed()) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest(`#${ROOT_ID}`)) return;
  if (state.launcherLockNoticeVisible) {
    hideLauncherLockNotice();
  }
  const expectedSourceUrl = getSelectedJobClickSourceUrl(target);
  if (
    expectedSourceUrl ||
    target.closest(
      ".job-card-container, .jobs-search-results__list-item, .scaffold-layout__list-item, [data-job-id]",
    )
  ) {
    scheduleSelectedJobRefresh({
      expectedSourceUrl,
      delayMs: 420,
    });
  }
}

function handlePromptStyleInfoOutsideClick(event) {
  if (isContentScriptDisposed() || !state.promptStyleInfoOpen) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (
    target.closest(`#${RUN_PROMPT_PROFILE_FIELD_ID}`) ||
    target.closest(`#${RUN_PROMPT_PROFILE_POPUP_ID}`)
  )
    return;
  state.promptStyleInfoOpen = false;
  renderRunView();
}

function stopSelectedJobDetailWatcher() {
  if (selectedJobDetailObserverThrottle !== null) {
    window.clearTimeout(selectedJobDetailObserverThrottle);
    selectedJobDetailObserverThrottle = null;
  }
  if (!selectedJobDetailObserver) {
    selectedJobDetailObservedRoot = null;
    return;
  }
  selectedJobDetailObserver.disconnect();
  selectedJobDetailObserver = null;
  selectedJobDetailObservedRoot = null;
}

function handleViewportChange() {
  if (isContentScriptDisposed()) return;
  const root = $(ROOT_ID);
  if (!root) return;
  syncDockedPosition(root);
}

function doesLocallyOwnLockedRun() {
  const lockedRunId =
    String(
      state.runLock?.runId ||
        state.activeRunId ||
        state.extensionState?.sessionId ||
        "",
    ).trim() || null;
  if (!lockedRunId || !state.ownedRunId) {
    return false;
  }
  return state.ownedRunId === lockedRunId;
}

function isLockedToAnotherTab() {
  if (state.runLock?.active !== true) {
    return false;
  }
  if (state.runLock?.currentTabOwnsRun === true) {
    return false;
  }
  if (doesLocallyOwnLockedRun()) {
    return false;
  }
  return true;
}

function clearLauncherLockNoticeTimer() {
  if (launcherLockNoticeTimer) {
    window.clearTimeout(launcherLockNoticeTimer);
    launcherLockNoticeTimer = null;
  }
}

function hideLauncherLockNotice({ renderNow = true } = {}) {
  clearLauncherLockNoticeTimer();
  if (!state.launcherLockNoticeVisible) {
    return;
  }
  state.launcherLockNoticeVisible = false;
  if (renderNow) {
    renderRootFlags();
  }
}

function showLauncherLockNotice() {
  if (!isLockedToAnotherTab()) {
    hideLauncherLockNotice();
    return;
  }
  state.launcherLockNoticeVisible = true;
  renderRootFlags();
  clearLauncherLockNoticeTimer();
  launcherLockNoticeTimer = window.setTimeout(() => {
    launcherLockNoticeTimer = null;
    state.launcherLockNoticeVisible = false;
    renderRootFlags();
  }, 3600);
}

function activateRunInspection(options = {}) {
  const { recheckConnection = true } = options;
  if (isNonLinkedInManualRoute()) {
    state.jobInspectionRequested = false;
    state.currentJob = null;
    resetJobLoadingState();
    stopSelectedJobDetailWatcher();
    render();
    return;
  }
  state.jobInspectionRequested = true;
  syncFloatingAction({ recheckConnection });
}

async function handleShowLauncher() {
  await refreshBoardData({ refreshBackendMaster: true });
  ensureRoot();
  showLauncher();
}

function updateStatusFromLog(level, scope, message, data) {
  const formatted =
    `${LOG_PREFIX}[${scope || "Unknown"}] ${message || ""}`.trim();
  if (level === "error") {
    if (data === undefined) {
      console.error(formatted);
    } else {
      console.error(formatted, data);
    }
  } else if (level === "warn") {
    if (data === undefined) {
      console.warn(formatted);
    } else {
      console.warn(formatted, data);
    }
  } else if (data === undefined) {
    console.info(formatted);
  } else {
    console.info(formatted, data);
  }

  const scopedRunId = data?.run_id ?? data?.runId ?? null;
  if (!shouldHandleRunScopedMessage(scopedRunId)) {
    return;
  }

  if (state.previewHandoffComplete) {
    return;
  }

  if (state.isCanceling) {
    return;
  }

  if (level === "error") {
    if (!scopedRunId && !isRunStatusRelevantScope(scope)) {
      return;
    }
    state.isRunning = false;
    state.isCanceling = false;
    state.awaitingAuth = false;
    state.awaitingStoryboard = false;
    state.activeRunId = null;
    clearOwnedRun(scopedRunId);
    setRunStatus(
      "error",
      "Run failed",
      formatErrorText(data?.error || data?.message || message),
    );
    return;
  }

  const progress = getProgressMessage(scope, message, data);
  if (!progress) return;
  if (
    (scope === "Orchestrator" &&
      (message === "Job extraction completed." ||
        message === "Running Prompt 1." ||
        message === "Running Prompt 2." ||
        message === "Rendering Prompt 1." ||
        message === "Rendering Prompt 2." ||
        message === "Running Prompt 3." ||
        message === "Opening generated resume preview.")) ||
    (scope === "ResumeApi" &&
      (message === "Uploading job description." ||
        message === "Clone resume succeeded." ||
        message === "Job upload succeeded."))
  ) {
    clearScrapeRecoveryState();
  }
  if (scope === "Orchestrator" && message === "Opening generated resume preview.") {
    markPreviewHandoffComplete();
    setExplicitRunStatus(
      "success",
      "success",
      "Opening workspace",
      `Your tailored resume for ${getJobDisplayLabel(state.activeRunJob)} is opening on the web.`,
    );
    return;
  }
  const [title, detail] = progress;
  activateVisibleRunFromProgress(scopedRunId);
  applyExplicitRunStatus(
    runStatusHelpers.createExplicitRunStatus(
      "running",
      "running",
      title,
      detail,
      [],
    ),
    {
      source:
        typeof data?.phaseText === "string" && data.phaseText.trim()
          ? "heartbeat"
          : "stage",
    },
  );
}

function syncFloatingAction(options = {}) {
  if (isContentScriptDisposed()) {
    removeRoot();
    return;
  }
  const { recheckConnection = true } = options;
  if (!hasVisibleLauncherRoute()) {
    state.jobInspectionRequested = false;
    resetJobLoadingState();
    state.currentJob = null;
    stopSelectedJobDetailWatcher();
    removeRoot();
    return;
  }
  ensureRoot();
  if (isNonLinkedInManualRoute()) {
    state.jobInspectionRequested = false;
    state.currentJob = null;
    resetJobLoadingState();
    stopSelectedJobDetailWatcher();
    render();
    return;
  }
  if (!state.jobInspectionRequested) {
    state.currentJob = null;
    resetJobLoadingState();
    stopSelectedJobDetailWatcher();
    render();
    return;
  }
  const nextJob = extractCurrentJob();
  updateJobReadiness(nextJob);
  startSelectedJobDetailWatcher();
  render();
  if (recheckConnection && hasActiveSelectedJobRoute() && nextJob) {
    void reconcileConnectionStatus("run");
  }
}

function reconcileRouteState(options = {}) {
  const { force = false, recheckConnection = true } = options;
  if (!force && location.href === lastUrl) return;
  const previousJobSignature = getCurrentJobSignature(state.currentJob);
  lastUrl = location.href;
  lastRouteSignature = getCurrentRouteSignature();
  resetJobLoadingState();
  if (isNonLinkedInManualRoute()) {
    state.jobInspectionRequested = false;
    state.currentJob = null;
    stopSelectedJobDetailWatcher();
  } else if (state.jobInspectionRequested) {
    updateJobReadiness(extractCurrentJob());
  } else {
    state.currentJob = null;
  }
  if (!state.isRunning && !state.awaitingAuth && !state.awaitingStoryboard) {
    state.activeRunJob = null;
    if (
      previousJobSignature &&
      !getCurrentJobSignature(state.currentJob) &&
      runStatusHelpers.shouldClearExplicitStatusOnJobChange(state.explicitRunStatus)
    ) {
      clearExplicitRunStatus("route-change", { renderNow: false });
    }
  }
  syncFloatingAction({ recheckConnection });
}

function startUrlFallbackPolling() {
  if (routePollTimer) {
    return;
  }

  lastRouteSignature = getCurrentRouteSignature();
  routePollTimer = window.setInterval(() => {
    if (document.hidden) return;
    const nextSignature = getCurrentRouteSignature();
    if (nextSignature === lastRouteSignature) {
      return;
    }

    const nextMode = deriveFallbackRouteModeFromLocation();
    setRouteMode(nextMode);
    reconcileRouteState({ force: true });
  }, 1000);
}

function stopUrlFallbackPolling() {
  if (routePollTimer) {
    window.clearInterval(routePollTimer);
    routePollTimer = null;
  }
}

function startSelectedJobDetailWatcher() {
  const nextRoot = getLinkedInJobDetailRoot();
  if (!nextRoot) return;
  if (selectedJobDetailObservedRoot === nextRoot && selectedJobDetailObserver) {
    return;
  }

  if (selectedJobDetailObserver) {
    selectedJobDetailObserver.disconnect();
  }

  selectedJobDetailObservedRoot = nextRoot;
  selectedJobDetailObserver = new MutationObserver(() => {
    // Throttle: LinkedIn's job pane mutates constantly (lazy images, hover,
    // dynamic sections). extractCurrentJob() is expensive (querySelectorAll
    // sweeps + reading the full JD text), so coalesce bursts and run it at most
    // once per ~350ms instead of on every mutation. The 260ms refresh debounce
    // below already absorbs the added latency.
    if (selectedJobDetailObserverThrottle !== null) {
      return;
    }
    selectedJobDetailObserverThrottle = window.setTimeout(() => {
      selectedJobDetailObserverThrottle = null;
      const nextJob = extractCurrentJob();
      if (
        getCurrentJobSignature(nextJob) ===
        getCurrentJobSignature(state.currentJob)
      ) {
        return;
      }
      scheduleSelectedJobRefresh({
        expectedSourceUrl: nextJob?.sourceUrl || "",
        delayMs: 260,
      });
    }, 350);
  });
  selectedJobDetailObserver.observe(nextRoot, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

function handleVisibilityChange() {
  if (isContentScriptDisposed()) return;
  if (document.hidden) {
    // Tab going to background — go fully quiescent: pause the MutationObserver
    // AND stop the 1s route poll. A repeating timer firing while hidden counts
    // as page activity and can keep Edge/Chrome from sleeping the tab, so a
    // backgrounded LinkedIn tab should run nothing of ours.
    if (selectedJobDetailObserver) {
      selectedJobDetailObserver.disconnect();
    }
    stopUrlFallbackPolling();
  } else {
    // Tab becoming visible again — resume the poll and reconnect the observer
    // so we pick up any job/route changes that happened while we were away,
    // then reconcile state.
    startUrlFallbackPolling();
    startSelectedJobDetailWatcher();
    reconcileRouteState({ force: true });
  }
}

function handleRuntimeMessage(message, _sender, sendResponse) {
  if (isContentScriptDisposed()) {
    sendResponse({ ok: false, error: "Extension context invalidated." });
    return false;
  }
  if (message?.type === "EXTENSION_PING") {
    sendResponse({ ok: true });
    return false;
  }

  if (
    message?.type === "SCRAPE_JOB_PREVIEW" ||
    message?.type === "SCRAPE_JOB_FULL"
  ) {
    const mode = message.type === "SCRAPE_JOB_FULL" ? "full" : "preview";
    loadAdapterModule()
      .then(({ getAdapter }) => {
        const adapter = getAdapter(window.location.hostname);
        if (!adapter) {
          sendResponse({
            ok: false,
            error: "Unsupported page for job scraping.",
          });
          return null;
        }
        return adapter.snapshot(document, {
          mode,
          locationHref: window.location.href,
        });
      })
      .then((snapshot) => {
        if (!snapshot) return;
        sendResponse({ ok: true, snapshot });
      })
      .catch((error) =>
        sendResponse({ ok: false, error: error?.message || String(error) }),
      );
    return true;
  }

  if (message?.type === "EXTENSION_SHOW_LAUNCHER") {
    void handleShowLauncher();
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "EXTENSION_RECHECK_CONNECTION") {
    void reconcileConnectionStatus(state.currentView);
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "EXTENSION_ROUTE_CHANGED") {
    setRouteMode(message.payload?.route?.mode || "hidden");
    reconcileRouteState({ force: true });
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "CHATGPT_POPUP_STALLED") {
    if (state.isRunning && !state.popupStallHint) {
      state.popupStallHint = true;
      render();
    }
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "CHATGPT_POPUP_RESUMED") {
    if (state.popupStallHint) {
      state.popupStallHint = false;
      render();
    }
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "EXTENSION_CONNECTION_STATE_CHANGED") {
    state.connectionState =
      message.payload?.connectionState || state.connectionState;
    const accountChanged = message.payload?.accountChanged === true;
    if (accountChanged) {
      state.isRunning = false;
      state.isCanceling = false;
      state.awaitingAuth = false;
      state.awaitingStoryboard = false;
      state.activeRunId = null;
      state.activeRunJob = null;
      clearOwnedRun();
      state.currentView = "run";
      openBoard("run", { skipConnectionCheck: true });
      setExplicitRunStatus(
        "interrupted",
        "info",
        "Different account detected",
        message.payload?.message ||
          "You’re signed in with a different account. This account uses its own local extension workspace.",
      );
    } else if (state.connectionState !== "connected") {
      state.isRunning = false;
      state.isCanceling = false;
      state.awaitingAuth = false;
      state.activeRunId = null;
      state.activeRunJob = null;
      clearOwnedRun();
      state.currentView = "run";
      openBoard("run", { skipConnectionCheck: true });
    }
    void reconcileConnectionStatus(state.currentView);
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "EXTENSION_AUTH_REQUIRED") {
    if (!shouldHandleRunScopedMessage(message.payload?.runId ?? null)) {
      sendResponse({ ok: true });
      return true;
    }
    state.isRunning = false;
    state.isCanceling = false;
    state.awaitingAuth = message.payload?.connectionState === "signed_out";
    state.activeRunId = message.payload?.runId || state.activeRunId;
    state.connectionState = message.payload?.connectionState || "signed_out";
    state.setupState = {
      ...(state.setupState || {}),
      state: "signed_out",
      title: "You’ve been signed out",
      detail:
        message.payload?.message ||
        "Sign in to continue tailoring this job. Each account keeps its own local extension workspace.",
      primaryAction: {
        id: "connect",
        label: "Continue with Google",
      },
    };
    openBoard("run");
    const requirement = getSetupRequirementStatus(message.payload?.message) || {
      tone: "blocked",
      title: "You’ve been signed out",
      detail:
        message.payload?.message ||
        "Sign in to continue tailoring this job. Each account keeps its own local extension workspace.",
      actions: [
        {
          id: "connect",
          label: "Continue with Google",
          variant: "primary",
        },
      ],
    };
    setExplicitRunStatus(
      "interrupted",
      requirement.tone,
      requirement.title,
      requirement.detail,
      requirement.actions,
    );
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "EXTENSION_AUTH_COMPLETED") {
    state.awaitingAuth = false;
    state.isCanceling = false;
    state.connectionState = "connected";
    state.websiteAuthenticated = true;
    state.extensionConnected = true;
    openBoard("run");
    clearExplicitRunStatus("auth-completed");
    void refreshBoardData({ refreshBackendMaster: true });
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "EXTENSION_SETUP_REQUIRED") {
    if (!shouldHandleRunScopedMessage(message.payload?.runId ?? null)) {
      sendResponse({ ok: true });
      return true;
    }
    state.isRunning = false;
    state.isCanceling = false;
    state.awaitingAuth = false;
    state.awaitingStoryboard = false;
    state.activeRunId = message.payload?.runId || state.activeRunId;
    state.activeRunJob = null;
    state.setupState = message.payload?.setupState || state.setupState;
    openBoard("run");
    const requirement = getSetupRequirementStatus(message.payload?.message) || {
      tone: "blocked",
      title: "Finish setup",
      detail: message.payload?.message || "Finish setup to continue.",
      actions: [],
    };
    setExplicitRunStatus(
      "interrupted",
      requirement.tone,
      requirement.title,
      requirement.detail,
      requirement.actions,
    );
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "EXTENSION_STORYBOARD_RECOMMENDATION") {
    if (shouldHandleRunScopedMessage(message.payload?.runId ?? null)) {
      state.activeRunId = message.payload?.runId || state.activeRunId;
      sendMessage("CONTINUE_PENDING_GENERATION_WITHOUT_STORYBOARD").catch(
        () => {},
      );
    }
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "EXTENSION_RESUMED_GENERATION_RESULT") {
    if (
      state.previewHandoffComplete ||
      state.explicitRunStatus?.kind === "canceled" ||
      !shouldHandleRunScopedMessage(message.payload?.runId ?? null)
    ) {
      sendResponse({ ok: true });
      return true;
    }
    state.awaitingAuth = false;
    state.awaitingStoryboard = false;
    state.isCanceling = false;
    state.isRunning = false;
    if (message.payload?.canceled) {
      applyCanceledRunState(message.payload?.runId ?? state.activeRunId);
      sendResponse({ ok: true });
      return true;
    }
    if (message.payload?.ok) {
      clearScrapeRecoveryState();
      if (!state.previewHandoffComplete) {
        setExplicitRunStatus(
          "success",
          "success",
          "Opening workspace",
          `Your tailored resume for ${getJobDisplayLabel(state.activeRunJob)} is opening on the web.`,
        );
      }
      state.activeRunId = null;
      state.activeRunJob = null;
      void refreshBoardData();
    } else {
      if (
        state.isCanceling &&
        isCancellationTeardownMessage(message.payload?.error)
      ) {
        applyCanceledRunState(message.payload?.runId ?? state.activeRunId);
        void refreshBoardData();
        sendResponse({ ok: true });
        return true;
      }
      if (isScrapeProblemMessage(message.payload?.error)) {
        state.scrapeIssue = getScrapeRequirementStatus().detail;
        clearExplicitRunStatus("scrape-recovery");
        sendResponse({ ok: true });
        return true;
      }
      state.activeRunId = null;
      state.activeRunJob = null;
      clearOwnedRun(message.payload?.runId ?? null);
      setExplicitRunStatus(
        "error",
        "error",
        "Run failed",
        formatErrorText(
          message.payload?.error || "Failed to generate tailored resume.",
        ),
      );
    }
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "EXTENSION_RUN_CANCELED") {
    if (!shouldHandleRunScopedMessage(message.payload?.runId ?? null)) {
      sendResponse({ ok: true });
      return true;
    }
    applyCanceledRunState(message.payload?.runId ?? state.activeRunId);
    void refreshBoardData();
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "EXTENSION_PREVIEW_OPENED") {
    state.launcherAlert = false;
    markPreviewHandoffComplete();
    state.activeRunJob = null;
    if (state.explicitRunStatus?.kind === "success") {
      clearExplicitRunStatus("preview-opened");
    } else {
      render();
    }
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "LOG_EVENT") {
    updateStatusFromLog(
      message.payload?.level,
      message.payload?.scope,
      message.payload?.message,
      message.payload?.data,
    );
    sendResponse({ ok: true });
    return true;
  }

  return false;
}

function destroyContentScriptInstance(reason = "disposed") {
  if (contentScriptDisposed) {
    return;
  }
  contentScriptDisposed = true;
  state.isRunning = false;
  state.isCanceling = false;
  state.awaitingAuth = false;
  state.awaitingStoryboard = false;
  state.boardOpen = false;
  state.jobInspectionRequested = false;
  state.activeRunId = null;
  state.activeRunJob = null;
  clearOwnedRun();
  clearJobLoadTimer();
  if (selectedJobRefreshTimer) {
    window.clearTimeout(selectedJobRefreshTimer);
    selectedJobRefreshTimer = null;
  }
  if (routePollTimer) {
    window.clearInterval(routePollTimer);
    routePollTimer = null;
  }
  stopRunningStatusRotation();
  stopSelectedJobDetailWatcher();
  window.removeEventListener("pointermove", handlePointerMove);
  window.removeEventListener("pointerup", finishPointerDrag);
  window.removeEventListener("pointercancel", finishPointerDrag);
  window.removeEventListener("resize", handleViewportChange);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  if (selectedJobClickListenerAttached) {
    document.removeEventListener("click", handleSelectedJobClick);
    selectedJobClickListenerAttached = false;
  }
  if (promptStyleInfoClickListenerAttached) {
    document.removeEventListener("click", handlePromptStyleInfoOutsideClick);
    promptStyleInfoClickListenerAttached = false;
  }
  chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
  removeRoot();
  if (
    globalThis[CONTENT_SCRIPT_INSTANCE_KEY] &&
    globalThis[CONTENT_SCRIPT_INSTANCE_KEY].destroy === destroyContentScriptInstance
  ) {
    delete globalThis[CONTENT_SCRIPT_INSTANCE_KEY];
  }
  console.info(`${LOG_PREFIX} Disposed content script instance.`, { reason });
}

chrome.runtime.onMessage.addListener(handleRuntimeMessage);

void loadRunStatusHelpers().finally(() => {
  if (isContentScriptDisposed()) {
    return;
  }
  void chrome.runtime
    .sendMessage({ type: "REGISTER_LOG_VIEWER" })
    .catch((error) => {
      if (isExtensionContextInvalidatedError(error)) {
        destroyContentScriptInstance("register-log-viewer-invalidated");
      }
    });

  window.addEventListener("resize", handleViewportChange);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  void refreshBoardData({ refreshBackendMaster: true });
  // Don't start the route poll for a tab opened in the background — it would be
  // a repeating timer that keeps the tab from sleeping before the user ever
  // looks at it. handleVisibilityChange starts it on first focus.
  if (!document.hidden) {
    startUrlFallbackPolling();
  }
  globalThis[CONTENT_SCRIPT_INSTANCE_KEY] = {
    destroy: destroyContentScriptInstance,
  };
});
})();
