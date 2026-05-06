import { formatApiProviderErrorForUser } from "./api-errors.js";
import { runPrompt } from "./runners.js";

const API_CHECK_PROMPT =
  "This is a connection check. Reply with exactly: hi";
const API_CHECK_TIMEOUT_MS = 15000;

export async function validateApiProfile(profile) {
  if (profile?.mode !== "api") {
    return { ok: true, skipped: true };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_CHECK_TIMEOUT_MS);
  let result;
  try {
    result = await runPrompt(API_CHECK_PROMPT, {
      profile,
      promptLabel: "AI API check",
      systemPrompt: "Reply with exactly one short word: hi",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (result?.status === "success" && String(result.rawText || "").trim()) {
    return { ok: true };
  }

  return {
    ok: false,
    error: formatApiProviderErrorForUser(result, profile?.label || "AI API"),
    result,
  };
}
