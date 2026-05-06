import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_TEMPLATE_SETTINGS,
  getFitOnePageModeForMeasurements,
  getFitOnePageModeForRatio,
  getFitOnePageEffectiveSettings,
  getFitOnePageVerticalScale,
  shouldRenderAsSingleFitPage,
} from '@/lib/types/template-settings';
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

  describe('getFitOnePageEffectiveSettings', () => {
    it('keeps layout settings unchanged when fit-to-one-page is off', () => {
      const settings = {
        ...DEFAULT_TEMPLATE_SETTINGS,
        fitOnePage: false,
        compactMode: false,
      };

      expect(getFitOnePageEffectiveSettings(settings)).toBe(settings);
    });

    it('uses a balanced profile without shrinking type', () => {
      const settings = {
        ...DEFAULT_TEMPLATE_SETTINGS,
        fitOnePage: true,
        compactMode: false,
        spacing: { section: 3, item: 2, lineHeight: 2 } as const,
        fontSize: { ...DEFAULT_TEMPLATE_SETTINGS.fontSize, base: 3, headerScale: 2 } as const,
      };

      expect(getFitOnePageEffectiveSettings(settings, 'balanced')).toMatchObject({
        ...settings,
        compactMode: false,
        spacing: { section: 2, item: 1, lineHeight: 1 },
        fontSize: settings.fontSize,
      });
    });

    it('uses compact spacing only for larger one-page overflow', () => {
      const settings = {
        ...DEFAULT_TEMPLATE_SETTINGS,
        fitOnePage: true,
        compactMode: false,
        spacing: { section: 3, item: 2, lineHeight: 2 } as const,
        fontSize: { ...DEFAULT_TEMPLATE_SETTINGS.fontSize, base: 3, headerScale: 2 } as const,
      };

      expect(getFitOnePageEffectiveSettings(settings, 'compact')).toMatchObject({
        ...settings,
        compactMode: true,
        spacing: { section: 2, item: 1, lineHeight: 1 },
        fontSize: settings.fontSize,
      });
    });
  });

  describe('getFitOnePageModeForRatio', () => {
    it('leaves fitting and long resumes unmodified', () => {
      expect(getFitOnePageModeForRatio(true, 0.95)).toBe('off');
      expect(getFitOnePageModeForRatio(true, 1.3)).toBe('off');
      expect(getFitOnePageModeForRatio(false, 1.1)).toBe('off');
    });

    it('chooses the least aggressive useful fit profile', () => {
      expect(getFitOnePageModeForRatio(true, 1.04)).toBe('gentle');
      expect(getFitOnePageModeForRatio(true, 1.12)).toBe('balanced');
      expect(getFitOnePageModeForRatio(true, 1.22)).toBe('compact');
    });
  });

  describe('getFitOnePageModeForMeasurements', () => {
    it('leaves fitting and long resumes unmodified', () => {
      expect(
        getFitOnePageModeForMeasurements(true, 0.95, {
          gentle: 0.9,
          balanced: 0.85,
          compact: 0.8,
        })
      ).toBe('off');
      expect(
        getFitOnePageModeForMeasurements(true, 1.3, {
          gentle: 1.1,
          balanced: 1.05,
          compact: 0.98,
        })
      ).toBe('off');
      expect(
        getFitOnePageModeForMeasurements(false, 1.1, {
          gentle: 0.99,
          balanced: 0.95,
          compact: 0.9,
        })
      ).toBe('off');
    });

    it('uses the measured profile that fills the page closest without spilling', () => {
      expect(
        getFitOnePageModeForMeasurements(true, 1.12, {
          gentle: 0.99,
          balanced: 0.95,
          compact: 0.9,
        })
      ).toBe('gentle');
      expect(
        getFitOnePageModeForMeasurements(true, 1.12, {
          gentle: 1.03,
          balanced: 0.98,
          compact: 0.9,
        })
      ).toBe('balanced');
      expect(
        getFitOnePageModeForMeasurements(true, 1.12, {
          gentle: 1.05,
          balanced: 1.02,
          compact: 1,
        })
      ).toBe('compact');
      expect(
        getFitOnePageModeForMeasurements(true, 1.12, {
          gentle: 0.84,
          balanced: 0.97,
          compact: 0.92,
        })
      ).toBe('balanced');
    });

    it('uses the tightest measured profile when a slight overflow still needs vertical scaling', () => {
      expect(
        getFitOnePageModeForMeasurements(true, 1.12, {
          gentle: 1.04,
          balanced: 1.02,
          compact: 1.01,
        })
      ).toBe('compact');
    });
  });

  describe('getFitOnePageVerticalScale', () => {
    it('does not expand content below the 75 percent one-page threshold', () => {
      expect(getFitOnePageVerticalScale(true, 0.74, 0.74)).toBe(1);
    });

    it('expands fitting content from 75 percent toward one full page', () => {
      expect(getFitOnePageVerticalScale(true, 0.8, 0.8)).toBeCloseTo(0.995 / 0.8);
      expect(shouldRenderAsSingleFitPage(true, 0.8, 'off')).toBe(true);
    });

    it('expands the selected compacted profile after slight overflow is condensed', () => {
      expect(getFitOnePageVerticalScale(true, 1.12, 0.9)).toBeCloseTo(0.995 / 0.9);
      expect(shouldRenderAsSingleFitPage(true, 1.12, 'balanced')).toBe(true);
    });

    it('tightens a compacted profile that still measures slightly over one page', () => {
      expect(getFitOnePageVerticalScale(true, 1.12, 1.01)).toBeCloseTo(0.995 / 1.01);
      expect(shouldRenderAsSingleFitPage(true, 1.12, 'compact')).toBe(true);
    });

    it('does not force long resumes into a single page', () => {
      expect(getFitOnePageVerticalScale(true, 1.3, 0.9)).toBe(1);
      expect(shouldRenderAsSingleFitPage(true, 1.3, 'compact')).toBe(false);
    });
  });
});
