import { recordLog } from './log-buffer.js';

const LOG_PREFIX = '[ResumeMatcherExt]';
const relayTabIds = new Set();

export function setLogRelayTabId(tabId) {
  if (typeof tabId !== 'number') {
    return;
  }
  relayTabIds.add(tabId);
}

function formatMessage(scope, message) {
  return `${LOG_PREFIX}[${scope}] ${message}`;
}

function relayLog(level, scope, message, data) {
  if (relayTabIds.size === 0 || typeof chrome === 'undefined' || !chrome.tabs?.sendMessage) {
    return;
  }

  for (const tabId of [...relayTabIds]) {
    void chrome.tabs
      .sendMessage(tabId, {
        type: 'LOG_EVENT',
        payload: { level, scope, message, data },
      })
      .catch(() => {
        relayTabIds.delete(tabId);
      });
  }
}

export function logInfo(scope, message, data) {
  recordLog('info', scope, message, data);
  if (data === undefined) {
    console.info(formatMessage(scope, message));
    relayLog('info', scope, message);
    return;
  }
  console.info(formatMessage(scope, message), data);
  relayLog('info', scope, message, data);
}

export function logWarn(scope, message, data) {
  recordLog('warn', scope, message, data);
  if (data === undefined) {
    console.warn(formatMessage(scope, message));
    relayLog('warn', scope, message);
    return;
  }
  console.warn(formatMessage(scope, message), data);
  relayLog('warn', scope, message, data);
}

export function logError(scope, message, data) {
  recordLog('error', scope, message, data);
  if (data === undefined) {
    console.error(formatMessage(scope, message));
    relayLog('error', scope, message);
    return;
  }
  console.error(formatMessage(scope, message), data);
  relayLog('error', scope, message, data);
}
