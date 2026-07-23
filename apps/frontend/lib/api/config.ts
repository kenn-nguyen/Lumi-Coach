import { apiFetch } from './client';
import type {
  DateDisplayMode,
  ResumeTemplateSettings,
  TemplateSettings,
} from '@/lib/types/template-settings';

// Supported LLM providers
export type LLMProvider =
  | 'openai'
  | 'anthropic'
  | 'openrouter'
  | 'gemini'
  | 'deepseek'
  | 'vertex_ai';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  api_key: string;
  api_base: string | null;
  is_user_config?: boolean;
}

export interface LLMConfigUpdate {
  provider?: LLMProvider;
  model?: string;
  api_key?: string;
  api_base?: string | null;
}

export interface DatabaseStats {
  total_resumes: number;
  total_jobs: number;
  total_improvements: number;
  has_master_resume: boolean;
}

export interface SystemStatus {
  status: 'ready' | 'setup_required';
  llm_configured: boolean;
  llm_healthy: boolean;
  has_user_api_key: boolean;
  free_llm_available: boolean;
  using_free_llm: boolean;
  free_llm_provider: 'gemini' | null;
  free_llm_model: 'gemini-2.5-flash-lite' | string | null;
  has_master_resume: boolean;
  database_stats: DatabaseStats;
}

export interface LLMHealthCheck {
  healthy: boolean;
  provider: string;
  model: string;
  error?: string;
  error_code?: string;
  response_model?: string;
  warning?: string;
  warning_code?: string;
  test_prompt?: string;
  model_output?: string;
  error_detail?: string;
}

// Fetch full LLM configuration
export async function fetchLlmConfig(): Promise<LLMConfig> {
  const res = await apiFetch('/config/llm-api-key', { credentials: 'include' });

  if (!res.ok) {
    throw new Error(`Failed to load LLM config (status ${res.status}).`);
  }

  return res.json();
}

// Legacy function for backwards compatibility
export async function fetchLlmApiKey(): Promise<string> {
  const config = await fetchLlmConfig();
  return config.api_key ?? '';
}

// Update LLM configuration
export async function updateLlmConfig(config: LLMConfigUpdate): Promise<LLMConfig> {
  const res = await apiFetch('/config/llm-api-key', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(config),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Failed to update LLM config (status ${res.status}).`);
  }

  return res.json();
}

// Legacy function for backwards compatibility
export async function updateLlmApiKey(value: string): Promise<string> {
  const trimmed = value.trim();
  const isMasked = trimmed.includes('*') || trimmed.includes('•');
  const config = await updateLlmConfig(isMasked ? {} : { api_key: trimmed });
  return config.api_key ?? '';
}

// Test LLM connection with optional config (for pre-save testing)
export async function testLlmConnection(config?: LLMConfigUpdate): Promise<LLMHealthCheck> {
  const options: RequestInit = {
    method: 'POST',
    credentials: 'include',
  };

  // If config provided, send it in the request body
  if (config) {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(config);
  }

  const res = await apiFetch('/config/llm-test', options);

  if (!res.ok) {
    throw new Error(`Failed to test LLM connection (status ${res.status}).`);
  }

  return res.json();
}

// Fetch system status
export async function fetchSystemStatus(): Promise<SystemStatus> {
  const res = await apiFetch('/status', { credentials: 'include' });

  if (!res.ok) {
    throw new Error(`Failed to fetch system status (status ${res.status}).`);
  }

  return res.json();
}

// Provider display names and default models
export const PROVIDER_INFO: Record<
  LLMProvider,
  { name: string; defaultModel: string; requiresKey: boolean }
> = {
  openai: { name: 'OpenAI', defaultModel: 'gpt-5-nano-2025-08-07', requiresKey: true },
  anthropic: { name: 'Anthropic', defaultModel: 'claude-haiku-4-5-20251001', requiresKey: true },
  openrouter: {
    name: 'OpenRouter',
    defaultModel: 'deepseek/deepseek-chat',
    requiresKey: true,
  },
  gemini: { name: 'Google Gemini', defaultModel: 'gemini-2.5-flash-lite', requiresKey: true },
  vertex_ai: {
    name: 'Google Vertex AI',
    defaultModel: 'gemini-2.5-flash-lite',
    requiresKey: false,
  },
  deepseek: { name: 'DeepSeek', defaultModel: 'deepseek-chat', requiresKey: true },
};

// Feature configuration types
export interface FeatureConfig {
  enable_cover_letter: boolean;
  enable_outreach_message: boolean;
  preserve_generated_resume_facts: boolean;
}

export interface FeatureConfigUpdate {
  enable_cover_letter?: boolean;
  enable_outreach_message?: boolean;
  preserve_generated_resume_facts?: boolean;
}

// Fetch feature configuration
export async function fetchFeatureConfig(): Promise<FeatureConfig> {
  const res = await apiFetch('/config/features', { credentials: 'include' });

  if (!res.ok) {
    throw new Error(`Failed to load feature config (status ${res.status}).`);
  }

  return res.json();
}

// Update feature configuration
export async function updateFeatureConfig(config: FeatureConfigUpdate): Promise<FeatureConfig> {
  const res = await apiFetch('/config/features', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(config),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Failed to update feature config (status ${res.status}).`);
  }

  return res.json();
}

