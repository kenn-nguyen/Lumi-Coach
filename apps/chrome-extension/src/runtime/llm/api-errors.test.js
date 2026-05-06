import { describe, expect, it } from "vitest";

import {
  buildApiHttpError,
  formatApiProviderErrorForUser,
  isApiProviderError,
} from "./api-errors.js";

describe("api error helpers", () => {
  it("formats provider status errors without blaming the uploaded file", () => {
    const result = buildApiHttpError("Claude", 401, "invalid x-api-key");

    expect(isApiProviderError(result)).toBe(true);
    expect(formatApiProviderErrorForUser(result, "Claude API")).toBe(
      "AI API error. Claude API returned status 401. Check the API key, model, and provider access, then try again.",
    );
  });

  it("detects API status errors from message strings", () => {
    expect(
      formatApiProviderErrorForUser(
        "Gemini API request failed (status 429): quota exceeded",
        "Gemini API",
      ),
    ).toContain("status 429");
  });
});
