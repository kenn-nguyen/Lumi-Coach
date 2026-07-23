'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import {
  fetchLlmConfig,
  updateLlmConfig,
  testLlmConnection,
  fetchFeatureConfig,
  updateFeatureConfig,
  fetchOutputConfig,
  updateOutputConfig,
  fetchApifyKey,
  updateApifyKey,
  clearAllApiKeys,
  fetchLlmStageConfig,
  uploadLlmStageConfig,
  deleteLlmStageConfig,
  setLlmStageRoutingEnabled,
  fetchEvalConfig,
  uploadEvalConfig,
  deleteEvalConfig,
  fetchApiKeyStatus,
  fetchStageReadiness,
  updateApiKeys,
  deleteApiKey,
  PROVIDER_INFO,
  API_KEY_PROVIDER_INFO,
  type LLMConfig,
  type LLMProvider,
  type LLMHealthCheck,
  type ApiKeyProvider,
  type StageReadinessItem,
} from '@/lib/api/config';
import { DEFAULT_TEMPLATE_SETTINGS, type TemplateSettings } from '@/lib/types/template-settings';
import { FormattingControls } from '@/components/builder/formatting-controls';
import { mergeTemplateSettings } from '@/lib/utils/template-settings';
import { API_URL } from '@/lib/api/client';
import { getVersionString } from '@/lib/config/version';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { useStatusCache } from '@/lib/context/status-cache';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Save,
  Key,
  Database,
  Activity,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Server,
  FileText,
  Briefcase,
  Sparkles,
  Clock,
  Settings2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Upload,
  RotateCcw,
  Download,
} from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import {
  CACHE_KEYS,
  CACHE_TTL,
  readCache,
  writeCache,
  invalidateCache,
} from '@/lib/cache/local-cache';
import type { FeatureConfig, OutputConfig } from '@/lib/api/config';

type Status = 'idle' | 'loading' | 'saving' | 'saved' | 'error' | 'testing';
type ApiKeyDisclosureAction = 'save' | 'test';

const CHROME_EXTENSION_URL =
  'https://chromewebstore.google.com/detail/lumi-coach/iklflomjpppjfkaegdimkgabancffdhb';
const PROVIDERS: LLMProvider[] = ['openai', 'anthropic', 'openrouter', 'gemini', 'deepseek'];

const SEGMENTED_BUTTON_BASE =
  'rounded-xl border border-border font-mono transition-colors duration-150 ease-out shadow-xs disabled:cursor-not-allowed disabled:opacity-50';
const SEGMENTED_BUTTON_ACTIVE = 'bg-primary text-white border-primary/20 hover:bg-[color:#173ce0]';
const SEGMENTED_BUTTON_INACTIVE = 'bg-card text-foreground hover:bg-secondary';

const normalizeApiBaseForProvider = (_provider: LLMProvider, value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
};

const isKnownProvider = (value: string): value is LLMProvider =>
  Object.prototype.hasOwnProperty.call(PROVIDER_INFO, value);

const unwrapCodeBlock = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const fenced = trimmed.match(/^```[a-zA-Z0-9_-]*\n([\s\S]*?)\n```\s*$/);
  if (fenced) {
    return fenced[1]?.trimEnd() || null;
  }
  return trimmed;
};

const getHealthCheckMessage = (
  t: (key: string, params?: Record<string, string | number>) => string,
  baseKey: string,
  code?: string,
  fallback?: string
): string | null => {
  if (code) {
    const key = `${baseKey}.${code}`;
    const localized = t(key);
    return localized !== key ? localized : (fallback ?? code);
  }
  return fallback ?? null;
};