// Resume output defaults
export interface OutputConfig {
  default_date_display: DateDisplayMode;
  default_fit_one_page: boolean;
  default_template_settings: TemplateSettings;
}

export interface OutputConfigUpdate {
  default_date_display?: DateDisplayMode;
  default_fit_one_page?: boolean;
  default_template_settings?: ResumeTemplateSettings;
}

export async function fetchOutputConfig(): Promise<OutputConfig> {
  const res = await apiFetch('/config/output', { credentials: 'include' });

  if (!res.ok) {
    throw new Error(`Failed to load output config (status ${res.status}).`);
  }

  return res.json();
}

export async function updateOutputConfig(config: OutputConfigUpdate): Promise<OutputConfig> {
  const res = await apiFetch('/config/output', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(config),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Failed to update output config (status ${res.status}).`);
  }

  return res.json();
}

// Language configuration types
export type SupportedLanguage = 'en';

export interface LanguageConfig {
  ui_language: SupportedLanguage;
  content_language: SupportedLanguage;
  supported_languages: SupportedLanguage[];
}

export interface LanguageConfigUpdate {
  ui_language?: SupportedLanguage;
  content_language?: SupportedLanguage;
}

// Fetch language configuration
export async function fetchLanguageConfig(): Promise<LanguageConfig> {
  const res = await apiFetch('/config/language', { credentials: 'include' });

  if (!res.ok) {
    throw new Error(`Failed to load language config (status ${res.status}).`);
  }

  return res.json();
}

// Update language configuration
export async function updateLanguageConfig(update: LanguageConfigUpdate): Promise<LanguageConfig> {
  const res = await apiFetch('/config/language', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(update),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Failed to update language config (status ${res.status}).`);
  }

  return res.json();
}

export interface PromptOption {
  id: string;
  label: string;
  description: string;
}

export interface PromptConfig {
  default_prompt_id: string;
  prompt_options: PromptOption[];
}

export interface PromptConfigUpdate {
  default_prompt_id?: string;
}

// Fetch prompt configuration
export async function fetchPromptConfig(): Promise<PromptConfig> {
  const res = await apiFetch('/config/prompts', { credentials: 'include' });

  if (!res.ok) {
    throw new Error(`Failed to load prompt config (status ${res.status}).`);
  }

  return res.json();
}

// Update prompt configuration
export async function updatePromptConfig(update: PromptConfigUpdate): Promise<PromptConfig> {
  const res = await apiFetch('/config/prompts', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(update),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Failed to update prompt config (status ${res.status}).`);
  }

  return res.json();
}

// Apify API key
export interface ApifyKeyConfig {
  api_key: string;
  configured: boolean;
}

export async function fetchApifyKey(): Promise<ApifyKeyConfig> {
  const res = await apiFetch('/config/apify-key', { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to load Apify key (status ${res.status}).`);
  return res.json();
}

