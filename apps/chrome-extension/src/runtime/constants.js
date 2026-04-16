export const DEFAULT_APP_ORIGIN = 'http://localhost:3000';
export const DEFAULT_API_ORIGIN = 'http://localhost:3000';
export const DEFAULT_CHATGPT_TARGET_URL = 'https://chatgpt.com/?temporary-chat=true';

export const STORAGE_KEYS = {
  masterResumeContextAsset: 'masterResumeContextAsset',
  storyboardAsset: 'storyboardAsset',
  prompt1TemplateAsset: 'prompt1TemplateAsset',
  prompt2TemplateAsset: 'prompt2TemplateAsset',
  prompt3TemplateAsset: 'prompt3TemplateAsset',
  promptTemplateProfiles: 'promptTemplateProfiles',
  llmSettings: 'llmSettings',
  chatGptTargetUrl: 'chatGptTargetUrl',
  appOrigin: 'appOrigin',
  apiOrigin: 'apiOrigin',
  customFeatureEnabled: 'customFeatureEnabled',
  extensionSession: 'extensionSession',
  historyEntries: 'historyEntries',
  lastError: 'lastError',
};

export const SESSION_STATUS = {
  idle: 'idle',
  scraped: 'scraped',
  prompt1Done: 'prompt1_done',
  prompt2Done: 'prompt2_done',
  prompt3Done: 'prompt3_done',
  validated: 'validated',
  patched: 'patched',
  error: 'error',
};
