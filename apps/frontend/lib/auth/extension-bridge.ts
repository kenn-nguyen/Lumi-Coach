export const EXTENSION_BRIDGE_STORAGE_KEY = 'resumeMatcherExtensionBridge';
export const KNOWN_EXTENSION_STORAGE_KEY = 'resumeMatcherKnownExtension';
const EXTENSION_BRIDGE_TTL_MS = 30 * 60 * 1000;

export type ExtensionBridgeState = {
  extensionId: string;
  sourceTabId?: string;
  updatedAt: string;
};

export type KnownExtensionState = {
  extensionId: string;
  sourceTabId?: string;
  updatedAt: string;
};

function isBrowser() {
  return typeof window !== 'undefined';
}

export function saveExtensionBridgeState(extensionId: string, sourceTabId?: string) {
  if (!isBrowser() || !extensionId) return;

  const nextState: ExtensionBridgeState = {
    extensionId,
    sourceTabId: sourceTabId?.trim() || undefined,
    updatedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(EXTENSION_BRIDGE_STORAGE_KEY, JSON.stringify(nextState));
  saveKnownExtensionState(extensionId, sourceTabId);
}

export function clearExtensionBridgeState() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(EXTENSION_BRIDGE_STORAGE_KEY);
}

export function getExtensionBridgeState(): ExtensionBridgeState | null {
  if (!isBrowser()) return null;

  const raw = window.localStorage.getItem(EXTENSION_BRIDGE_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ExtensionBridgeState>;
    if (!parsed?.extensionId || typeof parsed.extensionId !== 'string') {
      clearExtensionBridgeState();
      return null;
    }

    const updatedAt = parsed.updatedAt ? new Date(parsed.updatedAt).getTime() : Number.NaN;
    if (!Number.isFinite(updatedAt) || Date.now() - updatedAt > EXTENSION_BRIDGE_TTL_MS) {
      clearExtensionBridgeState();
      return null;
    }

    return {
      extensionId: parsed.extensionId,
      sourceTabId: parsed.sourceTabId?.trim() || undefined,
      updatedAt: parsed.updatedAt!,
    };
  } catch {
    clearExtensionBridgeState();
    return null;
  }
}

export function saveKnownExtensionState(extensionId: string, sourceTabId?: string) {
  if (!isBrowser() || !extensionId) return;

  const nextState: KnownExtensionState = {
    extensionId,
    sourceTabId: sourceTabId?.trim() || undefined,
    updatedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(KNOWN_EXTENSION_STORAGE_KEY, JSON.stringify(nextState));
}

export function getKnownExtensionState(): KnownExtensionState | null {
  if (!isBrowser()) return null;

  const raw = window.localStorage.getItem(KNOWN_EXTENSION_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<KnownExtensionState>;
    if (!parsed?.extensionId || typeof parsed.extensionId !== 'string') {
      return null;
    }

    return {
      extensionId: parsed.extensionId,
      sourceTabId: parsed.sourceTabId?.trim() || undefined,
      updatedAt: parsed.updatedAt || new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}
