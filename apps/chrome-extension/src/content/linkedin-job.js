const ROOT_ID = "resume-matcher-floating-action";
const LAUNCHER_ID = "resume-matcher-launcher";
const LAUNCHER_CLOSE_ID = "resume-matcher-launcher-close";
const LAUNCHER_ALERT_ID = "resume-matcher-launcher-alert";
const BOARD_ID = "resume-matcher-board";
const BOARD_WEBSITE_ID = "resume-matcher-board-website";
const BOARD_TITLE_ID = "resume-matcher-board-title-link";
const BOARD_HOME_ID = "resume-matcher-board-home";
const BOARD_RUNS_ID = "resume-matcher-board-runs";
const BOARD_SETTINGS_ID = "resume-matcher-board-settings";
const BOARD_MINIMIZE_ID = "resume-matcher-board-minimize";
const RUN_VIEW_ID = "resume-matcher-run-view";
const RUN_READY_ID = "resume-matcher-job-ready";
const RUN_META_ID = "resume-matcher-job-meta";
const RUN_ONBOARDING_ID = "resume-matcher-run-onboarding";
const RUN_NOTES_ID = "resume-matcher-run-notes";
const RUN_MANUAL_JD_FIELD_ID = "resume-matcher-manual-jd-field";
const RUN_MANUAL_JD_ID = "resume-matcher-manual-jd";
const RUN_PRIMARY_ID = "resume-matcher-run-primary";
const RUN_SECONDARY_ID = "resume-matcher-run-secondary";
const RUN_ACTIONS_ID = "resume-matcher-run-actions";
const RUN_STATUS_ID = "resume-matcher-run-status";
const RUN_STATUS_ACTIONS_ID = "resume-matcher-run-status-actions";
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
const STORYBOARD_LABEL_ID = "resume-matcher-storyboard-label";
const STORYBOARD_INPUT_ID = "resume-matcher-storyboard-input";
const STORYBOARD_ACTION_ID = "resume-matcher-storyboard-action";
const ACCOUNT_ACTION_ID = "resume-matcher-account-action";
const PROVIDER_SELECT_ID = "resume-matcher-provider-select";
const PROVIDER_WEB_ROW_ID = "resume-matcher-provider-web-row";
const PROVIDER_WEB_INPUT_ID = "resume-matcher-provider-web-input";
const PROVIDER_API_BASE_ROW_ID = "resume-matcher-provider-api-base-row";
const PROVIDER_API_BASE_INPUT_ID = "resume-matcher-provider-api-base-input";
const PROVIDER_API_GRID_ID = "resume-matcher-provider-api-grid";
const PROVIDER_MODEL_ROW_ID = "resume-matcher-provider-model-row";
const PROVIDER_MODEL_INPUT_ID = "resume-matcher-provider-model-input";
const PROVIDER_API_KEY_ROW_ID = "resume-matcher-provider-api-key-row";
const PROVIDER_API_KEY_INPUT_ID = "resume-matcher-provider-api-key-input";
const ONBOARDING_PROVIDER_API_KEY_INPUT_ID =
  "resume-matcher-onboarding-provider-api-key-input";
const APP_URL_INPUT_ID = "resume-matcher-app-url-input";
const API_URL_INPUT_ID = "resume-matcher-api-url-input";
const APIFY_ENABLED_INPUT_ID = "resume-matcher-apify-enabled";
const APIFY_TOKEN_ROW_ID = "resume-matcher-apify-token-row";
const APIFY_TOKEN_INPUT_ID = "resume-matcher-apify-token-input";
const APIFY_TOKEN_TOGGLE_ID = "resume-matcher-apify-token-toggle";
const ADVANCED_TOGGLE_ID = "resume-matcher-advanced-toggle";
const CUSTOM_FEATURE_INPUT_ID = "resume-matcher-custom-feature";
const RUNTIME_URLS_ROW_ID = "resume-matcher-runtime-urls";
const RESET_LOCAL_ID = "resume-matcher-reset-local";
const RESET_DEFAULTS_ID = "resume-matcher-reset-defaults";
const STYLE_ID = "resume-matcher-floating-style";
const POSITION_KEY = "resumeMatcherFloatingPosition";
const DISMISSED_KEY = "resumeMatcherFloatingButtonDismissed";
const ICON_PATH = "src/assets/rocket.png";
const STAR_ICON_PATH = "src/assets/star.png";
const UPLOAD_ICON_PATH = "src/assets/upload.png";
const DOWNLOAD_ICON_PATH = "src/assets/direct-download.png";
const DELETE_ICON_PATH = "src/assets/delete.png";
const LOG_PREFIX = "[ResumeMatcherExt][FloatingBoard]";
const EDGE_PADDING = 8;
const VIEWPORT_PADDING = 20;
const RUN_BOARD_WIDTH = 300;
const WIDE_BOARD_WIDTH = 390;
const JOB_LOAD_RETRY_MS = 300;
const JOB_LOAD_TIMEOUT_MS = 7000;
const EDGE_GAP_TOTAL = EDGE_PADDING * 2;
const APP_URL = "https://som-career-coach-iota.vercel.app/";
const STORY_BANK_GUIDE_URL = `${APP_URL}story-bank`;
const RUN_WAIT_MESSAGE_INTERVAL_MS = 12000;
const RUN_WAIT_MESSAGES = [
  "Reading the job post.",
  "Checking the latest job details.",
  "Looking for the full JD.",
  "Rechecking the page content.",
  "Trying a cleaner extraction path.",
  "Comparing the job signals.",
  "Preparing the role summary.",
  "Mapping the hiring priorities.",
  "Reviewing the core requirements.",
  "Pulling out the strongest signals.",
  "Checking the fallback path.",
  "Waiting on the model.",
  "Keeping the run alive.",
  "Still shaping the draft.",
  "Reviewing the current output.",
  "Cleaning the response.",
  "Comparing resume and JD.",
  "Refining the positioning.",
  "Building the tailored draft.",
  "Checking for missing details.",
  "Making the wording tighter.",
  "Keeping the format consistent.",
  "Replaying the next step.",
  "Waiting for web automation.",
  "Still working through the queue.",
  "Checking the generated sections.",
  "Keeping the draft coherent.",
  "Revalidating the result.",
  "Finalizing the current pass.",
  "Almost there.",
];
let adapterModulePromise = null;
let zipModulePromise = null;

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

const PROMPT_FILE_DESCRIPTORS = [
  {
    templateName: "prompt1",
    label: "Prompt 1 Analyze job description",
    defaultPath: "src/prompts/prompt1.txt",
    contractPath: "src/prompts/patches/prompt1.output-contract.txt",
    promptFileName: "prompt1.txt",
    contractFileName: "prompt1.output-contract.txt",
    downloadName: "prompt1.default.zip",
  },
  {
    templateName: "prompt2",
    label: "Prompt 2 Strategize positioning",
    defaultPath: "src/prompts/prompt2.txt",
    contractPath: "src/prompts/patches/prompt2.output-contract.txt",
    promptFileName: "prompt2.txt",
    contractFileName: "prompt2.output-contract.txt",
    downloadName: "prompt2.default.zip",
  },
  {
    templateName: "prompt3",
    label: "Prompt 3 Write tailored resume",
    defaultPath: "src/prompts/prompt3.txt",
    contractPath: "src/prompts/patches/prompt3.output-contract.txt",
    promptFileName: "prompt3.txt",
    contractFileName: "prompt3.output-contract.txt",
    downloadName: "prompt3.default.zip",
  },
  {
    templateName: "systemPrompt",
    label: "System prompt API behavior guardrails",
    defaultPath: null,
    downloadName: null,
  },
];

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
};

let urlObserver = null;
let selectedJobDetailObserver = null;
let selectedJobDetailObservedRoot = null;
let lastUrl = location.href;
let pointerDragState = null;
let suppressNextClick = false;
let providerSettingsSaveTimer = null;
let runtimeUrlsSaveTimer = null;
let apifyFallbackSaveTimer = null;
let jobLoadTimer = null;
let selectedJobRefreshTimer = null;
let runningStatusMessageTimer = null;
let selectedJobClickListenerAttached = false;
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

const state = {
  boardOpen: false,
  currentView: "run",
  dismissed: false,
  dockSide: "right",
  launcherAlert: false,
  isRunning: false,
  awaitingAuth: false,
  awaitingStoryboard: false,
  statusTone: "neutral",
  statusTitle: "",
  statusDetail: "",
  rotatingStatusDetail: "",
  rotatingStatusIndex: -1,
  statusActions: [],
  assets: null,
  setupState: null,
  history: [],
  extensionState: null,
  connectionState: "signed_out",
  websiteAuthenticated: false,
  extensionConnected: false,
  jobLoadState: "idle",
  jobLoadStartedAt: null,
  customMessage: "",
  manualJobDescription: "",
  scrapeIssue: "",
  storyboardHelpOpen: false,
  currentJob: null,
  selectedJobRefreshing: false,
  selectedJobExpectedSourceUrl: "",
  selectedJobRefreshAttempts: 0,
  activeRunJob: null,
  historySearch: "",
  historySortDirection: "desc",
  historyPage: 1,
  historyFilterOpen: false,
};

function logInfo(message, data) {
  if (data === undefined) {
    console.info(`${LOG_PREFIX} ${message}`);
    return;
  }
  console.info(`${LOG_PREFIX} ${message}`, data);
}

function logError(message, data) {
  if (data === undefined) {
    console.error(`${LOG_PREFIX} ${message}`);
    return;
  }
  console.error(`${LOG_PREFIX} ${message}`, data);
}

function isLinkedInJobPage() {
  return (
    location.hostname === "www.linkedin.com" &&
    location.pathname.startsWith("/jobs/")
  );
}

function $(id) {
  return document.getElementById(id);
}

