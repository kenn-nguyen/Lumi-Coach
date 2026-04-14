const LOG_PREFIX = '[ResumeMatcherExt]';
let relayTabId = null;

export function setLogRelayTabId(tabId) {
  relayTabId = tabId ?? null;
}

function formatMessage(scope, message) {
  return `${LOG_PREFIX}[${scope}] ${message}`;
}

function relayLog(level, scope, message, data) {
  if (!relayTabId || typeof chrome === 'undefined' || !chrome.tabs?.sendMessage) {
    return;
  }

  void chrome.tabs
    .sendMessage(relayTabId, {
      type: 'LOG_EVENT',
      payload: { level, scope, message, data },
    })
    .catch(() => {});
}

export function logInfo(scope, message, data) {
  if (data === undefined) {
    console.info(formatMessage(scope, message));
    relayLog('info', scope, message);
    return;
  }
  console.info(formatMessage(scope, message), data);
  relayLog('info', scope, message, data);
}

export function logWarn(scope, message, data) {
  if (data === undefined) {
    console.warn(formatMessage(scope, message));
    relayLog('warn', scope, message);
    return;
  }
  console.warn(formatMessage(scope, message), data);
  relayLog('warn', scope, message, data);
}

export function logError(scope, message, data) {
  if (data === undefined) {
    console.error(formatMessage(scope, message));
    relayLog('error', scope, message);
    return;
  }
  console.error(formatMessage(scope, message), data);
  relayLog('error', scope, message, data);
}
