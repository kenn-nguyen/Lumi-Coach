import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_TEMPLATE_SETTINGS } from '@/lib/types/template-settings';
import {
  loadSavedTemplateSettings,
  mergeTemplateSettings,
  resolveEffectiveTemplateSettings,
  TEMPLATE_SETTINGS_STORAGE_KEY,
} from '@/lib/utils/template-settings';

describe('template settings utils', () => {
  const storage = {
    getItem: vi.fn<(key: string) => string | null>(),
    setItem: vi.fn<(key: string, value: string) => void>(),
    removeItem: vi.fn<(key: string) => void>(),
    clear: vi.fn<() => void>(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    storage.getItem.mockReturnValue(null);
    storage.setItem.mockReset();
    storage.removeItem.mockReset();
    storage.clear.mockReset();
    Object.defineProperty(window, 'localStorage', {
      value: storage,
      configurable: true,
    });
  });

  describe('mergeTemplateSettings', () => {
    it('uses editor defaults when no saved settings exist', () => {
      expect(mergeTemplateSettings()).toEqual(DEFAULT_TEMPLATE_SETTINGS);
    });

    it('merges nested saved settings without dropping editor defaults', () => {
      expect(
        mergeTemplateSettings({
          pageSize: 'LETTER',
          margins: { top: 20 },
          spacing: { section: 4 },
          fontSize: { bodyFont: 'mono' },
        })
      ).toEqual({
        ...DEFAULT_TEMPLATE_SETTINGS,
        pageSize: 'LETTER',
        margins: {
          ...DEFAULT_TEMPLATE_SETTINGS.margins,
          top: 20,
        },
        spacing: {
          ...DEFAULT_TEMPLATE_SETTINGS.spacing,
          section: 4,
        },
        fontSize: {
          ...DEFAULT_TEMPLATE_SETTINGS.fontSize,
          bodyFont: 'mono',
        },
      });
    });

    it('adds the default date display mode to older saved settings', () => {
      expect(
        mergeTemplateSettings({
          template: 'modern',
          compactMode: true,
        })
      ).toMatchObject({
        template: 'modern',
        compactMode: true,
        dateDisplay: 'month-year',
        fitOnePage: true,
      });
    });

    it('applies later settings as higher precedence', () => {
      expect(
        mergeTemplateSettings(
          {
            pageSize: 'LETTER',
            margins: { top: 12, bottom: 12 },
            fontSize: { bodyFont: 'serif' },
          },
          {
            pageSize: 'A4',
            margins: { top: 18 },
          }
        )
      ).toMatchObject({
        pageSize: 'A4',
        margins: {
          ...DEFAULT_TEMPLATE_SETTINGS.margins,
          top: 18,
          bottom: 12,
        },
        fontSize: {
          ...DEFAULT_TEMPLATE_SETTINGS.fontSize,
          bodyFont: 'serif',
        },
      });
    });
  });

  describe('resolveEffectiveTemplateSettings', () => {
    it('uses resume settings over backend defaults without localStorage', () => {
      storage.getItem.mockImplementation((key: string) =>
        key === TEMPLATE_SETTINGS_STORAGE_KEY
          ? JSON.stringify({
              pageSize: 'A4',
              margins: { top: 25 },
            })
          : null
      );

      expect(
        resolveEffectiveTemplateSettings(
          {
            pageSize: 'LETTER',
            margins: { top: 12 },
          },
          {
            margins: { top: 18 },
          }
        )
      ).toMatchObject({
        pageSize: 'LETTER',
        margins: {
          ...DEFAULT_TEMPLATE_SETTINGS.margins,
          top: 18,
        },
      });
      expect(storage.getItem).not.toHaveBeenCalled();
    });
  });

  describe('loadSavedTemplateSettings', () => {
    it('returns editor defaults when localStorage has no saved value', () => {
      expect(loadSavedTemplateSettings()).toEqual(DEFAULT_TEMPLATE_SETTINGS);
    });

    it('returns merged saved settings from localStorage', () => {
      storage.getItem.mockImplementation((key: string) =>
        key === TEMPLATE_SETTINGS_STORAGE_KEY
          ? JSON.stringify({
              template: 'modern',
              pageSize: 'LETTER',
              margins: { left: 18, right: 16 },
              compactMode: true,
              dateDisplay: 'year-only',
              fitOnePage: false,
            })
          : null
      );

      expect(loadSavedTemplateSettings()).toEqual({
        ...DEFAULT_TEMPLATE_SETTINGS,
        template: 'modern',
        pageSize: 'LETTER',
        margins: {
          ...DEFAULT_TEMPLATE_SETTINGS.margins,
          left: 18,
          right: 16,
        },
        compactMode: true,
        dateDisplay: 'month-year',
        fitOnePage: true,
      });
    });

    it('falls back to editor defaults when saved JSON is invalid', () => {
      storage.getItem.mockImplementation((key: string) =>
        key === TEMPLATE_SETTINGS_STORAGE_KEY ? '{broken-json' : null
      );

      expect(loadSavedTemplateSettings()).toEqual(DEFAULT_TEMPLATE_SETTINGS);
    });
  });
});
