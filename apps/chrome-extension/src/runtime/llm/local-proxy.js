const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export function isLoopbackApiBaseUrl(apiBaseUrl) {
  if (typeof apiBaseUrl !== "string" || !apiBaseUrl.trim()) return false;

  try {
    const parsed = new URL(apiBaseUrl.trim());
    return LOOPBACK_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

export function requiresApiKeyForApiBaseUrl(apiBaseUrl) {
  return !isLoopbackApiBaseUrl(apiBaseUrl);
}
