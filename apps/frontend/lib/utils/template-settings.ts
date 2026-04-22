import { DEFAULT_TEMPLATE_SETTINGS, type TemplateSettings } from '@/lib/types/template-settings';

export const TEMPLATE_SETTINGS_STORAGE_KEY = 'resume_builder_settings';

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

type PartialTemplateSettings = DeepPartial<TemplateSettings>;

export function mergeTemplateSettings(settings?: PartialTemplateSettings | null): TemplateSettings {
  return {
    ...DEFAULT_TEMPLATE_SETTINGS,
    ...settings,
    margins: {
      ...DEFAULT_TEMPLATE_SETTINGS.margins,
      ...settings?.margins,
    },
    spacing: {
      ...DEFAULT_TEMPLATE_SETTINGS.spacing,
      ...settings?.spacing,
    },
    fontSize: {
      ...DEFAULT_TEMPLATE_SETTINGS.fontSize,
      ...settings?.fontSize,
    },
  };
}

export function loadSavedTemplateSettings(): TemplateSettings {
  if (typeof window === 'undefined') {
    return mergeTemplateSettings();
  }

  const savedSettings = window.localStorage.getItem(TEMPLATE_SETTINGS_STORAGE_KEY);
  if (!savedSettings) {
    return mergeTemplateSettings();
  }

  try {
    return mergeTemplateSettings(JSON.parse(savedSettings) as PartialTemplateSettings);
  } catch {
    return mergeTemplateSettings();
  }
}
