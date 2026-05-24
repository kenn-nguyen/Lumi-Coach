import { describe, expect, it } from "vitest";

import {
  isLoopbackApiBaseUrl,
  requiresApiKeyForApiBaseUrl,
} from "./local-proxy.js";

describe("local proxy helpers", () => {
  it("treats localhost and loopback endpoints as key-optional", () => {
    expect(isLoopbackApiBaseUrl("http://127.0.0.1:8317/v1/responses")).toBe(
      true,
    );
    expect(isLoopbackApiBaseUrl("http://localhost:8317/v1/responses")).toBe(
      true,
    );
    expect(isLoopbackApiBaseUrl("http://[::1]:8317/v1/responses")).toBe(true);
    expect(
      requiresApiKeyForApiBaseUrl("http://127.0.0.1:8317/v1/responses"),
    ).toBe(false);
  });

  it("still requires API keys for non-loopback endpoints", () => {
    expect(
      requiresApiKeyForApiBaseUrl("https://api.openai.com/v1/responses"),
    ).toBe(true);
    expect(isLoopbackApiBaseUrl("https://lumi.ceo/api/proxy")).toBe(false);
  });
});
