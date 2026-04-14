const ROOT_ID = 'resume-matcher-floating-action';
const BUTTON_ID = 'resume-matcher-generate-button';
const STATUS_ID = 'resume-matcher-generate-status';
const PROMPT1_DETAILS_ID = 'resume-matcher-prompt1-details';
const PROMPT1_SUMMARY_ID = 'resume-matcher-prompt1-summary';
const PROMPT1_TEXTAREA_ID = 'resume-matcher-prompt1-textarea';
const STYLE_ID = 'resume-matcher-floating-style';
const STORAGE_KEY = 'resumeMatcherFloatingButtonTopOffset';
const ICON_PATH = 'src/assets/lightning-bolt.gif';
const LOG_PREFIX = '[ResumeMatcherExt][LinkedInButton]';
const VIEWPORT_PADDING = 20;

let isRunning = false;
let urlObserver = null;
let lastUrl = location.href;
let pointerDragState = null;
let suppressNextClick = false;
let clearStatusTimeout = null;

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

function logRelayed(level, scope, message, data) {
  let normalizedData = data;
  if (normalizedData && typeof normalizedData === 'object' && typeof normalizedData.submitDebug === 'string') {
    try {
      normalizedData = {
        ...normalizedData,
        submitDebug: JSON.parse(normalizedData.submitDebug),
      };
    } catch {
      // Keep original string payload if it is not valid JSON.
    }
  }
  if (normalizedData && typeof normalizedData === 'object' && normalizedData.submitDebug && !normalizedData.submitDebugText) {
    try {
      normalizedData = {
        ...normalizedData,
        submitDebugText: JSON.stringify(normalizedData.submitDebug),
      };
    } catch {
      // ignore JSON stringify failures for debug payloads
    }
  }
  const formatted = `[ResumeMatcherExt][${scope}] ${message}`;
  if (level === 'error') {
    if (normalizedData === undefined) {
      console.error(formatted);
      return;
    }
    console.error(formatted, normalizedData);
    return;
  }
  if (level === 'warn') {
    if (normalizedData === undefined) {
      console.warn(formatted);
      return;
    }
    console.warn(formatted, normalizedData);
    return;
  }
  if (normalizedData === undefined) {
    console.info(formatted);
    return;
  }
  console.info(formatted, normalizedData);
}