export default function SettingsPage() {
  const { status: authStatus } = useSession();
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);

  // LLM Config state
  const [provider, setProvider] = useState<LLMProvider>('openai');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiBase, setApiBase] = useState('');
  const [hasStoredApiKey, setHasStoredApiKey] = useState(false);
  const [isUserSavedConfig, setIsUserSavedConfig] = useState(false);

  // Advanced section
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showModelCustomize, setShowModelCustomize] = useState(false);

  // Stage config state
  const [stageConfigIsOverride, setStageConfigIsOverride] = useState(false);
  const [stageRoutingEnabled, setStageRoutingEnabled] = useState(false);
  const [stageConfigLoading, setStageConfigLoading] = useState(false);
  const [stageConfigError, setStageConfigError] = useState<string | null>(null);
  const [stageConfigSaved, setStageConfigSaved] = useState(false);
  const stageFileRef = useRef<HTMLInputElement>(null);
  const [stageReadiness, setStageReadiness] = useState<StageReadinessItem[]>([]);

  // Eval config state
  const [evalConfigIsOverride, setEvalConfigIsOverride] = useState(false);
  const [evalConfigLoading, setEvalConfigLoading] = useState(false);
  const [evalConfigError, setEvalConfigError] = useState<string | null>(null);
  const [evalConfigSaved, setEvalConfigSaved] = useState(false);
  const evalFileRef = useRef<HTMLInputElement>(null);

  // System status (collapsible)
  const [showSystemStatus, setShowSystemStatus] = useState(true);

  // Use cached system status (loaded on app start, refreshes every 30 min)
  const {
    status: systemStatus,
    isLoading: statusLoading,
    error: statusError,
    lastFetched,
    refreshStatus,
  } = useStatusCache();

  // Health check result from manual test
  const [healthCheck, setHealthCheck] = useState<LLMHealthCheck | null>(null);

  // Feature config state
  const [enableCoverLetter, setEnableCoverLetter] = useState(false);
  const [enableOutreach, setEnableOutreach] = useState(false);
  const [preserveGeneratedResumeFacts, setPreserveGeneratedResumeFacts] = useState(true);
  const [featureConfigLoading, setFeatureConfigLoading] = useState(false);
  const [apifyKey, setApifyKey] = useState('');
  const [hasStoredApifyKey, setHasStoredApifyKey] = useState(false);
  const [apifyKeyLoading, setApifyKeyLoading] = useState(false);
  const [apifyKeySaved, setApifyKeySaved] = useState(false);
  const [defaultTemplateSettings, setDefaultTemplateSettings] =
    useState<TemplateSettings>(DEFAULT_TEMPLATE_SETTINGS);
  const [outputConfigLoading, setOutputConfigLoading] = useState(false);

  // Danger Zone state
  const [showClearApiKeysDialog, setShowClearApiKeysDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [successMessage, setSuccessDialogMessage] = useState({ title: '', description: '' });
  const [isResetting, setIsResetting] = useState(false);
  const [showApiKeyDisclosureDialog, setShowApiKeyDisclosureDialog] = useState(false);
  const [pendingApiKeyAction, setPendingApiKeyAction] = useState<ApiKeyDisclosureAction | null>(
    null
  );

  // Multi-provider API key grid state
  const [providerKeys, setProviderKeys] = useState<Partial<Record<ApiKeyProvider, string>>>({});
  const [savedProviders, setSavedProviders] = useState<Set<ApiKeyProvider>>(new Set());
  const [providerKeysSavingMap, setProviderKeysSavingMap] = useState<
    Partial<Record<ApiKeyProvider, boolean>>
  >({});
  const [providerKeysSavedMap, setProviderKeysSavedMap] = useState<
    Partial<Record<ApiKeyProvider, boolean>>
  >({});
  const [providerKeysError, setProviderKeysError] = useState<string | null>(null);

  // Translations
  const { t } = useTranslations();
  const providerInfo = PROVIDER_INFO[provider] ?? PROVIDER_INFO['openai'];
  const healthDetailItems = useMemo(() => {
    if (!healthCheck) return [];

    return [
      {
        key: 'testPrompt',
        label: t('settings.llmConfiguration.testPromptLabel'),
        value: unwrapCodeBlock(healthCheck.test_prompt),
      },
      {
        key: 'modelOutput',
        label: t('settings.llmConfiguration.modelOutputLabel'),
        value: unwrapCodeBlock(healthCheck.model_output),
      },
      {
        key: 'errorDetail',
        label: t('settings.llmConfiguration.errorDetailLabel'),
        value: unwrapCodeBlock(healthCheck.error_detail),
      },
    ].filter((item) => item.value);
  }, [healthCheck, t]);
  const healthCheckError = useMemo(() => {
    if (!healthCheck) return null;
    return getHealthCheckMessage(
      t,
      'settings.llmConfiguration.healthErrors',
      healthCheck.error_code,
      healthCheck.error
    );
  }, [healthCheck, t]);
  const healthCheckWarning = useMemo(() => {
    if (!healthCheck) return null;
    return getHealthCheckMessage(
      t,
      'settings.llmConfiguration.healthWarnings',
      healthCheck.warning_code,
      healthCheck.warning
    );
  }, [healthCheck, t]);

  // Cached LLM config shape (no raw key value — only existence flag)
  interface SettingsLlmCache {
    provider: LLMProvider;
    model: string;
    api_base: string;
    has_stored_api_key: boolean;
    is_user_config: boolean;
  }

  const applyLlmConfig = useCallback(
    (llmConfig: LLMConfig | SettingsLlmCache) => {
      const providerFromBackend = llmConfig.provider || 'openai';
      const safeProvider = isKnownProvider(providerFromBackend) ? providerFromBackend : 'openai';
      setProvider(safeProvider);
      setModel(llmConfig.model || PROVIDER_INFO[safeProvider].defaultModel);
      setApiBase(normalizeApiBaseForProvider(safeProvider, llmConfig.api_base || '') || '');

      if ('has_stored_api_key' in llmConfig) {
        // From cache — no raw key available
        setHasStoredApiKey(llmConfig.has_stored_api_key);
        setIsUserSavedConfig(llmConfig.is_user_config);
      } else {
        // From API — may have masked key
        const isMaskedKey = Boolean(llmConfig.api_key) && llmConfig.api_key.includes('*');
        setHasStoredApiKey(Boolean(llmConfig.api_key));
        setIsUserSavedConfig(Boolean(llmConfig.is_user_config));
        setApiKey(isMaskedKey ? '' : llmConfig.api_key || '');
      }

      if (providerFromBackend !== safeProvider) {
        setError(t('settings.errors.unknownProvider', { provider: providerFromBackend }));
      }
    },
    [t]
  );

  const applyFeatureConfig = useCallback((featureConfig: FeatureConfig) => {
    setEnableCoverLetter(featureConfig.enable_cover_letter);
    setEnableOutreach(featureConfig.enable_outreach_message);
    setPreserveGeneratedResumeFacts(featureConfig.preserve_generated_resume_facts);
  }, []);

  const applyOutputConfig = useCallback((outputConfig: OutputConfig) => {
    setDefaultTemplateSettings(
      mergeTemplateSettings(outputConfig.default_template_settings, {
        dateDisplay: outputConfig.default_date_display,
        fitOnePage: outputConfig.default_fit_one_page,
      })
    );
  }, []);

  // Load all config on mount — serve from cache immediately, fetch fresh in background
  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    let cancelled = false;

    // 1. Apply cached values so the page is interactive immediately
    const cachedLlm = readCache<SettingsLlmCache>(CACHE_KEYS.SETTINGS_LLM, CACHE_TTL.SETTINGS);
    const cachedFeatures = readCache<FeatureConfig>(
      CACHE_KEYS.SETTINGS_FEATURES,
      CACHE_TTL.SETTINGS
    );
    const cachedOutput = readCache<OutputConfig>(CACHE_KEYS.SETTINGS_OUTPUT, CACHE_TTL.SETTINGS);

    if (cachedLlm) applyLlmConfig(cachedLlm);
    if (cachedFeatures) applyFeatureConfig(cachedFeatures);
    if (cachedOutput) applyOutputConfig(cachedOutput);
    if (cachedLlm || cachedFeatures || cachedOutput) setStatus('idle');

    // 2. Always fetch fresh in background
    async function loadConfig() {
      try {
        const [
          llmConfig,
          featureConfig,
          outputConfig,
          apifyConfig,
          stageConfig,
          apiKeyStatus,
          evalConfig,
          stageReadinessData,
        ] = await Promise.all([
          fetchLlmConfig().catch(() => null),
          fetchFeatureConfig().catch(() => null),
          fetchOutputConfig().catch(() => null),
          fetchApifyKey().catch(() => null),
          fetchLlmStageConfig().catch(() => null),
          fetchApiKeyStatus().catch(() => null),
          fetchEvalConfig().catch(() => null),
          fetchStageReadiness().catch(() => null),
        ]);

        if (cancelled) return;

        if (llmConfig) {
          applyLlmConfig(llmConfig);
          const safeProvider = isKnownProvider(llmConfig.provider) ? llmConfig.provider : 'openai';
          writeCache<SettingsLlmCache>(CACHE_KEYS.SETTINGS_LLM, {
            provider: safeProvider,
            model: llmConfig.model || PROVIDER_INFO[safeProvider].defaultModel,
            api_base: normalizeApiBaseForProvider(safeProvider, llmConfig.api_base || '') || '',
            has_stored_api_key: Boolean(llmConfig.api_key),
            is_user_config: Boolean(llmConfig.is_user_config),
          });
        }

        if (featureConfig) {
          applyFeatureConfig(featureConfig);
          writeCache<FeatureConfig>(CACHE_KEYS.SETTINGS_FEATURES, featureConfig);
        }

        if (outputConfig) {
          applyOutputConfig(outputConfig);
          writeCache<OutputConfig>(CACHE_KEYS.SETTINGS_OUTPUT, outputConfig);
        }

        if (apifyConfig) {
          setHasStoredApifyKey(apifyConfig.configured);
        }

        if (stageConfig) {
          setStageConfigIsOverride(stageConfig.is_override);
          setStageRoutingEnabled(stageConfig.enabled ?? false);
        }

        if (evalConfig) {
          setEvalConfigIsOverride(evalConfig.is_override);
        }

        if (stageReadinessData) {
          setStageReadiness(stageReadinessData.stages);
        }

        if (apiKeyStatus) {
          const saved = new Set<ApiKeyProvider>();
          apiKeyStatus.providers.forEach((p) => {
            if (p.configured) saved.add(p.provider as ApiKeyProvider);
          });
          setSavedProviders(saved);
        }

        setStatus('idle');
      } catch (err) {
        console.error('Failed to load settings', err);
        if (!cancelled) {
          setError(t('settings.errors.unableToConnectBackend'));
          setStatus('error');
        }
      }
    }

    loadConfig();
    return () => {
      cancelled = true;
    };
  }, [authStatus, t, applyLlmConfig, applyFeatureConfig, applyOutputConfig]);

  // Handle provider change
  const handleProviderChange = (newProvider: LLMProvider) => {
    setProvider(newProvider);
    setModel(PROVIDER_INFO[newProvider].defaultModel);
    setApiBase('');
    setApiKey('');
    setHasStoredApiKey(false);
    setIsUserSavedConfig(false);
  };

  // Save configuration
  const saveLlmConfiguration = async () => {
    setStatus('saving');
    setError(null);
    setHealthCheck(null);

    try {
      if (requiresApiKey && !apiKey.trim() && !hasStoredApiKey) {
        setError(t('settings.errors.apiKeyRequired'));
        setStatus('error');
        return;
      }

      const trimmedKey = apiKey.trim();
      const config: Partial<LLMConfig> = {
        provider,
        model: model.trim(),
        api_base: normalizeApiBaseForProvider(provider, apiBase),
      };
      if (requiresApiKey) {
        if (trimmedKey) {
          config.api_key = trimmedKey;
        } else if (!hasStoredApiKey) {
          config.api_key = '';
        }
      } else {
        config.api_key = '';
      }

      await updateLlmConfig(config);
      await refreshStatus();
      setIsUserSavedConfig(true);
      // Update LLM cache with new values (no raw key stored)
      writeCache(CACHE_KEYS.SETTINGS_LLM, {
        provider,
        model: model.trim() || providerInfo.defaultModel,
        api_base: normalizeApiBaseForProvider(provider, apiBase) || '',
        has_stored_api_key: requiresApiKey ? (apiKey.trim() ? true : hasStoredApiKey) : false,
        is_user_config: true,
      });
      invalidateCache(CACHE_KEYS.STATUS);
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to save config', err);
      setError((err as Error).message || t('settings.errors.unableToSaveConfiguration'));
      setStatus('error');
    }
  };

  // Test connection
  const testLlmConfiguration = async () => {
    setStatus('testing');
    setError(null);
    setHealthCheck(null);

    try {
      const testConfig: Partial<LLMConfig> = {
        provider,
        model: model.trim() || providerInfo.defaultModel,
        api_base: normalizeApiBaseForProvider(provider, apiBase),
      };
      if (requiresApiKey && apiKey.trim()) {
        testConfig.api_key = apiKey.trim();
      }

      const result = await testLlmConnection(testConfig);
      setHealthCheck(result);
      setStatus('idle');
    } catch (err) {
      console.error('Failed to test connection', err);
      setHealthCheck({ healthy: false, provider, model, error: (err as Error).message });
      setStatus('idle');
    }
  };

  const requestApiKeyAction = (action: ApiKeyDisclosureAction) => {
    if (!requiresApiKey) {
      void (action === 'save' ? saveLlmConfiguration() : testLlmConfiguration());
      return;
    }
    setPendingApiKeyAction(action);
    setShowApiKeyDisclosureDialog(true);
  };

  const handleApiKeyDisclosureConfirm = () => {
    const action = pendingApiKeyAction;
    setShowApiKeyDisclosureDialog(false);
    setPendingApiKeyAction(null);
    if (action === 'save') void saveLlmConfiguration();
    else if (action === 'test') void testLlmConfiguration();
  };

  // Feature config
  const handleFeatureConfigChange = async (
    key: 'enable_cover_letter' | 'enable_outreach_message' | 'preserve_generated_resume_facts',
    value: boolean
  ) => {
    setFeatureConfigLoading(true);
    try {
      const updated = await updateFeatureConfig({ [key]: value });
      setEnableCoverLetter(updated.enable_cover_letter);
      setEnableOutreach(updated.enable_outreach_message);
      setPreserveGeneratedResumeFacts(updated.preserve_generated_resume_facts);
      writeCache(CACHE_KEYS.SETTINGS_FEATURES, updated);
    } catch (err) {
      console.error('Failed to update feature config', err);
      if (key === 'enable_cover_letter') setEnableCoverLetter(!value);
      else if (key === 'enable_outreach_message') setEnableOutreach(!value);
      else setPreserveGeneratedResumeFacts(!value);
    } finally {
      setFeatureConfigLoading(false);
    }
  };

  // Apify key
  const handleApifyKeySave = async (valueOverride?: string) => {
    const trimmed = (valueOverride ?? apifyKey).trim();
    if (!trimmed && !hasStoredApifyKey) return;
    setApifyKeyLoading(true);
    setError(null);
    try {
      const result = await updateApifyKey(trimmed);
      setHasStoredApifyKey(result.configured);
      setApifyKey('');
      setApifyKeySaved(true);
      setTimeout(() => setApifyKeySaved(false), 2500);
    } catch (err) {
      console.error('Failed to save Apify key', err);
      setError((err as Error).message || t('settings.errors.unableToSaveConfiguration'));
    } finally {
      setApifyKeyLoading(false);
    }
  };

  // Multi-provider key grid — map LLMProvider pill selection to ApiKeyProvider key name
  const llmProviderToApiKeyProvider = (p: LLMProvider): ApiKeyProvider => {
    if (p === 'gemini') return 'google';
    return p as ApiKeyProvider;
  };

  const handleSaveProviderKey = async (pk: ApiKeyProvider) => {
    const val = providerKeys[pk]?.trim();
    if (!val) return;
    setProviderKeysSavingMap((prev) => ({ ...prev, [pk]: true }));
    setProviderKeysError(null);
    try {
      const result = await updateApiKeys({ [pk]: val });
      const updatedSaved = new Set(savedProviders);
      result.updated_providers.forEach((p) => updatedSaved.add(p as ApiKeyProvider));
      setSavedProviders(updatedSaved);
      setProviderKeys((prev) => {
        const next = { ...prev };
        delete next[pk];
        return next;
      });
      setProviderKeysSavedMap((prev) => ({ ...prev, [pk]: true }));
      setTimeout(() => setProviderKeysSavedMap((prev) => ({ ...prev, [pk]: false })), 2500);
    } catch (err) {
      setProviderKeysError((err as Error).message || 'Failed to save API key');
    } finally {
      setProviderKeysSavingMap((prev) => ({ ...prev, [pk]: false }));
    }
  };

  const handleDeleteProviderKey = async (p: ApiKeyProvider) => {
    try {
      await deleteApiKey(p);
      setSavedProviders((prev) => {
        const next = new Set(prev);
        next.delete(p);
        return next;
      });
    } catch (err) {
      console.error('Failed to delete provider key', err);
    }
  };

  // Output template settings
  const handleOutputTemplateSettingsChange = async (nextSettings: TemplateSettings) => {
    const previousSettings = defaultTemplateSettings;
    setDefaultTemplateSettings(nextSettings);
    setOutputConfigLoading(true);
    setError(null);
    try {
      const updated = await updateOutputConfig({
        default_template_settings: nextSettings,
        default_date_display: nextSettings.dateDisplay,
        default_fit_one_page: nextSettings.fitOnePage,
      });
      const merged = mergeTemplateSettings(updated.default_template_settings, {
        dateDisplay: updated.default_date_display,
        fitOnePage: updated.default_fit_one_page,
      });
      setDefaultTemplateSettings(merged);
      writeCache(CACHE_KEYS.SETTINGS_OUTPUT, updated);
    } catch (err) {
      console.error('Failed to update output config', err);
      setDefaultTemplateSettings(previousSettings);
      setError((err as Error).message || t('settings.errors.unableToSaveConfiguration'));
    } finally {
      setOutputConfigLoading(false);
    }
  };

  // Stage config upload
  const handleStageConfigUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStageConfigLoading(true);
    setStageConfigError(null);
    try {
      const result = await uploadLlmStageConfig(file);
      setStageConfigIsOverride(result.is_override);
      setStageConfigSaved(true);
      setTimeout(() => setStageConfigSaved(false), 2500);
    } catch (err) {
      setStageConfigError((err as Error).message || 'Failed to upload config');
    } finally {
      setStageConfigLoading(false);
      if (stageFileRef.current) stageFileRef.current.value = '';
    }
  };

  const handleStageConfigDownload = async () => {
    setStageConfigError(null);
    try {
      const result = await fetchLlmStageConfig(true);
      const blob = new Blob([result.content], { type: 'text/yaml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'llm-stage-config.yaml';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setStageConfigError((err as Error).message || 'Failed to download config');
    }
  };

  const handleStageConfigReset = async () => {
    setStageConfigLoading(true);
    setStageConfigError(null);
    try {
      await deleteLlmStageConfig();
      setStageConfigIsOverride(false);
    } catch (err) {
      setStageConfigError((err as Error).message || 'Failed to reset config');
    } finally {
      setStageConfigLoading(false);
    }
  };

  const handleStageRoutingToggle = async (checked: boolean) => {
    setStageRoutingEnabled(checked);
    setStageConfigError(null);
    try {
      await setLlmStageRoutingEnabled(checked);
    } catch (err) {
      setStageRoutingEnabled(!checked);
      setStageConfigError((err as Error).message || 'Failed to update toggle');
    }
  };

  // Eval config handlers
  const handleEvalConfigUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEvalConfigLoading(true);
    setEvalConfigError(null);
    try {
      const result = await uploadEvalConfig(file);
      setEvalConfigIsOverride(result.is_override);
      setEvalConfigSaved(true);
      setTimeout(() => setEvalConfigSaved(false), 2500);
    } catch (err) {
      setEvalConfigError((err as Error).message || 'Failed to upload eval config');
    } finally {
      setEvalConfigLoading(false);
      if (evalFileRef.current) evalFileRef.current.value = '';
    }
  };

  const handleEvalConfigDownload = async () => {
    setEvalConfigError(null);
    try {
      const result = await fetchEvalConfig(true);
      const blob = new Blob([result.content], { type: 'text/yaml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'eval-config.yaml';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setEvalConfigError((err as Error).message || 'Failed to download eval config');
    }
  };

  const handleEvalConfigReset = async () => {
    setEvalConfigLoading(true);
    setEvalConfigError(null);
    try {
      await deleteEvalConfig();
      setEvalConfigIsOverride(false);
    } catch (err) {
      setEvalConfigError((err as Error).message || 'Failed to reset eval config');
    } finally {
      setEvalConfigLoading(false);
    }
  };

  // Clear API keys
  const handleClearApiKeys = async () => {
    setIsResetting(true);
    try {
      await clearAllApiKeys();
      invalidateCache(CACHE_KEYS.SETTINGS_LLM, CACHE_KEYS.STATUS);
      const llmConfig = await fetchLlmConfig().catch(() => null);
      if (llmConfig) {
        setProvider(llmConfig.provider || 'openai');
        setModel(llmConfig.model || PROVIDER_INFO['openai'].defaultModel);
        const isMaskedKey = Boolean(llmConfig.api_key) && llmConfig.api_key.includes('*');
        setHasStoredApiKey(Boolean(llmConfig.api_key));
        setIsUserSavedConfig(Boolean(llmConfig.is_user_config));
        setApiKey(isMaskedKey ? '' : llmConfig.api_key || '');
        setApiBase(
          normalizeApiBaseForProvider(llmConfig.provider || 'openai', llmConfig.api_base || '') ||
            ''
        );
      } else {
        setApiKey('');
        setHasStoredApiKey(false);
        setIsUserSavedConfig(false);
      }
      setHealthCheck(null);
      await refreshStatus();
      setError(null);
      setSuccessDialogMessage({
        title: t('common.success'),
        description: t('common.keysCleared'),
      });
      setShowSuccessDialog(true);
    } catch (err) {
      console.error('Failed to clear API keys', err);
      setError(t('settings.errors.failedToClearApiKeys'));
    } finally {
      setIsResetting(false);
      setShowClearApiKeysDialog(false);
    }
  };

  // Format last fetched time
  const formatLastFetched = () => {
    if (!lastFetched) return t('settings.systemStatus.lastFetched.never');
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastFetched.getTime()) / 1000);
    if (diff < 60) return t('settings.systemStatus.lastFetched.justNow');
    if (diff < 3600)
      return t('settings.systemStatus.lastFetched.minutesAgo', { minutes: Math.floor(diff / 60) });
    return t('settings.systemStatus.lastFetched.hoursAgo', { hours: Math.floor(diff / 3600) });
  };

  const requiresApiKey = providerInfo.requiresKey ?? true;
  const isServerManagedVertexProvider = provider === 'vertex_ai' && !isUserSavedConfig;

  return (
    <div className="skin-page-work flex min-h-screen flex-col items-center justify-start overflow-y-auto p-6 md:p-12">
      <div className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-border bg-[rgba(250,248,242,0.96)] shadow-sw-card">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border bg-white/70 p-8">
          <h1 className="font-serif text-3xl font-bold tracking-[-0.04em]">
            {t('settings.title')}
          </h1>
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4" />
              {t('common.back')}
            </Button>
          </Link>
        </div>

        <div className="p-8 space-y-10">
          {/* LLM not configured warning */}
          {!statusLoading && systemStatus && !systemStatus.llm_configured && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sw-sm">
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 bg-amber-500 mt-1 shrink-0"></div>
                <div className="flex-1">
                  <p className="font-mono text-sm font-bold uppercase tracking-wider text-amber-800">
                    {t('settings.setupRequired.title')}
                  </p>
                  <p className="font-mono text-xs text-amber-700 mt-1">
                    {t('settings.setupRequired.description')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── System Status ─────────────────────────────────────────── */}
          <section className="space-y-3">
            <button
              onClick={() => setShowSystemStatus((v) => !v)}
              className="flex w-full items-center justify-between border-b border-border/80 pb-2"
            >
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                <h2 className="font-mono text-sm font-bold uppercase tracking-wider">
                  {t('settings.systemStatus.title')}
                </h2>
                {systemStatus && (
                  <span
                    className={`font-mono text-xs ${systemStatus.status === 'ready' ? 'text-green-700' : 'text-amber-600'}`}
                  >
                    —{' '}
                    {systemStatus.status === 'ready'
                      ? t('settings.footer.status.ready')
                      : t('settings.footer.status.setupRequired')}
                  </span>
                )}
              </div>
              {showSystemStatus ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {showSystemStatus && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  {lastFetched && (
                    <span className="font-mono text-xs text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatLastFetched()}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={refreshStatus}
                    disabled={statusLoading}
                    className="gap-1 text-xs ml-auto"
                  >
                    <RefreshCw className={`w-3 h-3 ${statusLoading ? 'animate-spin' : ''}`} />
                    {t('settings.systemStatus.refresh')}
                  </Button>
                </div>

                {statusLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : !systemStatus ? (
                  <div className="flex flex-col items-center justify-center p-8 gap-3 border border-dashed border-red-300 bg-red-50">
                    <p className="font-mono text-xs text-red-600 uppercase">
                      {t('settings.systemStatus.unableToConnect')}
                    </p>
                    <p className="font-mono text-xs text-gray-600">
                      {t('settings.systemStatus.expectedAt', { apiUrl: API_URL })}
                    </p>
                    {statusError && (
                      <p className="font-mono text-xs text-red-500 text-center max-w-sm break-words">
                        {statusError}
                      </p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={refreshStatus}
                      className="gap-1 text-xs"
                    >
                      <RefreshCw className="w-3 h-3" />
                      {t('common.retry')}
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-border bg-white p-4 shadow-sw-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <Server className="w-4 h-4 text-gray-500" />
                        <span className="font-mono text-xs uppercase text-gray-500">
                          {t('settings.statusCards.llm')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {systemStatus.llm_healthy ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                        <span className="font-mono text-sm font-bold">
                          {systemStatus.llm_healthy
                            ? t('settings.statusValues.healthy')
                            : t('settings.statusValues.offline')}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-white p-4 shadow-sw-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <Database className="w-4 h-4 text-gray-500" />
                        <span className="font-mono text-xs uppercase text-gray-500">
                          {t('settings.statusCards.database')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        <span className="font-mono text-sm font-bold">
                          {t('settings.statusValues.connected')}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-white p-4 shadow-sw-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-gray-500" />
                        <span className="font-mono text-xs uppercase text-gray-500">
                          {t('settings.statusCards.masterResume')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {systemStatus.has_master_resume ? (
                          <>
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                            <span className="font-mono text-sm font-bold">
                              {t('settings.statusValues.configured')}
                            </span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-5 h-5 text-amber-500" />
                            <span className="font-mono text-sm font-bold">
                              {t('settings.statusValues.notSet')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-white p-4 shadow-sw-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-gray-500" />
                        <span className="font-mono text-xs uppercase text-gray-500">
                          {t('settings.statusCards.resumes')}
                        </span>
                      </div>
                      <span className="font-mono text-2xl font-bold">
                        {systemStatus.database_stats.total_resumes}
                      </span>
                    </div>

                    <div className="rounded-2xl border border-border bg-white p-4 shadow-sw-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <Briefcase className="w-4 h-4 text-gray-500" />
                        <span className="font-mono text-xs uppercase text-gray-500">
                          {t('settings.statusCards.jobs')}
                        </span>
                      </div>
                      <span className="font-mono text-2xl font-bold">
                        {systemStatus.database_stats.total_jobs}
                      </span>
                    </div>

                    <div className="rounded-2xl border border-border bg-white p-4 shadow-sw-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-gray-500" />
                        <span className="font-mono text-xs uppercase text-gray-500">
                          {t('settings.statusCards.improvements')}
                        </span>
                      </div>
                      <span className="font-mono text-2xl font-bold">
                        {systemStatus.database_stats.total_improvements}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── AI Connection ────────────────────────────────────────── */}
          <section className="space-y-5">
            <div className="flex items-center gap-2 border-b border-border/80 pb-2">
              <Key className="w-4 h-4" />
              <h2 className="font-mono text-sm font-bold uppercase tracking-wider">
                {t('settings.llmConfigurationTitle')}
              </h2>
            </div>

            {/* Provider */}
            <div className="space-y-2">
              <Label>{t('settings.providerLabel')}</Label>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {PROVIDERS.map((p) => (
                  <button
                    key={p}
                    onClick={() => handleProviderChange(p)}
                    className={`px-3 py-2 text-xs uppercase ${SEGMENTED_BUTTON_BASE} ${
                      provider === p ? SEGMENTED_BUTTON_ACTIVE : SEGMENTED_BUTTON_INACTIVE
                    }`}
                  >
                    {PROVIDER_INFO[p].name.split(' ')[0]}
                  </button>
                ))}
              </div>
              {isServerManagedVertexProvider && (
                <p className="text-xs text-gray-500 font-mono">
                  Vertex AI is managed by the backend. Choose another provider to save your own
                  override.
                </p>
              )}
            </div>

            {/* Primary API Key (for selected provider) */}
            <div className="space-y-1.5">
              <Label htmlFor="apiKey">{t('settings.llmConfiguration.apiKeyLabel')}</Label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                }}
                placeholder={
                  requiresApiKey
                    ? hasStoredApiKey
                      ? t('settings.llmConfiguration.leaveBlankToKeepExistingKey')
                      : t('settings.llmConfiguration.apiKeyPlaceholder')
                    : t('settings.llmConfiguration.apiKeyNotRequiredPlaceholder')
                }
                className="font-mono"
                disabled={!requiresApiKey}
              />
              {hasStoredApiKey && isUserSavedConfig && (
                <p className="text-xs text-green-700 font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {t('settings.llmConfiguration.savedToAccount')}
                </p>
              )}
            </div>

            {/* Customize model — collapsible */}
            <div>
              <button
                onClick={() => setShowModelCustomize((v) => !v)}
                className="flex items-center gap-1.5 font-mono text-xs text-gray-500 hover:text-gray-800 transition-colors"
              >
                {showModelCustomize ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
                Customize model (optional)
              </button>
              {showModelCustomize && (
                <div className="mt-3 space-y-4 rounded-2xl border border-border/60 bg-white/40 p-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="llm-model-name">
                      {t('settings.llmConfiguration.modelLabel')}
                    </Label>
                    <Input
                      id="llm-model-name"
                      name="llm-model-name"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder={providerInfo.defaultModel}
                      autoComplete="off"
                      spellCheck={false}
                      className="font-mono"
                    />
                    <p className="text-xs text-amber-700 font-mono bg-amber-50 border border-amber-200 px-2 py-1.5">
                      Used for: bullet regeneration, outreach, cover letter, resume import.
                      Tailoring uses per-stage models from the stage config in Advanced.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="apiBase">{t('settings.llmConfiguration.baseUrlLabel')}</Label>
                    <Input
                      id="apiBase"
                      value={apiBase}
                      onChange={(e) => setApiBase(e.target.value)}
                      placeholder={t('settings.llmConfiguration.baseUrlPlaceholder')}
                      className="font-mono"
                    />
                    <p className="text-xs text-gray-500 font-mono">
                      {t('settings.llmConfiguration.baseUrlDescription')}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                onClick={() => requestApiKeyAction('save')}
                disabled={
                  status === 'saving' || status === 'loading' || isServerManagedVertexProvider
                }
                className="flex-1"
              >
                {status === 'saving' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : status === 'saved' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    {t('common.success')}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {t('common.save')}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => requestApiKeyAction('test')}
                disabled={status === 'testing' || status === 'saving'}
              >
                {status === 'testing' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Activity className="w-4 h-4" />
                    {t('settings.llmConfiguration.testConnection')}
                  </>
                )}
              </Button>
            </div>

            {/* Error */}
            {error && (
              <div className="border border-red-300 bg-red-50 p-3">
                <p className="text-xs text-red-600 font-mono">
                  {t('settings.llmConfiguration.errorPrefix', { error })}
                </p>
              </div>
            )}

            {/* Health check result */}
            {healthCheck && (
              <div
                className={`border p-4 ${
                  healthCheck.healthy ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {healthCheck.healthy ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  <span className="font-mono text-sm font-bold">
                    {healthCheck.healthy
                      ? t('settings.llmConfiguration.connectionSuccessful')
                      : t('settings.llmConfiguration.connectionFailed')}
                  </span>
                </div>
                <p className="font-mono text-xs text-gray-600">
                  {t('settings.llmConfiguration.connectionDetails', {
                    provider: healthCheck.provider,
                    model: healthCheck.model,
                  })}
                </p>
                {healthCheckError && (
                  <p className="font-mono text-xs text-red-600 mt-1">{healthCheckError}</p>
                )}
                {healthCheckWarning && (
                  <p className="font-mono text-xs text-amber-700 mt-1">{healthCheckWarning}</p>
                )}
                {healthDetailItems.length > 0 && (
                  <div className="mt-3 space-y-3">
                    {healthDetailItems.map((item) => (
                      <div key={item.key}>
                        <p className="font-mono text-[10px] uppercase tracking-wider text-gray-600">
                          {item.label}
                        </p>
                        <pre className="mt-1 whitespace-pre-wrap rounded-2xl border border-border bg-white p-3 text-xs text-gray-800 shadow-sw-sm">
                          {item.value}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Advanced toggle */}
            <button
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1.5 font-mono text-xs text-gray-500 hover:text-gray-800 transition-colors"
            >
              {showAdvanced ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              Advanced
            </button>

            {/* Advanced section */}
            {showAdvanced && (
              <div className="space-y-5 rounded-2xl border border-border/60 bg-white/40 p-5">
                {/* Stage Config YAML Upload */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Tailoring Pipeline</Label>
                    <span
                      className={`font-mono text-xs px-2 py-0.5 border ${
                        stageRoutingEnabled && stageConfigIsOverride
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : 'border-border bg-secondary text-gray-500'
                      }`}
                    >
                      {stageRoutingEnabled && stageConfigIsOverride
                        ? 'Custom active'
                        : 'Single provider'}
                    </span>
                  </div>
                  <ToggleSwitch
                    checked={stageRoutingEnabled}
                    onCheckedChange={handleStageRoutingToggle}
                    label="Enable per-stage routing"
                    description="Off by default: every stage uses your active AI provider. Turn on to route different prompt stages to different providers via a config file. Your config is private to your account."
                  />
                  {stageRoutingEnabled && (
                    <>
                      <p className="text-xs text-gray-500 font-mono">
                        YAML file controlling per-provider, per-stage model overrides for the
                        tailoring pipeline. Download the template to see the format, edit it, then
                        upload.
                      </p>
                      <div className="flex gap-2">
                        <input
                          ref={stageFileRef}
                          type="file"
                          accept=".yaml,.yml"
                          className="hidden"
                          onChange={handleStageConfigUpload}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => stageFileRef.current?.click()}
                          disabled={stageConfigLoading}
                          className="gap-1.5"
                        >
                          {stageConfigLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : stageConfigSaved ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                          ) : (
                            <Upload className="w-3.5 h-3.5" />
                          )}
                          {stageConfigSaved ? 'Uploaded' : 'Upload YAML'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleStageConfigDownload}
                          className="gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download template
                        </Button>
                        {stageConfigIsOverride && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleStageConfigReset}
                            disabled={stageConfigLoading}
                            className="gap-1.5 text-gray-600 hover:text-red-600 hover:border-red-200"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Remove config
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                  {stageConfigError && (
                    <p className="text-xs text-red-600 font-mono">{stageConfigError}</p>
                  )}
                </div>

                {/* ── Eval Pipeline ──────────────────────────────────────── */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Eval Pipeline</Label>
                    <span
                      className={`font-mono text-xs px-2 py-0.5 border ${
                        evalConfigIsOverride
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : 'border-border bg-secondary text-gray-500'
                      }`}
                    >
                      {evalConfigIsOverride ? 'Custom active' : 'Default'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 font-mono">
                    YAML file controlling judge weights, heuristics thresholds, and structural
                    requirements for your eval runs.
                  </p>
                  <div className="flex gap-2">
                    <input
                      ref={evalFileRef}
                      type="file"
                      accept=".yaml,.yml"
                      className="hidden"
                      onChange={handleEvalConfigUpload}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => evalFileRef.current?.click()}
                      disabled={evalConfigLoading}
                      className="gap-1.5"
                    >
                      {evalConfigLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : evalConfigSaved ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      {evalConfigSaved ? 'Uploaded' : 'Upload YAML'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleEvalConfigDownload}
                      className="gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download template
                    </Button>
                    {evalConfigIsOverride && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleEvalConfigReset}
                        disabled={evalConfigLoading}
                        className="gap-1.5 text-gray-600 hover:text-red-600 hover:border-red-200"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset to default
                      </Button>
                    )}
                  </div>
                  {evalConfigError && (
                    <p className="text-xs text-red-600 font-mono">{evalConfigError}</p>
                  )}
                </div>

                {/* ── Pipeline Routing ────────────────────────────────────── */}
                {stageRoutingEnabled && stageConfigIsOverride && stageReadiness.length > 0 && (
                  <div className="space-y-2">
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-gray-700">
                      Pipeline Routing
                    </span>
                    <div className="rounded-2xl border border-border bg-white/60 overflow-hidden">
                      <table className="w-full text-xs font-mono">
                        <thead>
                          <tr className="border-b border-border bg-secondary/40">
                            <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-gray-500">
                              Stage
                            </th>
                            <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-gray-500">
                              Provider
                            </th>
                            <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-gray-500">
                              Key
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {stageReadiness.map((s) => (
                            <tr key={s.stage} className="border-b border-border/50 last:border-0">
                              <td className="px-3 py-2 text-gray-700">{s.stage}</td>
                              <td className="px-3 py-2 text-gray-700">{s.provider}</td>
                              <td className="px-3 py-2">
                                {s.configured ? (
                                  <span className="flex items-center gap-1 text-green-700">
                                    <CheckCircle2 className="h-3 w-3" /> ready
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-red-600">
                                    <XCircle className="h-3 w-3" /> missing key
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ── Stage Routing Keys ──────────────────────────────────── */}
                <div className="space-y-3 rounded-2xl border border-border bg-white/60 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-gray-700">
                      Stage Routing Keys
                    </span>
                    <span
                      className={`font-mono text-[10px] px-2 py-0.5 border ${
                        stageRoutingEnabled && stageConfigIsOverride
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : 'border-border bg-secondary text-gray-400'
                      }`}
                    >
                      {stageRoutingEnabled && stageConfigIsOverride
                        ? 'Active'
                        : 'Requires per-stage routing'}
                    </span>
                  </div>

                  {!(stageRoutingEnabled && stageConfigIsOverride) ? (
                    <p className="font-mono text-[11px] text-gray-400">
                      Enable per-stage routing and upload a stage YAML above to use per-provider
                      routing. These keys are only used when a custom pipeline config is active.
                    </p>
                  ) : (
                    <>
                      <p className="font-mono text-[11px] text-gray-500">
                        Keys for providers used in your custom stage config. Your primary provider
                        key (set above) is already available — only add keys for other providers
                        here.
                      </p>
                      <div className="space-y-2">
                        {(Object.keys(API_KEY_PROVIDER_INFO) as ApiKeyProvider[])
                          .filter((pk) => llmProviderToApiKeyProvider(provider) !== pk)
                          .map((pk) => {
                            const isSaved = savedProviders.has(pk);
                            const isSaving = providerKeysSavingMap[pk] ?? false;
                            const isSavedRecently = providerKeysSavedMap[pk] ?? false;
                            const hasInput = Boolean(providerKeys[pk]?.trim());
                            return (
                              <div
                                key={pk}
                                className="flex items-center gap-2 rounded-xl border border-border bg-white/40 p-2"
                              >
                                <span className="font-mono text-[10px] uppercase tracking-wider shrink-0 w-20 text-gray-500">
                                  {API_KEY_PROVIDER_INFO[pk].name}
                                </span>
                                <Input
                                  type="password"
                                  value={providerKeys[pk] ?? ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setProviderKeys((prev) => ({ ...prev, [pk]: val }));
                                  }}
                                  placeholder={
                                    isSaved
                                      ? '••••  (saved)'
                                      : `${API_KEY_PROVIDER_INFO[pk].name} API key`
                                  }
                                  className="font-mono text-xs flex-1 h-8"
                                />
                                {isSaved && !hasInput && (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                                )}
                                {isSaved && (
                                  <button
                                    onClick={() => handleDeleteProviderKey(pk)}
                                    className="shrink-0 font-mono text-[10px] text-red-500 hover:text-red-700 border border-red-200 px-1.5 py-0.5 hover:bg-red-50 transition-colors"
                                    title={`Clear ${API_KEY_PROVIDER_INFO[pk].name} key`}
                                  >
                                    ×
                                  </button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleSaveProviderKey(pk)}
                                  disabled={isSaving || !hasInput}
                                  className="shrink-0 h-8 px-2 font-mono text-xs"
                                >
                                  {isSaving ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : isSavedRecently ? (
                                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                                  ) : (
                                    <Save className="w-3 h-3" />
                                  )}
                                </Button>
                              </div>
                            );
                          })}
                      </div>
                      {providerKeysError && (
                        <p className="font-mono text-xs text-red-600">{providerKeysError}</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* ── Resume Output ──────────────────────────────────────────── */}
          <section className="space-y-5">
            <div className="flex items-center gap-2 border-b border-border/80 pb-2">
              <FileText className="w-4 h-4" />
              <h2 className="font-mono text-sm font-bold uppercase tracking-wider">
                {t('settings.resumeOutput.title')}
              </h2>
            </div>
            <div className={outputConfigLoading ? 'pointer-events-none opacity-70' : ''}>
              <FormattingControls
                settings={defaultTemplateSettings}
                onChange={handleOutputTemplateSettingsChange}
              />
            </div>
          </section>

          {/* ── Content Generation ─────────────────────────────────────── */}
          <section className="space-y-5">
            <div className="flex items-center gap-2 border-b border-border/80 pb-2">
              <Settings2 className="w-4 h-4" />
              <h2 className="font-mono text-sm font-bold uppercase tracking-wider">
                {t('settings.contentGeneration.title')}
              </h2>
            </div>
            <div className="space-y-3">
              <ToggleSwitch
                checked={enableCoverLetter}
                onCheckedChange={(checked) => {
                  setEnableCoverLetter(checked);
                  handleFeatureConfigChange('enable_cover_letter', checked);
                }}
                label={t('settings.contentGeneration.coverLetter.label')}
                description={t('settings.contentGeneration.coverLetter.description')}
                disabled={featureConfigLoading}
              />
              <ToggleSwitch
                checked={enableOutreach}
                onCheckedChange={(checked) => {
                  setEnableOutreach(checked);
                  handleFeatureConfigChange('enable_outreach_message', checked);
                }}
                label={t('settings.contentGeneration.outreachMessage.label')}
                description={t('settings.contentGeneration.outreachMessage.description')}
                disabled={featureConfigLoading}
              />
              <ToggleSwitch
                checked={preserveGeneratedResumeFacts}
                onCheckedChange={(checked) => {
                  setPreserveGeneratedResumeFacts(checked);
                  handleFeatureConfigChange('preserve_generated_resume_facts', checked);
                }}
                label={t('settings.contentGeneration.preserveFacts.label')}
                description={t('settings.contentGeneration.preserveFacts.description')}
                disabled={featureConfigLoading}
              />
            </div>
          </section>

          {/* ── Integrations ───────────────────────────────────────────── */}
          <section className="space-y-5">
            <div className="flex items-center gap-2 border-b border-border/80 pb-2">
              <Key className="w-4 h-4" />
              <h2 className="font-mono text-sm font-bold uppercase tracking-wider">Integrations</h2>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Apify API Key</p>
                <p className="mt-1 text-xs text-gray-500">
                  Extracts job descriptions from LinkedIn URLs. Uses{' '}
                  <a
                    href="https://apify.com/apimaestro/linkedin-job-detail"
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    apimaestro/linkedin-job-detail
                  </a>
                  . Get your key at{' '}
                  <a
                    href="https://console.apify.com/settings/integrations"
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    console.apify.com
                  </a>
                  .
                </p>
              </div>
              {hasStoredApifyKey && (
                <p className="font-mono text-xs text-green-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Apify key saved
                </p>
              )}
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={apifyKey}
                  onChange={(e) => setApifyKey(e.target.value)}
                  placeholder={hasStoredApifyKey ? 'Enter new key to replace' : 'apify_api_…'}
                  className="flex-1 font-mono text-sm"
                  disabled={apifyKeyLoading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleApifyKeySave();
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => handleApifyKeySave()}
                  disabled={apifyKeyLoading || (!apifyKey.trim() && !hasStoredApifyKey)}
                >
                  {apifyKeyLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : apifyKeySaved ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span className="ml-2">{apifyKeySaved ? 'Saved' : 'Save'}</span>
                </Button>
                {hasStoredApifyKey && (
                  <Button
                    variant="outline"
                    className="text-red-600 hover:bg-red-50 hover:border-red-300"
                    onClick={() => handleApifyKeySave('')}
                    disabled={apifyKeyLoading}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </section>

          {/* ── Danger Zone ─────────────────────────────────────────────── */}
          <section className="space-y-5">
            <div className="flex items-center gap-2 border-b border-red-200 pb-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-red-600">
                {t('settings.dangerZone')}
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="border border-red-200 bg-red-50/50 p-6 space-y-4">
                <div>
                  <h3 className="font-bold text-sm text-red-900 mb-1">
                    {t('settings.clearApiKeys')}
                  </h3>
                  <p className="text-xs text-red-700">{t('settings.clearApiKeysDescription')}</p>
                </div>
                <Button
                  variant="outline"
                  className="w-full border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 hover:border-red-300"
                  onClick={() => setShowClearApiKeysDialog(true)}
                  disabled={isResetting}
                >
                  <Key className="w-4 h-4 mr-2" />
                  {t('settings.clearApiKeys')}
                </Button>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border bg-white/50 p-4">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Lumi Coach" width={20} height={20} className="w-5 h-5" />
            <span className="font-mono text-xs text-gray-500">
              {getVersionString().toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {statusLoading ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-gray-500" />
                <span className="font-mono text-xs text-gray-500">
                  {t('settings.footer.status.checking')}
                </span>
              </>
            ) : systemStatus ? (
              <>
                <div
                  className={`w-3 h-3 ${systemStatus.status === 'ready' ? 'bg-green-700' : 'bg-amber-500'}`}
                ></div>
                <span
                  className={`font-mono text-xs font-bold ${systemStatus.status === 'ready' ? 'text-green-700' : 'text-amber-600'}`}
                >
                  {systemStatus.status === 'ready'
                    ? t('settings.footer.status.ready')
                    : t('settings.footer.status.setupRequired')}
                </span>
              </>
            ) : (
              <span className="font-mono text-xs text-gray-500">
                {t('settings.footer.status.offline')}
              </span>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showClearApiKeysDialog}
        onOpenChange={setShowClearApiKeysDialog}
        title={t('confirmations.clearApiKeys')}
        description={t('confirmations.clearApiKeysDescription')}
        confirmLabel={t('common.delete')}
        variant="warning"
        onConfirm={handleClearApiKeys}
      />

      <ConfirmDialog
        open={showSuccessDialog}
        onOpenChange={setShowSuccessDialog}
        title={successMessage.title}
        description={successMessage.description}
        confirmLabel={t('common.close')}
        showCancelButton={false}
        variant="success"
        onConfirm={() => setShowSuccessDialog(false)}
      />

      <Dialog open={showApiKeyDisclosureDialog} onOpenChange={setShowApiKeyDisclosureDialog}>
        <DialogContent className="sm:max-w-[560px] p-0 gap-0">
          <DialogHeader className="border-b border-border bg-white/80 p-6 pr-14">
            <DialogTitle>{t('settings.llmConfiguration.apiKeyDisclosure.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 p-6 text-sm text-gray-700">
            <div className="border border-blue-200 bg-blue-50 p-4">
              <p className="font-semibold text-blue-900">
                {t('settings.llmConfiguration.apiKeyDisclosure.extensionLead')}{' '}
                <Link
                  href={CHROME_EXTENSION_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-blue-700 underline underline-offset-2"
                >
                  {t('settings.llmConfiguration.apiKeyDisclosure.extensionLink')}
                </Link>
                {t('settings.llmConfiguration.apiKeyDisclosure.extensionTail')}
              </p>
            </div>
            <p>{t('settings.llmConfiguration.apiKeyDisclosure.webOption')}</p>
            <p className="font-semibold text-gray-900">
              {t('settings.llmConfiguration.apiKeyDisclosure.ownKey')}
            </p>
          </div>
          <DialogFooter className="flex-row justify-end gap-3 border-t border-border bg-secondary/60 p-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowApiKeyDisclosureDialog(false);
                setPendingApiKeyAction(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={handleApiKeyDisclosureConfirm}>
              {pendingApiKeyAction === 'test'
                ? t('settings.llmConfiguration.apiKeyDisclosure.confirmTest')
                : t('settings.llmConfiguration.apiKeyDisclosure.confirmSave')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
