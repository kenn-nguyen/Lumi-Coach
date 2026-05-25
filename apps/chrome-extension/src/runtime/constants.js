export const DEFAULT_APP_ORIGIN = "https://lumi.ceo";
export const DEFAULT_API_ORIGIN = "https://som-career-coach.onrender.com";
export const DEFAULT_CHATGPT_TARGET_URL =
  "https://chatgpt.com/?temporary-chat=true";

export const STORAGE_KEYS = {
  accountStorageVersion: "accountStorageVersion",
  activeAccountKey: "activeAccountKey",
  legacyScopedData: "legacyScopedData",
  masterResumeContextAsset: "masterResumeContextAsset",
  storyboardAsset: "storyboardAsset",
  apifyFallbackSettings: "apifyFallbackSettings",
  prompt1TemplateAsset: "prompt1TemplateAsset",
  prompt2TemplateAsset: "prompt2TemplateAsset",
  prompt3TemplateAsset: "prompt3TemplateAsset",
  promptTemplateProfiles: "promptTemplateProfiles",
  promptDefaultsMode: "promptDefaultsMode",
  serverPromptArtifacts: "serverPromptArtifacts",
  serverPromptManifest: "serverPromptManifest",
  serverPromptLastSyncedAt: "serverPromptLastSyncedAt",
  llmSettings: "llmSettings",
  chatGptTargetUrl: "chatGptTargetUrl",
  appOrigin: "appOrigin",
  apiOrigin: "apiOrigin",
  extensionAuth: "extensionAuth",
  onboardingProgress: "onboardingProgress",
  extensionPendingAction: "extensionPendingAction",
  extensionSession: "extensionSession",
  analyticsState: "analyticsState",
  historyEntries: "historyEntries",
  lastError: "lastError",
};

export const APIFY_DEFAULT_LINKEDIN_ACTOR = "apimaestro/linkedin-job-detail";

export const SESSION_STATUS = {
  idle: "idle",
  starting: "starting",
  bootstrapMaster: "bootstrap_master",
  scraped: "scraped",
  prompt1Done: "prompt1_done",
  prompt2Done: "prompt2_done",
  prompt3Done: "prompt3_done",
  validated: "validated",
  patched: "patched",
  canceling: "canceling",
  canceled: "canceled",
  error: "error",
};
