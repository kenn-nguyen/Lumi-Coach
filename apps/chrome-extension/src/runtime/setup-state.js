import { getActiveLlmProfile } from "./llm/profiles.js";

function hasTextContent(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeOnboardingProgress(progress) {
  return {
    hasCompletedOnboarding: progress?.hasCompletedOnboarding === true,
    onboardingStep:
      typeof progress?.onboardingStep === "string"
        ? progress.onboardingStep === "intro"
          ? "sign_in"
          : progress.onboardingStep
        : "sign_in",
  };
}

function getProviderRequirement(llmSettings) {
  const profile = getActiveLlmProfile(llmSettings);
  if (!profile) {
    return {
      ready: false,
      label: "Provider",
      detail: "Choose a provider to continue.",
      actionLabel: "Choose provider",
      focusTarget: "provider",
      mode: null,
      localKey: false,
    };
  }

  if (profile.mode === "web_automation") {
    const ready = hasTextContent(profile.targetUrl);
    return {
      ready,
      label: profile.label,
      detail: ready ? `${profile.label} is selected.` : "Choose a provider.",
      actionLabel: "Choose provider",
      focusTarget: "provider",
      profile,
      mode: "web_automation",
      localKey: false,
    };
  }

  const hasApiBaseUrl = hasTextContent(profile.apiBaseUrl);
  const hasModel = hasTextContent(profile.model);
  const hasApiKey = hasTextContent(profile.apiKey);

  return {
    ready: hasApiBaseUrl && hasModel && hasApiKey,
    label: profile.label,
    detail: hasApiKey
      ? `${profile.label} is ready.`
      : `Add your ${profile.label} API key to continue.`,
    actionLabel: "Choose provider",
    focusTarget: !hasApiKey
      ? "providerApiKey"
      : !hasModel
        ? "providerModel"
        : "providerApiBase",
    profile,
    mode: "api",
    localKey: true,
  };
}

function buildChecklist(connected, hasResume, provider, hasStoryboard) {
  return [
    {
      id: "auth",
      label: "Google sign-in",
      done: connected,
      optional: false,
    },
    {
      id: "resume",
      label: "Resume uploaded",
      done: hasResume,
      optional: false,
    },
    {
      id: "provider",
      label: provider.label,
      done: provider.ready,
      optional: false,
    },
    {
      id: "storyboard",
      label: "Story bank",
      done: hasStoryboard,
      optional: true,
    },
  ];
}

function buildBaseState({
  mode,
  state,
  step = null,
  hasCompletedOnboarding,
  title,
  detail,
  primaryAction = null,
  secondaryAction = null,
  canContinue = true,
  provider,
  checklist,
}) {
  return {
    mode,
    state,
    step,
    hasCompletedOnboarding,
    title,
    detail,
    primaryAction,
    secondaryAction,
    canContinue,
    provider,
    checklist,
  };
}

export function getExtensionSetupState({
  assets,
  extensionConnected = false,
  websiteAuthenticated = false,
  onboardingProgress,
} = {}) {
  const normalizedOnboarding = normalizeOnboardingProgress(onboardingProgress);
  const hasResume = hasTextContent(assets?.masterResumeContextAsset?.content);
  const hasStoryboard = hasTextContent(assets?.storyboardAsset?.content);
  const provider = getProviderRequirement(assets?.llmSettings);
  const connected = extensionConnected && websiteAuthenticated;
  const checklist = buildChecklist(
    connected,
    hasResume,
    provider,
    hasStoryboard,
  );

  if (!normalizedOnboarding.hasCompletedOnboarding) {
    switch (normalizedOnboarding.onboardingStep) {
      case "intro":
      case "sign_in":
        return buildBaseState({
          mode: "onboarding",
          state: "onboarding_sign_in",
          step: "sign_in",
          hasCompletedOnboarding: false,
          title: "Sign in to Lumi Coach",
          detail: connected
            ? "You’re signed in. Continue."
            : "Use Google to connect your account.",
          primaryAction: connected
            ? { id: "onboarding_next", label: "Next", nextStep: "assets" }
            : { id: "connect", label: "Sign in with Google" },
          provider,
          checklist,
          canContinue: connected,
        });
      case "assets":
        return buildBaseState({
          mode: "onboarding",
          state: "onboarding_assets",
          step: "assets",
          hasCompletedOnboarding: false,
          title: "Add your resume",
          detail: "Your resume is required. Story bank is optional.",
          primaryAction: {
            id: "onboarding_next",
            label: "Next",
            nextStep: "provider",
          },
          provider,
          checklist,
          canContinue: hasResume,
        });
      case "provider":
        return buildBaseState({
          mode: "onboarding",
          state: "onboarding_provider",
          step: "provider",
          hasCompletedOnboarding: false,
          title: "Choose your AI setup",
          detail: "ChatGPT is selected by default.",
          primaryAction: {
            id: "onboarding_next",
            label: "Next",
            nextStep: "done",
          },
          provider,
          checklist,
          canContinue: provider.ready,
        });
      case "done":
        return buildBaseState({
          mode: "onboarding",
          state: "onboarding_done",
          step: "done",
          hasCompletedOnboarding: false,
          title: "You’re ready.",
          detail: "You can change prompts later in Advanced Settings.",
          primaryAction: { id: "complete_onboarding", label: "Start tailoring" },
          provider,
          checklist,
        });
      default:
        return buildBaseState({
          mode: "onboarding",
          state: "onboarding_sign_in",
          step: "sign_in",
          hasCompletedOnboarding: false,
          title: "Sign in to Lumi Coach",
          detail: connected
            ? "You’re signed in. Continue."
            : "Use Google to connect your account.",
          primaryAction: connected
            ? { id: "onboarding_next", label: "Next", nextStep: "assets" }
            : { id: "connect", label: "Sign in with Google" },
          provider,
          checklist,
          canContinue: connected,
        });
    }
  }

  if (!connected) {
    return buildBaseState({
      mode: "run",
      state: "signed_out_returning",
      hasCompletedOnboarding: true,
      title: "You’ve been signed out",
      detail:
        "Sign in to continue tailoring this job. Each account keeps its own local extension workspace.",
      primaryAction: {
        id: "connect",
        label: "Continue with Google",
      },
      provider,
      checklist,
      canContinue: false,
    });
  }

  if (!hasResume) {
    return buildBaseState({
      mode: "run",
      state: "missing_resume",
      hasCompletedOnboarding: true,
      title: "Add your resume",
      detail: "Your base resume is missing. Open Settings to add it back.",
      primaryAction: {
        id: "open_settings",
        label: "Open Settings",
        focusTarget: "resume",
      },
      provider,
      checklist,
      canContinue: false,
    });
  }

  if (!provider.ready) {
    return buildBaseState({
      mode: "run",
      state: "missing_provider_config",
      hasCompletedOnboarding: true,
      title: "Finish provider setup",
      detail: provider.detail,
      primaryAction: {
        id: "open_settings",
        label: "Open Settings",
        focusTarget: provider.focusTarget,
      },
      provider,
      checklist,
      canContinue: false,
    });
  }

  return buildBaseState({
    mode: "run",
    state: "ready",
    hasCompletedOnboarding: true,
    title: "Job loaded",
    detail: "Review the job, then tailor when you're ready.",
    secondaryAction: hasStoryboard
      ? null
      : {
          id: "upload_storyboard",
          label: "Add story bank",
        },
    provider,
    checklist,
  });
}