export async function updateApifyKey(api_key: string): Promise<ApifyKeyConfig> {
  const res = await apiFetch('/config/apify-key', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ api_key }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Failed to save Apify key (status ${res.status}).`);
  }
  return res.json();
}

// API Key Management types
export type ApiKeyProvider = 'openai' | 'anthropic' | 'google' | 'openrouter' | 'deepseek';

export interface ApiKeyProviderStatus {
  provider: ApiKeyProvider;
  configured: boolean;
  masked_key: string | null;
}

export interface ApiKeyStatusResponse {
  providers: ApiKeyProviderStatus[];
}

export interface ApiKeysUpdateRequest {
  openai?: string;
  anthropic?: string;
  google?: string;
  openrouter?: string;
  deepseek?: string;
}

export interface ApiKeysUpdateResponse {
  message: string;
  updated_providers: string[];
}

export interface StageReadinessItem {
  stage: string;
  provider: string;
  configured: boolean;
}

export interface StageReadinessResponse {
  stages: StageReadinessItem[];
  is_override: boolean;
}

export async function fetchStageReadiness(): Promise<StageReadinessResponse> {
  const res = await apiFetch('/config/stage-readiness', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load stage readiness');
  return res.json();
}

// Provider display names for API keys
export const API_KEY_PROVIDER_INFO: Record<ApiKeyProvider, { name: string; description: string }> =
  {
    openai: { name: 'OpenAI', description: 'GPT-4, GPT-4o, etc.' },
    anthropic: { name: 'Anthropic', description: 'Claude 3.5, Claude 4, etc.' },
    google: { name: 'Google', description: 'Gemini 1.5, Gemini 2, etc.' },
    openrouter: { name: 'OpenRouter', description: 'Access multiple providers' },
    deepseek: { name: 'DeepSeek', description: 'DeepSeek chat models' },
  };

// Fetch API key status for all providers
export async function fetchApiKeyStatus(): Promise<ApiKeyStatusResponse> {
  const res = await apiFetch('/config/api-keys', { credentials: 'include' });

  if (!res.ok) {
    throw new Error(`Failed to load API key status (status ${res.status}).`);
  }

  return res.json();
}

// Update API keys for one or more providers
export async function updateApiKeys(keys: ApiKeysUpdateRequest): Promise<ApiKeysUpdateResponse> {
  const res = await apiFetch('/config/api-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(keys),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Failed to update API keys (status ${res.status}).`);
  }

  return res.json();
}

// Delete API key for a specific provider
export async function deleteApiKey(provider: ApiKeyProvider): Promise<void> {
  const res = await apiFetch(`/config/api-keys/${provider}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Failed to delete API key (status ${res.status}).`);
  }
}

// Clear all API keys
export async function clearAllApiKeys(): Promise<void> {
  const res = await apiFetch('/config/api-keys?confirm=CLEAR_ALL_KEYS', {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Failed to clear API keys (status ${res.status}).`);
  }
}

// LLM Stage Config (per-stage model overrides YAML) — per-user, gated by a toggle.
export interface LlmStageConfigResponse {
  content: string;
  is_override: boolean;
  enabled?: boolean;
}

export async function setLlmStageRoutingEnabled(enabled: boolean): Promise<{ enabled: boolean }> {
  const res = await apiFetch('/config/llm-stage-config/enabled', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Failed to update routing toggle (status ${res.status}).`);
  }
  return res.json();
}

export async function fetchLlmStageConfig(template = false): Promise<LlmStageConfigResponse> {
  const url = template ? '/config/llm-stage-config?template=true' : '/config/llm-stage-config';
  const res = await apiFetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to load stage config (status ${res.status}).`);
  return res.json();
}

export async function uploadLlmStageConfig(file: File): Promise<LlmStageConfigResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await apiFetch('/config/llm-stage-config', {
    method: 'PUT',
    credentials: 'include',
    body: form,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Failed to upload stage config (status ${res.status}).`);
  }
  return res.json();
}

export async function deleteLlmStageConfig(): Promise<void> {
  const res = await apiFetch('/config/llm-stage-config', {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Failed to reset stage config (status ${res.status}).`);
  }
}

// Eval Config (per-user eval pipeline settings YAML)
export interface EvalConfigResponse {
  content: string;
  is_override: boolean;
}

export async function fetchEvalConfig(template = false): Promise<EvalConfigResponse> {
  const url = template ? '/config/eval-config?template=true' : '/config/eval-config';
  const res = await apiFetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to load eval config (status ${res.status}).`);
  return res.json();
}

export async function uploadEvalConfig(file: File): Promise<EvalConfigResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await apiFetch('/config/eval-config', {
    method: 'PUT',
    credentials: 'include',
    body: form,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Failed to upload eval config (status ${res.status}).`);
  }
  return res.json();
}

export async function deleteEvalConfig(): Promise<void> {
  const res = await apiFetch('/config/eval-config', {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Failed to reset eval config (status ${res.status}).`);
  }
}