async function sendMessage(type, payload) {
  return chrome.runtime.sendMessage({ type, payload });
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

function maskSecret(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (normalized.length <= 6) {
    return `${normalized.slice(0, 1)}...${normalized.slice(-1)}`;
  }
  return `${normalized.slice(0, 3)}...${normalized.slice(-3)}`;
}

function getSecretPlaceholder(inputId) {
  if (inputId === APIFY_TOKEN_INPUT_ID) {
    return "Paste your Apify API token";
  }
  return "Paste new API key";
}

function getCurrentSecretValue(inputId) {
  if (inputId === APIFY_TOKEN_INPUT_ID) {
    return state.assets?.apifyFallbackSettings?.apiToken || "";
  }

  if (inputId === ONBOARDING_PROVIDER_API_KEY_INPUT_ID) {
    return (
      getSelectedProfile(
        "resume-matcher-onboarding-provider-select",
        state.assets?.llmSettings,
      )?.apiKey || ""
    );
  }

  return (
    getSelectedProfile(PROVIDER_SELECT_ID, state.assets?.llmSettings)?.apiKey ||
    ""
  );
}

function syncSecretInput(inputId) {
  const input = $(inputId);
  if (!(input instanceof HTMLInputElement)) return;

  const actualValue = getCurrentSecretValue(inputId);
  const isEditing = secretEditingState[inputId] === true;
  input.dataset.secretInput = "true";
  input.autocomplete = "off";
  input.spellcheck = false;

  if (isEditing) {
    input.type = "password";
    input.readOnly = false;
    input.placeholder = getSecretPlaceholder(inputId);
    input.value = secretDraftState[inputId] || "";
    return;
  }

  if (actualValue) {
    if (inputId === APIFY_TOKEN_INPUT_ID) {
      input.type = secretRevealState[inputId] === true ? "text" : "password";
      input.readOnly = true;
      input.placeholder = "";
      input.value = actualValue;
    } else {
      input.type = "text";
      input.readOnly = true;
      input.placeholder = "";
      input.value = maskSecret(actualValue);
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
  const actualValue = getCurrentSecretValue(inputId);
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
  secretDraftState[inputId] = "";
  secretRevealState[inputId] = false;
  syncSecretInput(inputId);
  syncSecretRevealToggle(inputId);
  const next = $(inputId);
  if (next instanceof HTMLInputElement) {
    next.focus();
  }
}

function endSecretEdit(inputId) {
  secretEditingState[inputId] = false;
  secretDraftState[inputId] = "";
  secretRevealState[inputId] = false;
  syncSecretInput(inputId);
  syncSecretRevealToggle(inputId);
}

function toggleSecretReveal(inputId) {
  if (inputId !== APIFY_TOKEN_INPUT_ID) return;
  if (secretEditingState[inputId] === true) return;
  if (!getCurrentSecretValue(inputId)) return;
  secretRevealState[inputId] = !secretRevealState[inputId];
  syncSecretInput(inputId);
  syncSecretRevealToggle(inputId);
}

function readSecretInputValue(inputId) {
  if (secretEditingState[inputId] === true) {
    return (secretDraftState[inputId] || "").trim();
  }
  return getCurrentSecretValue(inputId);
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
) {
  const downloadButton = canDownloadDefault
    ? `<button id="${promptDownloadId(templateName)}" type="button" class="resume-matcher-file-chip__action" aria-label="Download default ${label}" title="Download default ${label}"><img class="resume-matcher-file-chip__icon-image" src="${chrome.runtime.getURL(DOWNLOAD_ICON_PATH)}" alt="" /></button>`
    : "";
  return `${downloadButton}<button id="${promptActionId(templateName)}" type="button" class="resume-matcher-file-chip__action" aria-label="${hasFile ? `Delete ${label}` : `Upload ${label}`}" title="${hasFile ? `Delete ${label}` : `Upload ${label}`}">${renderFileActionIcon(hasFile ? "delete" : "upload")}</button>`;
}

function promptLabelId(templateName) {
  return `resume-matcher-${templateName}-label`;
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

async function downloadDefaultPrompt(templateName) {
  const descriptor = PROMPT_FILE_DESCRIPTORS.find(
    (item) => item.templateName === templateName,
  );
  if (
    !descriptor?.defaultPath ||
    !descriptor.contractPath ||
    !descriptor.downloadName ||
    !descriptor.promptFileName ||
    !descriptor.contractFileName
  ) {
    return;
  }

  const [promptResponse, contractResponse] = await Promise.all([
    fetch(chrome.runtime.getURL(descriptor.defaultPath)),
    fetch(chrome.runtime.getURL(descriptor.contractPath)),
  ]);

  if (!promptResponse.ok) {
    throw new Error(`Failed to load default ${descriptor.label}.`);
  }
  if (!contractResponse.ok) {
    throw new Error(`Failed to load output contract for ${descriptor.label}.`);
  }

  const [promptText, rawContractText] = await Promise.all([
    promptResponse.text(),
    contractResponse.text(),
  ]);
  const { createZipArchive } = await loadZipModule();
  const contractText = [
    "Output contract note:",
    "- This contract is fixed in the extension code.",
    "- Changes to this file will not affect runtime behavior.",
    "- Upload .txt files only.",
    "- Upload only the main prompt file, not this contract file.",
    "- To tailor the tool, edit the main prompt instead.",
    "",
    rawContractText.trim(),
  ].join("\n");
  const archive = createZipArchive([
    { name: descriptor.promptFileName, content: promptText },
    { name: descriptor.contractFileName, content: contractText },
  ]);
  const blob = new Blob([archive], { type: "application/zip" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = descriptor.downloadName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

function injectStyles() {
  if ($(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${ROOT_ID} {
      position: fixed;
      left: auto;
      right: calc(env(safe-area-inset-right, 0px) + ${EDGE_PADDING}px);
      top: 50vh;
      z-index: 2147483647;
      display: grid;
      justify-items: start;
      width: auto;
      background: transparent;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #1f2937;
      user-select: none;
      transition: left 180ms ease, top 180ms ease;
      will-change: left, top;
    }

    #${ROOT_ID}[data-hidden="true"] {
      display: none;
    }

    #${ROOT_ID} [hidden] {
      display: none !important;
    }

    #${ROOT_ID}[data-dragging="true"] {
      transition: none;
    }

    #${LAUNCHER_ID} {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 78px;
      height: 78px;
      border-radius: 26px;
      border: 1px solid rgba(255, 255, 255, 0.78);
      background:
        linear-gradient(180deg, rgba(211, 231, 247, 0.82), rgba(224, 237, 248, 0.78)),
        rgba(215, 231, 246, 0.72);
      box-shadow:
        -8px 18px 28px rgba(15, 23, 42, 0.08),
        inset 0 1px 1px rgba(255, 255, 255, 0.82);
      backdrop-filter: blur(24px) saturate(145%);
      -webkit-backdrop-filter: blur(24px) saturate(145%);
      cursor: grab;
      transition: transform 140ms ease, box-shadow 140ms ease;
      overflow: visible;
    }

    #${LAUNCHER_ID}::before {
      content: '';
      position: absolute;
      width: 96px;
      height: 96px;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      border-radius: 999px;
      background: conic-gradient(
        from 0deg at 50% 50%,
        rgba(59, 130, 246, 0) 0deg,
        rgba(59, 130, 246, 0) 220deg,
        rgba(56, 189, 248, 0.18) 265deg,
        rgba(96, 165, 250, 0.8) 312deg,
        rgba(125, 211, 252, 0.34) 344deg,
        rgba(59, 130, 246, 0) 360deg
      );
      -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px));
      mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px));
      opacity: 0;
      pointer-events: none;
      filter: drop-shadow(0 0 14px rgba(96, 165, 250, 0.28));
    }

    #${ROOT_ID}[data-running="true"][data-board-open="false"] #${LAUNCHER_ID}::before {
      opacity: 1;
      animation: resume-matcher-launcher-ring 1.4s linear infinite;
    }

    #${ROOT_ID}[data-board-open="true"] #${LAUNCHER_ID} {
      display: none;
    }

    #${LAUNCHER_ID}:hover {
      transform: translateY(-1px);
      box-shadow:
        -10px 20px 30px rgba(15, 23, 42, 0.1),
        inset 0 1px 1px rgba(255, 255, 255, 0.84);
    }

    #${ROOT_ID}[data-dock-side="left"] #${LAUNCHER_ID} {
      box-shadow:
        8px 18px 28px rgba(15, 23, 42, 0.08),
        inset 0 1px 1px rgba(255, 255, 255, 0.82);
    }

    #${ROOT_ID}[data-dock-side="left"] #${LAUNCHER_ID}:hover {
      box-shadow:
        10px 20px 30px rgba(15, 23, 42, 0.1),
        inset 0 1px 1px rgba(255, 255, 255, 0.84);
    }

    #${LAUNCHER_ID}:active {
      cursor: grabbing;
    }

    #${LAUNCHER_ID} img {
      display: block;
      width: 42px;
      height: 42px;
      object-fit: contain;
      pointer-events: none;
    }

    #${LAUNCHER_CLOSE_ID} {
      position: absolute;
      top: -8px;
      right: -8px;
      display: none;
      width: 24px;
      height: 24px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.88);
      background: rgba(255, 255, 255, 0.92);
      color: rgba(0, 0, 0, 0.56);
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.12);
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font: inherit;
      font-size: 14px;
      line-height: 1;
      padding: 0;
    }

    #${LAUNCHER_ID}:hover #${LAUNCHER_CLOSE_ID} {
      display: inline-flex;
    }

    #${LAUNCHER_ALERT_ID} {
      position: absolute;
      right: -6px;
      bottom: -6px;
      display: none;
      min-width: 22px;
      height: 22px;
      padding: 0 4px;
      border-radius: 999px;
      background: #ef4444;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      line-height: 22px;
      text-align: center;
      box-shadow: 0 8px 18px rgba(127, 29, 29, 0.22);
    }

    #${ROOT_ID}[data-alert="true"] #${LAUNCHER_ALERT_ID} {
      display: block;
    }

    #${ROOT_ID}[data-dragging="true"][data-dock-preview="left"] #${BOARD_ID},
    #${ROOT_ID}[data-dragging="true"][data-dock-preview="left"] #${LAUNCHER_ID} {
      box-shadow:
        0 22px 42px rgba(15, 23, 42, 0.12),
        inset 3px 0 0 rgba(0, 122, 255, 0.16),
        inset 0 1px 1px rgba(255, 255, 255, 0.84);
    }

    #${ROOT_ID}[data-dragging="true"][data-dock-preview="right"] #${BOARD_ID},
    #${ROOT_ID}[data-dragging="true"][data-dock-preview="right"] #${LAUNCHER_ID} {
      box-shadow:
        0 22px 42px rgba(15, 23, 42, 0.12),
        inset -3px 0 0 rgba(0, 122, 255, 0.16),
        inset 0 1px 1px rgba(255, 255, 255, 0.84);
    }

    #${BOARD_ID} {
      display: none;
      grid-template-rows: auto 1fr;
      width: min(${RUN_BOARD_WIDTH}px, calc(100vw - ${EDGE_GAP_TOTAL}px));
      max-width: calc(100vw - ${EDGE_GAP_TOTAL}px);
      max-height: min(76vh, 680px);
      overflow: hidden;
      border-radius: 24px;
      border: 1px solid rgba(255, 255, 255, 0.76);
      background:
        linear-gradient(180deg, rgba(211, 231, 247, 0.76), rgba(224, 237, 248, 0.72)),
        rgba(215, 231, 246, 0.64);
      box-shadow:
        -10px 24px 34px rgba(0, 0, 0, 0.08),
        inset 0 1px 1px rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(30px) saturate(150%);
      -webkit-backdrop-filter: blur(30px) saturate(150%);
    }

    #${ROOT_ID}[data-current-view="settings"] #${BOARD_ID},
    #${ROOT_ID}[data-onboarding-mode="true"] #${BOARD_ID} {
      width: min(${WIDE_BOARD_WIDTH}px, calc(100vw - ${EDGE_GAP_TOTAL}px));
    }

    #${ROOT_ID}[data-board-open="true"] #${BOARD_ID} {
      display: grid;
    }

    #${ROOT_ID}[data-dock-side="left"] #${BOARD_ID} {
      box-shadow:
        10px 24px 34px rgba(0, 0, 0, 0.08),
        inset 0 1px 1px rgba(255, 255, 255, 0.8);
    }

    .resume-matcher-board__header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 8px;
      padding: 12px 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.52);
      background:
        linear-gradient(to bottom, rgba(255, 255, 255, 0.58), rgba(255, 255, 255, 0.24)),
        rgba(255, 255, 255, 0.12);
      box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.35);
      cursor: grab;
    }

    .resume-matcher-board__header:active {
      cursor: grabbing;
    }

    .resume-matcher-board__brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .resume-matcher-board__logo {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 0;
      background: transparent;
      cursor: pointer;
      flex: 0 0 auto;
    }

    .resume-matcher-board__brand img {
      width: 22px;
      height: 22px;
      object-fit: contain;
    }

    .resume-matcher-board__brand-text {
      display: grid;
      gap: 0;
      min-width: 0;
      text-align: left;
    }

    .resume-matcher-board__brand-link {
      display: inline-flex;
      align-items: center;
      padding: 0;
      border: 0;
      background: transparent;
      cursor: pointer;
      text-align: left;
      font: inherit;
    }

    .resume-matcher-board__title {
      font-size: 15px;
      font-weight: 700;
      line-height: 1.05;
      color: rgba(0, 0, 0, 0.88);
      letter-spacing: -0.03em;
      white-space: nowrap;
    }

    .resume-matcher-board__subtitle { display: none; }

    .resume-matcher-board__header-actions {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .resume-matcher-icon-button {
      width: 28px;
      height: 28px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.68);
      background: rgba(255, 255, 255, 0.34);
      color: rgba(0, 0, 0, 0.64);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      padding: 0;
      box-shadow: 0 6px 16px rgba(15, 23, 42, 0.04);
      font: inherit;
      font-size: 0;
      opacity: 1;
      position: relative;
      transition:
        background 140ms ease,
        color 140ms ease,
        transform 140ms ease,
        border-color 140ms ease,
        box-shadow 140ms ease;
    }

    .resume-matcher-icon-button:hover {
      background: rgba(255, 255, 255, 0.52);
      border-color: rgba(255, 255, 255, 0.82);
      color: rgba(0, 0, 0, 0.84);
      transform: translateY(-0.5px);
    }

    .resume-matcher-icon-button svg,
    .resume-matcher-icon-button img,
    .resume-matcher-board__subtitle svg {
      width: 15px;
      height: 15px;
      display: block;
    }

    .resume-matcher-icon-button.is-active {
      color: rgba(0, 0, 0, 0.85);
      background: linear-gradient(
        180deg,
        rgba(255, 255, 255, 0.78),
        rgba(255, 255, 255, 0.54)
      );
      border-color: rgba(255, 255, 255, 0.92);
      box-shadow:
        0 0 0 1px rgba(255, 255, 255, 0.18),
        0 0 18px rgba(59, 130, 246, 0.22),
        0 8px 18px rgba(15, 23, 42, 0.08);
      transform: translateY(-0.5px);
      opacity: 1;
    }

    .resume-matcher-icon-button.is-active::after {
      content: "";
      position: absolute;
      inset: -3px;
      border-radius: 999px;
      border: 1px solid rgba(96, 165, 250, 0.42);
      box-shadow: 0 0 14px rgba(96, 165, 250, 0.14);
      pointer-events: none;
    }

    .resume-matcher-board__body {
      min-height: 0;
      overflow: auto;
      padding: 0;
      display: grid;
      gap: 0;
    }

    .resume-matcher-view {
      display: none;
      padding: 12px 14px 14px;
      gap: 12px;
    }

    .resume-matcher-view.is-active {
      display: grid;
    }

    .resume-matcher-section,
    .resume-matcher-history-item,
    .resume-matcher-settings-group {
      border-radius: 18px;
      border: 1px solid rgba(255, 255, 255, 0.72);
      background: rgba(255, 255, 255, 0.56);
      backdrop-filter: blur(16px) saturate(140%);
      -webkit-backdrop-filter: blur(16px) saturate(140%);
      box-shadow: 0 14px 28px rgba(15, 23, 42, 0.06);
      padding: 12px;
    }

    .resume-matcher-run-shell {
      border-radius: 0;
      border: none;
      background: transparent;
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
      box-shadow: none;
      overflow: visible;
    }

    .resume-matcher-run-shell__body {
      padding: 0;
      display: grid;
      gap: 14px;
    }

    .resume-matcher-run-job {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }

    .resume-matcher-run-job__title {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: -0.05em;
      color: rgba(17, 24, 39, 0.92);
      padding-right: 8px;
    }

    .resume-matcher-run-ready {
      width: 24px;
      height: 24px;
      flex: 0 0 auto;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #34c759;
      color: #ffffff;
      font-size: 12px;
      font-weight: 800;
      box-shadow: 0 4px 10px rgba(52, 199, 89, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.4);
    }

    .resume-matcher-run-ready.is-muted {
      background: rgba(255, 255, 255, 0.4);
      color: rgba(0, 0, 0, 0.6);
      box-shadow: inset 0 1px 1px rgba(255,255,255,0.45);
    }

    .resume-matcher-run-ready.is-loading {
      background: rgba(14, 165, 233, 0.2);
      color: rgba(3, 105, 161, 0.96);
      box-shadow: 0 4px 10px rgba(14, 165, 233, 0.16), inset 0 1px 1px rgba(255,255,255,0.4);
    }

    .resume-matcher-run-ready.is-warning {
      background: rgba(255, 168, 48, 0.92);
      color: rgba(123, 52, 16, 0.98);
      box-shadow: 0 4px 10px rgba(234, 120, 21, 0.24), inset 0 1px 1px rgba(255, 255, 255, 0.28);
    }

    .resume-matcher-run-ready.is-error {
      background: rgba(255, 79, 79, 0.92);
      color: #ffffff;
      box-shadow: 0 4px 10px rgba(220, 38, 38, 0.24), inset 0 1px 1px rgba(255, 255, 255, 0.22);
    }

    .resume-matcher-run-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      font-size: 15px;
      line-height: 1.4;
      color: rgba(0, 0, 0, 0.72);
      margin-top: -4px;
    }

    .resume-matcher-run-meta strong {
      color: rgba(0, 0, 0, 0.85);
      font-weight: 600;
    }

    .resume-matcher-run-meta__bullet {
      color: rgba(0, 0, 0, 0.35);
      font-size: 10px;
    }

    .resume-matcher-onboarding {
      display: grid;
      gap: 14px;
      padding: 16px;
      border-radius: 22px;
      border: 1px solid rgba(255, 255, 255, 0.72);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.7), rgba(245, 248, 255, 0.92)),
        rgba(255, 255, 255, 0.6);
      box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.55);
    }

    .resume-matcher-onboarding__progress {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }

    .resume-matcher-onboarding__progress-step {
      display: grid;
      gap: 4px;
      min-width: 0;
    }

    .resume-matcher-onboarding__progress-bar {
      height: 4px;
      border-radius: 999px;
      background: rgba(148, 163, 184, 0.18);
      overflow: hidden;
    }

    .resume-matcher-onboarding__progress-bar::after {
      content: "";
      display: block;
      width: 100%;
      height: 100%;
      border-radius: inherit;
      background: rgba(148, 163, 184, 0.3);
      transform: scaleX(0.42);
      transform-origin: left center;
    }

    .resume-matcher-onboarding__progress-step.is-active .resume-matcher-onboarding__progress-bar::after,
    .resume-matcher-onboarding__progress-step.is-complete .resume-matcher-onboarding__progress-bar::after {
      transform: scaleX(1);
      background: linear-gradient(90deg, #8e2247, #c04e77);
    }

    .resume-matcher-onboarding__progress-label {
      min-width: 0;
      font-size: 11px;
      line-height: 1.25;
      color: rgba(0, 0, 0, 0.42);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .resume-matcher-onboarding__progress-step.is-active .resume-matcher-onboarding__progress-label,
    .resume-matcher-onboarding__progress-step.is-complete .resume-matcher-onboarding__progress-label {
      color: #5b1a30;
    }

    .resume-matcher-onboarding__eyebrow {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: rgba(0, 0, 0, 0.48);
    }

    .resume-matcher-onboarding__title {
      font-size: 26px;
      line-height: 1.02;
      letter-spacing: -0.06em;
      font-weight: 700;
      color: rgba(17, 24, 39, 0.94);
    }

    .resume-matcher-onboarding__text,
    .resume-matcher-onboarding__list,
    .resume-matcher-onboarding__help {
      font-size: 14px;
      line-height: 1.45;
      color: rgba(0, 0, 0, 0.7);
      margin: 0;
    }

    .resume-matcher-onboarding__help--subtle {
      font-size: 12px;
      color: rgba(71, 85, 105, 0.82);
      font-style: italic;
    }

    .resume-matcher-onboarding__list {
      padding-left: 18px;
    }

    .resume-matcher-onboarding__badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(52, 199, 89, 0.14);
      color: rgba(22, 101, 52, 0.95);
      font-size: 13px;
      font-weight: 700;
    }

    .resume-matcher-onboarding__status-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 24px;
      padding: 0 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      border: 1px solid rgba(15, 23, 42, 0.08);
      background: rgba(255, 255, 255, 0.76);
      color: rgba(17, 24, 39, 0.62);
    }

    .resume-matcher-onboarding__status-pill.is-required {
      background: rgba(249, 115, 22, 0.12);
      color: rgba(154, 52, 18, 0.94);
      border-color: rgba(249, 115, 22, 0.22);
    }

    .resume-matcher-onboarding__status-pill.is-optional {
      background: rgba(255, 255, 255, 0.76);
      color: rgba(17, 24, 39, 0.52);
    }

    .resume-matcher-onboarding__status-pill.is-complete {
      background: rgba(52, 199, 89, 0.14);
      color: rgba(22, 101, 52, 0.95);
      border-color: rgba(52, 199, 89, 0.18);
    }

    .resume-matcher-onboarding__row {
      display: grid;
      gap: 10px;
    }

    .resume-matcher-onboarding__file {
      display: grid;
      gap: 8px;
    }

    .resume-matcher-onboarding__file-top,
    .resume-matcher-onboarding__provider-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .resume-matcher-onboarding__label {
      font-size: 13px;
      font-weight: 700;
      color: rgba(0, 0, 0, 0.82);
      min-width: 0;
    }

    .resume-matcher-onboarding__status {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.54);
      min-width: 0;
      max-width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .resume-matcher-onboarding__link {
      appearance: none;
      border: none;
      background: transparent;
      padding: 0;
      color: rgba(0, 122, 255, 0.92);
      width: 18px;
      height: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    .resume-matcher-onboarding__link svg {
      width: 18px;
      height: 18px;
      display: block;
    }

    .resume-matcher-onboarding__provider-grid {
      display: grid;
      gap: 10px;
    }

    .resume-matcher-onboarding__provider-grid .resume-matcher-field select,
    .resume-matcher-onboarding__provider-grid .resume-matcher-field input {
      min-height: 44px;
      padding: 10px 14px;
      border-radius: 14px;
      border: 1px solid rgba(231, 197, 207, 0.96);
      background: rgba(255, 252, 252, 0.94);
      color: #4c1d2d;
      font-size: 13px;
      line-height: 1.3;
      box-shadow: inset 0 1px 2px rgba(91, 26, 48, 0.04);
    }

    .resume-matcher-onboarding__provider-grid .resume-matcher-field select {
      padding-right: 38px;
    }

    .resume-matcher-onboarding__provider-grid .resume-matcher-field select:focus,
    .resume-matcher-onboarding__provider-grid .resume-matcher-field input:focus {
      outline: none;
      border-color: rgba(152, 35, 72, 0.72);
      box-shadow:
        0 0 0 3px rgba(168, 85, 110, 0.14),
        inset 0 1px 2px rgba(91, 26, 48, 0.04);
    }

    .resume-matcher-onboarding__provider-grid .resume-matcher-field select option {
      color: #4c1d2d;
      background: #ffffff;
    }

    .resume-matcher-onboarding__provider-note {
      margin: 0;
      padding: 10px 12px;
      border-radius: 14px;
      border: 1px solid rgba(15, 23, 42, 0.06);
      background: rgba(255, 255, 255, 0.72);
      font-size: 12px;
      line-height: 1.4;
      color: rgba(17, 24, 39, 0.64);
    }

    .resume-matcher-onboarding__provider-note strong {
      color: rgba(17, 24, 39, 0.84);
    }

    .resume-matcher-onboarding__actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    .resume-matcher-field {
      display: grid;
      gap: 4px;
    }

    .resume-matcher-field label {
      font-size: 10px;
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #667085;
    }

    .resume-matcher-run-shell .resume-matcher-field label {
      display: none;
    }

    .resume-matcher-field input,
    .resume-matcher-field textarea,
    .resume-matcher-field select,
    .resume-matcher-file-display {
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      border-radius: 14px;
      border: 1px solid rgba(216, 206, 187, 0.96);
      background: #ffffff;
      color: #1f2937;
      padding: 11px 12px;
      font: inherit;
      font-size: 13px;
      line-height: 1.4;
    }

    .resume-matcher-field select,
    .resume-matcher-settings-item select {
      appearance: none;
      -webkit-appearance: none;
      background-image:
        linear-gradient(45deg, transparent 50%, rgba(71, 85, 105, 0.82) 50%),
        linear-gradient(135deg, rgba(71, 85, 105, 0.82) 50%, transparent 50%);
      background-position:
        calc(100% - 18px) calc(50% - 2px),
        calc(100% - 12px) calc(50% - 2px);
      background-size: 6px 6px, 6px 6px;
      background-repeat: no-repeat;
      padding-right: 34px;
      color: #1f2937;
    }

    .resume-matcher-field select option,
    .resume-matcher-settings-item select option {
      color: #1f2937;
      background: #ffffff;
    }

    .resume-matcher-field textarea {
      resize: none;
      overflow-y: hidden;
      min-height: 86px;
      padding-top: 14px;
      padding-bottom: 14px;
      line-height: 1.45;
    }

    .resume-matcher-run-shell .resume-matcher-field input,
    .resume-matcher-run-shell .resume-matcher-field textarea {
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.84);
      background: rgba(255, 255, 255, 0.72);
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.03);
      color: rgba(0, 0, 0, 0.82);
    }

    .resume-matcher-field input::placeholder,
    .resume-matcher-field textarea::placeholder {
      color: rgba(0, 0, 0, 0.56);
    }

    .resume-matcher-field input:focus,
    .resume-matcher-field textarea:focus,
    .resume-matcher-field select:focus {
      outline: none;
      border-color: rgba(147, 197, 253, 0.95);
      box-shadow: 0 0 0 3px rgba(219, 234, 254, 0.8);
    }

    .resume-matcher-run-shell .resume-matcher-field input:focus,
    .resume-matcher-run-shell .resume-matcher-field textarea:focus {
      background: rgba(255, 255, 255, 0.84);
      border-color: rgba(0, 122, 255, 0.4);
      box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15);
    }

    .resume-matcher-field__hint {
      font-size: 12px;
      line-height: 1.4;
      color: rgba(0, 0, 0, 0.62);
      margin-top: 4px;
    }

    .resume-matcher-file-row {
      display: block;
    }

    .resume-matcher-file-chip {
      min-height: 38px;
      border-radius: 999px;
      border: 1px solid rgba(216, 206, 187, 0.96);
      background: rgba(255, 255, 255, 0.86);
      padding: 0 6px 0 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-width: 0;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      overflow: hidden;
      color: #1f2937;
      font-size: 12px;
      line-height: 1.2;
    }

    .resume-matcher-file-chip.is-placeholder {
      color: #98a2b3;
    }

    .resume-matcher-file-chip__text {
      display: block;
      flex: 1 1 0%;
      min-width: 0;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .resume-matcher-file-chip__actions {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      flex: 0 0 auto;
    }

    .resume-matcher-file-chip__action {
      width: 28px;
      min-width: 28px;
      min-height: 28px;
      padding: 0;
      border-radius: 999px;
      border: none;
      background: transparent;
      color: #344054;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex: 0 0 auto;
    }

    .resume-matcher-file-chip__action:hover {
      background: rgba(15, 23, 42, 0.06);
    }

    .resume-matcher-file-chip__action .resume-matcher-button__icon {
      width: 16px;
      height: 16px;
    }

    .resume-matcher-file-chip__icon-image {
      width: 14px;
      height: 14px;
      display: block;
      opacity: 0.82;
    }

    .resume-matcher-file-input {
      display: none;
    }

    .resume-matcher-file-display {
      min-height: 44px;
      display: flex;
      align-items: center;
      color: #1f2937;
    }

    .resume-matcher-file-display.is-placeholder {
      color: #98a2b3;
    }

    .resume-matcher-button-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    .resume-matcher-button {
      appearance: none;
      box-sizing: border-box;
      border: 1px solid rgba(216, 206, 187, 0.96);
      border-radius: 999px;
      background: #ffffff;
      color: #344054;
      padding: 10px 14px;
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      line-height: 1;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-width: 0;
      min-height: 40px;
    }

    .resume-matcher-button__icon {
      width: 16px;
      height: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
    }

    .resume-matcher-button__icon svg {
      width: 16px;
      height: 16px;
      display: block;
    }

    .resume-matcher-button__icon--google {
      width: 13px;
      height: 13px;
    }

    .resume-matcher-button__icon--google svg {
      width: 13px;
      height: 13px;
    }

    .resume-matcher-button.is-primary {
      border-color: rgba(147, 197, 253, 0.96);
      background: #2563eb;
      color: #ffffff;
      box-shadow: 0 10px 24px rgba(37, 99, 235, 0.2);
    }

    .resume-matcher-run-shell .resume-matcher-button {
      border-radius: 20px;
      min-height: 48px;
      padding: 0 18px;
      font-size: 14px;
    }

    .resume-matcher-run-shell .resume-matcher-button.is-primary {
      background: #007aff;
      border-color: rgba(0, 122, 255, 0.18);
      box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
    }

    .resume-matcher-run-shell .resume-matcher-button:not(.is-primary) {
      background: rgba(255, 255, 255, 0.72);
      border-color: rgba(255, 255, 255, 0.84);
      color: rgba(0, 0, 0, 0.82);
      box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08);
    }

    .resume-matcher-run-shell .resume-matcher-button-row {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: nowrap;
    }

    .resume-matcher-run-shell .resume-matcher-button-row.is-hidden {
      display: none;
    }

    .resume-matcher-run-shell .resume-matcher-button.is-primary {
      flex: 1;
    }

    .resume-matcher-button.is-danger {
      color: #b42318;
    }

    .resume-matcher-button:disabled {
      cursor: default;
      opacity: 0.55;
      box-shadow: none;
    }

    #${ROOT_ID}[data-running="true"] .resume-matcher-field textarea:disabled,
    #${ROOT_ID}[data-running="true"] .resume-matcher-field input:disabled,
    #${ROOT_ID}[data-running="true"] .resume-matcher-field select:disabled {
      cursor: default;
      opacity: 0.78;
    }

    .resume-matcher-status-card {
      display: none;
      gap: 4px;
      color: #4a2333;
      border-radius: 12px;
      padding: 16px;
      border: 1px solid rgba(255, 255, 255, 0.6);
      background: rgba(255, 255, 255, 0.5);
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      line-height: 1.4;
    }

    .resume-matcher-status-card.is-visible {
      display: grid;
    }

    .resume-matcher-status-card[data-tone="error"] {
      background: rgba(255, 214, 214, 0.5);
      color: #a01f1f;
    }

    .resume-matcher-status-card[data-tone="running"] {
      background: rgba(255, 255, 255, 0.5);
      color: #4a2333;
    }

    .resume-matcher-status-card[data-tone="success"] {
      background: rgba(167, 215, 193, 0.4);
      color: #1a5a38;
    }

    .resume-matcher-status-card[data-tone="blocked"] {
      background: rgba(252, 227, 200, 0.5);
      color: #7a4b1a;
    }

    .resume-matcher-status-card[data-tone="warning"] {
      background: rgba(252, 227, 200, 0.5);
      color: #7a4b1a;
    }

    .resume-matcher-status-card[data-tone="info"] {
      background: rgba(255, 255, 255, 0.5);
      color: #4a2333;
    }

    .resume-matcher-status-card[data-tone="neutral"] {
      background: rgba(255, 255, 255, 0.5);
      color: #4a2333;
    }

    .resume-matcher-status-card[data-tone="idle"] {
      background: rgba(255, 255, 255, 0.5);
      color: #4a2333;
    }

    .resume-matcher-status-title {
      font-size: 16px;
      font-weight: 700;
      color: inherit;
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 4px;
    }

    .resume-matcher-status-detail {
      font-size: 14px;
      line-height: 1.4;
      color: inherit;
      opacity: 0.92;
      overflow-wrap: anywhere;
    }

    .resume-matcher-status-spinner {
      width: 14px;
      height: 14px;
      flex: 0 0 auto;
      border-radius: 999px;
      border: 2px solid rgba(74, 35, 51, 0.2);
      border-top-color: currentColor;
      animation: resume-matcher-spin 0.85s linear infinite;
    }

    @keyframes resume-matcher-spin {
      to {
        transform: rotate(360deg);
      }
    }

    @keyframes resume-matcher-launcher-ring {
      to {
        transform: translate(-50%, -50%) rotate(360deg);
      }
    }

    .resume-matcher-history-list {
      display: grid;
      gap: 8px;
    }

    .resume-matcher-history-toolbar {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 6px;
    }

    .resume-matcher-history-search {
      position: relative;
      flex: 1 1 auto;
      min-width: 0;
    }

    .resume-matcher-history-search input {
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      height: 42px;
      border-radius: 14px;
      border: 1px solid rgba(255, 255, 255, 0.9);
      background: rgba(255, 255, 255, 0.82);
      box-shadow:
        inset 0 1px 3px rgba(0, 0, 0, 0.02),
        0 10px 22px rgba(15, 23, 42, 0.04);
      color: rgba(0, 0, 0, 0.82);
      padding: 0 52px 0 16px;
      font: inherit;
      font-size: 13px;
      line-height: 1.3;
    }

    .resume-matcher-history-search input::placeholder {
      color: rgba(0, 0, 0, 0.56);
    }

    .resume-matcher-history-search input:focus {
      outline: none;
      background: rgba(255, 255, 255, 0.92);
      border-color: rgba(0, 122, 255, 0.4);
      box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15);
    }

    .resume-matcher-history-filter {
      position: absolute;
      top: 50%;
      right: 6px;
      transform: translateY(-50%);
      z-index: 1;
    }

    .resume-matcher-history-filter__button {
      width: 32px;
      height: 32px;
      border-radius: 10px;
      border: none;
      background: rgba(248, 250, 252, 0.9);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: rgba(0, 0, 0, 0.72);
      cursor: pointer;
      box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.18);
      padding: 0;
    }

    .resume-matcher-history-filter__button:hover {
      background: rgba(255, 255, 255, 0.98);
    }

    .resume-matcher-history-filter__button svg {
      width: 14px;
      height: 14px;
    }

    .resume-matcher-history-filter__menu {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      z-index: 2;
      min-width: 132px;
      display: none;
      grid-template-columns: 1fr;
      gap: 4px;
      padding: 6px;
      border-radius: 14px;
      border: 1px solid rgba(255, 255, 255, 0.84);
      background: rgba(255, 255, 255, 0.9);
      box-shadow: 0 14px 28px rgba(15, 23, 42, 0.12);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
    }

    .resume-matcher-history-filter[data-open="true"] .resume-matcher-history-filter__menu {
      display: grid;
    }

    .resume-matcher-history-filter__option {
      appearance: none;
      border: none;
      border-radius: 10px;
      background: transparent;
      color: #344054;
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      text-align: left;
      padding: 8px 10px;
      cursor: pointer;
    }

    .resume-matcher-history-filter__option:hover,
    .resume-matcher-history-filter__option.is-active {
      background: rgba(0, 122, 255, 0.1);
      color: #0b63ce;
    }

    .resume-matcher-history-item {
      display: grid;
      gap: 10px;
      border-radius: 20px;
      border: 1px solid rgba(255, 255, 255, 0.78);
      background: rgba(255, 255, 255, 0.68);
      box-shadow: 0 16px 30px rgba(15, 23, 42, 0.06);
      padding: 14px 16px;
    }

    .resume-matcher-history-item__top {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      align-items: start;
      gap: 6px;
      min-width: 0;
    }

    .resume-matcher-history-item__title,
    .resume-matcher-history-item__title-button {
      font-size: 13px;
      font-weight: 700;
      line-height: 1.3;
      color: #1f2937;
    }

    .resume-matcher-history-item__title-button {
      appearance: none;
      border: none;
      background: transparent;
      padding: 0;
      text-align: left;
      cursor: pointer;
      width: fit-content;
      max-width: 100%;
      text-wrap: balance;
    }

    .resume-matcher-history-item__title-button:hover {
      color: #0f4e99;
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    .resume-matcher-history-item__company {
      font-size: 12px;
      line-height: 1.35;
      color: #475467;
    }

    .resume-matcher-history-item__meta {
      font-size: 11px;
      line-height: 1.3;
      color: #667085;
    }

    .resume-matcher-history-item__footer {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 12px;
    }

    .resume-matcher-history-item__link {
      color: #1f6fe5;
      font-size: 12px;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
      white-space: nowrap;
    }

    .resume-matcher-history-item__link:hover {
      text-decoration: underline;
    }

    .resume-matcher-history-pagination {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 12px;
      margin-top: 10px;
      color: #667085;
      font-size: 12px;
      font-weight: 600;
    }

    .resume-matcher-history-pagination button {
      appearance: none;
      width: 34px;
      height: 34px;
      border: 1px solid rgba(255, 255, 255, 0.88);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.78);
      color: #344054;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.02);
    }

    .resume-matcher-history-pagination button:disabled {
      opacity: 0.32;
      cursor: default;
    }

    .resume-matcher-history-pagination button svg {
      width: 16px;
      height: 16px;
    }

    .resume-matcher-history-pagination button:first-child {
      justify-self: start;
    }

    .resume-matcher-history-pagination button:last-child {
      justify-self: end;
    }

    .resume-matcher-history-pagination span {
      justify-self: center;
      font-size: 13px;
      color: #475467;
    }

    .resume-matcher-settings-stack {
      display: grid;
      gap: 10px;
    }

    .resume-matcher-settings-group {
      border-radius: 18px;
      border: 1px solid rgba(255, 255, 255, 0.72);
      background: rgba(255, 255, 255, 0.62);
      box-shadow: 0 14px 28px rgba(15, 23, 42, 0.06);
      padding: 10px 12px 12px;
    }

    .resume-matcher-settings-title {
      margin: 0 0 10px;
      font-size: 10px;
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #667085;
    }

    .resume-matcher-settings-stack {
      display: grid;
      gap: 10px;
    }

    .resume-matcher-settings-list {
      display: grid;
      gap: 12px;
    }

    .resume-matcher-settings-item {
      display: grid;
      gap: 6px;
      min-width: 0;
    }

    .resume-matcher-settings-item__title {
      font-size: 10px;
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #667085;
    }

    .resume-matcher-settings-item__detail {
      font-size: 12px;
      line-height: 1.45;
      color: rgba(71, 85, 105, 0.86);
      margin-top: -2px;
    }

    .resume-matcher-settings-item__detail a {
      color: rgba(29, 78, 216, 0.92);
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .resume-matcher-settings-item__link {
      display: inline-flex;
      width: fit-content;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.3;
      color: rgba(154, 79, 103, 0.88);
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .resume-matcher-settings-substack {
      display: grid;
      gap: 8px;
      padding-top: 2px;
    }

    .resume-matcher-settings-substack--compact {
      gap: 4px;
      padding-top: 0;
    }

    .resume-matcher-settings-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .resume-matcher-settings-grid--single {
      grid-template-columns: minmax(0, 1fr);
    }

    .resume-matcher-settings-grid > .resume-matcher-field--full {
      grid-column: 1 / -1;
    }

    .resume-matcher-settings-row {
      display: grid;
      grid-template-columns: 82px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
    }

    .resume-matcher-settings-row + .resume-matcher-settings-row {
      margin-top: 8px;
    }

    .resume-matcher-settings-row__label {
      font-size: 11px;
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #667085;
    }

    .resume-matcher-settings-row__body {
      min-width: 0;
      display: grid;
      gap: 6px;
    }

    .resume-matcher-settings-item .resume-matcher-file-row {
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .resume-matcher-settings-item .resume-matcher-file-display,
    .resume-matcher-settings-item select,
    .resume-matcher-settings-item input {
      min-height: 38px;
      border-radius: 12px;
      border: 1px solid rgba(231, 197, 207, 0.96);
      background: rgba(255, 252, 252, 0.94);
      color: #4c1d2d;
      box-shadow: inset 0 1px 2px rgba(91, 26, 48, 0.04);
      padding: 9px 11px;
      font-size: 12px;
    }

    .resume-matcher-settings-item input:focus,
    .resume-matcher-settings-item select:focus,
    .resume-matcher-settings-row input:focus,
    .resume-matcher-settings-row select:focus,
    .resume-matcher-secret-field input:focus {
      outline: none;
      border-color: rgba(152, 35, 72, 0.72);
      box-shadow:
        0 0 0 3px rgba(168, 85, 110, 0.14),
        inset 0 1px 2px rgba(91, 26, 48, 0.04);
    }

    .resume-matcher-settings-item .resume-matcher-button,
    .resume-matcher-settings-group .resume-matcher-button {
      min-height: 36px;
      padding: 9px 12px;
      font-size: 12px;
    }

    .resume-matcher-google-connect {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 12px;
      flex-wrap: nowrap;
    }

    .resume-matcher-google-button {
      min-height: 34px;
      padding: 7px 16px;
      white-space: nowrap;
      flex: 0 0 auto;
    }

    .resume-matcher-settings-row .resume-matcher-file-row {
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .resume-matcher-settings-row .resume-matcher-file-display,
    .resume-matcher-settings-row select,
    .resume-matcher-settings-row input {
      min-height: 38px;
      border-radius: 12px;
      border: 1px solid rgba(231, 197, 207, 0.96);
      background: rgba(255, 252, 252, 0.94);
      color: #4c1d2d;
      box-shadow: inset 0 1px 2px rgba(91, 26, 48, 0.04);
      padding: 9px 11px;
      font-size: 12px;
    }

    .resume-matcher-secret-field {
      position: relative;
      display: grid;
      align-items: center;
    }

    .resume-matcher-secret-field input {
      padding-right: 42px !important;
    }

    .resume-matcher-secret-toggle {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      width: 28px;
      height: 28px;
      border: none;
      border-radius: 999px;
      background: transparent;
      color: rgba(111, 58, 76, 0.72);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      padding: 0;
    }

    .resume-matcher-secret-toggle:hover {
      background: rgba(127, 29, 63, 0.08);
      color: rgba(91, 26, 48, 0.92);
    }

    .resume-matcher-secret-toggle:focus-visible {
      outline: none;
      background: rgba(127, 29, 63, 0.1);
      box-shadow: 0 0 0 3px rgba(168, 85, 110, 0.14);
      color: rgba(91, 26, 48, 0.92);
    }

    .resume-matcher-secret-toggle svg {
      width: 16px;
      height: 16px;
      display: block;
    }

    .resume-matcher-settings-row .resume-matcher-button,
    .resume-matcher-settings-group .resume-matcher-button {
      min-height: 36px;
      padding: 9px 12px;
      font-size: 12px;
    }

    .resume-matcher-settings-row .resume-matcher-button-row {
      flex-wrap: nowrap;
    }

    .resume-matcher-inline-action {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      font-size: 12px;
      color: #667085;
      min-width: 0;
      min-height: 38px;
    }

    .resume-matcher-inline-action--compact {
      min-height: 30px;
    }

    .resume-matcher-checkbox {
      position: absolute;
      opacity: 0;
      pointer-events: none;
      width: 0;
      height: 0;
    }

    .resume-matcher-inline-action__label {
      display: inline-flex;
      align-items: center;
      cursor: pointer;
      min-width: 0;
      font-size: 13px;
      font-weight: 600;
      color: rgba(91, 26, 48, 0.84);
    }

    .resume-matcher-toggle {
      position: relative;
      width: 38px;
      height: 22px;
      border-radius: 999px;
      background: rgba(148, 163, 184, 0.36);
      box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.16);
      flex: 0 0 auto;
      transition: background 140ms ease;
    }

    .resume-matcher-toggle::after {
      content: "";
      position: absolute;
      top: 2px;
      left: 2px;
      width: 18px;
      height: 18px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.98);
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.18);
      transition: transform 140ms ease;
    }

    .resume-matcher-checkbox:checked + .resume-matcher-toggle {
      background: rgba(37, 99, 235, 0.88);
    }

    .resume-matcher-checkbox:checked + .resume-matcher-toggle::after {
      transform: translateX(16px);
    }

    .resume-matcher-inline-action:focus-within .resume-matcher-toggle {
      box-shadow:
        inset 0 0 0 1px rgba(152, 35, 72, 0.28),
        0 0 0 3px rgba(168, 85, 110, 0.14);
    }

    .resume-matcher-advanced {
      display: grid;
      gap: 8px;
    }

    .resume-matcher-advanced > summary {
      list-style: none;
      cursor: pointer;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #667085;
    }

    .resume-matcher-advanced > summary + * {
      margin-top: 2px;
    }

    .resume-matcher-advanced .resume-matcher-settings-group {
      border-color: rgba(255, 255, 255, 0.56);
      background: rgba(255, 255, 255, 0.48);
      box-shadow: 0 10px 20px rgba(15, 23, 42, 0.04);
    }

    .resume-matcher-advanced-actions {
      display: grid;
      gap: 8px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .resume-matcher-advanced-actions .resume-matcher-button {
      width: 100%;
      justify-content: center;
      min-height: 38px !important;
      padding: 8px 12px !important;
      font-size: 12px !important;
      line-height: 1 !important;
    }

    .resume-matcher-advanced-actions .resume-matcher-button:nth-child(3) {
      grid-column: 1 / -1;
    }

    @media (max-width: 360px) {
      .resume-matcher-advanced-actions {
        grid-template-columns: minmax(0, 1fr);
      }

      .resume-matcher-advanced-actions .resume-matcher-button:nth-child(3) {
        grid-column: auto;
      }
    }

    .resume-matcher-advanced > summary::-webkit-details-marker {
      display: none;
    }

    .resume-matcher-empty {
      font-size: 13px;
      line-height: 1.45;
      color: #667085;
      padding: 12px 0;
    }

    #${ROOT_ID} {
      color: #381622;
    }

    #${LAUNCHER_ID} {
      border-color: rgba(255, 234, 239, 0.88);
      background:
        linear-gradient(180deg, rgba(133, 35, 68, 0.94), rgba(98, 21, 50, 0.96)),
        rgba(117, 26, 57, 0.94);
      box-shadow:
        -10px 20px 30px rgba(64, 16, 34, 0.3),
        inset 0 1px 1px rgba(255, 243, 246, 0.34);
    }

    #${LAUNCHER_ID}::before {
      background: conic-gradient(
        from 0deg at 50% 50%,
        rgba(123, 29, 64, 0) 0deg,
        rgba(123, 29, 64, 0) 210deg,
        rgba(196, 74, 118, 0.18) 265deg,
        rgba(232, 120, 156, 0.76) 320deg,
        rgba(245, 192, 206, 0.28) 346deg,
        rgba(123, 29, 64, 0) 360deg
      );
      filter: drop-shadow(0 0 14px rgba(196, 74, 118, 0.28));
    }

    #${LAUNCHER_CLOSE_ID} {
      border-color: rgba(253, 226, 235, 0.92);
      background: rgba(255, 246, 248, 0.96);
      color: rgba(91, 26, 48, 0.74);
    }

    #${BOARD_ID} {
      border-color: rgba(255, 228, 236, 0.72);
      background:
        radial-gradient(circle at top right, rgba(138, 31, 68, 0.18), transparent 34%),
        linear-gradient(180deg, rgba(248, 237, 241, 0.97), rgba(242, 225, 231, 0.95)),
        rgba(243, 228, 233, 0.94);
      box-shadow:
        -12px 26px 36px rgba(76, 21, 41, 0.18),
        inset 0 1px 1px rgba(255, 246, 248, 0.86);
    }

    .resume-matcher-board__header {
      border-bottom-color: rgba(136, 34, 68, 0.14);
      background:
        linear-gradient(to bottom, rgba(110, 22, 54, 0.1), rgba(110, 22, 54, 0.04)),
        rgba(255, 248, 250, 0.62);
      box-shadow: inset 0 -1px 0 rgba(255, 231, 237, 0.66);
    }

    .resume-matcher-board__title,
    .resume-matcher-run-job__title {
      color: #3f1424;
    }

    .resume-matcher-board__brand img {
      filter: drop-shadow(0 4px 10px rgba(110, 22, 54, 0.18));
    }

    .resume-matcher-icon-button {
      border-color: rgba(255, 229, 236, 0.86);
      background: rgba(255, 247, 249, 0.82);
      color: rgba(91, 26, 48, 0.76);
      box-shadow: 0 8px 18px rgba(91, 26, 48, 0.08);
    }

    .resume-matcher-icon-button:hover {
      background: rgba(255, 242, 246, 0.96);
      border-color: rgba(226, 171, 188, 0.92);
      color: rgba(91, 26, 48, 0.9);
    }

    .resume-matcher-icon-button.is-active {
      color: #5b1a30;
      background: linear-gradient(
        180deg,
        rgba(255, 250, 251, 0.98),
        rgba(247, 227, 234, 0.94)
      );
      border-color: rgba(205, 128, 155, 0.86);
      box-shadow:
        0 0 0 1px rgba(255, 244, 247, 0.24),
        0 0 18px rgba(162, 45, 84, 0.16),
        0 10px 22px rgba(91, 26, 48, 0.12);
    }

    .resume-matcher-icon-button.is-active::after {
      border-color: rgba(170, 52, 91, 0.38);
      box-shadow: 0 0 14px rgba(170, 52, 91, 0.12);
    }

    .resume-matcher-section,
    .resume-matcher-history-item,
    .resume-matcher-settings-group,
    .resume-matcher-onboarding {
      border-color: rgba(255, 234, 239, 0.88);
      background: rgba(255, 249, 250, 0.74);
      box-shadow: 0 16px 30px rgba(91, 26, 48, 0.08);
    }

    .resume-matcher-run-shell {
      background: transparent;
      box-shadow: none;
    }

    .resume-matcher-job-meta,
    .resume-matcher-history-item__company,
    .resume-matcher-history-pagination span,
    .resume-matcher-settings-item__detail,
    .resume-matcher-empty,
    .resume-matcher-onboarding__text,
    .resume-matcher-onboarding__help,
    .resume-matcher-field__hint {
      color: rgba(79, 30, 45, 0.8);
    }

    .resume-matcher-status-title,
    .resume-matcher-status-detail {
      color: inherit;
    }

    .resume-matcher-run-ready {
      background: #7f1d3f;
      box-shadow: 0 8px 16px rgba(127, 29, 63, 0.26), inset 0 1px 1px rgba(255, 235, 241, 0.28);
    }

    .resume-matcher-run-ready.is-loading {
      background: rgba(127, 29, 63, 0.14);
      color: #7f1d3f;
      box-shadow: 0 8px 16px rgba(127, 29, 63, 0.12), inset 0 1px 1px rgba(255, 235, 241, 0.26);
    }

    .resume-matcher-field input,
    .resume-matcher-field textarea,
    .resume-matcher-field select,
    .resume-matcher-file-display,
    .resume-matcher-history-search input,
    .resume-matcher-history-filter__menu {
      border-color: rgba(231, 197, 207, 0.96);
      background: rgba(255, 252, 252, 0.94);
      color: #4c1d2d;
    }

    .resume-matcher-field input:hover,
    .resume-matcher-field textarea:hover,
    .resume-matcher-field select:hover,
    .resume-matcher-history-search input:hover,
    .resume-matcher-settings-item input:hover,
    .resume-matcher-settings-item select:hover,
    .resume-matcher-settings-row input:hover,
    .resume-matcher-settings-row select:hover,
    .resume-matcher-secret-field input:hover,
    .resume-matcher-onboarding__provider-grid .resume-matcher-field input:hover,
    .resume-matcher-onboarding__provider-grid .resume-matcher-field select:hover {
      border-color: rgba(205, 128, 155, 0.86);
      box-shadow: inset 0 1px 3px rgba(91, 26, 48, 0.05);
    }

    .resume-matcher-field input::placeholder,
    .resume-matcher-field textarea::placeholder,
    .resume-matcher-history-search input::placeholder {
      color: rgba(111, 58, 76, 0.58);
    }

    .resume-matcher-field input:focus,
    .resume-matcher-field textarea:focus,
    .resume-matcher-field select:focus,
    .resume-matcher-history-search input:focus {
      border-color: rgba(152, 35, 72, 0.72);
      box-shadow: 0 0 0 3px rgba(168, 85, 110, 0.14);
    }

    .resume-matcher-run-shell .resume-matcher-field input,
    .resume-matcher-run-shell .resume-matcher-field textarea {
      border-color: rgba(237, 210, 219, 0.98);
      background: rgba(255, 251, 252, 0.9);
      color: #4c1d2d;
      box-shadow: inset 0 1px 3px rgba(91, 26, 48, 0.04);
    }

    .resume-matcher-file-chip {
      border-color: rgba(231, 197, 207, 0.96);
      background: rgba(255, 252, 252, 0.92);
      color: #4c1d2d;
    }

    .resume-matcher-file-chip.is-placeholder {
      color: rgba(122, 92, 102, 0.84);
    }

    .resume-matcher-file-chip__action {
      color: #6c2940;
    }

    .resume-matcher-file-chip__action:hover {
      background: rgba(127, 29, 63, 0.08);
    }

    .resume-matcher-button {
      border-color: rgba(226, 188, 200, 0.98);
      background: rgba(255, 252, 252, 0.94);
      color: #5b1a30;
    }

    .resume-matcher-button.is-primary,
    .resume-matcher-run-shell .resume-matcher-button.is-primary {
      border-color: rgba(127, 29, 63, 0.9);
      background: linear-gradient(180deg, #8e2247, #691733);
      color: #fff8fa;
      box-shadow: 0 12px 24px rgba(105, 23, 51, 0.24);
    }

    .resume-matcher-run-shell .resume-matcher-button:not(.is-primary) {
      background: rgba(255, 250, 251, 0.9);
      border-color: rgba(234, 206, 215, 0.96);
      color: #5b1a30;
      box-shadow: 0 8px 18px rgba(91, 26, 48, 0.08);
    }

    .resume-matcher-button.is-danger {
      color: #b42318;
      border-color: rgba(248, 113, 113, 0.38);
      background: rgba(255, 247, 247, 0.92);
    }

    .resume-matcher-status-card[data-tone="running"] {
      background: rgba(255, 255, 255, 0.5);
      border-color: rgba(255, 255, 255, 0.6);
      color: #4a2333;
    }

    .resume-matcher-status-card[data-tone="success"] {
      background: rgba(167, 215, 193, 0.4);
      border-color: rgba(255, 255, 255, 0.6);
      color: #1a5a38;
    }

    .resume-matcher-status-card[data-tone="warning"] {
      background: rgba(252, 227, 200, 0.5);
      border-color: rgba(255, 255, 255, 0.6);
      color: #7a4b1a;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);
    }

    .resume-matcher-status-card[data-tone="blocked"] {
      background: rgba(252, 227, 200, 0.5);
      border-color: rgba(255, 255, 255, 0.6);
      color: #7a4b1a;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);
    }

    .resume-matcher-status-card[data-tone="error"] {
      background: rgba(255, 214, 214, 0.5);
      border-color: rgba(255, 255, 255, 0.6);
      color: #a01f1f;
    }

    .resume-matcher-status-card[data-tone="info"],
    .resume-matcher-status-card[data-tone="neutral"],
    .resume-matcher-status-card[data-tone="idle"] {
      background: rgba(255, 255, 255, 0.5);
      border-color: rgba(255, 255, 255, 0.6);
      color: #4a2333;
    }

    .resume-matcher-status-spinner {
      border-color: rgba(74, 35, 51, 0.2);
      border-top-color: currentColor;
    }

    .resume-matcher-settings-title,
    .resume-matcher-settings-item__title,
    .resume-matcher-settings-row__label,
    .resume-matcher-advanced > summary,
    .resume-matcher-onboarding__eyebrow,
    .resume-matcher-onboarding__label {
      color: rgba(108, 41, 64, 0.8);
    }

    .resume-matcher-settings-item__detail a,
    .resume-matcher-history-item__link,
    .resume-matcher-onboarding__link {
      color: #8e2247;
    }

    .resume-matcher-history-filter__button,
    .resume-matcher-history-pagination button {
      border-color: rgba(232, 206, 214, 0.86);
      background: rgba(255, 250, 251, 0.9);
      color: #5b1a30;
      box-shadow: inset 0 0 0 1px rgba(217, 180, 193, 0.12);
    }

    .resume-matcher-history-filter__option:hover,
    .resume-matcher-history-filter__option.is-active {
      background: rgba(142, 34, 71, 0.08);
      color: #8e2247;
    }

    .resume-matcher-onboarding__progress-bar {
      background: rgba(231, 197, 207, 0.74);
    }

    .resume-matcher-onboarding__progress-bar::after {
      background: linear-gradient(90deg, #8e2247, #c04e77);
    }

    .resume-matcher-onboarding__progress-label {
      color: rgba(91, 26, 48, 0.68);
    }

    .resume-matcher-onboarding__progress-step.is-active .resume-matcher-onboarding__progress-label,
    .resume-matcher-onboarding__progress-step.is-complete .resume-matcher-onboarding__progress-label {
      color: #5b1a30;
    }

    .resume-matcher-onboarding__provider-note {
      border-color: rgba(235, 209, 217, 0.92);
      background: rgba(255, 250, 251, 0.94);
      color: rgba(79, 30, 45, 0.82);
    }

    .resume-matcher-onboarding__help--subtle {
      color: rgba(108, 41, 64, 0.68);
      font-size: 11px;
    }

    .resume-matcher-toggle {
      background: rgba(180, 159, 167, 0.42);
      box-shadow: inset 0 0 0 1px rgba(167, 130, 143, 0.2);
    }

    .resume-matcher-checkbox:checked + .resume-matcher-toggle {
      background: rgba(127, 29, 63, 0.92);
    }

    @media (max-width: 520px) {
      #${ROOT_ID} {
        left: auto;
        right: ${EDGE_PADDING}px;
      }

      #${BOARD_ID} {
        width: calc(100vw - ${EDGE_GAP_TOTAL}px);
        max-width: calc(100vw - ${EDGE_GAP_TOTAL}px);
      }

      .resume-matcher-job-meta,
      .resume-matcher-readiness,
      .resume-matcher-settings-grid,
      .resume-matcher-settings-row {
        grid-template-columns: 1fr;
      }
    }
  `;
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
  }
  if (pointerDragState.dragged) {
    suppressNextClick = true;
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
  const previousOpen = state.boardOpen;
  const previousView = state.currentView;
  state.boardOpen = true;
  state.currentView = view;
  state.launcherAlert = false;
  render();
  syncDockedPosition($(ROOT_ID));
  if (!previousOpen || previousView !== view) {
    void trackAnalyticsEvent(
      view === "settings"
        ? "extension_settings_viewed"
        : "extension_board_opened",
      { surface: view === "settings" ? "settings_view" : "run_view" },
    );
  }
  if (!options.skipConnectionCheck && (view === "run" || view === "settings")) {
    void reconcileConnectionStatus(view);
    return;
  }
  void refreshBoardData();
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
  const raw = (document.title || "").replace(/\s*\|\s*LinkedIn.*$/i, "").trim();
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
  state.currentJob = nextJob;

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
  if (!isLinkedInJobPage()) return;

  const nextJob = extractCurrentJob();
  const matchesExpected = isCurrentJobExpectedSelection(nextJob);
  const nextHasEnoughContext = hasEnoughJobContext(nextJob);

  updateJobReadiness(nextJob);

  if (matchesExpected && nextHasEnoughContext) {
    render();
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
  if (!isLinkedInJobPage()) return;

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
  const setupState = state.setupState;
  if (!setupState) {
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
          "Sign in to continue tailoring this job. Your setup is still here.",
        actions: [
          {
            id: "connect",
            label: "Continue with Google",
            variant: "primary",
          },
        ],
      };
    }
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
        ? "I’ll keep trying fallback extraction. If it still misses, paste the JD below."
        : "I couldn’t get the full JD. Enable Apify in Settings or paste the JD below."),
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

function buildManualJobInput() {
  const rawText = state.manualJobDescription.trim();
  if (!rawText) {
    return null;
  }

  return {
    source: "manual_text",
    rawText,
    title: state.currentJob?.title || "",
    company: state.currentJob?.company || "",
    location: state.currentJob?.location || "",
    datePosted: state.currentJob?.datePosted || "",
    sourceUrl: state.currentJob?.sourceUrl || window.location.href,
  };
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
    const directMatch = parsed.pathname.match(/\/jobs\/view\/(\d+)/);
    if (directMatch) {
      return `${parsed.origin}/jobs/view/${directMatch[1]}/`;
    }
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString();
  } catch {
    return normalized;
  }
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

const ACTIVE_EXTENSION_SESSION_STATUSES = new Set([
  "starting",
  "bootstrap_master",
  "scraped",
  "prompt1_done",
  "prompt2_done",
  "prompt3_done",
  "validated",
]);

function getRunStateFromExtensionSession() {
  const session = state.extensionState;
  if (!session) return null;

  const status = session.status || "";
  const activeRunJob = cloneJobForRun(
    session.jobSnapshot || session.activeRunJob || null,
  );

  if (ACTIVE_EXTENSION_SESSION_STATUSES.has(status)) {
    const byStatus = {
      starting: {
        title: "Starting run",
        detail: "Getting things ready.",
      },
      bootstrap_master: {
        title: "Creating your base resume",
        detail: "Extracting your uploaded Markdown file.",
      },
      scraped: {
        title: "Job captured",
        detail: "Job details are ready.",
      },
      prompt1_done: {
        title: "Prompt 1 · Analyze JD",
        detail: "Reading hiring signals.",
      },
      prompt2_done: {
        title: "Prompt 2 · Positioning",
        detail: "Building the positioning strategy.",
      },
      prompt3_done: {
        title: "Prompt 3 · Tailored Resume",
        detail: "Writing the tailored resume.",
      },
      validated: {
        title: "Saving draft",
        detail: "Saving your resume.",
      },
    };
    return {
      isRunning: true,
      tone: "running",
      activeRunJob,
      ...(byStatus[status] || byStatus.starting),
    };
  }

  if (status === "patched" && activeRunJob) {
    return {
      isRunning: false,
      tone: "success",
      title: "Opening workspace",
      detail: `Your tailored resume for ${getJobDisplayLabel(activeRunJob)} is opening on the web.`,
      activeRunJob,
    };
  }

  if (status === "error") {
    return {
      isRunning: false,
      tone: "error",
      title: "Run failed",
      detail: formatErrorText(session.patchError || ""),
      activeRunJob,
    };
  }

  return null;
}

function syncVisibleRunStateFromExtensionSession() {
  if (state.isRunning || state.awaitingAuth || state.awaitingStoryboard) return;
  if (getSetupRequirementStatus() || isHardPrerequisiteBlocker()) {
    state.activeRunJob = null;
    return;
  }
  const sessionState = getRunStateFromExtensionSession();
  if (!sessionState) {
    state.activeRunJob = null;
    return;
  }

  state.isRunning = sessionState.isRunning;
  state.activeRunJob = sessionState.activeRunJob;
  state.statusTone = sessionState.tone;
  state.statusTitle = sessionState.title;
  state.statusDetail = sessionState.detail;
  state.statusActions = [];
}

function getJobDisplayLabel(job) {
  if (!job) return "another job";
  const title = String(job.title || "").trim();
  const company = String(job.company || "").trim();
  if (title && company) return `${title} at ${company}`;
  return title || company || "another job";
}

function doesActiveRunMatchCurrentJob() {
  if (!state.activeRunJob || !state.currentJob) return true;
  const activeUrl = normalizeJobSourceUrl(state.activeRunJob.sourceUrl);
  const currentUrl = normalizeJobSourceUrl(state.currentJob.sourceUrl);
  if (activeUrl && currentUrl) {
    return activeUrl === currentUrl;
  }
  return (
    String(state.activeRunJob.title || "").trim() ===
      String(state.currentJob.title || "").trim() &&
    String(state.activeRunJob.company || "").trim() ===
      String(state.currentJob.company || "").trim()
  );
}

function canAttemptRecoveryRun() {
  if (!isLinkedInJobPage()) return false;
  if (hasManualJobDescription()) return true;

  const job = state.currentJob || {};
  return Boolean(
    job.sourceUrl ||
    job.title ||
    job.company ||
    /\/jobs\/view\/\d+/.test(window.location.href),
  );
}

function getRunBlockingState() {
  const setupRequirement = getSetupRequirementStatus();
  if (setupRequirement) {
    return setupRequirement;
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

function isRunReady() {
  return (
    !getRunBlockingState() && !state.awaitingAuth && !state.awaitingStoryboard
  );
}

function extractCurrentJob() {
  const normalizedSourceUrl = (() => {
    const href = window.location.href;
    try {
      const parsed = new URL(href);
      const currentJobId = parsed.searchParams.get("currentJobId")?.trim();
      if (currentJobId) {
        return `${parsed.origin}/jobs/view/${currentJobId}/`;
      }
    } catch {}

    const canonicalMatch = href.match(/\/jobs\/view\/(\d+)/);
    if (canonicalMatch) {
      return `${window.location.origin}/jobs/view/${canonicalMatch[1]}/`;
    }

    const canonicalLink = document.querySelector(
      'a[href*="/jobs/view/"][href*="currentJobId="], a[href*="/jobs/view/"]',
    )?.href;
    if (canonicalLink) {
      const linkMatch = canonicalLink.match(/\/jobs\/view\/(\d+)/);
      if (linkMatch) {
        return `${window.location.origin}/jobs/view/${linkMatch[1]}/`;
      }
      return canonicalLink;
    }

    return href;
  })();

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

function getLinkedInJobDetailRoot() {
  return (
    document.querySelector(
      ".jobs-search__job-details--container, .jobs-search__job-details, .scaffold-layout__detail, [data-testid='job-details']",
    ) || document.querySelector("main")
  );
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

function getSelectedProfile(selectId = PROVIDER_SELECT_ID, settings = null) {
  const resolvedSettings = settings || state.assets?.llmSettings;
  if (!resolvedSettings?.profiles) return null;
  const select = $(selectId);
  const profileId = select?.value || resolvedSettings.activeProfileId;
  return resolvedSettings.profiles[profileId] ?? null;
}

function isOnboardingMode() {
  return state.setupState?.mode === "onboarding";
}

function renderPrimaryButtonMarkup(label, actionId, extraAttrs = "") {
  return `<button type="button" class="resume-matcher-button is-primary" data-onboarding-action="${escapeHtml(actionId)}" ${extraAttrs}>${escapeHtml(label)}</button>`;
}

function renderProviderOptions(settings) {
  return Object.values(settings?.profiles || {})
    .sort((left, right) =>
      (left?.label || "").localeCompare(right?.label || "", undefined, {
        sensitivity: "base",
      }),
    )
    .map(
      (profile) =>
        `<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.label)}</option>`,
    )
    .join("");
}

function getOnboardingStepIndex(step) {
  switch (step) {
    case "sign_in":
      return 1;
    case "assets":
      return 2;
    case "provider":
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
    { label: "Add resume", index: 2 },
    { label: "Choose AI", index: 3 },
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

  const hasResume = Boolean(state.assets?.masterResumeContextAsset?.filename);
  const hasStoryboard = Boolean(state.assets?.storyboardAsset?.filename);
  const providerSettings = state.assets?.llmSettings;
  const selectedProfile = getSelectedProfile(
    "resume-matcher-onboarding-provider-select",
    providerSettings,
  );

  switch (setupState.step) {
    case "sign_in":
      return `
        ${renderOnboardingProgress(setupState.step)}
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
                  'data-next-step="assets"',
                )
              : `<button type="button" class="resume-matcher-button is-primary resume-matcher-google-button" data-onboarding-action="connect">${renderGoogleButtonLabel("Continue with Google")}</button>`
          }
        </div>
      `;
    case "assets":
      return `
        ${renderOnboardingProgress(setupState.step)}
        <p class="resume-matcher-onboarding__text">Use TXT, MD, or JSON for both files.</p>
        <div class="resume-matcher-onboarding__row">
          <div class="resume-matcher-onboarding__file">
            <div class="resume-matcher-onboarding__file-top">
              <span class="resume-matcher-onboarding__label">Resume</span>
              ${hasResume ? renderOnboardingStatusPill("Added", "complete") : renderOnboardingStatusPill("Required", "required")}
            </div>
            ${
              hasResume
                ? `<span class="resume-matcher-onboarding__status">${escapeHtml(state.assets?.masterResumeContextAsset?.filename || "Resume added")}</span>`
                : ""
            }
            <button type="button" class="resume-matcher-button" data-onboarding-action="upload_resume">${hasResume ? "Replace" : "Upload"}</button>
          </div>
          <div class="resume-matcher-onboarding__file">
            <div class="resume-matcher-onboarding__file-top">
              <span class="resume-matcher-onboarding__label">Story bank</span>
              ${hasStoryboard ? renderOnboardingStatusPill("Added", "complete") : renderOnboardingStatusPill("Optional", "optional")}
            </div>
            <p class="resume-matcher-onboarding__help">Use a story bank for fuller bullet details and extra wins beyond your main resume. It gives the AI stronger stories to pull into the tailored version.</p>
            <a class="resume-matcher-settings-item__link" href="${STORY_BANK_GUIDE_URL}" target="_blank" rel="noopener noreferrer">Optional, but useful. Learn more.</a>
            ${
              hasStoryboard
                ? `<span class="resume-matcher-onboarding__status">${escapeHtml(state.assets?.storyboardAsset?.filename || "Story bank added")}</span>`
                : ""
            }
            <button type="button" class="resume-matcher-button" data-onboarding-action="upload_storyboard">${hasStoryboard ? "Replace" : "Upload"}</button>
          </div>
        </div>
        <div class="resume-matcher-onboarding__actions">
          ${renderPrimaryButtonMarkup("Next", "onboarding_next", `data-next-step="provider"${hasResume ? "" : " disabled"}`)}
        </div>
      `;
    case "provider": {
      const isWeb = selectedProfile?.mode === "web_automation";
      const isApi = selectedProfile?.mode === "api";
      return `
        ${renderOnboardingProgress(setupState.step)}
        <div class="resume-matcher-onboarding__provider-grid">
          <p class="resume-matcher-onboarding__provider-note"><strong>API key</strong> is more stable.</p>
          <p class="resume-matcher-onboarding__provider-note"><strong>Web automation</strong> uses your browser login and is less stable.</p>
          <div class="resume-matcher-field">
            <select id="resume-matcher-onboarding-provider-select">${renderProviderOptions(providerSettings)}</select>
          </div>
          <div id="resume-matcher-onboarding-provider-web-row" class="resume-matcher-field"${isWeb ? "" : " hidden"}>
            <input id="resume-matcher-onboarding-provider-web-input" type="url" placeholder="Provider URL" value="${escapeHtml(isWeb ? selectedProfile?.targetUrl || "" : "")}" />
          </div>
          <div id="resume-matcher-onboarding-provider-api-row" class="resume-matcher-field"${isApi ? "" : " hidden"}>
            <input id="resume-matcher-onboarding-provider-api-base-input" type="url" placeholder="API endpoint" value="${escapeHtml(isApi ? selectedProfile?.apiBaseUrl || "" : "")}" />
          </div>
          <div id="resume-matcher-onboarding-provider-model-row" class="resume-matcher-field"${isApi ? "" : " hidden"}>
            <input id="resume-matcher-onboarding-provider-model-input" type="text" placeholder="Model" value="${escapeHtml(isApi ? selectedProfile?.model || "" : "")}" />
          </div>
          <div id="resume-matcher-onboarding-provider-key-row" class="resume-matcher-field"${isApi ? "" : " hidden"}>
            <input id="${ONBOARDING_PROVIDER_API_KEY_INPUT_ID}" type="password" placeholder="API key" value="" />
          </div>
        </div>
        <p class="resume-matcher-onboarding__help resume-matcher-onboarding__help--subtle"><em>Most tested: ChatGPT web automation and Claude API.</em></p>
        <div class="resume-matcher-onboarding__actions">
          ${renderPrimaryButtonMarkup("Next", "onboarding_next", `data-next-step="done"${setupState.canContinue ? "" : " disabled"}`)}
        </div>
      `;
    }
    case "done":
      return `
        ${renderOnboardingProgress(setupState.step)}
        <p class="resume-matcher-onboarding__text">${escapeHtml(setupState.detail)}</p>
        <div class="resume-matcher-onboarding__actions">
          ${renderPrimaryButtonMarkup("Start tailoring", "complete_onboarding")}
        </div>
      `;
    case "intro":
    default:
      return `
        ${renderOnboardingProgress(setupState.step)}
        <p class="resume-matcher-onboarding__text">${escapeHtml(setupState.detail)}</p>
        <div class="resume-matcher-onboarding__actions">
          ${renderPrimaryButtonMarkup("Continue", "onboarding_next", 'data-next-step="sign_in"')}
        </div>
      `;
  }
}

function getRunStatusCopy() {
  if (state.awaitingAuth) {
    return {
      tone: state.statusTone || "info",
      title: state.statusTitle || "Opening Google sign-in",
      detail:
        state.statusDetail || "We will bring you back here after sign-in.",
      actions: [],
    };
  }

  const blocked = getRunBlockingState();
  if (blocked) {
    return blocked;
  }

  if (state.statusTone === "error" && state.statusTitle) {
    return {
      tone: state.statusTone,
      title: state.statusTitle,
      detail: state.statusDetail,
      actions: state.statusActions,
    };
  }

  if (
    state.statusTitle &&
    (state.isRunning ||
      state.statusTone === "success" ||
      state.statusTone === "info" ||
      state.statusTone === "running")
  ) {
    const isDifferentJob =
      state.activeRunJob &&
      (state.isRunning || state.awaitingStoryboard || state.awaitingAuth) &&
      !doesActiveRunMatchCurrentJob();
    if (isDifferentJob) {
      return {
        tone: state.statusTone === "success" ? "success" : "info",
        title:
          state.statusTone === "success"
            ? "Workspace ready"
            : state.awaitingStoryboard
              ? "Story bank needed for another job"
              : state.awaitingAuth
                ? "Sign-in needed for another job"
                : "Tailoring in background",
        detail:
          state.statusTone === "success"
            ? `Opened the tailored resume for ${getJobDisplayLabel(state.activeRunJob)}.`
            : state.awaitingStoryboard
              ? `Continue or upload a story bank for ${getJobDisplayLabel(state.activeRunJob)}.`
              : state.awaitingAuth
                ? `Sign in to continue ${getJobDisplayLabel(state.activeRunJob)}.`
                : `${state.statusTitle || "Still working"} for ${getJobDisplayLabel(state.activeRunJob)}.`,
        actions: state.statusActions,
      };
    }
    return {
      tone: state.statusTone,
      title: state.statusTitle,
      detail:
        state.statusTone === "running" && state.rotatingStatusDetail
          ? state.rotatingStatusDetail
          : state.statusDetail,
      actions: state.statusActions,
    };
  }

  if (state.awaitingStoryboard) {
    return {
      tone: "warning",
      title: "Story bank missing",
      detail: "Continue without a story bank or upload one in Settings.",
      actions: [
        { id: "continue-storyboard", label: "Continue", variant: "primary" },
        { id: "cancel-storyboard", label: "Cancel" },
      ],
    };
  }

  if (shouldShowManualJdFallback()) {
    return getScrapeRequirementStatus(state.scrapeIssue);
  }

  if (!state.statusTitle && state.statusTone === "neutral") {
    return null;
  }

  return {
    tone: state.statusTone,
    title: state.statusTitle,
    detail:
      state.statusTone === "running" && state.rotatingStatusDetail
        ? state.rotatingStatusDetail
        : state.statusDetail,
    actions: state.statusActions,
  };
}

function stopRunningStatusRotation() {
  if (runningStatusMessageTimer) {
    window.clearTimeout(runningStatusMessageTimer);
    runningStatusMessageTimer = null;
  }
  state.rotatingStatusIndex = -1;
  state.rotatingStatusDetail = "";
}

function scheduleNextRunningStatusRotation() {
  if (!state.isRunning || state.statusTone !== "running") return;
  runningStatusMessageTimer = window.setTimeout(() => {
    runningStatusMessageTimer = null;
    if (!state.isRunning || state.statusTone !== "running") return;
    const nextIndex =
      state.rotatingStatusIndex < 0
        ? Math.floor(Math.random() * RUN_WAIT_MESSAGES.length)
        : (state.rotatingStatusIndex + 1) % RUN_WAIT_MESSAGES.length;
    state.rotatingStatusIndex = nextIndex;
    state.rotatingStatusDetail = RUN_WAIT_MESSAGES[nextIndex];
    render();
    scheduleNextRunningStatusRotation();
  }, RUN_WAIT_MESSAGE_INTERVAL_MS);
}

function startRunningStatusRotation() {
  if (!state.isRunning || state.statusTone !== "running") {
    stopRunningStatusRotation();
    return;
  }
  if (!state.rotatingStatusDetail) {
    state.rotatingStatusIndex = Math.floor(
      Math.random() * RUN_WAIT_MESSAGES.length,
    );
    state.rotatingStatusDetail = RUN_WAIT_MESSAGES[state.rotatingStatusIndex];
  }
  if (!runningStatusMessageTimer) {
    scheduleNextRunningStatusRotation();
  }
}

function clearScrapeRecoveryState() {
  state.scrapeIssue = "";
}

function setRunStatus(tone, title, detail = "", actions = []) {
  state.statusTone = tone;
  state.statusTitle = title || "";
  state.statusDetail = detail || "";
  state.statusActions = Array.isArray(actions) ? actions : [];
  if (tone === "running" && state.isRunning) {
    startRunningStatusRotation();
  } else {
    stopRunningStatusRotation();
  }
  if (!state.boardOpen && tone === "error") {
    state.launcherAlert = true;
  }
  render();
}

function formatErrorText(message) {
  if (!message) return "Generation failed.";
  const normalized = message
    .replace(/^Prompt \d+ failed:\s*/i, "")
    .replace(/^Failed to /i, "")
    .trim();
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
      [
        "Rendering Prompt 1.",
        ["Prompt 1 · Analyze JD", "Preparing the job analysis."],
      ],
      [
        "Running Prompt 1.",
        ["Prompt 1 · Analyze JD", "Reading hiring signals."],
      ],
      [
        "Rendering Prompt 2.",
        ["Prompt 2 · Positioning", "Preparing the positioning strategy."],
      ],
      [
        "Running Prompt 2.",
        ["Prompt 2 · Positioning", "Building the positioning strategy."],
      ],
      [
        "Rendering Prompt 3.",
        ["Prompt 3 · Tailored Resume", "Preparing the tailored draft."],
      ],
      [
        "Running Prompt 3.",
        ["Prompt 3 · Tailored Resume", "Writing the tailored resume."],
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
    return [promptLabel, message];
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

  if (!totalItems) {
    historyRoot.innerHTML = `<div class="resume-matcher-empty">${state.historySearch.trim() ? "No matching runs." : "No runs yet."}</div>`;
    if (pageNode) pageNode.textContent = "0/0";
    if (prevButton) prevButton.disabled = true;
    if (nextButton) nextButton.disabled = true;
    return;
  }

  historyRoot.innerHTML = items
    .map(
      ({ entry, originalIndex }) => `
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
          <div class="resume-matcher-history-item__meta">${escapeHtml(formatDate(entry.generatedAt))}</div>
          <a href="#" class="resume-matcher-history-item__link" data-history-open="${originalIndex}">View resume</a>
        </div>
      </article>
    `,
    )
    .join("");

  if (pageNode) pageNode.textContent = `${state.historyPage}/${totalPages}`;
  if (prevButton) prevButton.disabled = state.historyPage <= 1;
  if (nextButton) nextButton.disabled = state.historyPage >= totalPages;
}

function renderProviderFields() {
  const settings = state.assets?.llmSettings;
  const select = $(PROVIDER_SELECT_ID);
  if (!settings || !select) return;

  const options = renderProviderOptions(settings);
  select.innerHTML = options;
  select.value = settings.activeProfileId || "";

  const profile = getSelectedProfile();
  const isWeb = profile?.mode === "web_automation";
  const isApi = profile?.mode === "api";

  const toggleRow = (id, visible) => {
    const node = $(id);
    if (!node) return;
    node.hidden = !visible;
  };

  toggleRow(PROVIDER_WEB_ROW_ID, isWeb);
  toggleRow(PROVIDER_API_BASE_ROW_ID, isApi);
  toggleRow(PROVIDER_API_GRID_ID, isApi);
  toggleRow(PROVIDER_MODEL_ROW_ID, isApi);
  toggleRow(PROVIDER_API_KEY_ROW_ID, isApi);

  const webInput = $(PROVIDER_WEB_INPUT_ID);
  if (webInput) webInput.value = isWeb ? profile.targetUrl || "" : "";
  const apiBaseInput = $(PROVIDER_API_BASE_INPUT_ID);
  if (apiBaseInput) apiBaseInput.value = isApi ? profile.apiBaseUrl || "" : "";
  const modelInput = $(PROVIDER_MODEL_INPUT_ID);
  if (modelInput) modelInput.value = isApi ? profile.model || "" : "";
  syncSecretInput(PROVIDER_API_KEY_INPUT_ID);
}

function renderSettings() {
  const assets = state.assets;
  const masterLabel = $(MASTER_RESUME_LABEL_ID);
  const storyboardLabel = $(STORYBOARD_LABEL_ID);
  if (masterLabel) {
    const hasFile = Boolean(assets?.masterResumeContextAsset?.filename);
    const label =
      assets?.masterResumeContextAsset?.filename?.trim() || "Master resume";
    masterLabel.innerHTML = `<span class="resume-matcher-file-chip__text">${escapeHtml(label)}</span><button id="${MASTER_RESUME_ACTION_ID}" type="button" class="resume-matcher-file-chip__action" aria-label="${hasFile ? "Delete master resume" : "Upload master resume"}" title="${hasFile ? "Delete master resume" : "Upload master resume"}">${renderFileActionIcon(hasFile ? "delete" : "upload")}</button>`;
    masterLabel.classList.toggle("is-placeholder", !hasFile);
  }
  if (storyboardLabel) {
    const hasFile = Boolean(assets?.storyboardAsset?.filename);
    const label = assets?.storyboardAsset?.filename?.trim() || "Story bank";
    storyboardLabel.innerHTML = `<span class="resume-matcher-file-chip__text">${escapeHtml(label)}</span><button id="${STORYBOARD_ACTION_ID}" type="button" class="resume-matcher-file-chip__action" aria-label="${hasFile ? "Delete story bank" : "Upload story bank"}" title="${hasFile ? "Delete story bank" : "Upload story bank"}">${renderFileActionIcon(hasFile ? "delete" : "upload")}</button>`;
    storyboardLabel.classList.toggle("is-placeholder", !hasFile);
  }
  PROMPT_FILE_DESCRIPTORS.forEach(({ templateName, label }) => {
    const chip = $(promptLabelId(templateName));
    if (!chip) return;
    const descriptor = PROMPT_FILE_DESCRIPTORS.find(
      (item) => item.templateName === templateName,
    );
    const asset = assets?.[`${templateName}TemplateAsset`];
    const hasFile = Boolean(asset?.filename);
    const filename = asset?.filename?.trim() || label;
    chip.innerHTML = `<span class="resume-matcher-file-chip__text">${escapeHtml(filename)}</span><span class="resume-matcher-file-chip__actions">${renderPromptActionButtons(templateName, hasFile, Boolean(descriptor?.defaultPath), label)}</span>`;
    chip.classList.toggle("is-placeholder", !hasFile);
  });

  const appUrl = $(APP_URL_INPUT_ID);
  if (appUrl) appUrl.value = assets?.appOrigin || "";
  const apiUrl = $(API_URL_INPUT_ID);
  if (apiUrl) apiUrl.value = assets?.apiOrigin || "";
  const apifyEnabled = $(APIFY_ENABLED_INPUT_ID);
  if (apifyEnabled) {
    apifyEnabled.checked = assets?.apifyFallbackSettings?.enabled === true;
  }
  const apifyTokenRow = $(APIFY_TOKEN_ROW_ID);
  if (apifyTokenRow) {
    apifyTokenRow.hidden = assets?.apifyFallbackSettings?.enabled !== true;
  }
  const apifyTokenInput = $(APIFY_TOKEN_INPUT_ID);
  if (apifyTokenInput) {
    syncSecretInput(APIFY_TOKEN_INPUT_ID);
    syncSecretRevealToggle(APIFY_TOKEN_INPUT_ID);
  }
  const customFeature = $(CUSTOM_FEATURE_INPUT_ID);
  if (customFeature)
    customFeature.checked = assets?.customFeatureEnabled === true;
  const runtimeUrlsRow = $(RUNTIME_URLS_ROW_ID);
  if (runtimeUrlsRow) {
    runtimeUrlsRow.hidden = assets?.customFeatureEnabled !== true;
  }

  const accountButton = $(ACCOUNT_ACTION_ID);
  if (accountButton) {
    const connected = state.connectionState === "connected";
    accountButton.classList.add("resume-matcher-google-button");
    accountButton.innerHTML = renderGoogleButtonLabel(
      connected ? "Sign out" : "Sign in with Google",
    );
    accountButton.disabled = false;
  }

  $(MASTER_RESUME_ACTION_ID)?.addEventListener("click", async () => {
    if (state.assets?.masterResumeContextAsset?.filename) {
      await sendMessage("CLEAR_MASTER_RESUME_CONTEXT").catch(() => {});
      await refreshBoardData();
      return;
    }
    $(MASTER_RESUME_INPUT_ID)?.click();
  });

  $(STORYBOARD_ACTION_ID)?.addEventListener("click", async () => {
    if (state.assets?.storyboardAsset?.filename) {
      await sendMessage("CLEAR_STORYBOARD").catch(() => {});
      await refreshBoardData();
      return;
    }
    $(STORYBOARD_INPUT_ID)?.click();
  });
  PROMPT_FILE_DESCRIPTORS.forEach(({ templateName, label }) => {
    $(promptActionId(templateName))?.addEventListener("click", async () => {
      const asset = state.assets?.[`${templateName}TemplateAsset`];
      if (asset?.filename) {
        await sendMessage("DELETE_PROMPT_TEMPLATE", {
          templateName,
          promptProfileId: state.assets?.activePromptProfileId || "profile1",
        }).catch(() => {});
        await refreshBoardData();
        return;
      }
      $(promptInputId(templateName))?.click();
    });
    $(promptDownloadId(templateName))?.addEventListener("click", async () => {
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

  renderProviderFields();
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
  const status = getRunStatusCopy();
  const readyPill = $(RUN_READY_ID);
  const jobMeta = $(RUN_META_ID);
  const onboardingRoot = $(RUN_ONBOARDING_ID);
  const manualJdField = $(RUN_MANUAL_JD_FIELD_ID);
  const manualJdInput = $(RUN_MANUAL_JD_ID);
  const notesField = $(RUN_NOTES_ID)?.closest(".resume-matcher-field");
  const isLoadingJob =
    state.jobLoadState === "loading" &&
    (state.selectedJobRefreshing || !hasEnoughJobContext(state.currentJob));
  const hasScrapeProblem = shouldShowManualJdFallback();
  const hardBlocker = isHardPrerequisiteBlocker();
  const canRun = isRunReady();
  const onboardingMode = isOnboardingMode();
  const runningDifferentJob =
    state.isRunning && !doesActiveRunMatchCurrentJob();

  if (onboardingRoot) {
    onboardingRoot.hidden = !onboardingMode;
    onboardingRoot.innerHTML = onboardingMode ? renderOnboardingStep() : "";
    if (onboardingMode && state.setupState?.step === "provider") {
      const onboardingProviderSelect = $(
        "resume-matcher-onboarding-provider-select",
      );
      if (
        onboardingProviderSelect &&
        state.assets?.llmSettings?.activeProfileId
      ) {
        onboardingProviderSelect.value =
          state.assets.llmSettings.activeProfileId;
      }
    }
    syncSecretInput(ONBOARDING_PROVIDER_API_KEY_INPUT_ID);
  }

  if (readyPill) {
    readyPill.hidden = onboardingMode || hardBlocker;
    readyPill.textContent = canRun ? "✓" : isLoadingJob ? "…" : "!";
    const toneClass = canRun
      ? ""
      : isLoadingJob
        ? " is-loading"
        : status?.tone === "error"
          ? " is-error"
          : status?.tone === "blocked" || status?.tone === "warning"
            ? " is-warning"
            : " is-muted";
    readyPill.className = `resume-matcher-run-ready${toneClass}`;
    readyPill.setAttribute(
      "aria-label",
      canRun ? "Job ready" : isLoadingJob ? "Loading job" : "Needs setup",
    );
    readyPill.setAttribute(
      "title",
      canRun ? "Job ready" : isLoadingJob ? "Loading job" : "Needs setup",
    );
  }

  if (jobMeta) {
    jobMeta.hidden = onboardingMode || hardBlocker;
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
    manualJdField.hidden = onboardingMode || hardBlocker || !hasScrapeProblem;
  }
  if (manualJdInput && manualJdInput.value !== state.manualJobDescription) {
    manualJdInput.value = state.manualJobDescription;
    autoGrowTextarea(manualJdInput);
  }
  if (notesField) {
    notesField.hidden = onboardingMode || hardBlocker;
  }

  const primaryButton = $(RUN_PRIMARY_ID);
  if (primaryButton) {
    primaryButton.disabled = onboardingMode || state.isRunning || !canRun;
    primaryButton.textContent = state.isRunning
      ? runningDifferentJob
        ? "Working on other job"
        : "Running…"
      : hasManualJobDescription() && hasScrapeProblem
        ? "Continue"
        : "Tailor";
    primaryButton.hidden = onboardingMode || hardBlocker;
  }

  const secondaryButton = $(RUN_SECONDARY_ID);
  if (secondaryButton) {
    secondaryButton.textContent = "Minimize";
    secondaryButton.hidden = onboardingMode || hardBlocker;
  }

  const mainActions = $(RUN_ACTIONS_ID);
  const statusRoot = $(RUN_STATUS_ID);
  const statusActions = $(RUN_STATUS_ACTIONS_ID);
  if (statusRoot && statusActions) {
    statusRoot.hidden = onboardingMode;
    statusActions.hidden = onboardingMode;
    statusRoot.classList.toggle(
      "is-visible",
      !onboardingMode && Boolean(status),
    );
    statusRoot.dataset.tone = status?.tone || "neutral";
    statusRoot.innerHTML = status
      ? `
        <div class="resume-matcher-status-title">${status.tone === "info" && isLoadingJob ? '<span class="resume-matcher-status-spinner" aria-hidden="true"></span>' : ""}${escapeHtml(status.title)}</div>
        ${status.detail ? `<div class="resume-matcher-status-detail">${escapeHtml(status.detail)}</div>` : ""}
      `
      : "";
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
      (status.tone === "blocked" || status.tone === "warning"),
    );
    mainActions.classList.toggle(
      "is-hidden",
      onboardingMode || hardBlocker || shouldHideMainActions,
    );
  }

  const titleNode = document.querySelector("#resume-matcher-job-title");
  if (titleNode) {
    titleNode.textContent = onboardingMode
      ? state.setupState?.title || "Welcome"
      : hardBlocker
        ? state.setupState?.title || "Finish setup"
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
  root.dataset.hidden = state.dismissed && !state.boardOpen ? "true" : "false";
  root.dataset.dockSide = state.dockSide;
  root.dataset.currentView = state.currentView;
  root.dataset.onboardingMode = isOnboardingMode() ? "true" : "false";
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
    RUN_SECONDARY_ID,
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
      if (state.isRunning && isInRunView && !allowWhileRunning) {
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
    if (state.isRunning && isInRunView && !allowWhileRunning) {
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
  const runView = $(RUN_VIEW_ID);
  const settingsView = $(SETTINGS_VIEW_ID);
  runView?.classList.toggle("is-active", state.currentView === "run");
  settingsView?.classList.toggle("is-active", state.currentView === "settings");
  $(BOARD_RUNS_ID)?.classList.toggle("is-active", state.currentView === "run");
  $(BOARD_SETTINGS_ID)?.classList.toggle(
    "is-active",
    state.currentView === "settings",
  );
}

function render() {
  const root = ensureRoot();
  if (!root) return;
  if (state.isRunning && state.statusTone === "running") {
    startRunningStatusRotation();
  } else {
    stopRunningStatusRotation();
  }
  renderRootFlags();
  renderViews();
  renderRunView();
  renderSettings();
  syncRunningInteractivity();
}

async function refreshBoardData() {
  try {
    const response = await sendMessage("GET_STATE");
    if (!response?.ok) {
      throw new Error(response?.error || "Failed to load extension state.");
    }
    state.assets = response.assets ?? null;
    state.setupState = response.setupState ?? state.setupState;
    state.history = response.history ?? [];
    state.extensionState = response.state ?? null;
    updateJobReadiness(extractCurrentJob());
    syncVisibleRunStateFromExtensionSession();
    render();
  } catch (error) {
    logError("Failed to refresh board data.", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function reconcileConnectionStatus() {
  try {
    const response = await sendMessage("CHECK_CONNECTION_STATUS");
    if (!response?.ok) {
      throw new Error(response?.error || "Failed to check connection status.");
    }
    state.assets = response.assets ?? state.assets;
    state.setupState = response.setupState ?? state.setupState;
    state.history = response.history ?? state.history;
    state.extensionState = response.state ?? state.extensionState;
    state.connectionState =
      response.connectionState ||
      (response.connected ? "connected" : "signed_out");
    state.websiteAuthenticated = response.websiteAuthenticated === true;
    state.extensionConnected = response.extensionConnected === true;
    updateJobReadiness(extractCurrentJob());
    syncVisibleRunStateFromExtensionSession();
    if (
      response.connected === true &&
      /(sign[- ]in|required|connect extension|opening google sign-in|connected)/i.test(
        `${state.statusTitle} ${state.statusDetail}`,
      )
    ) {
      state.awaitingAuth = false;
      setRunStatus("neutral", "", "");
      return true;
    }

    render();
    return response.connected === true;
  } catch (error) {
    logError("Failed to reconcile connection status.", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
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

async function persistProviderSelection(selectId = PROVIDER_SELECT_ID) {
  const select = $(selectId);
  if (!select) return;
  const response = await sendMessage("SAVE_LLM_SETTINGS", {
    activeProfileId: select.value,
    profileUpdates: null,
  });
  if (!response?.ok) {
    throw new Error(response?.error || "Failed to save provider selection.");
  }
  state.assets = {
    ...(state.assets || {}),
    llmSettings: response.llmSettings,
  };
  renderSettings();
  renderRunView();
}

async function persistSelectedProviderSettings(config = {}) {
  const {
    selectId = PROVIDER_SELECT_ID,
    webInputId = PROVIDER_WEB_INPUT_ID,
    apiBaseInputId = PROVIDER_API_BASE_INPUT_ID,
    modelInputId = PROVIDER_MODEL_INPUT_ID,
    apiKeyInputId = PROVIDER_API_KEY_INPUT_ID,
  } = config;
  const profile = getSelectedProfile(selectId);
  if (!profile) return;

  const profileUpdates =
    profile.mode === "web_automation"
      ? { targetUrl: $(webInputId)?.value.trim() || "" }
      : {
          apiBaseUrl: $(apiBaseInputId)?.value.trim() || "",
          model: $(modelInputId)?.value.trim() || "",
          apiKey: readSecretInputValue(apiKeyInputId),
        };

  const response = await sendMessage("SAVE_LLM_SETTINGS", {
    activeProfileId: profile.id,
    profileUpdates,
  });
  if (!response?.ok) {
    throw new Error(response?.error || "Failed to save provider settings.");
  }
  state.assets = {
    ...(state.assets || {}),
    llmSettings: response.llmSettings,
  };
  endSecretEdit(apiKeyInputId);
  renderSettings();
  renderRunView();
}

function scheduleProviderSettingsSave() {
  if (providerSettingsSaveTimer) {
    window.clearTimeout(providerSettingsSaveTimer);
  }
  providerSettingsSaveTimer = window.setTimeout(() => {
    providerSettingsSaveTimer = null;
    persistSelectedProviderSettings().catch((error) => {
      setRunStatus(
        "error",
        "Save failed",
        error instanceof Error
          ? error.message
          : "Unable to save provider settings.",
      );
    });
  }, 350);
}

async function persistRuntimeUrls() {
  const response = await sendMessage("SAVE_RUNTIME_URLS", {
    appUrl: $(APP_URL_INPUT_ID)?.value.trim() || "",
    apiUrl: $(API_URL_INPUT_ID)?.value.trim() || "",
  });
  if (!response?.ok) {
    throw new Error(response?.error || "Failed to save URLs.");
  }
}

function scheduleRuntimeUrlsSave() {
  if (runtimeUrlsSaveTimer) {
    window.clearTimeout(runtimeUrlsSaveTimer);
  }
  runtimeUrlsSaveTimer = window.setTimeout(() => {
    runtimeUrlsSaveTimer = null;
    persistRuntimeUrls().catch((error) => {
      setRunStatus(
        "error",
        "Save failed",
        error instanceof Error ? error.message : "Unable to save URLs.",
      );
    });
  }, 350);
}

async function persistApifyFallbackSettings() {
  const response = await sendMessage("SAVE_APIFY_FALLBACK_SETTINGS", {
    enabled: $(APIFY_ENABLED_INPUT_ID)?.checked === true,
    apiToken: readSecretInputValue(APIFY_TOKEN_INPUT_ID),
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
  endSecretEdit(APIFY_TOKEN_INPUT_ID);
  renderSettings();
}

function scheduleApifyFallbackSave() {
  if (apifyFallbackSaveTimer) {
    window.clearTimeout(apifyFallbackSaveTimer);
  }
  apifyFallbackSaveTimer = window.setTimeout(() => {
    apifyFallbackSaveTimer = null;
    persistApifyFallbackSettings().catch((error) => {
      setRunStatus(
        "error",
        "Save failed",
        error instanceof Error
          ? error.message
          : "Unable to save Apify fallback settings.",
      );
    });
  }, 250);
}

async function handleGenerateClick() {
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }
  if (state.isRunning) return;

  state.currentView = "run";
  openBoard("run", { skipConnectionCheck: true });
  const connected = await reconcileConnectionStatus("run");
  if (!connected) {
    state.isRunning = false;
    return;
  }

  state.awaitingAuth = false;
  state.awaitingStoryboard = false;
  state.isRunning = true;
  state.activeRunJob = cloneJobForRun(state.currentJob);
  state.launcherAlert = false;
  clearScrapeRecoveryState();
  setRunStatus("running", "Starting run", "Preparing your tailored resume.");

  try {
    const manualJobInput = shouldShowManualJdFallback()
      ? buildManualJobInput()
      : null;
    const response = await sendMessage("GENERATE_FOR_ACTIVE_JOB", {
      prompt1CustomInstruction: state.customMessage.trim(),
      jobInput: manualJobInput,
      activeRunJob: cloneJobForRun(state.currentJob),
    });
    if (response?.awaitingAuth) {
      state.isRunning = false;
      state.awaitingAuth = true;
      state.connectionState = response.connectionState || "signed_out";
      state.setupState = response.setupState ??
        state.setupState ?? { state: "signed_out" };
      const requirement = getSetupRequirementStatus(response.message) || {
        tone: "blocked",
        title: "Sign in with Google",
        detail: response.message || "Sign in with Google to continue.",
        actions: [
          {
            id: "connect",
            label: "Sign in with Google",
            variant: "primary",
          },
        ],
      };
      setRunStatus(
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
      state.setupState = response.setupState;
      const requirement = getSetupRequirementStatus(response.message) || {
        tone: "blocked",
        title: "Finish setup",
        detail: response.message || "Finish setup to continue.",
        actions: [],
      };
      setRunStatus(
        requirement.tone,
        requirement.title,
        requirement.detail,
        requirement.actions,
      );
      return;
    }
    if (response?.awaitingStoryboard) {
      state.isRunning = false;
      state.awaitingStoryboard = true;
      setRunStatus(
        "warning",
        "Story bank missing",
        response.message || "Continue without a story bank?",
        [
          { id: "continue-storyboard", label: "Continue", variant: "primary" },
          { id: "cancel-storyboard", label: "Cancel" },
        ],
      );
      return;
    }
    if (!response?.ok) {
      throw new Error(response?.error || "Failed to generate tailored resume.");
    }
    state.isRunning = false;
    clearScrapeRecoveryState();
    setRunStatus(
      "success",
      "Opening workspace",
      `Your tailored resume for ${getJobDisplayLabel(state.activeRunJob)} is opening on the web.`,
    );
    state.activeRunJob = null;
    await refreshBoardData();
  } catch (error) {
    state.isRunning = false;
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate tailored resume.";
    if (isScrapeProblemMessage(message)) {
      state.scrapeIssue = getScrapeRequirementStatus().detail;
      setRunStatus("warning", "Couldn’t read full JD", state.scrapeIssue, []);
      render();
      return;
    }
    state.activeRunJob = null;
    setRunStatus("error", "Run failed", formatErrorText(message));
  }
}

async function handleStatusAction(actionId) {
  if (actionId === "open_settings" || actionId === "open-settings") {
    state.currentView = "settings";
    render();
    const focusTarget =
      state.setupState?.primaryAction?.focusTarget ||
      state.setupState?.secondaryAction?.focusTarget ||
      "";
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
    state.currentView = "settings";
    render();
    $(MASTER_RESUME_INPUT_ID)?.click();
    return;
  }

  if (actionId === "upload_storyboard") {
    state.currentView = "settings";
    render();
    $(STORYBOARD_INPUT_ID)?.click();
    return;
  }

  if (actionId === "configure_provider") {
    state.currentView = "settings";
    render();
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
    setRunStatus(
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
      setRunStatus(
        "error",
        "Connect failed",
        error instanceof Error ? error.message : "Unable to open sign-in.",
      );
    }
    return;
  }

  if (actionId === "continue-storyboard") {
    const connected = await reconcileConnectionStatus("run");
    if (!connected) {
      state.awaitingStoryboard = false;
      state.isRunning = false;
      return;
    }
    state.awaitingStoryboard = false;
    state.isRunning = true;
    clearScrapeRecoveryState();
    setRunStatus("running", "Continuing run", "Running without a story bank.");
    try {
      const response = await sendMessage(
        "CONTINUE_PENDING_GENERATION_WITHOUT_STORYBOARD",
      );
      if (!response?.ok) {
        throw new Error(
          response?.error || "Failed to continue without story bank.",
        );
      }
    } catch (error) {
      state.isRunning = false;
      state.activeRunJob = null;
      setRunStatus(
        "error",
        "Run failed",
        formatErrorText(
          error instanceof Error
            ? error.message
            : "Failed to continue without story bank.",
        ),
      );
    }
    return;
  }

  if (actionId === "cancel-storyboard") {
    state.awaitingStoryboard = false;
    await sendMessage("CLEAR_PENDING_EXTENSION_ACTION").catch(() => {});
    setRunStatus("neutral", "", "");
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
    $(MASTER_RESUME_INPUT_ID)?.click();
    return;
  }

  if (actionId === "upload_storyboard") {
    $(STORYBOARD_INPUT_ID)?.click();
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

  if (actionId === "complete_onboarding") {
    const response = await sendMessage("COMPLETE_ONBOARDING");
    if (!response?.ok) {
      throw new Error(response?.error || "Failed to finish onboarding.");
    }
    setRunStatus("neutral", "", "");
    await refreshBoardData();
  }
}

function ensureRoot() {
  if (!isLinkedInJobPage()) {
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
    <section id="${BOARD_ID}" aria-label="Simplify board">
      <header class="resume-matcher-board__header">
        <div class="resume-matcher-board__brand">
          <button id="${BOARD_WEBSITE_ID}" class="resume-matcher-board__logo" type="button" aria-label="Open Lumi Coach website" title="Open Lumi Coach">
            <img src="${chrome.runtime.getURL(ICON_PATH)}" alt="" />
          </button>
          <button id="${BOARD_TITLE_ID}" class="resume-matcher-board__brand-link" type="button" aria-label="Open Lumi Coach website" title="Open Lumi Coach">
            <span class="resume-matcher-board__brand-text">
              <span class="resume-matcher-board__title">Lumi Coach</span>
            </span>
          </button>
        </div>
        <div class="resume-matcher-board__header-actions">
          <button id="${BOARD_HOME_ID}" class="resume-matcher-icon-button" type="button" aria-label="Dashboard" title="Dashboard">${icon("home")}</button>
          <button id="${BOARD_RUNS_ID}" class="resume-matcher-icon-button" type="button" aria-label="Run" title="Run">${icon("aiStar")}</button>
          <button id="${BOARD_SETTINGS_ID}" class="resume-matcher-icon-button" type="button" aria-label="Settings" title="Settings">${icon("settings")}</button>
          <button id="${BOARD_MINIMIZE_ID}" class="resume-matcher-icon-button" type="button" aria-label="Minimize" title="Minimize">${icon("minimize")}</button>
        </div>
      </header>
      <div class="resume-matcher-board__body">
        <section id="${RUN_VIEW_ID}" class="resume-matcher-view is-active">
          <article class="resume-matcher-run-shell">
            <div class="resume-matcher-run-shell__body">
              <div class="resume-matcher-run-job">
                <h2 id="resume-matcher-job-title" class="resume-matcher-run-job__title">LinkedIn job</h2>
                <span id="${RUN_READY_ID}" class="resume-matcher-run-ready is-muted">!</span>
              </div>
              <div id="${RUN_META_ID}" class="resume-matcher-run-meta"></div>
              <div id="${RUN_STATUS_ID}" class="resume-matcher-status-card" data-tone="neutral"></div>
              <div id="${RUN_ONBOARDING_ID}" class="resume-matcher-onboarding" hidden></div>
              <div id="${RUN_MANUAL_JD_FIELD_ID}" class="resume-matcher-field" hidden>
                <label for="${RUN_MANUAL_JD_ID}">Paste job description manually</label>
                <textarea id="${RUN_MANUAL_JD_ID}" rows="5" placeholder="If LinkedIn hides the full job description, paste it here to continue."></textarea>
              </div>
              <div class="resume-matcher-field">
                <label for="${RUN_NOTES_ID}">Custom message</label>
                <textarea id="${RUN_NOTES_ID}" rows="2" placeholder="Want to tell me extra useful info for this run?"></textarea>
              </div>
              <div id="${RUN_ACTIONS_ID}" class="resume-matcher-button-row">
                <button id="${RUN_SECONDARY_ID}" type="button" class="resume-matcher-button">Cancel</button>
                <button id="${RUN_PRIMARY_ID}" type="button" class="resume-matcher-button is-primary">Tailor</button>
              </div>
              <div id="${RUN_STATUS_ACTIONS_ID}" class="resume-matcher-button-row"></div>
            </div>
          </article>
        </section>
        <section id="${SETTINGS_VIEW_ID}" class="resume-matcher-view">
          <div class="resume-matcher-settings-stack">
            <section class="resume-matcher-settings-group">
              <h3 class="resume-matcher-settings-title">Core</h3>
              <div class="resume-matcher-settings-list">
                <div class="resume-matcher-settings-item">
                  <div class="resume-matcher-file-row">
                    <div id="${MASTER_RESUME_LABEL_ID}" class="resume-matcher-file-chip is-placeholder">
                      <span class="resume-matcher-file-chip__text">Master resume</span>
                      <button id="${MASTER_RESUME_ACTION_ID}" type="button" class="resume-matcher-file-chip__action" aria-label="Upload master resume" title="Upload master resume">${renderFileActionIcon("upload")}</button>
                    </div>
                    <input id="${MASTER_RESUME_INPUT_ID}" class="resume-matcher-file-input" type="file" accept=".txt,.md,.json,text/plain,text/markdown,application/json" />
                  </div>
                </div>
                <div class="resume-matcher-settings-item">
                  <div class="resume-matcher-file-row">
                    <div id="${STORYBOARD_LABEL_ID}" class="resume-matcher-file-chip is-placeholder">
                      <span class="resume-matcher-file-chip__text">Story bank</span>
                      <button id="${STORYBOARD_ACTION_ID}" type="button" class="resume-matcher-file-chip__action" aria-label="Upload story bank" title="Upload story bank">${renderFileActionIcon("upload")}</button>
                    </div>
                    <input id="${STORYBOARD_INPUT_ID}" class="resume-matcher-file-input" type="file" accept=".txt,.md,.json,text/plain,text/markdown,application/json" />
                  </div>
                  <a class="resume-matcher-settings-item__link" href="${STORY_BANK_GUIDE_URL}" target="_blank" rel="noopener noreferrer">Story bank helps tailoring. Learn more.</a>
                </div>
                <div class="resume-matcher-settings-item">
                  <div class="resume-matcher-settings-item__title">Google sign-in</div>
                  <div class="resume-matcher-google-connect">
                    <button id="${ACCOUNT_ACTION_ID}" type="button" class="resume-matcher-button resume-matcher-google-button">${renderGoogleButtonLabel("Sign in with Google")}</button>
                  </div>
                </div>
                <div class="resume-matcher-settings-item">
                  <div class="resume-matcher-settings-item__title">Provider</div>
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
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
            <details id="${ADVANCED_TOGGLE_ID}" class="resume-matcher-advanced">
              <summary>Advanced</summary>
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
                  </div>
                  <div class="resume-matcher-settings-item">
                    <div class="resume-matcher-settings-item__title">Prompting</div>
                    <div class="resume-matcher-settings-item__detail">Upload .txt only. Upload the main prompt only.</div>
                    <div class="resume-matcher-settings-substack">
                      ${PROMPT_FILE_DESCRIPTORS.map(
                        ({ templateName, label, defaultPath }) => `
                        <div class="resume-matcher-settings-item">
                          <div class="resume-matcher-file-row">
                            <div id="${promptLabelId(templateName)}" class="resume-matcher-file-chip is-placeholder">
                              <span class="resume-matcher-file-chip__text">${label}</span>
                              <span class="resume-matcher-file-chip__actions">
                                ${defaultPath ? `<button id="${promptDownloadId(templateName)}" type="button" class="resume-matcher-file-chip__action" aria-label="Download default ${label}" title="Download default ${label}">${icon("download")}</button>` : ""}
                                <button id="${promptActionId(templateName)}" type="button" class="resume-matcher-file-chip__action" aria-label="Upload ${label}" title="Upload ${label}">${renderFileActionIcon("upload")}</button>
                              </span>
                            </div>
                            <input id="${promptInputId(templateName)}" class="resume-matcher-file-input" type="file" accept=".txt,text/plain" />
                          </div>
                        </div>
                      `,
                      ).join("")}
                    </div>
                  </div>
                  <div class="resume-matcher-advanced-actions resume-matcher-field--full">
                    <button id="resume-matcher-open-history-web" type="button" class="resume-matcher-button">Open history</button>
                    <button id="${RESET_DEFAULTS_ID}" type="button" class="resume-matcher-button">Reset settings</button>
                    <button id="${RESET_LOCAL_ID}" type="button" class="resume-matcher-button is-danger">Clear local data</button>
                  </div>
                  <label class="resume-matcher-inline-action resume-matcher-field--full" for="${CUSTOM_FEATURE_INPUT_ID}">
                    <span class="resume-matcher-inline-action__label">Enable custom feature</span>
                    <input id="${CUSTOM_FEATURE_INPUT_ID}" class="resume-matcher-checkbox" type="checkbox" />
                    <span class="resume-matcher-toggle" aria-hidden="true"></span>
                  </label>
                  <div id="${RUNTIME_URLS_ROW_ID}" class="resume-matcher-settings-grid resume-matcher-settings-grid--single" hidden>
                    <div class="resume-matcher-settings-item">
                      <div class="resume-matcher-settings-item__title">App URL</div>
                      <input id="${APP_URL_INPUT_ID}" type="url" placeholder="App URL" />
                    </div>
                    <div class="resume-matcher-settings-item">
                      <div class="resume-matcher-settings-item__title">API URL</div>
                      <input id="${API_URL_INPUT_ID}" type="url" placeholder="API URL" />
                    </div>
                  </div>
                </div>
              </section>
            </details>
          </div>
        </section>
      </div>
    </section>
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
  $(BOARD_WEBSITE_ID)?.addEventListener("click", () => {
    window.open(APP_URL, "_blank", "noopener,noreferrer");
  });
  $(BOARD_TITLE_ID)?.addEventListener("click", () => {
    window.open(APP_URL, "_blank", "noopener,noreferrer");
  });
  $(BOARD_HOME_ID)?.addEventListener("click", () => {
    window.open(`${getAppOrigin()}/dashboard`, "_blank", "noopener,noreferrer");
  });
  $(BOARD_RUNS_ID)?.addEventListener("click", async () => {
    state.currentView = "run";
    render();
    await reconcileConnectionStatus("run");
  });
  $(BOARD_SETTINGS_ID)?.addEventListener("click", async () => {
    state.currentView = state.currentView === "settings" ? "run" : "settings";
    state.launcherAlert = false;
    render();
    await reconcileConnectionStatus(state.currentView);
  });
  $(BOARD_MINIMIZE_ID)?.addEventListener("click", minimizeBoard);
  $(RUN_PRIMARY_ID)?.addEventListener("click", handleGenerateClick);
  $(RUN_SECONDARY_ID)?.addEventListener("click", minimizeBoard);
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
        await refreshBoardData();
      }
    } catch (error) {
      setRunStatus(
        "error",
        "Save failed",
        error instanceof Error ? error.message : "Unable to save provider.",
      );
    }
  });
  $(RUN_ONBOARDING_ID)?.addEventListener("focusout", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const providerInputIds = new Set([
      "resume-matcher-onboarding-provider-web-input",
      "resume-matcher-onboarding-provider-api-base-input",
      "resume-matcher-onboarding-provider-model-input",
      "resume-matcher-onboarding-provider-api-key-input",
    ]);
    if (!providerInputIds.has(target.id)) return;
    try {
      await persistSelectedProviderSettings({
        selectId: "resume-matcher-onboarding-provider-select",
        webInputId: "resume-matcher-onboarding-provider-web-input",
        apiBaseInputId: "resume-matcher-onboarding-provider-api-base-input",
        modelInputId: "resume-matcher-onboarding-provider-model-input",
        apiKeyInputId: "resume-matcher-onboarding-provider-api-key-input",
      });
      await refreshBoardData();
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
  $(RUN_MANUAL_JD_ID)?.addEventListener("input", (event) => {
    state.manualJobDescription = event.target.value || "";
    autoGrowTextarea(event.target);
    render();
  });
  $(MASTER_RESUME_INPUT_ID)?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await saveTextAsset(file, "SAVE_MASTER_RESUME_CONTEXT");
    event.target.value = "";
  });
  $(STORYBOARD_INPUT_ID)?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await saveTextAsset(file, "SAVE_STORYBOARD");
    event.target.value = "";
  });
  PROMPT_FILE_DESCRIPTORS.forEach(({ templateName, label }) => {
    $(promptInputId(templateName))?.addEventListener(
      "change",
      async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
          await sendMessage("SAVE_PROMPT_TEMPLATE", {
            templateName,
            promptProfileId: state.assets?.activePromptProfileId || "profile1",
            filename: file.name,
            content: await file.text(),
          });
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
  [
    PROVIDER_WEB_INPUT_ID,
    PROVIDER_API_BASE_INPUT_ID,
    PROVIDER_MODEL_INPUT_ID,
    PROVIDER_API_KEY_INPUT_ID,
  ].forEach((id) => {
    $(id)?.addEventListener("input", scheduleProviderSettingsSave);
  });
  [APP_URL_INPUT_ID, API_URL_INPUT_ID].forEach((id) => {
    $(id)?.addEventListener("input", scheduleRuntimeUrlsSave);
  });
  $(APIFY_ENABLED_INPUT_ID)?.addEventListener("change", () => {
    state.assets = {
      ...(state.assets || {}),
      apifyFallbackSettings: {
        ...(state.assets?.apifyFallbackSettings || {}),
        enabled: $(APIFY_ENABLED_INPUT_ID)?.checked === true,
      },
    };
    renderSettings();
    scheduleApifyFallbackSave();
  });
  $(APIFY_TOKEN_INPUT_ID)?.addEventListener("input", (event) => {
    secretDraftState[APIFY_TOKEN_INPUT_ID] = event.target.value || "";
    scheduleApifyFallbackSave();
  });
  $(APIFY_TOKEN_TOGGLE_ID)?.addEventListener("click", (event) => {
    event.preventDefault();
    toggleSecretReveal(APIFY_TOKEN_INPUT_ID);
  });
  [
    PROVIDER_API_KEY_INPUT_ID,
    ONBOARDING_PROVIDER_API_KEY_INPUT_ID,
    APIFY_TOKEN_INPUT_ID,
  ].forEach((id) => {
    $(id)?.addEventListener("focus", (event) => {
      beginSecretEdit(event.target);
    });
    $(id)?.addEventListener("mousedown", (event) => {
      beginSecretEdit(event.target);
    });
    $(id)?.addEventListener("copy", (event) => {
      event.preventDefault();
    });
    $(id)?.addEventListener("cut", (event) => {
      event.preventDefault();
    });
    $(id)?.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });
    $(id)?.addEventListener("blur", () => {
      if (
        secretEditingState[id] === true &&
        !(secretDraftState[id] || "").trim()
      ) {
        endSecretEdit(id);
      }
    });
  });
  $(CUSTOM_FEATURE_INPUT_ID)?.addEventListener("change", async (event) => {
    await sendMessage("SAVE_CUSTOM_FEATURE_ENABLED", {
      enabled: event.target.checked,
    }).catch(() => {});
    await refreshBoardData();
  });
  $(RESET_LOCAL_ID)?.addEventListener("click", async () => {
    await sendMessage("RESET_LOCAL_DATA").catch(() => {});
    state.customMessage = "";
    await refreshBoardData();
    setRunStatus("neutral", "", "");
  });
  $(RESET_DEFAULTS_ID)?.addEventListener("click", async () => {
    await sendMessage("RESET_DEFAULT_SETTINGS").catch(() => {});
    await refreshBoardData();
  });
  $("resume-matcher-open-history-web")?.addEventListener("click", () => {
    window.open(getAppOrigin(), "_blank", "noopener,noreferrer");
  });
  root.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-status-action]");
    if (button) {
      await handleStatusAction(button.dataset.statusAction);
      return;
    }
    const guideLink = event.target.closest(`a[href="${STORY_BANK_GUIDE_URL}"]`);
    if (guideLink) {
      void trackAnalyticsEvent("extension_story_bank_guide_clicked", {
        surface:
          state.currentView === "settings" ? "settings_view" : "run_view",
      });
    }
  });
  if (!selectedJobClickListenerAttached) {
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(`#${ROOT_ID}`)) return;
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
    });
    selectedJobClickListenerAttached = true;
  }

  void applyStoredRootState(root);
  void refreshBoardData();
  return root;
}

