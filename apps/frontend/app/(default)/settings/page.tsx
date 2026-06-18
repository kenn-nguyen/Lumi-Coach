'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
  PROVIDER_INFO,
  type LLMConfig,
  type LLMProvider,
  type LLMHealthCheck,
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
} from 'lucide-react';
import { useTranslations } from '@/lib/i18n';

type Status = 'idle' | 'loading' | 'saving' | 'saved' | 'error' | 'testing';
type ApiKeyDisclosureAction = 'save' | 'test';

const OLLAMA_DEFAULT_API_BASE = 'http://localhost:11434';
const CHROME_EXTENSION_URL =
  'https://chromewebstore.google.com/detail/lumi-coach/iklflomjpppjfkaegdimkgabancffdhb';
const PROVIDERS: LLMProvider[] = [
  'openai',
  'anthropic',
  'openrouter',
  'gemini',
  'deepseek',
  'ollama',
];

const SEGMENTED_BUTTON_BASE =
  'rounded-xl border border-border font-mono transition-colors duration-150 ease-out shadow-xs disabled:cursor-not-allowed disabled:opacity-50';
const SEGMENTED_BUTTON_ACTIVE = 'bg-primary text-white border-primary/20 hover:bg-[color:#173ce0]';
const SEGMENTED_BUTTON_INACTIVE = 'bg-card text-foreground hover:bg-secondary';

