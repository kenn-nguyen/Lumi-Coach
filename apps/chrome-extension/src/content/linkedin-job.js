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
const RUN_NOTES_ID = "resume-matcher-run-notes";
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
const APP_URL_INPUT_ID = "resume-matcher-app-url-input";
const API_URL_INPUT_ID = "resume-matcher-api-url-input";
const ADVANCED_TOGGLE_ID = "resume-matcher-advanced-toggle";
const CUSTOM_FEATURE_INPUT_ID = "resume-matcher-custom-feature";
const RESET_LOCAL_ID = "resume-matcher-reset-local";
const RESET_DEFAULTS_ID = "resume-matcher-reset-defaults";
const STYLE_ID = "resume-matcher-floating-style";
const POSITION_KEY = "resumeMatcherFloatingPosition";
const DISMISSED_KEY = "resumeMatcherFloatingButtonDismissed";
const ICON_PATH = "src/assets/rocket.png";
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
const PROMPT_FILE_DESCRIPTORS = [
  {
    templateName: "prompt1",
    label: "Prompt 1 Analyze job description",
    defaultPath: "src/prompts/prompt1.txt",
    downloadName: "prompt1.default.txt",
  },
  {
    templateName: "prompt2",
    label: "Prompt 2 Strategize positioning",
    defaultPath: "src/prompts/prompt2.txt",
    downloadName: "prompt2.default.txt",
  },
  {
    templateName: "prompt3",
    label: "Prompt 3 Write tailored resume",
    defaultPath: "src/prompts/prompt3.txt",
    downloadName: "prompt3.default.txt",
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
let lastUrl = location.href;
let pointerDragState = null;
let suppressNextClick = false;
let providerSettingsSaveTimer = null;
let runtimeUrlsSaveTimer = null;
let jobLoadTimer = null;

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
  statusActions: [],
  assets: null,
  history: [],
  extensionState: null,
  connectionState: "signed_out",
  websiteAuthenticated: false,
  extensionConnected: false,
  jobLoadState: "idle",
  jobLoadStartedAt: null,
  customMessage: "",
  currentJob: null,
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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
  if (!descriptor?.defaultPath || !descriptor.downloadName) return;

  const response = await fetch(chrome.runtime.getURL(descriptor.defaultPath));
  if (!response.ok) {
    throw new Error(`Failed to load default ${descriptor.label}.`);
  }

  const text = await response.text();
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
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

    #${ROOT_ID}[data-current-view="runs"] #${BOARD_ID},
    #${ROOT_ID}[data-current-view="settings"] #${BOARD_ID} {
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
      transition: background 140ms ease, color 140ms ease, transform 140ms ease, border-color 140ms ease;
    }

    .resume-matcher-icon-button:hover {
      background: rgba(255, 255, 255, 0.52);
      border-color: rgba(255, 255, 255, 0.82);
      color: rgba(0, 0, 0, 0.84);
      transform: translateY(-0.5px);
    }

    .resume-matcher-icon-button svg,
    .resume-matcher-board__subtitle svg {
      width: 15px;
      height: 15px;
      display: block;
    }

    .resume-matcher-icon-button.is-active {
      color: rgba(0, 0, 0, 0.85);
      background: transparent;
      opacity: 1;
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
      color: #1f2937;
      font-size: 12px;
      line-height: 1.2;
    }

    .resume-matcher-file-chip.is-placeholder {
      color: #98a2b3;
    }

    .resume-matcher-file-chip__text {
      flex: 1 1 auto;
      min-width: 0;
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

    .resume-matcher-status-card {
      display: none;
      gap: 8px;
    }

    .resume-matcher-status-card.is-visible {
      display: grid;
    }

    .resume-matcher-status-card[data-tone="error"] {
      background: rgba(255, 59, 48, 0.14);
      border: 1px solid rgba(255, 59, 48, 0.24);
      border-radius: 10px;
      padding: 12px 16px;
    }

    .resume-matcher-status-card[data-tone="running"] {
      background: rgba(0, 122, 255, 0.14);
      border: 1px solid rgba(0, 122, 255, 0.2);
      border-radius: 10px;
      padding: 12px 16px;
    }

    .resume-matcher-status-card[data-tone="success"] {
      background: rgba(52, 199, 89, 0.14);
      border: 1px solid rgba(52, 199, 89, 0.2);
      border-radius: 10px;
      padding: 12px 16px;
    }

    .resume-matcher-status-card[data-tone="blocked"] {
      background:
        radial-gradient(circle at top right, rgba(255, 220, 150, 0.38), transparent 42%),
        linear-gradient(180deg, rgba(255, 186, 73, 0.32), rgba(255, 154, 58, 0.22));
      border: 1px solid rgba(255, 150, 56, 0.52);
      color: rgba(132, 56, 12, 0.98);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.42),
        0 10px 22px rgba(255, 154, 58, 0.12);
      backdrop-filter: blur(12px) saturate(145%);
      -webkit-backdrop-filter: blur(12px) saturate(145%);
      border-radius: 10px;
      padding: 12px 16px;
    }

    .resume-matcher-status-card[data-tone="warning"] {
      background:
        radial-gradient(circle at top right, rgba(255, 228, 170, 0.28), transparent 42%),
        linear-gradient(180deg, rgba(255, 197, 102, 0.2), rgba(255, 171, 84, 0.14));
      border: 1px solid rgba(255, 162, 70, 0.34);
      color: rgba(132, 56, 12, 0.94);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.34),
        0 8px 18px rgba(255, 171, 84, 0.08);
      backdrop-filter: blur(10px) saturate(138%);
      -webkit-backdrop-filter: blur(10px) saturate(138%);
      border-radius: 10px;
      padding: 12px 16px;
    }

    .resume-matcher-status-card[data-tone="info"] {
      background: rgba(14, 165, 233, 0.12);
      border: 1px solid rgba(2, 132, 199, 0.18);
      border-radius: 10px;
      padding: 12px 16px;
    }

    .resume-matcher-status-card[data-tone="neutral"] {
      background: rgba(255, 255, 255, 0.58);
      border: 1px solid rgba(255, 255, 255, 0.7);
      border-radius: 10px;
      padding: 12px 16px;
    }

    .resume-matcher-status-card[data-tone="idle"] {
      background: rgba(255, 255, 255, 0.58);
      border: 1px solid rgba(255, 255, 255, 0.7);
      border-radius: 10px;
      padding: 12px 16px;
    }

    .resume-matcher-status-title {
      font-size: 13px;
      font-weight: 700;
      color: rgba(0, 0, 0, 0.88);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .resume-matcher-status-detail {
      font-size: 13px;
      line-height: 1.45;
      color: rgba(0, 0, 0, 0.76);
      overflow-wrap: anywhere;
    }

    .resume-matcher-status-spinner {
      width: 13px;
      height: 13px;
      flex: 0 0 auto;
      border-radius: 999px;
      border: 2px solid rgba(2, 132, 199, 0.2);
      border-top-color: rgba(2, 132, 199, 0.88);
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
      gap: 10px;
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

    .resume-matcher-settings-substack {
      display: grid;
      gap: 8px;
      padding-top: 2px;
    }

    .resume-matcher-settings-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
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
      padding: 9px 11px;
      font-size: 12px;
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
      padding: 9px 11px;
      font-size: 12px;
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
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #667085;
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
      gap: 8px;
      cursor: pointer;
    }

    .resume-matcher-inline-action__label::before {
      content: "";
      width: 14px;
      height: 14px;
      border: 1.5px solid #98a2b3;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.96);
      box-sizing: border-box;
      flex: 0 0 auto;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
    }

    .resume-matcher-checkbox:checked + .resume-matcher-inline-action__label::before {
      background: #2563eb;
      border-color: #2563eb;
      box-shadow: inset 0 0 0 3px #ffffff;
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
      grid-template-columns: repeat(2, max-content);
      gap: 8px;
      justify-content: start;
    }

    .resume-matcher-advanced-actions .resume-matcher-button {
      width: auto;
      min-height: 28px !important;
      padding: 5px 10px !important;
      font-size: 11px !important;
      line-height: 1 !important;
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
  state.boardOpen = true;
  state.currentView = view;
  state.launcherAlert = false;
  render();
  syncDockedPosition($(ROOT_ID));
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

function hasUsableJobContext(job) {
  if (!job) return false;
  return Boolean(job.title || job.company || job.location);
}

function hasEnoughJobContext(job) {
  if (!job?.title) return false;
  return Boolean(job.company || job.location || job.highlights?.length);
}

function clearJobLoadTimer() {
  if (jobLoadTimer) {
    window.clearTimeout(jobLoadTimer);
    jobLoadTimer = null;
  }
}

function resetJobLoadingState() {
  clearJobLoadTimer();
  state.jobLoadState = "idle";
  state.jobLoadStartedAt = null;
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
    return true;
  }

  const now = Date.now();
  if (!state.jobLoadStartedAt) {
    state.jobLoadStartedAt = now;
  }

  const elapsed = now - state.jobLoadStartedAt;
  state.jobLoadState = elapsed >= JOB_LOAD_TIMEOUT_MS ? "timed_out" : "loading";

  if (state.jobLoadState === "loading") {
    scheduleJobReadinessCheck();
  } else {
    clearJobLoadTimer();
  }

  return false;
}

function getConnectionRequirementStatus() {
  return {
    tone: "blocked",
    title: "Google sign-in required",
    detail: "Sign in with Google to continue this run.",
    actions: [{ id: "connect", label: "Sign in", variant: "primary" }],
  };
}

function getRunBlockingState() {
  const hasResume = Boolean(
    state.assets?.masterResumeContextAsset?.content?.trim(),
  );
  const hasAccount = state.connectionState === "connected";
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
    return {
      tone: "blocked",
      title: "Refresh page",
      detail: "We could not read this job yet.",
      actions: [{ id: "refresh-page", label: "Refresh", variant: "primary" }],
    };
  }

  if (!hasResume) {
    return {
      tone: "blocked",
      title: "Add resume",
      detail: "Open Settings to add your master resume.",
      actions: [{ id: "open-settings", label: "Settings", variant: "primary" }],
    };
  }

  if (!hasAccount) {
    return getConnectionRequirementStatus();
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

  const title = extractText([
    ".job-details-jobs-unified-top-card__job-title h1",
    ".jobs-unified-top-card__job-title h1",
    "main h1",
  ]);
  const company = extractText([
    ".job-details-jobs-unified-top-card__company-name a",
    ".job-details-jobs-unified-top-card__company-name",
    ".jobs-unified-top-card__company-name a",
    ".jobs-unified-top-card__company-name",
  ]);
  const values = extractMetaCandidates();
  const jobLocation = guessLocation(values);
  const applicants = guessApplicants(values);
  const highlights = guessHighlights(values, jobLocation);
  return {
    title,
    company,
    location: jobLocation,
    applicants,
    highlights,
    sourceUrl: normalizedSourceUrl,
  };
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

function getSelectedProfile() {
  const settings = state.assets?.llmSettings;
  if (!settings?.profiles) return null;
  const select = $(PROVIDER_SELECT_ID);
  const profileId = select?.value || settings.activeProfileId;
  return settings.profiles[profileId] ?? null;
}

function getRunStatusCopy() {
  const blocked = getRunBlockingState();
  if (blocked) {
    return blocked;
  }

  if (state.awaitingAuth) {
    return getConnectionRequirementStatus();
  }

  if (state.awaitingStoryboard) {
    return {
      tone: "warning",
      title: "Storyboard missing",
      detail: "Continue without a storyboard or upload one in Settings.",
      actions: [
        { id: "continue-storyboard", label: "Continue", variant: "primary" },
        { id: "cancel-storyboard", label: "Cancel" },
      ],
    };
  }

  if (!state.statusTitle && state.statusTone === "neutral") {
    return null;
  }

  return {
    tone: state.statusTone,
    title: state.statusTitle,
    detail: state.statusDetail,
    actions: state.statusActions,
  };
}

function setRunStatus(tone, title, detail = "", actions = []) {
  state.statusTone = tone;
  state.statusTitle = title || "";
  state.statusDetail = detail || "";
  state.statusActions = Array.isArray(actions) ? actions : [];
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
    return "Connect your account to continue.";
  }
  if (/storyboard/i.test(normalized)) {
    return "Storyboard required or continue without it.";
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
      [
        "Generate flow started.",
        ["Starting run", "Preparing your tailored resume."],
      ],
      [
        "Loading local assets.",
        ["Loading assets", "Checking your saved setup."],
      ],
      [
        "Using active LinkedIn tab.",
        ["Checking job page", "Reading the current LinkedIn job."],
      ],
      [
        "LinkedIn scrape completed.",
        ["Job captured", "Job details are ready."],
      ],
      [
        "Resolving base resume.",
        ["Finding resume", "Locating your base resume."],
      ],
      [
        "Resolved base resume for cloning.",
        ["Resume ready", "Base resume found."],
      ],
      [
        "Cloned base resume and created job-specific resume.",
        ["Draft created", "Created a job-specific draft."],
      ],
      ["Rendering Prompt 1.", ["Prompt 1", "Preparing extraction."]],
      ["Running Prompt 1.", ["Prompt 1", "Extracting hiring signals."]],
      ["Rendering Prompt 2.", ["Prompt 2", "Preparing strategy brief."]],
      ["Running Prompt 2.", ["Prompt 2", "Building strategy brief."]],
      ["Rendering Prompt 3.", ["Prompt 3", "Preparing writing pass."]],
      ["Running Prompt 3.", ["Prompt 3", "Writing tailored resume."]],
      [
        "Validating Prompt 3 output.",
        ["Validating output", "Checking generated resume JSON."],
      ],
      [
        "Patching generated resume.",
        ["Saving draft", "Saving your tailored resume."],
      ],
      [
        "Renaming generated resume.",
        ["Naming resume", "Updating the resume title."],
      ],
      [
        "Opening generated resume preview.",
        ["Opening workspace", "Opening the tailored resume on the web."],
      ],
    ]);
    return byMessage.get(message) ?? null;
  }

  if (scope === "LinkedInScrape") {
    if (message === "Starting LinkedIn scrape.")
      return ["Reading job page", "Extracting current job details."];
    if (message === "LinkedIn scrape normalized successfully.")
      return ["Job captured", "LinkedIn job is ready."];
  }

  if (scope === "ResumeApi") {
    if (message === "Listing resumes.")
      return ["Finding resume", "Loading your available resumes."];
    if (message === "Cloning resume.")
      return ["Creating draft", "Cloning your base resume."];
    if (message === "Patch resume succeeded.")
      return ["Saved", "Generated resume saved."];
    if (message === "Rename resume succeeded.")
      return ["Named", "Resume title updated."];
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

  const options = Object.values(settings.profiles || {})
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
  const apiKeyInput = $(PROVIDER_API_KEY_INPUT_ID);
  if (apiKeyInput) apiKeyInput.value = isApi ? profile.apiKey || "" : "";
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
    const label = assets?.storyboardAsset?.filename?.trim() || "Storyboard";
    storyboardLabel.innerHTML = `<span class="resume-matcher-file-chip__text">${escapeHtml(label)}</span><button id="${STORYBOARD_ACTION_ID}" type="button" class="resume-matcher-file-chip__action" aria-label="${hasFile ? "Delete storyboard" : "Upload storyboard"}" title="${hasFile ? "Delete storyboard" : "Upload storyboard"}">${renderFileActionIcon(hasFile ? "delete" : "upload")}</button>`;
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
  const customFeature = $(CUSTOM_FEATURE_INPUT_ID);
  if (customFeature)
    customFeature.checked = assets?.customFeatureEnabled === true;

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
  const isLoadingJob =
    state.jobLoadState === "loading" && !hasEnoughJobContext(state.currentJob);
  const canRun = isRunReady();
  if (readyPill) {
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
    const job = state.currentJob || {};
    const parts = [];
    if (job.company) parts.push(`<strong>${escapeHtml(job.company)}</strong>`);
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

  const notes = $(RUN_NOTES_ID);
  if (notes && notes.value !== state.customMessage) {
    notes.value = state.customMessage;
    autoGrowTextarea(notes);
  }

  const primaryButton = $(RUN_PRIMARY_ID);
  if (primaryButton) {
    primaryButton.disabled = state.isRunning || !canRun;
    primaryButton.textContent = state.isRunning ? "Running…" : "Tailor";
  }

  const secondaryButton = $(RUN_SECONDARY_ID);
  if (secondaryButton) {
    secondaryButton.textContent = "Minimize";
  }

  const mainActions = $(RUN_ACTIONS_ID);
  const statusRoot = $(RUN_STATUS_ID);
  const statusActions = $(RUN_STATUS_ACTIONS_ID);
  if (statusRoot && statusActions) {
    statusRoot.classList.toggle("is-visible", Boolean(status));
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
    mainActions.classList.toggle("is-hidden", shouldHideMainActions);
  }

  const titleNode = document.querySelector("#resume-matcher-job-title");
  if (titleNode) {
    titleNode.textContent =
      state.currentJob?.title ||
      (isLoadingJob
        ? "Loading job"
        : hasUsableJobContext(state.currentJob)
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
  if (!pointerDragState) {
    root.dataset.dragging = "false";
    root.dataset.dockPreview = state.dockSide;
  }
}

function renderViews() {
  const runView = $(RUN_VIEW_ID);
  const historyView = $(HISTORY_VIEW_ID);
  const settingsView = $(SETTINGS_VIEW_ID);
  runView?.classList.toggle("is-active", state.currentView === "run");
  historyView?.classList.toggle("is-active", state.currentView === "runs");
  settingsView?.classList.toggle("is-active", state.currentView === "settings");
  $(BOARD_HOME_ID)?.classList.toggle("is-active", state.currentView === "run");
  $(BOARD_RUNS_ID)?.classList.toggle("is-active", state.currentView === "runs");
  $(BOARD_SETTINGS_ID)?.classList.toggle(
    "is-active",
    state.currentView === "settings",
  );
}

function render() {
  const root = ensureRoot();
  if (!root) return;
  renderRootFlags();
  renderViews();
  renderRunView();
  renderHistory();
  renderSettings();
}

async function refreshBoardData() {
  try {
    const response = await sendMessage("GET_STATE");
    if (!response?.ok) {
      throw new Error(response?.error || "Failed to load extension state.");
    }
    state.assets = response.assets ?? null;
    state.history = response.history ?? [];
    state.extensionState = response.state ?? null;
    updateJobReadiness(extractCurrentJob());
    render();
  } catch (error) {
    logError("Failed to refresh board data.", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function reconcileConnectionStatus(view = state.currentView) {
  try {
    const response = await sendMessage("CHECK_CONNECTION_STATUS");
    if (!response?.ok) {
      throw new Error(response?.error || "Failed to check connection status.");
    }
    state.assets = response.assets ?? state.assets;
    state.history = response.history ?? state.history;
    state.extensionState = response.state ?? state.extensionState;
    updateJobReadiness(extractCurrentJob());
    state.connectionState =
      response.connectionState ||
      (response.connected ? "connected" : "signed_out");
    state.websiteAuthenticated = response.websiteAuthenticated === true;
    state.extensionConnected = response.extensionConnected === true;
    state.awaitingAuth = response.connected !== true && view !== "settings";

    if (
      view === "run" &&
      response.connected !== true &&
      Boolean(state.assets?.masterResumeContextAsset?.content?.trim()) &&
      hasEnoughJobContext(state.currentJob)
    ) {
      const requirement = getConnectionRequirementStatus();
      setRunStatus(
        requirement.tone,
        requirement.title,
        requirement.detail,
        requirement.actions,
      );
    } else if (
      response.connected === true &&
      state.statusTone === "blocked" &&
      /(sign[- ]in|required|connect extension)/i.test(state.statusTitle)
    ) {
      setRunStatus("neutral", "", "");
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

async function persistProviderSelection() {
  const select = $(PROVIDER_SELECT_ID);
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
}

async function persistSelectedProviderSettings() {
  const profile = getSelectedProfile();
  if (!profile) return;

  const profileUpdates =
    profile.mode === "web_automation"
      ? { targetUrl: $(PROVIDER_WEB_INPUT_ID)?.value.trim() || "" }
      : {
          apiBaseUrl: $(PROVIDER_API_BASE_INPUT_ID)?.value.trim() || "",
          model: $(PROVIDER_MODEL_INPUT_ID)?.value.trim() || "",
          apiKey: $(PROVIDER_API_KEY_INPUT_ID)?.value.trim() || "",
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
  state.launcherAlert = false;
  setRunStatus("running", "Starting run", "Preparing your tailored resume.");

  try {
    const response = await sendMessage("GENERATE_FOR_ACTIVE_JOB", {
      prompt1CustomInstruction: state.customMessage.trim(),
    });
    if (response?.awaitingAuth) {
      state.isRunning = false;
      state.awaitingAuth = true;
      state.connectionState = response.connectionState || "signed_out";
      const requirement = getConnectionRequirementStatus();
      setRunStatus(
        requirement.tone,
        requirement.title,
        response.message || requirement.detail,
        requirement.actions,
      );
      return;
    }
    if (response?.awaitingStoryboard) {
      state.isRunning = false;
      state.awaitingStoryboard = true;
      setRunStatus(
        "warning",
        "Storyboard missing",
        response.message || "Continue without a storyboard?",
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
    setRunStatus(
      "success",
      "Opening workspace",
      "Your tailored resume is opening on the web.",
    );
    await refreshBoardData();
  } catch (error) {
    state.isRunning = false;
    setRunStatus(
      "error",
      "Run failed",
      formatErrorText(
        error instanceof Error
          ? error.message
          : "Failed to generate tailored resume.",
      ),
    );
  }
}

async function handleStatusAction(actionId) {
  if (actionId === "open-settings") {
    state.currentView = "settings";
    render();
    return;
  }

  if (actionId === "refresh-page") {
    window.location.reload();
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
    setRunStatus("running", "Continuing run", "Running without a storyboard.");
    try {
      const response = await sendMessage(
        "CONTINUE_PENDING_GENERATION_WITHOUT_STORYBOARD",
      );
      if (!response?.ok) {
        throw new Error(
          response?.error || "Failed to continue without storyboard.",
        );
      }
    } catch (error) {
      state.isRunning = false;
      setRunStatus(
        "error",
        "Run failed",
        formatErrorText(
          error instanceof Error
            ? error.message
            : "Failed to continue without storyboard.",
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
          <button id="${BOARD_HOME_ID}" class="resume-matcher-icon-button" type="button" aria-label="Run" title="Run">${icon("home")}</button>
          <button id="${BOARD_RUNS_ID}" class="resume-matcher-icon-button" type="button" aria-label="Runs" title="Runs">${icon("history")}</button>
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
        <section id="${HISTORY_VIEW_ID}" class="resume-matcher-view">
          <div class="resume-matcher-history-toolbar">
            <div class="resume-matcher-history-search">
              <input id="${HISTORY_SEARCH_ID}" type="search" placeholder="Search title or company" />
              <div id="${HISTORY_FILTER_ID}" class="resume-matcher-history-filter" data-open="false">
                <button type="button" id="${HISTORY_FILTER_ID}-button" class="resume-matcher-history-filter__button" aria-label="History sort options" title="Sort options">${icon("filter")}</button>
                <div id="${HISTORY_FILTER_MENU_ID}" class="resume-matcher-history-filter__menu">
                  <button type="button" id="${HISTORY_SORT_DESC_ID}" class="resume-matcher-history-filter__option">Descending</button>
                  <button type="button" id="${HISTORY_SORT_ASC_ID}" class="resume-matcher-history-filter__option">Ascending</button>
                </div>
              </div>
            </div>
          </div>
          <div id="${HISTORY_LIST_ID}" class="resume-matcher-history-list"></div>
          <div class="resume-matcher-history-pagination">
            <button id="${HISTORY_PREV_ID}" type="button" aria-label="Previous page" title="Previous page">${icon("chevronLeft")}</button>
            <span id="${HISTORY_PAGE_ID}">1/1</span>
            <button id="${HISTORY_NEXT_ID}" type="button" aria-label="Next page" title="Next page">${icon("chevronRight")}</button>
          </div>
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
                      <span class="resume-matcher-file-chip__text">Storyboard</span>
                      <button id="${STORYBOARD_ACTION_ID}" type="button" class="resume-matcher-file-chip__action" aria-label="Upload storyboard" title="Upload storyboard">${renderFileActionIcon("upload")}</button>
                    </div>
                    <input id="${STORYBOARD_INPUT_ID}" class="resume-matcher-file-input" type="file" accept=".txt,.md,.json,text/plain,text/markdown,application/json" />
                  </div>
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
                  <div class="resume-matcher-settings-item">
                    <div class="resume-matcher-settings-item__title">Prompting</div>
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
                  <div class="resume-matcher-settings-grid">
                    <div class="resume-matcher-settings-item">
                      <div class="resume-matcher-settings-item__title">App URL</div>
                      <input id="${APP_URL_INPUT_ID}" type="url" placeholder="App URL" />
                    </div>
                    <div class="resume-matcher-settings-item">
                      <div class="resume-matcher-settings-item__title">API URL</div>
                      <input id="${API_URL_INPUT_ID}" type="url" placeholder="API URL" />
                    </div>
                  </div>
                  <div class="resume-matcher-advanced-actions resume-matcher-field--full">
                    <button id="${RESET_DEFAULTS_ID}" type="button" class="resume-matcher-button">Reset settings</button>
                    <button id="${RESET_LOCAL_ID}" type="button" class="resume-matcher-button is-danger">Clear local data</button>
                  </div>
                  <label class="resume-matcher-inline-action resume-matcher-field--full" for="${CUSTOM_FEATURE_INPUT_ID}">
                    <input id="${CUSTOM_FEATURE_INPUT_ID}" class="resume-matcher-checkbox" type="checkbox" />
                    <span class="resume-matcher-inline-action__label">Enable custom feature</span>
                  </label>
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
  $(BOARD_HOME_ID)?.addEventListener("click", async () => {
    state.currentView = "run";
    render();
    await reconcileConnectionStatus("run");
  });
  $(BOARD_RUNS_ID)?.addEventListener("click", () => {
    state.currentView = state.currentView === "runs" ? "run" : "runs";
    state.launcherAlert = false;
    render();
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
  $(HISTORY_SEARCH_ID)?.addEventListener("input", (event) => {
    state.historySearch = event.target.value || "";
    state.historyPage = 1;
    renderHistory();
  });
  $(HISTORY_PREV_ID)?.addEventListener("click", () => {
    if (state.historyPage <= 1) return;
    state.historyPage -= 1;
    renderHistory();
  });
  $(HISTORY_NEXT_ID)?.addEventListener("click", () => {
    const { totalPages } = getVisibleHistory();
    if (state.historyPage >= totalPages) return;
    state.historyPage += 1;
    renderHistory();
  });
  root.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-status-action]");
    if (button) {
      await handleStatusAction(button.dataset.statusAction);
      return;
    }
    if (event.target.closest(`#${HISTORY_FILTER_ID}-button`)) {
      state.historyFilterOpen = !state.historyFilterOpen;
      renderHistory();
      return;
    }
    if (event.target.closest(`#${HISTORY_SORT_ASC_ID}`)) {
      state.historySortDirection = "asc";
      state.historyFilterOpen = false;
      state.historyPage = 1;
      renderHistory();
      return;
    }
    if (event.target.closest(`#${HISTORY_SORT_DESC_ID}`)) {
      state.historySortDirection = "desc";
      state.historyFilterOpen = false;
      state.historyPage = 1;
      renderHistory();
      return;
    }
    const historyJobButton = event.target.closest("[data-history-job]");
    if (historyJobButton) {
      const entry = state.history[Number(historyJobButton.dataset.historyJob)];
      const sourceUrl = getHistorySourceUrl(entry);
      if (sourceUrl) {
        window.open(sourceUrl, "_blank", "noopener,noreferrer");
      }
      return;
    }
    const historyButton = event.target.closest("[data-history-open]");
    if (historyButton) {
      event.preventDefault();
      state.historyFilterOpen = false;
      const entry = state.history[Number(historyButton.dataset.historyOpen)];
      if (entry?.previewUrl) {
        await sendMessage("OPEN_PREVIEW", {
          previewUrl: entry.previewUrl,
        }).catch(() => {});
      }
      return;
    }
    if (
      !event.target.closest(`#${HISTORY_FILTER_ID}`) &&
      state.historyFilterOpen
    ) {
      state.historyFilterOpen = false;
      renderHistory();
    }
  });

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
  const [title, detail] = progress;
  setRunStatus("running", title, detail);
}

function syncFloatingAction() {
  if (!isLinkedInJobPage()) {
    resetJobLoadingState();
    removeRoot();
    return;
  }
  ensureRoot();
  updateJobReadiness(extractCurrentJob());
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
    state.isRunning = false;
    state.awaitingAuth = false;
    state.awaitingStoryboard = false;
    setRunStatus("neutral", "", "");
    syncFloatingAction();
  });
  urlObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
    }
    void reconcileConnectionStatus(state.currentView);
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "EXTENSION_AUTH_REQUIRED") {
    state.isRunning = false;
    state.awaitingAuth = message.payload?.connectionState === "signed_out";
    state.connectionState = message.payload?.connectionState || "signed_out";
    openBoard("run");
    const requirement = getConnectionRequirementStatus();
    setRunStatus(
      requirement.tone,
      requirement.title,
      message.payload?.message || requirement.detail,
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
    setRunStatus("info", "Connected", "Resuming your run.");
    void refreshBoardData();
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "EXTENSION_STORYBOARD_RECOMMENDATION") {
    state.isRunning = false;
    state.awaitingStoryboard = true;
    openBoard("run");
    setRunStatus(
      "warning",
      "Storyboard missing",
      message.payload?.message || "Continue without storyboard?",
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
      setRunStatus(
        "success",
        "Opening workspace",
        "Your tailored resume is opening on the web.",
      );
      void refreshBoardData();
    } else {
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