function handleGenerateClickOpenBoard(event) {
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }
  event.preventDefault();
  openBoard("run");
}

function removeRoot() {
  pointerDragState = null;
  $(ROOT_ID)?.remove();
}

function handleViewportChange() {
  const root = $(ROOT_ID);
  if (!root) return;
  syncDockedPosition(root);
}

async function handleShowLauncher() {
  ensureRoot();
  showLauncher();
  await reconcileConnectionStatus("run");
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

  if (level === "error") {
    state.isRunning = false;
    state.awaitingAuth = false;
    state.awaitingStoryboard = false;
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
  const [title, detail] = progress;
  setRunStatus("running", title, detail);
}

function syncFloatingAction() {
  if (!isLinkedInJobPage()) {
    resetJobLoadingState();
    if (selectedJobDetailObserver) {
      selectedJobDetailObserver.disconnect();
      selectedJobDetailObserver = null;
      selectedJobDetailObservedRoot = null;
    }
    removeRoot();
    return;
  }
  ensureRoot();
  updateJobReadiness(extractCurrentJob());
  startSelectedJobDetailWatcher();
  render();
  void reconcileConnectionStatus("run");
}

function startUrlWatcher() {
  if (urlObserver) return;
  urlObserver = new MutationObserver(() => {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    resetJobLoadingState();
    updateJobReadiness(extractCurrentJob());
    if (!state.isRunning && !state.awaitingAuth && !state.awaitingStoryboard) {
      state.activeRunJob = null;
      setRunStatus("neutral", "", "");
    }
    syncFloatingAction();
  });
  urlObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
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
  });
  selectedJobDetailObserver.observe(nextRoot, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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

  if (message?.type === "EXTENSION_CONNECTION_STATE_CHANGED") {
    state.connectionState =
      message.payload?.connectionState || state.connectionState;
    if (state.connectionState !== "connected") {
      state.isRunning = false;
      state.awaitingAuth = false;
      state.activeRunJob = null;
      state.currentView = "run";
      openBoard("run", { skipConnectionCheck: true });
    }
    void reconcileConnectionStatus(state.currentView);
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "EXTENSION_AUTH_REQUIRED") {
    state.isRunning = false;
    state.awaitingAuth = message.payload?.connectionState === "signed_out";
    state.connectionState = message.payload?.connectionState || "signed_out";
    state.setupState = {
      ...(state.setupState || {}),
      state: "signed_out",
      title: "You’ve been signed out",
      detail:
        message.payload?.message ||
        "Sign in to continue tailoring this job. Your setup is still here.",
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
        "Sign in to continue tailoring this job. Your setup is still here.",
      actions: [
        {
          id: "connect",
          label: "Continue with Google",
          variant: "primary",
        },
      ],
    };
    setRunStatus(
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
    state.connectionState = "connected";
    state.websiteAuthenticated = true;
    state.extensionConnected = true;
    openBoard("run");
    setRunStatus("info", "Account signed in", "Continuing in the extension.");
    void refreshBoardData().then(() => {
      if (
        state.connectionState === "connected" &&
        /(account signed in|connected|opening google sign-in)/i.test(
          `${state.statusTitle} ${state.statusDetail}`,
        )
      ) {
        setRunStatus("neutral", "", "");
      }
    });
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "EXTENSION_SETUP_REQUIRED") {
    state.isRunning = false;
    state.awaitingAuth = false;
    state.awaitingStoryboard = false;
    state.activeRunJob = null;
    state.setupState = message.payload?.setupState || state.setupState;
    openBoard("run");
    const requirement = getSetupRequirementStatus(message.payload?.message) || {
      tone: "blocked",
      title: "Finish setup",
      detail: message.payload?.message || "Finish setup to continue.",
      actions: [],
    };
    setRunStatus(
      requirement.tone,
      requirement.title,
      requirement.detail,
      requirement.actions,
    );
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "EXTENSION_STORYBOARD_RECOMMENDATION") {
    state.isRunning = false;
    state.awaitingStoryboard = true;
    openBoard("run");
    setRunStatus(
      "warning",
      "Story bank missing",
      message.payload?.message || "Continue without story bank?",
      [
        { id: "continue-storyboard", label: "Continue", variant: "primary" },
        { id: "cancel-storyboard", label: "Cancel" },
      ],
    );
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "EXTENSION_RESUMED_GENERATION_RESULT") {
    state.awaitingAuth = false;
    state.awaitingStoryboard = false;
    state.isRunning = false;
    if (message.payload?.ok) {
      clearScrapeRecoveryState();
      setRunStatus(
        "success",
        "Opening workspace",
        `Your tailored resume for ${getJobDisplayLabel(state.activeRunJob)} is opening on the web.`,
      );
      state.activeRunJob = null;
      void refreshBoardData();
    } else {
      if (isScrapeProblemMessage(message.payload?.error)) {
        state.scrapeIssue = getScrapeRequirementStatus().detail;
        setRunStatus("warning", "Couldn’t read full JD", state.scrapeIssue, []);
        sendResponse({ ok: true });
        return true;
      }
      state.activeRunJob = null;
      setRunStatus(
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

  if (message?.type === "EXTENSION_PREVIEW_OPENED") {
    state.launcherAlert = false;
    state.activeRunJob = null;
    if (
      !state.isRunning &&
      !state.awaitingAuth &&
      !state.awaitingStoryboard &&
      state.statusTone === "success" &&
      /opening workspace|workspace ready/i.test(state.statusTitle || "")
    ) {
      setRunStatus("neutral", "", "");
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
});

void chrome.runtime
  .sendMessage({ type: "REGISTER_LOG_VIEWER" })
  .catch(() => {});

window.addEventListener("resize", handleViewportChange);
syncFloatingAction();
startUrlWatcher();