const normalizeApiBaseForProvider = (provider: LLMProvider, value: string): string | null => {
  const trimmed = value.trim();
  if (provider === 'ollama') {
    return trimmed || OLLAMA_DEFAULT_API_BASE;
  }
  if (!trimmed || trimmed === OLLAMA_DEFAULT_API_BASE) {
    return null;
  }
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

  // Use cached system status (loaded on app start, refreshes every 30 min)
  const {
    status: systemStatus,
    isLoading: statusLoading,
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

  // Load LLM config and feature config on mount
  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    let cancelled = false;

    async function loadConfig() {
      try {
        const [llmConfig, featureConfig, outputConfig, apifyConfig] = await Promise.all([
          fetchLlmConfig().catch(() => null),
          fetchFeatureConfig().catch(() => null),
          fetchOutputConfig().catch(() => null),
          fetchApifyKey().catch(() => null),
        ]);

        if (cancelled) return;

        if (llmConfig) {
          const providerFromBackend = llmConfig.provider || 'openai';
          const safeProvider = isKnownProvider(providerFromBackend)
            ? providerFromBackend
            : 'openai';
          setProvider(safeProvider);
          setModel(llmConfig.model || PROVIDER_INFO[safeProvider].defaultModel);
          const isMaskedKey = Boolean(llmConfig.api_key) && llmConfig.api_key.includes('*');
          setHasStoredApiKey(Boolean(llmConfig.api_key));
          setIsUserSavedConfig(Boolean(llmConfig.is_user_config));
          setApiKey(isMaskedKey ? '' : llmConfig.api_key || '');
          setApiBase(normalizeApiBaseForProvider(safeProvider, llmConfig.api_base || '') || '');

          if (providerFromBackend !== safeProvider) {
            setError(t('settings.errors.unknownProvider', { provider: providerFromBackend }));
          }
        }

        if (featureConfig) {
          setEnableCoverLetter(featureConfig.enable_cover_letter);
          setEnableOutreach(featureConfig.enable_outreach_message);
          setPreserveGeneratedResumeFacts(featureConfig.preserve_generated_resume_facts);
        }

        if (outputConfig) {
          setDefaultTemplateSettings(
            mergeTemplateSettings(outputConfig.default_template_settings, {
              dateDisplay: outputConfig.default_date_display,
              fitOnePage: outputConfig.default_fit_one_page,
            })
          );
        }

        if (apifyConfig) {
          setHasStoredApifyKey(apifyConfig.configured);
          setApifyKey(apifyConfig.configured ? '' : '');
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
  }, [authStatus, t]);

  // Handle provider change
  const handleProviderChange = (newProvider: LLMProvider) => {
    setProvider(newProvider);
    setModel(PROVIDER_INFO[newProvider].defaultModel);

    setApiBase(newProvider === 'ollama' ? OLLAMA_DEFAULT_API_BASE : '');

    // Clear API key input when switching providers to avoid accidental cross-provider usage.
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

      // Refresh cached system status after save
      await refreshStatus();

      setIsUserSavedConfig(true);
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to save config', err);
      setError((err as Error).message || t('settings.errors.unableToSaveConfiguration'));
      setStatus('error');
    }
  };

  // Test connection with current form values (pre-save testing)
  const testLlmConfiguration = async () => {
    setStatus('testing');
    setError(null);
    setHealthCheck(null);

    try {
      // Build config from current form values
      const testConfig: Partial<LLMConfig> = {
        provider,
        model: model.trim() || providerInfo.defaultModel,
        api_base: normalizeApiBaseForProvider(provider, apiBase),
      };

      // Only include API key if provided or if we have a stored key
      if (requiresApiKey) {
        if (apiKey.trim()) {
          testConfig.api_key = apiKey.trim();
        }
        // If no new key but has stored key, don't send api_key (backend uses stored)
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

    if (action === 'save') {
      void saveLlmConfiguration();
    } else if (action === 'test') {
      void testLlmConfiguration();
    }
  };

  // Update feature config
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
    } catch (err) {
      console.error('Failed to update feature config', err);
      // Revert on error
      if (key === 'enable_cover_letter') {
        setEnableCoverLetter(!value);
      } else if (key === 'enable_outreach_message') {
        setEnableOutreach(!value);
      } else {
        setPreserveGeneratedResumeFacts(!value);
      }
    } finally {
      setFeatureConfigLoading(false);
    }
  };

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
      setDefaultTemplateSettings(
        mergeTemplateSettings(updated.default_template_settings, {
          dateDisplay: updated.default_date_display,
          fitOnePage: updated.default_fit_one_page,
        })
      );
    } catch (err) {
      console.error('Failed to update output config', err);
      setDefaultTemplateSettings(previousSettings);
      setError((err as Error).message || t('settings.errors.unableToSaveConfiguration'));
    } finally {
      setOutputConfigLoading(false);
    }
  };

  // Handle Clear API Keys
  const handleClearApiKeys = async () => {
    setIsResetting(true);
    try {
      await clearAllApiKeys();

      // Refetch full LLM config to ensure local state is synced with backend
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
        // Fallback if refetch fails
        setApiKey('');
        setHasStoredApiKey(false);
        setIsUserSavedConfig(false);
      }

      setHealthCheck(null);
      // Refresh status
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

  // Format last fetched time for display
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
      <div className="w-full max-w-4xl overflow-hidden rounded-[28px] border border-border bg-[rgba(250,248,242,0.96)] shadow-sw-card">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border bg-white/70 p-8">
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-[-0.04em]">
              {t('settings.title')}
            </h1>
          </div>
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4" />
              {t('common.back')}
            </Button>
          </Link>
        </div>

        <div className="p-8 space-y-10">
          {/* API Key Not Configured Warning */}
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

          {/* System Status Panel */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/80 pb-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  <h2 className="font-mono text-sm font-bold uppercase tracking-wider">
                    {t('settings.systemStatus.title')}
                  </h2>
                </div>
                {lastFetched && (
                  <span className="font-mono text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatLastFetched()}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshStatus}
                disabled={statusLoading}
                className="gap-1 text-xs"
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* LLM Status */}
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

                {/* Database Status */}
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

                {/* Resumes Count */}
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

                {/* Jobs Count */}
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
              </div>
            )}

            {/* Additional Stats Row */}
            {systemStatus && (
              <div className="grid grid-cols-2 gap-4">
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
              </div>
            )}
          </section>

          {/* LLM Configuration */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 border-b border-border/80 pb-2">
              <Key className="w-4 h-4" />
              <h2 className="font-mono text-sm font-bold uppercase tracking-wider">
                {t('settings.llmConfigurationTitle')}
              </h2>
            </div>

            <div className="grid gap-6">
              {/* Provider Selection */}
              <div className="space-y-2">
                <Label>{t('settings.providerLabel')}</Label>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
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
                <p className="text-xs text-gray-500 font-mono">
                  {t('settings.llmConfiguration.selectedProvider', {
                    provider: providerInfo.name,
                  })}
                </p>
                {isServerManagedVertexProvider && (
                  <p className="text-xs text-gray-500 font-mono">
                    Vertex AI is managed by the backend. Choose another provider below if you want
                    to save your own account-level override.
                  </p>
                )}
              </div>

              {/* Model Input */}
              <div className="space-y-2">
                <Label htmlFor="llm-model-name">{t('settings.llmConfiguration.modelLabel')}</Label>
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
                <p className="text-xs text-gray-500 font-mono">
                  {t('settings.llmConfiguration.defaultModel', {
                    model: providerInfo.defaultModel,
                  })}
                </p>
                <p className="text-xs text-amber-700 font-mono bg-amber-50 border border-amber-200 px-2 py-1.5">
                  This model is used for: regenerate bullets, outreach email, cover letter, and
                  master resume import. The tailoring pipeline uses optimized models per stage
                  (matched to the Chrome extension).
                </p>
              </div>

              {/* API Key Input */}
              <div className="space-y-2">
                <Label htmlFor="apiKey">
                  {t('settings.llmConfiguration.apiKeyLabel')}{' '}
                  {!requiresApiKey && (
                    <span className="text-gray-400">
                      {t('settings.llmConfiguration.apiKeyOptionalForOllama')}
                    </span>
                  )}
                </Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    requiresApiKey
                      ? t('settings.llmConfiguration.apiKeyPlaceholder')
                      : t('settings.llmConfiguration.apiKeyNotRequiredPlaceholder')
                  }
                  className="font-mono"
                  disabled={!requiresApiKey}
                />
                {requiresApiKey && hasStoredApiKey && !apiKey && (
                  <p className="text-xs text-gray-500 font-mono">
                    {t('settings.llmConfiguration.leaveBlankToKeepExistingKey')}
                  </p>
                )}
                {hasStoredApiKey && isUserSavedConfig && (
                  <p className="text-xs text-gray-500 font-mono">
                    {t('settings.llmConfiguration.savedToAccount')}
                  </p>
                )}
              </div>

              {/* API Base URL (optional, for proxies/aggregators/custom endpoints) */}
              <div className="space-y-2">
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

              {/* Action Buttons */}
              <div className="flex gap-4">
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

              {/* Error Message */}
              {error && (
                <div className="border border-red-300 bg-red-50 p-3">
                  <p className="text-xs text-red-600 font-mono">
                    {t('settings.llmConfiguration.errorPrefix', { error })}
                  </p>
                </div>
              )}

              {/* Health Check Result */}
              {healthCheck && (
                <div
                  className={`border p-4 ${
                    healthCheck.healthy
                      ? 'border-green-300 bg-green-50'
                      : 'border-red-300 bg-red-50'
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
            </div>
          </section>

          {/* Resume Output Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 border-b border-border/80 pb-2">
              <FileText className="w-4 h-4" />
              <h2 className="font-mono text-sm font-bold uppercase tracking-wider">
                {t('settings.resumeOutput.title')}
              </h2>
            </div>

            <div className="space-y-3">
              <p className="mb-4 text-sm text-gray-600">{t('settings.resumeOutput.description')}</p>

              <div className={outputConfigLoading ? 'pointer-events-none opacity-70' : ''}>
                <FormattingControls
                  settings={defaultTemplateSettings}
                  onChange={handleOutputTemplateSettingsChange}
                />
              </div>
            </div>
          </section>

          {/* Content Generation Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 border-b border-border/80 pb-2">
              <Settings2 className="w-4 h-4" />
              <h2 className="font-mono text-sm font-bold uppercase tracking-wider">
                {t('settings.contentGeneration.title')}
              </h2>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-gray-600 mb-4">
                {t('settings.contentGeneration.description')}
              </p>

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
            </div>
          </section>

          {/* Integrations */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 border-b border-border/80 pb-2">
              <Key className="w-4 h-4" />
              <h2 className="font-mono text-sm font-bold uppercase tracking-wider">Integrations</h2>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Apify API Key</p>
                <p className="mt-1 text-xs text-gray-500">
                  Used to extract job descriptions from LinkedIn URLs when tailoring. The actor used
                  is{' '}
                  <a
                    href="https://apify.com/apimaestro/linkedin-job-detail"
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    apimaestro/linkedin-job-detail
                  </a>
                  . Get your API key at{' '}
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
                <p className="font-mono text-xs text-green-700 uppercase tracking-wide">
                  ✓ Apify key saved
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

          {/* Danger Zone */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 border-b border-red-200 pb-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-red-600">
                {t('settings.dangerZone')}
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Clear API Keys */}
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