function isLinkedInJobPage() {
  return location.hostname === 'www.linkedin.com' && location.pathname.startsWith('/jobs/');
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${ROOT_ID} {
      position: fixed;
      right: 8px;
      top: 50vh;
      z-index: 2147483647;
      display: grid;
      justify-items: center;
      gap: 4px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      touch-action: none;
      user-select: none;
      width: 132px;
    }

    #${BUTTON_ID} {
      appearance: none;
      border: 1px solid rgba(251, 146, 60, 0.38);
      border-radius: 24px;
      padding: 10px;
      position: relative;
      overflow: hidden;
      isolation: isolate;
      background: rgba(255, 248, 240, 0.98);
      box-shadow:
        0 0 0 4px rgba(251, 146, 60, 0.08),
        0 14px 30px rgba(180, 83, 9, 0.16),
        inset 0 1px 0 rgba(255, 255, 255, 0.7);
      cursor: pointer;
      display: grid;
      place-items: center;
      width: 78px;
      height: 78px;
    }

    #${BUTTON_ID}::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: linear-gradient(180deg, rgba(251, 146, 60, 0.2) 0%, rgba(249, 115, 22, 0.28) 100%);
      mix-blend-mode: multiply;
      pointer-events: none;
      z-index: 1;
    }

    #${BUTTON_ID}:disabled {
      opacity: 0.7;
      cursor: wait;
    }

    #${BUTTON_ID} img {
      display: block;
      width: 58px;
      height: 58px;
      object-fit: contain;
      pointer-events: none;
      position: relative;
      z-index: 0;
      filter: drop-shadow(0 3px 8px rgba(249, 115, 22, 0.16));
    }

    #${STATUS_ID} {
      display: none;
      width: fit-content;
      max-width: min(372px, calc(100vw - 24px));
      min-width: 0;
      padding: 9px 12px;
      border-radius: 12px;
      background: rgba(255, 247, 237, 0.95);
      box-shadow: 0 10px 22px rgba(180, 83, 9, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.18);
      font-size: 12px;
      line-height: 1.3;
      color: #9a3412;
      text-align: center;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
      overflow: hidden;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      justify-self: end;
      align-self: start;
      box-sizing: border-box;
    }

    #${STATUS_ID}[data-visible="true"] {
      display: -webkit-box;
    }

    #${ROOT_ID}[data-state="running"] #${STATUS_ID} {
      color: #9a3412;
    }

    #${ROOT_ID}[data-state="error"] #${STATUS_ID} {
      color: #b42318;
      font-weight: 600;
      background: rgba(254, 242, 242, 0.97);
      border-color: rgba(220, 38, 38, 0.16);
    }

    #${ROOT_ID}[data-state="success"] #${STATUS_ID} {
      color: #166534;
      background: rgba(255, 251, 235, 0.97);
      border-color: rgba(245, 158, 11, 0.16);
    }

    #${PROMPT1_DETAILS_ID} {
      position: relative;
      width: 132px;
      display: grid;
      justify-items: center;
      justify-self: center;
    }

    #${PROMPT1_SUMMARY_ID} {
      list-style: none;
      cursor: pointer;
      color: #c2410c;
      font-size: 0;
      line-height: 0;
      padding: 0;
      user-select: none;
      text-align: center;
      justify-self: center;
      margin-top: -1px;
      display: grid;
      place-items: center;
    }

    #${PROMPT1_SUMMARY_ID}::-webkit-details-marker {
      display: none;
    }

    #${PROMPT1_SUMMARY_ID} svg {
      width: 16px;
      height: 16px;
      display: block;
      stroke: currentColor;
      stroke-width: 2.25;
      fill: none;
      transition: transform 140ms ease;
    }

    #${PROMPT1_DETAILS_ID}[open] #${PROMPT1_SUMMARY_ID} {
      color: #9a3412;
    }

    #${PROMPT1_DETAILS_ID}[open] #${PROMPT1_SUMMARY_ID} svg {
      transform: rotate(180deg);
    }

    .resume-matcher-prompt1-panel {
      position: absolute;
      top: calc(100% + 6px);
      right: 50%;
      transform: translateX(50%);
      width: min(210px, calc(100vw - 8px));
      display: grid;
      padding: 10px;
      border-radius: 12px;
      background: rgba(255, 247, 237, 0.98);
      box-shadow: 0 10px 22px rgba(180, 83, 9, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.18);
      justify-self: end;
    }

    #${PROMPT1_TEXTAREA_ID} {
      width: 100%;
      min-height: 72px;
      box-sizing: border-box;
      resize: vertical;
      border: 1px solid rgba(245, 158, 11, 0.28);
      border-radius: 10px;
      background: rgba(255, 252, 245, 0.98);
      color: #7c2d12;
      padding: 8px 10px;
      font: inherit;
      font-size: 12px;
      line-height: 1.4;
    }

    #${PROMPT1_TEXTAREA_ID}::placeholder {
      color: rgba(154, 52, 18, 0.72);
    }

    #${PROMPT1_TEXTAREA_ID}:focus {
      outline: none;
      border-color: rgba(249, 115, 22, 0.7);
      box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.18);
    }
  `;
  document.documentElement.appendChild(style);
}

function getRootHeight(root) {
  if (!root) return 0;
  const rect = root.getBoundingClientRect();
  return rect.height || 0;
}

function getDefaultTop(root) {
  const rootHeight = getRootHeight(root);
  const fallbackTop = Math.round((window.innerHeight - rootHeight) / 2);
  return Math.max(VIEWPORT_PADDING, fallbackTop);
}

function clampTop(top, root) {
  const rootHeight = getRootHeight(root);
  const maxTop = Math.max(VIEWPORT_PADDING, window.innerHeight - rootHeight - VIEWPORT_PADDING);
  return Math.min(Math.max(Math.round(top), VIEWPORT_PADDING), maxTop);
}

async function persistTopOffset(top) {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: top });
  } catch (error) {
    logError('Failed to persist floating button position.', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function applyStoredTopOffset(root) {
  if (!root) return;
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const savedTop = stored?.[STORAGE_KEY];
    const nextTop = typeof savedTop === 'number'
      ? clampTop(savedTop, root)
      : getDefaultTop(root);
    root.style.top = `${nextTop}px`;
  } catch (error) {
    logError('Failed to restore floating button position.', {
      error: error instanceof Error ? error.message : String(error),
    });
    root.style.top = `${getDefaultTop(root)}px`;
  }
}

function updateFloatingTop(root, nextTop) {
  const clampedTop = clampTop(nextTop, root);
  root.style.top = `${clampedTop}px`;
  return clampedTop;
}

function handlePointerMove(event) {
  if (!pointerDragState) return;
  const root = document.getElementById(ROOT_ID);
  if (!root) return;

  const nextTop = pointerDragState.originTop + (event.clientY - pointerDragState.startY);
  const clampedTop = updateFloatingTop(root, nextTop);
  const moved = Math.abs(event.clientY - pointerDragState.startY);
  pointerDragState.lastTop = clampedTop;
  if (moved > 4) {
    pointerDragState.dragged = true;
  }
}

async function finishPointerDrag(event) {
  if (!pointerDragState) return;
  const root = document.getElementById(ROOT_ID);

  if (pointerDragState.dragged && root) {
    suppressNextClick = true;
    await persistTopOffset(pointerDragState.lastTop ?? getDefaultTop(root));
    logInfo('Floating action moved.', { top: pointerDragState.lastTop ?? null });
  }

  pointerDragState = null;
  window.removeEventListener('pointermove', handlePointerMove);
  window.removeEventListener('pointerup', finishPointerDrag);
  window.removeEventListener('pointercancel', finishPointerDrag);
}

function startPointerDrag(event) {
  const root = document.getElementById(ROOT_ID);
  if (!root || event.button !== 0) return;

  const currentTop = Number.parseFloat(root.style.top) || getDefaultTop(root);
  pointerDragState = {
    pointerId: event.pointerId,
    startY: event.clientY,
    originTop: currentTop,
    lastTop: currentTop,
    dragged: false,
  };

  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', finishPointerDrag);
  window.addEventListener('pointercancel', finishPointerDrag);
}

function ensureRoot() {
  if (!isLinkedInJobPage()) {
    removeFloatingAction();
    return null;
  }

  let root = document.getElementById(ROOT_ID);
  if (root) return root;

  injectStyles();

  root = document.createElement('div');
  root.id = ROOT_ID;
  root.dataset.state = 'idle';

  const button = document.createElement('button');
  button.id = BUTTON_ID;
  button.type = 'button';
  button.ariaLabel = 'Generate resume';
  button.title = 'Generate resume';
  const icon = document.createElement('img');
  icon.src = chrome.runtime.getURL(ICON_PATH);
  icon.alt = '';
  button.appendChild(icon);
  button.addEventListener('click', handleGenerateClick);
  button.addEventListener('pointerdown', startPointerDrag);
  const status = document.createElement('div');
  status.id = STATUS_ID;
  const prompt1Details = document.createElement('details');
  prompt1Details.id = PROMPT1_DETAILS_ID;

  const prompt1Summary = document.createElement('summary');
  prompt1Summary.id = PROMPT1_SUMMARY_ID;
  prompt1Summary.ariaLabel = 'Toggle Prompt 1 notes';
  prompt1Summary.innerHTML = `
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M3.5 6.25 8 10.75l4.5-4.5" />
    </svg>
  `;

  const prompt1Panel = document.createElement('div');
  prompt1Panel.className = 'resume-matcher-prompt1-panel';

  const prompt1Textarea = document.createElement('textarea');
  prompt1Textarea.id = PROMPT1_TEXTAREA_ID;
  prompt1Textarea.placeholder = 'Prompt 1 keywords or notes for this run only';

  prompt1Panel.append(prompt1Textarea);
  prompt1Details.append(prompt1Summary, prompt1Panel);
  root.append(button, prompt1Details, status);
  document.documentElement.appendChild(root);
  void applyStoredTopOffset(root);
  logInfo('Floating action injected.', { url: location.href });
  return root;
}

function removeFloatingAction() {
  pointerDragState = null;
  if (clearStatusTimeout) {
    window.clearTimeout(clearStatusTimeout);
    clearStatusTimeout = null;
  }
  document.getElementById(ROOT_ID)?.remove();
}

function setUiState(state, message = '') {
  const root = ensureRoot();
  if (!root) return;
  const button = document.getElementById(BUTTON_ID);
  const status = document.getElementById(STATUS_ID);
  root.dataset.state = state;
  if (button) {
    button.disabled = state === 'running';
  }
  if (status) {
    status.textContent = message || '';
    status.dataset.visible = message ? 'true' : 'false';
  }
}

function scheduleStatusClear(delayMs = 5000) {
  if (clearStatusTimeout) {
    window.clearTimeout(clearStatusTimeout);
  }
  clearStatusTimeout = window.setTimeout(() => {
    clearStatusTimeout = null;
    if (isRunning) return;
    setUiState('idle', '');
  }, delayMs);
}

function consumePrompt1Instruction() {
  const textarea = document.getElementById(PROMPT1_TEXTAREA_ID);
  const details = document.getElementById(PROMPT1_DETAILS_ID);
  const value = textarea instanceof HTMLTextAreaElement ? textarea.value.trim() : '';
  if (textarea instanceof HTMLTextAreaElement) {
    textarea.value = '';
  }
  if (details instanceof HTMLDetailsElement) {
    details.open = false;
  }
  return value;
}

function formatErrorText(message) {
  if (!message) return 'Generation failed.';
  const normalized = message
    .replace(/^Prompt \d+ failed:\s*/i, '')
    .replace(/^Failed to /i, '')
    .trim();

  if (/upload a storyboard before generating/i.test(normalized)) {
    return 'Upload a storyboard in Assets.';
  }

  if (/extension context invalidated/i.test(normalized)) {
    return 'Extension reloaded. Refresh this LinkedIn page.';
  }

  if (/no master resume was found/i.test(normalized)) {
    return 'Upload a master resume in Resume Matcher first.';
  }

  return normalized;
}

function getProgressMessage(scope, message) {
  if (scope === 'Orchestrator') {
    const byMessage = new Map([
      ['Generate flow started.', 'Starting…'],
      ['Loading local assets.', 'Loading assets…'],
      ['Using active LinkedIn tab.', 'Checking LinkedIn page…'],
      ['LinkedIn scrape completed.', 'Job description captured.'],
      ['Resolving base resume.', 'Finding base resume…'],
      ['Resolved base resume for cloning.', 'Base resume found.'],
      ['Cloned base resume and created job-specific resume.', 'Created new resume draft.'],
      ['Rendering Prompt 1.', 'Preparing Prompt 1…'],
      ['Running Prompt 1.', 'Running Prompt 1…'],
      ['Parsing Prompt 1 output.', 'Reading Prompt 1…'],
      ['Rendering Prompt 2.', 'Preparing Prompt 2…'],
      ['Running Prompt 2.', 'Running Prompt 2…'],
      ['Parsing Prompt 2 output.', 'Reading Prompt 2…'],
      ['Rendering Prompt 3.', 'Preparing Prompt 3…'],
      ['Running Prompt 3.', 'Running Prompt 3…'],
      ['Parsing Prompt 3 output.', 'Reading Prompt 3…'],
      ['Validating Prompt 3 output.', 'Validating resume JSON…'],
      ['Patching generated resume.', 'Saving generated resume…'],
      ['Renaming generated resume.', 'Updating resume title…'],
      ['Opening generated resume preview.', 'Opening preview…'],
    ]);
    if (byMessage.has(message)) {
      return byMessage.get(message);
    }
  }

  if (scope === 'LinkedInScrape') {
    if (message === 'Starting LinkedIn scrape.') return 'Scraping LinkedIn job…';
    if (message === 'LinkedIn scrape normalized successfully.') return 'LinkedIn job ready.';
  }

  if (scope === 'ResumeApi') {
    if (message === 'Listing resumes.') return 'Loading base resumes…';
    if (message === 'Cloning resume.') return 'Creating resume copy…';
    if (message === 'Clone resume succeeded.') return 'Resume copy created.';
    if (message === 'Fetch resume succeeded.') return 'Base resume loaded.';
    if (message === 'Patch resume succeeded.') return 'Generated resume saved.';
    if (message === 'Rename resume succeeded.') return 'Resume title updated.';
  }

  if (scope === 'ChatGptAutomation') {
    return null;
  }

  return null;
}

function getLlmProgressMessage(scope, message, data) {
  const promptLabel = typeof data?.promptLabel === 'string' ? data.promptLabel : 'Prompt';

  if (scope === 'ChatGptAutomation') {
    if (message === 'Opening ChatGPT popup.') return `${promptLabel}: opening ChatGPT…`;
    if (message === 'ChatGPT popup created.') return `${promptLabel}: popup created.`;
    if (message === 'Waiting for ChatGPT tab to finish loading.') return `${promptLabel}: loading tab…`;
    if (message === 'ChatGPT tab ready.') return `${promptLabel}: ChatGPT ready.`;
    if (message === 'Injecting ChatGPT prompt runner.') return `${promptLabel}: injecting runner…`;
    if (message === 'ChatGPT prompt runner in progress.') {
      const phase = typeof data?.phaseText === 'string'
        ? data.phaseText
        : typeof data?.phase === 'string'
          ? data.phase
          : 'Waiting on ChatGPT…';
      return `${promptLabel}: ${phase}`;
    }
    if (message === 'Retrying prompt after submit-start failure.') return `${promptLabel}: retrying submit…`;
    if (message === 'Using parseable partial ChatGPT response after timeout.') return `${promptLabel}: using partial JSON output.`;
    if (message === 'Using parseable partial ChatGPT response after retry timeout.') return `${promptLabel}: using partial JSON output.`;
  }

  if (scope === 'ClaudeApi') {
    if (message === 'Sending prompt to Claude API.') return `${promptLabel}: sending to Claude API…`;
    if (message === 'Claude API response parsed successfully.') return `${promptLabel}: Claude API complete.`;
  }

  if (scope === 'ClaudeWebAutomation') {
    if (message === 'Opening Claude popup.') return `${promptLabel}: opening Claude…`;
    if (message === 'Claude popup created.') return `${promptLabel}: popup created.`;
    if (message === 'Waiting for Claude tab to finish loading.') return `${promptLabel}: loading tab…`;
    if (message === 'Claude tab ready.') return `${promptLabel}: Claude ready.`;
    if (message === 'Injecting Claude prompt runner.') return `${promptLabel}: injecting runner…`;
    if (message === 'Claude prompt runner in progress.') {
      const phase = typeof data?.phaseText === 'string'
        ? data.phaseText
        : typeof data?.phase === 'string'
          ? data.phase
          : 'Waiting on Claude…';
      return `${promptLabel}: ${phase}`;
    }
    if (message === 'Retrying prompt after submit-start failure.') return `${promptLabel}: retrying submit…`;
    if (message === 'Using parseable partial Claude response after timeout.') return `${promptLabel}: using partial JSON output.`;
    if (message === 'Using parseable partial Claude response after retry timeout.') return `${promptLabel}: using partial JSON output.`;
  }

  if (scope === 'GeminiWebAutomation') {
    if (message === 'Opening Gemini popup.') return `${promptLabel}: opening Gemini…`;
    if (message === 'Gemini popup created.') return `${promptLabel}: popup created.`;
    if (message === 'Waiting for Gemini tab to finish loading.') return `${promptLabel}: loading tab…`;
    if (message === 'Gemini tab ready.') return `${promptLabel}: Gemini ready.`;
    if (message === 'Injecting Gemini prompt runner.') return `${promptLabel}: injecting runner…`;
    if (message === 'Gemini prompt runner in progress.') {
      const phase = typeof data?.phaseText === 'string'
        ? data.phaseText
        : typeof data?.phase === 'string'
          ? data.phase
          : 'Waiting on Gemini…';
      return `${promptLabel}: ${phase}`;
    }
    if (message === 'Retrying prompt after submit-start failure.') return `${promptLabel}: retrying submit…`;
    if (message === 'Using parseable partial Gemini response after timeout.') return `${promptLabel}: using partial JSON output.`;
    if (message === 'Using parseable partial Gemini response after retry timeout.') return `${promptLabel}: using partial JSON output.`;
  }

  if (scope === 'GeminiApi') {
    if (message === 'Sending prompt to Gemini API.') return `${promptLabel}: sending to Gemini API…`;
    if (message === 'Gemini API response parsed successfully.') return `${promptLabel}: Gemini API complete.`;
  }

  if (scope === 'LlmRunner') {
    if (message === 'Resolved prompt runner.') {
      const vendor = typeof data?.vendor === 'string' ? data.vendor : 'llm';
      const mode = typeof data?.mode === 'string' ? data.mode.replace('_', ' ') : 'runner';
      return `${promptLabel}: ${vendor} ${mode} selected.`;
    }
  }

  return null;
}

function updateStatusFromLog(level, scope, message, data) {
  if (level === 'error') {
    if (scope === 'Background' && typeof data?.error === 'string') {
      setUiState('error', formatErrorText(data.error));
      return;
    }
    if (scope === 'Orchestrator' && typeof data?.message === 'string') {
      setUiState('error', formatErrorText(data.message));
      return;
    }
    setUiState('error', formatErrorText(message));
    return;
  }

  const progressMessage = getLlmProgressMessage(scope, message, data)
    ?? getProgressMessage(scope, message);
  if (!progressMessage) return;
  setUiState(isRunning ? 'running' : 'idle', progressMessage);
}

async function handleGenerateClick() {
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }
  if (isRunning) return;
  isRunning = true;
  if (clearStatusTimeout) {
    window.clearTimeout(clearStatusTimeout);
    clearStatusTimeout = null;
  }
  logInfo('Generate button clicked.', { url: location.href });
  const prompt1CustomInstruction = consumePrompt1Instruction();
  setUiState('running', 'Starting…');

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GENERATE_FOR_ACTIVE_JOB',
      payload: { prompt1CustomInstruction },
    });
    if (!response?.ok) {
      throw new Error(response?.error ?? 'Failed to generate tailored resume.');
    }
    logInfo('Generate flow succeeded.', response.result ?? {});
    setUiState('success', 'Preview opened.');
  } catch (error) {
    logError('Generate flow failed.', error);
    setUiState('error', formatErrorText(error instanceof Error ? error.message : 'Failed to generate tailored resume.'));
  } finally {
    isRunning = false;
    const root = document.getElementById(ROOT_ID);
    if (root?.dataset.state === 'success') {
      scheduleStatusClear();
    }
  }
}

function syncFloatingAction() {
  if (isLinkedInJobPage()) {
    const root = ensureRoot();
    if (root) {
      updateFloatingTop(root, Number.parseFloat(root.style.top) || getDefaultTop(root));
    }
  } else {
    removeFloatingAction();
  }
}

function startUrlWatcher() {
  if (urlObserver) return;
  urlObserver = new MutationObserver(() => {
    if (location.href === lastUrl) return;
    logInfo('URL changed.', { previousUrl: lastUrl, nextUrl: location.href });
    lastUrl = location.href;
    isRunning = false;
    syncFloatingAction();
  });
  urlObserver.observe(document.documentElement, { childList: true, subtree: true });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'LOG_EVENT') {
    const payload = message.payload ?? {};
    logRelayed(payload.level, payload.scope, payload.message, payload.data);
    updateStatusFromLog(payload.level, payload.scope, payload.message, payload.data);
    sendResponse({ ok: true });
    return true;
  }
  return false;
});

void chrome.runtime.sendMessage({ type: 'REGISTER_LOG_VIEWER' }).catch(() => {});

window.addEventListener('resize', () => {
  const root = document.getElementById(ROOT_ID);
  if (!root) return;
  updateFloatingTop(root, Number.parseFloat(root.style.top) || getDefaultTop(root));
});

syncFloatingAction();
startUrlWatcher();
