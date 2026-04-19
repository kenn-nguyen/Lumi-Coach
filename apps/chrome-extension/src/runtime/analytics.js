import { DEFAULT_APP_ORIGIN, STORAGE_KEYS } from "./constants.js";
import { getExtensionAuth, getExtensionState, getUserAssets } from "./storage.js";
import { logWarn } from "./log.js";

const ANALYTICS_CONFIG_PATH = "/api/public/analytics";
const ANALYTICS_CONFIG_TTL_MS = 5 * 60 * 1000;

let cachedAnalyticsConfig = null;
let cachedAnalyticsConfigExpiresAt = 0;

function createUuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeOrigin(value) {
  return (value || DEFAULT_APP_ORIGIN).trim().replace(/\/+$/, "") || DEFAULT_APP_ORIGIN;
}

function resolveFallbackEnv(origin) {
  try {
    const hostname = new URL(origin).hostname;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname.endsWith(".local")
    ) {
      return "test";
    }
    if (hostname.endsWith(".vercel.app")) {
      return "uat";
    }
  } catch {}
  return "production";
}

async function getOrCreateAnalyticsState() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.analyticsState);
  const existing = data[STORAGE_KEYS.analyticsState];
  if (existing?.anonymousId && existing?.sessionId) {
    return existing;
  }

  const next = {
    anonymousId: existing?.anonymousId || createUuid(),
    sessionId: existing?.sessionId || createUuid(),
    updatedAt: new Date().toISOString(),
  };
  await chrome.storage.local.set({ [STORAGE_KEYS.analyticsState]: next });
  return next;
}

async function getAnalyticsConfig() {
  if (cachedAnalyticsConfig && Date.now() < cachedAnalyticsConfigExpiresAt) {
    return cachedAnalyticsConfig;
  }

  const { appOrigin } = await getUserAssets();
  const resolvedAppOrigin = normalizeOrigin(appOrigin);
  const endpoint = `${resolvedAppOrigin}${ANALYTICS_CONFIG_PATH}`;

  try {
    const response = await fetch(endpoint, { method: "GET", cache: "no-store" });
    if (!response.ok) {
      throw new Error(`status ${response.status}`);
    }
    const payload = await response.json();
    cachedAnalyticsConfig = {
      posthogKey: payload?.posthogKey || "",
      posthogHost: (payload?.posthogHost || "https://us.i.posthog.com").replace(/\/$/, ""),
      env: payload?.env || resolveFallbackEnv(resolvedAppOrigin),
      release: payload?.release || null,
    };
  } catch (error) {
    logWarn("Analytics", "Failed to load public analytics config.", {
      endpoint,
      message: error instanceof Error ? error.message : String(error),
    });
    cachedAnalyticsConfig = {
      posthogKey: "",
      posthogHost: "https://us.i.posthog.com",
      env: resolveFallbackEnv(resolvedAppOrigin),
      release: null,
    };
  }

  cachedAnalyticsConfigExpiresAt = Date.now() + ANALYTICS_CONFIG_TTL_MS;
  return cachedAnalyticsConfig;
}

export async function captureExtensionEvent(event, properties = {}) {
  if (!event) {
    return;
  }

  const config = await getAnalyticsConfig();
  if (!config.posthogKey) {
    return;
  }

  const extensionVersion = chrome.runtime?.getManifest?.().version || null;
  const [assets, auth, extensionState, analyticsState] = await Promise.all([
    getUserAssets(),
    getExtensionAuth(),
    getExtensionState(),
    getOrCreateAnalyticsState(),
  ]);

  const distinctId = auth?.user?.id || analyticsState.anonymousId;
  const payload = {
    api_key: config.posthogKey,
    event,
    distinct_id: distinctId,
    properties: {
      env: config.env,
      platform: "extension",
      surface: properties.surface || "extension",
      release: config.release || extensionVersion,
      app_version: extensionVersion,
      extension_version: extensionVersion,
      anonymous_id: analyticsState.anonymousId,
      session_id: analyticsState.sessionId,
      run_id: properties.run_id ?? extensionState?.sessionId ?? null,
      user_id: auth?.user?.id ?? null,
      app_origin: assets.appOrigin,
      api_origin: assets.apiOrigin,
      ...properties,
    },
    timestamp: new Date().toISOString(),
  };

  try {
    await fetch(`${config.posthogHost}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch (error) {
    logWarn("Analytics", "Failed to capture PostHog event.", {
      event,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
