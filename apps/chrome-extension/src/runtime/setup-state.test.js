import { describe, expect, it } from "vitest";

import { getDefaultLlmSettings } from "./llm/profiles.js";
import { getExtensionSetupState } from "./setup-state.js";

function readyLlmSettings() {
  const settings = getDefaultLlmSettings();
  return {
    ...settings,
    activeProfileId: "claude:api",
    profiles: {
      ...settings.profiles,
      "claude:api": {
        ...settings.profiles["claude:api"],
        apiKey: "test-key",
      },
    },
  };
}

function chatGptApiLlmSettings() {
  const settings = getDefaultLlmSettings();
  return {
    ...settings,
    profiles: {
      ...settings.profiles,
      "chatgpt:api": {
        ...settings.profiles["chatgpt:api"],
        apiKey: "test-key",
      },
    },
  };
}

describe("getExtensionSetupState onboarding", () => {
  it("moves signed-in users to provider setup before Master Resume upload when provider is missing", () => {
    const state = getExtensionSetupState({
      assets: {
        llmSettings: getDefaultLlmSettings(),
        backendMasterResume: null,
      },
      extensionConnected: true,
      websiteAuthenticated: true,
      onboardingProgress: {
        hasCompletedOnboarding: false,
        onboardingStep: "sign_in",
      },
    });

    expect(state).toMatchObject({
      step: "provider",
      primaryAction: {
        id: "onboarding_next",
        nextStep: "assets",
      },
    });
  });

  it("moves signed-in users to Master Resume when provider is already ready", () => {
    const state = getExtensionSetupState({
      assets: {
        llmSettings: readyLlmSettings(),
        backendMasterResume: null,
      },
      extensionConnected: true,
      websiteAuthenticated: true,
      onboardingProgress: {
        hasCompletedOnboarding: false,
        onboardingStep: "sign_in",
      },
    });

    expect(state).toMatchObject({
      step: "assets",
      title: "Master Resume",
      primaryAction: {
        id: "upload_resume",
        label: "Add Master Resume",
      },
    });
  });

  it("moves provider setup to the Master Resume step", () => {
    const state = getExtensionSetupState({
      assets: {
        llmSettings: readyLlmSettings(),
        backendMasterResume: null,
      },
      extensionConnected: true,
      websiteAuthenticated: true,
      onboardingProgress: {
        hasCompletedOnboarding: false,
        onboardingStep: "provider",
      },
    });

    expect(state.primaryAction).toMatchObject({
      id: "upload_resume",
      label: "Add Master Resume",
    });
  });

  it("does not keep a ready provider user on the provider body", () => {
    const state = getExtensionSetupState({
      assets: {
        llmSettings: readyLlmSettings(),
        backendMasterResume: null,
      },
      extensionConnected: true,
      websiteAuthenticated: true,
      onboardingProgress: {
        hasCompletedOnboarding: false,
        onboardingStep: "provider",
      },
    });

    expect(state).toMatchObject({
      state: "onboarding_assets",
      step: "assets",
      title: "Master Resume",
      primaryAction: {
        id: "upload_resume",
      },
    });
  });

  it("shows Start tailoring on the Master Resume step when backend master exists", () => {
    const state = getExtensionSetupState({
      assets: {
        llmSettings: readyLlmSettings(),
        backendMasterResume: {
          resumeId: "resume-1",
        },
      },
      extensionConnected: true,
      websiteAuthenticated: true,
      onboardingProgress: {
        hasCompletedOnboarding: false,
        onboardingStep: "assets",
      },
    });

    expect(state).toMatchObject({
      step: "assets",
      title: "Master Resume",
      primaryAction: {
        id: "complete_onboarding",
        label: "Start tailoring",
      },
      canContinue: true,
    });
  });

  it("asks returning users to add Master Resume when provider is ready but backend master is missing", () => {
    const state = getExtensionSetupState({
      assets: {
        llmSettings: readyLlmSettings(),
        backendMasterResume: null,
      },
      extensionConnected: true,
      websiteAuthenticated: true,
      onboardingProgress: {
        hasCompletedOnboarding: true,
        onboardingStep: "done",
      },
    });

    expect(state).toMatchObject({
      state: "missing_resume",
      title: "Add your Master Resume",
      primaryAction: {
        id: "upload_resume",
        label: "Add Master Resume",
      },
    });
  });

  it("keeps tailoring available when Story bank is missing", () => {
    const state = getExtensionSetupState({
      assets: {
        llmSettings: readyLlmSettings(),
        backendMasterResume: {
          resumeId: "resume-1",
        },
        storyboardAsset: null,
      },
      extensionConnected: true,
      websiteAuthenticated: true,
      onboardingProgress: {
        hasCompletedOnboarding: true,
        onboardingStep: "done",
      },
    });

    expect(state).toMatchObject({
      state: "ready",
      canContinue: true,
      secondaryAction: {
        id: "upload_storyboard",
        label: "Add story bank",
      },
    });
    expect(state.checklist).toContainEqual(
      expect.objectContaining({
        id: "storyboard",
        optional: true,
        done: false,
      }),
    );
  });

  it("treats a valid extension token as connected even when the website session cannot be verified", () => {
    const state = getExtensionSetupState({
      assets: {
        llmSettings: readyLlmSettings(),
        backendMasterResume: {
          resumeId: "resume-1",
        },
        storyboardAsset: null,
      },
      extensionConnected: true,
      websiteAuthenticated: false,
      onboardingProgress: {
        hasCompletedOnboarding: true,
        onboardingStep: "done",
      },
    });

    expect(state).toMatchObject({
      state: "ready",
      title: "Job loaded",
      canContinue: true,
    });
  });

  it("accepts ChatGPT API when required fields are filled", () => {
    const state = getExtensionSetupState({
      assets: {
        llmSettings: chatGptApiLlmSettings(),
        backendMasterResume: null,
      },
      extensionConnected: true,
      websiteAuthenticated: true,
      onboardingProgress: {
        hasCompletedOnboarding: false,
        onboardingStep: "provider",
      },
    });

    expect(state).toMatchObject({
      state: "onboarding_assets",
      step: "assets",
      canContinue: false,
      provider: {
        ready: true,
      },
    });
  });

  it("moves stale Master Resume onboarding state back to provider when provider is not ready", () => {
    const state = getExtensionSetupState({
      assets: {
        llmSettings: getDefaultLlmSettings(),
        backendMasterResume: null,
      },
      extensionConnected: true,
      websiteAuthenticated: true,
      onboardingProgress: {
        hasCompletedOnboarding: false,
        onboardingStep: "assets",
      },
    });

    expect(state).toMatchObject({
      state: "onboarding_provider",
      step: "provider",
      canContinue: false,
      provider: {
        ready: false,
      },
    });
  });
});
