import { describe, expect, it } from "vitest";

import {
  getProviderSecretHint,
  getProviderSecretInputPresentation,
  maskSecret,
  normalizeSecretValue,
  shouldEndSecretEdit,
} from "./secret-input-state.js";

describe("secret-input-state", () => {
  it("normalizes secret values before comparisons", () => {
    expect(normalizeSecretValue("  sk-ant-123  ")).toBe("sk-ant-123");
  });

  it("masks saved secrets for summary display only", () => {
    expect(maskSecret("sk-ant-api03-abcdef")).toBe("sk-...def");
  });

  it("keeps provider inputs blank when a saved key exists and the field is not editing", () => {
    expect(
      getProviderSecretInputPresentation({
        savedValue: "sk-ant-api03-abcdef1234",
        draftValue: "sk-ant-api03-abcdef1234",
        isEditing: false,
      }),
    ).toEqual({
      type: "password",
      readOnly: true,
      placeholder: "Saved API key. Focus to replace.",
      value: "",
    });
  });

  it("starts provider key replacement with a blank editable field", () => {
    expect(
      getProviderSecretInputPresentation({
        savedValue: "sk-ant-api03-abcdef1234",
        draftValue: "",
        isEditing: true,
      }),
    ).toEqual({
      type: "password",
      readOnly: false,
      placeholder: "API key",
      value: "",
    });
  });

  it("does not collapse provider editing when the draft differs from the saved key", () => {
    expect(
      shouldEndSecretEdit(
        "sk-ant-api03-new-secret",
        "sk-ant-api03-old-secret",
      ),
    ).toBe(false);
  });

  it("allows provider editing to collapse when the field is empty or unchanged", () => {
    expect(shouldEndSecretEdit("", "sk-ant-api03-old-secret")).toBe(true);
    expect(
      shouldEndSecretEdit(
        "sk-ant-api03-old-secret",
        "sk-ant-api03-old-secret",
      ),
    ).toBe(true);
  });

  it("describes saved provider keys without reusing the masked value as input text", () => {
    expect(
      getProviderSecretHint({
        savedValue: "sk-ant-api03-abcdef1234",
        isEditing: false,
      }),
    ).toBe("Saved API key ending in 1234. Focus to replace.");
  });
});
