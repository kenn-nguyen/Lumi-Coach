const ERROR_BODY_LIMIT = 220;

function cleanWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function truncate(value, maxLength = ERROR_BODY_LIMIT) {
  const normalized = cleanWhitespace(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(1, maxLength - 3))}...`;
}

export function extractApiStatusFromMessage(message) {
  const match = String(message || "").match(/status\s+(\d{3})/i);
  return match ? Number.parseInt(match[1], 10) : null;
}

export function buildApiHttpError(providerLabel, httpStatus, body = "") {
  const safeLabel = cleanWhitespace(providerLabel) || "AI";
  const safeBody = truncate(body);
  return {
    status: "error",
    errorSource: "api_http",
    httpStatus,
    message: `${safeLabel} API request failed (status ${httpStatus})${
      safeBody ? `: ${safeBody}` : "."
    }`,
  };
}

export function buildApiNetworkError(providerLabel, message = "") {
  const safeLabel = cleanWhitespace(providerLabel) || "AI";
  const safeMessage = truncate(message);
  return {
    status: "error",
    errorSource: "api_network",
    message: `${safeLabel} API request failed before response${
      safeMessage ? `: ${safeMessage}` : "."
    }`,
  };
}

export function buildApiResponseError(providerLabel, message = "") {
  const safeLabel = cleanWhitespace(providerLabel) || "AI";
  const safeMessage = truncate(message);
  return {
    status: "error",
    errorSource: "api_response",
    message: `${safeLabel} API returned an unreadable response${
      safeMessage ? `: ${safeMessage}` : "."
    }`,
  };
}

export function isApiProviderError(value) {
  if (!value) return false;
  if (
    ["api_http", "api_network", "api_response"].includes(
      value.errorSource || "",
    )
  ) {
    return true;
  }
  const message = value instanceof Error ? value.message : String(value);
  return /API request failed|API returned an unreadable response|status\s+\d{3}/i.test(
    message,
  );
}

export function formatApiProviderErrorForUser(value, providerLabel = "AI API") {
  const safeLabel = cleanWhitespace(providerLabel) || "AI API";
  const status =
    Number.isInteger(value?.httpStatus)
      ? value.httpStatus
      : extractApiStatusFromMessage(value?.message || value);
  if (status) {
    return `AI API error. ${safeLabel} returned status ${status}. Check the API key, model, and provider access, then try again.`;
  }
  return `AI API error. ${safeLabel} could not complete the request. Check the API key, model, and provider access, then try again.`;
}
