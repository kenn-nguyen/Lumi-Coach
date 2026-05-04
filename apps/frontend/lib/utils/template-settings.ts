import {
  DEFAULT_TEMPLATE_SETTINGS,
  type ResumeTemplateSettings,
  type TemplateSettings,
} from '@/lib/types/template-settings';

export const TEMPLATE_SETTINGS_STORAGE_KEY = 'resume_builder_settings';

export type PartialTemplateSettings = ResumeTemplateSettings;

export function mergeTemplateSettings(
  ...settingsList: Array<PartialTemplateSettings | null | undefined>
): TemplateSettings {
  return settingsList.reduce<TemplateSettings>(
    (merged, settings) => ({
      ...merged,
      ...settings,
      margins: {
        ...merged.margins,
        ...settings?.margins,
      },
      spacing: {
        ...merged.spacing,
        ...settings?.spacing,
      },
      fontSize: {
        ...merged.fontSize,
        ...settings?.fontSize,
      },
    }),
    DEFAULT_TEMPLATE_SETTINGS
  );
}

export function resolveEffectiveTemplateSettings(
  backendDefaults?: PartialTemplateSettings | null,
  resumeSettings?: PartialTemplateSettings | null
): TemplateSettings {
  return mergeTemplateSettings(backendDefaults, resumeSettings);
}

export function omitDateDisplaySetting(
  settings: PartialTemplateSettings
): Omit<PartialTemplateSettings, 'dateDisplay' | 'fitOnePage'> {
  const nextSettings = { ...settings };
  delete nextSettings.dateDisplay;
  delete nextSettings.fitOnePage;
  return nextSettings;
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
    return mergeTemplateSettings(
      omitDateDisplaySetting(JSON.parse(savedSettings) as PartialTemplateSettings)
    );
  } catch {
    return mergeTemplateSettings();
  }
}
