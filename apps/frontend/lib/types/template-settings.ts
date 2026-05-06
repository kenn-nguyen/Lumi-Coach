/**
 * Resume Template Settings
 *
 * Defines the structure for template selection and formatting controls.
 * These settings affect both the live preview and PDF generation.
 */

export type TemplateType = 'swiss-single' | 'swiss-two-column' | 'modern' | 'modern-two-column';

export type PageSize = 'A4' | 'LETTER';

export type AccentColor = 'blue' | 'green' | 'orange' | 'red';

export type DateDisplayMode = 'month-year' | 'year-only';

export type ExperienceHeaderOrder = 'company-first' | 'role-first';

export type SpacingLevel = 1 | 2 | 3 | 4 | 5;

export type FitOnePageMode = 'off' | 'gentle' | 'balanced' | 'compact';
export type FitOnePageCandidateMode = Exclude<FitOnePageMode, 'off'>;

export type HeaderFontFamily = 'serif' | 'sans-serif' | 'mono';
export type BodyFontFamily = 'serif' | 'sans-serif' | 'mono';

export interface MarginSettings {
  top: number; // 5-25mm
  bottom: number;
  left: number;
  right: number;
}

export interface SpacingSettings {
  section: SpacingLevel; // Gap between major sections
  item: SpacingLevel; // Gap between items within sections
  lineHeight: SpacingLevel; // Text line height
}

export interface FontSizeSettings {
  base: SpacingLevel; // Overall text scale
  headerScale: SpacingLevel; // Header size multiplier
  headerFont: HeaderFontFamily; // Header font family
  bodyFont: BodyFontFamily; // Body text font family
}

export interface TemplateSettings {
  template: TemplateType;
  pageSize: PageSize;
  margins: MarginSettings;
  spacing: SpacingSettings;
  fontSize: FontSizeSettings;
  compactMode: boolean; // Apply tighter spacing across the board
  showContactIcons: boolean; // Show icons next to contact info
  accentColor: AccentColor; // Accent color for Modern template
  dateDisplay: DateDisplayMode; // Render resume dates as month/year text or years only
  experienceHeaderOrder: ExperienceHeaderOrder; // Lead experience entries with company/context or role/date.
  fitOnePage: boolean; // Condense slight one-page overflow; long content can still continue.
  fitOnePageVerticalScale?: number; // Runtime-only vertical rhythm multiplier; never persisted.
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export type ResumeTemplateSettings = DeepPartial<TemplateSettings>;

/**
 * Default template settings
 */
export const DEFAULT_TEMPLATE_SETTINGS: TemplateSettings = {
  template: 'swiss-single',
  pageSize: 'A4',
  margins: { top: 10, bottom: 10, left: 10, right: 10 },
  spacing: { section: 2, item: 2, lineHeight: 2 },
  fontSize: { base: 2, headerScale: 2, headerFont: 'serif', bodyFont: 'sans-serif' },
  compactMode: false,
  showContactIcons: false,
  accentColor: 'blue',
  dateDisplay: 'month-year',
  experienceHeaderOrder: 'company-first',
  fitOnePage: true,
};

function reduceSpacingLevel(level: SpacingLevel, amount = 1): SpacingLevel {
  return Math.max(1, level - amount) as SpacingLevel;
}

export const FIT_ONE_PAGE_MAX_OVERFLOW_RATIO = 1.25;
export const FIT_ONE_PAGE_MIN_FILL_RATIO = 0.75;
export const FIT_ONE_PAGE_TARGET_RATIO = 0.995;
export const FIT_ONE_PAGE_MIN_VERTICAL_SCALE =
  FIT_ONE_PAGE_TARGET_RATIO / FIT_ONE_PAGE_MAX_OVERFLOW_RATIO;
export const FIT_ONE_PAGE_MAX_VERTICAL_SCALE =
  FIT_ONE_PAGE_TARGET_RATIO / FIT_ONE_PAGE_MIN_FILL_RATIO;
export const FIT_ONE_PAGE_CANDIDATE_MODES: readonly FitOnePageCandidateMode[] = [
  'gentle',
  'balanced',
  'compact',
];

export function getFitOnePageModeForRatio(
  fitOnePage: boolean,
  contentToPageRatio: number
): FitOnePageMode {
  if (!fitOnePage || !Number.isFinite(contentToPageRatio)) {
    return 'off';
  }
  if (contentToPageRatio <= 1 || contentToPageRatio > FIT_ONE_PAGE_MAX_OVERFLOW_RATIO) {
    return 'off';
  }
  if (contentToPageRatio <= 1.08) {
    return 'gentle';
  }
  if (contentToPageRatio <= 1.18) {
    return 'balanced';
  }
  return 'compact';
}

export function shouldAttemptFitOnePage(fitOnePage: boolean, contentToPageRatio: number): boolean {
  return (
    fitOnePage &&
    Number.isFinite(contentToPageRatio) &&
    contentToPageRatio > 1 &&
    contentToPageRatio <= FIT_ONE_PAGE_MAX_OVERFLOW_RATIO
  );
}

export function shouldTargetOnePage(fitOnePage: boolean, contentToPageRatio: number): boolean {
  return (
    fitOnePage &&
    Number.isFinite(contentToPageRatio) &&
    contentToPageRatio >= FIT_ONE_PAGE_MIN_FILL_RATIO &&
    contentToPageRatio <= FIT_ONE_PAGE_MAX_OVERFLOW_RATIO
  );
}

export function getFitOnePageModeForMeasurements(
  fitOnePage: boolean,
  baseContentToPageRatio: number,
  candidateContentToPageRatios: Partial<Record<FitOnePageCandidateMode, number>>
): FitOnePageMode {
  if (!shouldAttemptFitOnePage(fitOnePage, baseContentToPageRatio)) {
    return 'off';
  }

  let bestFittingMode: FitOnePageMode = 'off';
  let bestFittingRatio = 0;
  let tightestMode: FitOnePageMode = 'off';
  let tightestRatio = Number.POSITIVE_INFINITY;

  for (const mode of FIT_ONE_PAGE_CANDIDATE_MODES) {
    const ratio = candidateContentToPageRatios[mode];
    if (typeof ratio !== 'number' || !Number.isFinite(ratio) || ratio <= 0) {
      continue;
    }

    if (ratio <= 1) {
      if (ratio > bestFittingRatio) {
        bestFittingMode = mode;
        bestFittingRatio = ratio;
      }
    }

    if (ratio < tightestRatio) {
      tightestMode = mode;
      tightestRatio = ratio;
    }
  }

  return bestFittingMode !== 'off' ? bestFittingMode : tightestMode;
}

function clampFitOnePageVerticalScale(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 1;
  }
  return Math.min(
    FIT_ONE_PAGE_MAX_VERTICAL_SCALE,
    Math.max(FIT_ONE_PAGE_MIN_VERTICAL_SCALE, value)
  );
}

export function getFitOnePageVerticalScale(
  fitOnePage: boolean,
  baseContentToPageRatio: number,
  selectedContentToPageRatio: number
): number {
  if (
    !shouldTargetOnePage(fitOnePage, baseContentToPageRatio) ||
    !Number.isFinite(selectedContentToPageRatio) ||
    selectedContentToPageRatio <= 0
  ) {
    return 1;
  }

  return clampFitOnePageVerticalScale(FIT_ONE_PAGE_TARGET_RATIO / selectedContentToPageRatio);
}

export function shouldRenderAsSingleFitPage(
  fitOnePage: boolean,
  baseContentToPageRatio: number,
  fitMode: FitOnePageMode
): boolean {
  if (!shouldTargetOnePage(fitOnePage, baseContentToPageRatio)) {
    return false;
  }
  return baseContentToPageRatio <= 1 || fitMode !== 'off';
}

/**
 * Fit-to-one-page uses graduated compacting profiles, not visual scale.
 * It keeps the resume full width and lets genuinely long resumes continue.
 */
export function getFitOnePageEffectiveSettings(
  settings: TemplateSettings,
  mode: FitOnePageMode = settings.fitOnePage ? 'balanced' : 'off'
): TemplateSettings {
  if (!settings.fitOnePage || mode === 'off') {
    return settings;
  }

  if (mode === 'gentle') {
    return {
      ...settings,
      compactMode: false,
      spacing: {
        ...settings.spacing,
        section: reduceSpacingLevel(settings.spacing.section, 1),
      },
    };
  }

  if (mode === 'balanced') {
    return {
      ...settings,
      compactMode: false,
      spacing: {
        section: reduceSpacingLevel(settings.spacing.section, 1),
        item: reduceSpacingLevel(settings.spacing.item, 1),
        lineHeight: reduceSpacingLevel(settings.spacing.lineHeight, 1),
      },
    };
  }

  return {
    ...settings,
    compactMode: true,
    spacing: {
      section: reduceSpacingLevel(settings.spacing.section, 1),
      item: reduceSpacingLevel(settings.spacing.item, 1),
      lineHeight: reduceSpacingLevel(settings.spacing.lineHeight, 1),
    },
  };
}

/**
 * Page size dimensions for display
 */
export const PAGE_SIZE_INFO: Record<PageSize, { name: string; dimensions: string }> = {
  A4: { name: 'A4', dimensions: '210 × 297 mm' },
  LETTER: { name: 'US Letter', dimensions: '8.5 × 11 in' },
};

/**
 * CSS Variable mappings for spacing levels
 */
export const SECTION_SPACING_MAP: Record<SpacingLevel, string> = {
  1: '0.375rem', // 6px
  2: '0.625rem', // 10px
  3: '1rem', // 16px - default
  4: '1.25rem', // 20px
  5: '1.5rem', // 24px
};

export const ITEM_SPACING_MAP: Record<SpacingLevel, string> = {
  1: '0.125rem', // 2px
  2: '0.25rem', // 4px - default
  3: '0.5rem', // 8px
  4: '0.75rem', // 12px
  5: '1rem', // 16px
};

export const LINE_HEIGHT_MAP: Record<SpacingLevel, number> = {
  1: 1.15, // tight
  2: 1.25,
  3: 1.35, // default
  4: 1.45,
  5: 1.55, // loose
};

export const FONT_SIZE_MAP: Record<SpacingLevel, string> = {
  1: '11px',
  2: '12px',
  3: '14px', // default
  4: '15px',
  5: '16px',
};

export const HEADER_SCALE_MAP: Record<SpacingLevel, number> = {
  1: 1.5,
  2: 1.75,
  3: 2, // default
  4: 2.25,
  5: 2.5,
};

// Section header scale (SUMMARY, EXPERIENCE, etc.) - slightly smaller than name
export const SECTION_HEADER_SCALE_MAP: Record<SpacingLevel, number> = {
  1: 1.0,
  2: 1.1,
  3: 1.2, // default
  4: 1.3,
  5: 1.4,
};

// Header font family mapping
export const HEADER_FONT_MAP: Record<HeaderFontFamily, string> = {
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  'sans-serif': 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
  mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
};

export const BODY_FONT_MAP: Record<BodyFontFamily, string> = {
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  'sans-serif': 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
  mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
};

/**
 * Accent color mapping for Modern template
 */
export const ACCENT_COLOR_MAP: Record<
  AccentColor,
  { primary: string; light: string; name: string }
> = {
  blue: { primary: '#1D4ED8', light: '#DBEAFE', name: 'Blue' },
  green: { primary: '#15803D', light: '#DCFCE7', name: 'Green' },
  orange: { primary: '#EA580C', light: '#FED7AA', name: 'Orange' },
  red: { primary: '#DC2626', light: '#FEE2E2', name: 'Red' },
};

// Compact mode multiplier (applied to spacing values only, NOT line-height)
export const COMPACT_MULTIPLIER = 0.6;

// Line height gets a gentler reduction in compact mode
export const COMPACT_LINE_HEIGHT_MULTIPLIER = 0.92;

function multiplyCssLength(value: string, multiplier: number): string {
  const match = value.match(/^(-?\d*\.?\d+)([a-z%]+)$/i);
  if (!match) {
    return value;
  }
  return `${Number(match[1]) * multiplier}${match[2]}`;
}

/**
 * Convert TemplateSettings to CSS custom properties
 */
export function settingsToCssVars(settings?: TemplateSettings): React.CSSProperties {
  const s = settings || DEFAULT_TEMPLATE_SETTINGS;
  const compact = s.compactMode ? COMPACT_MULTIPLIER : 1;
  const fitOnePageVerticalScale = clampFitOnePageVerticalScale(s.fitOnePageVerticalScale);
  const spacingMultiplier = compact * fitOnePageVerticalScale;
  const lineHeightMultiplier =
    (s.compactMode ? COMPACT_LINE_HEIGHT_MULTIPLIER : 1) * fitOnePageVerticalScale;

  // Margins remain literal; compact mode only affects spacing/line-height.
  const marginTop = s.margins.top;
  const marginBottom = s.margins.bottom;
  const marginLeft = s.margins.left;
  const marginRight = s.margins.right;

  // Get accent colors for Modern template
  const accentColors = ACCENT_COLOR_MAP[s.accentColor];

  return {
    '--section-gap': multiplyCssLength(SECTION_SPACING_MAP[s.spacing.section], spacingMultiplier),
    '--item-gap': multiplyCssLength(ITEM_SPACING_MAP[s.spacing.item], spacingMultiplier),
    // Fit-to-one-page adjusts vertical rhythm only; font size and page width stay unchanged.
    '--line-height': LINE_HEIGHT_MAP[s.spacing.lineHeight] * lineHeightMultiplier,
    '--font-size-base': FONT_SIZE_MAP[s.fontSize.base],
    '--header-scale': HEADER_SCALE_MAP[s.fontSize.headerScale],
    '--section-header-scale': SECTION_HEADER_SCALE_MAP[s.fontSize.headerScale],
    '--header-font': HEADER_FONT_MAP[s.fontSize.headerFont],
    '--body-font': BODY_FONT_MAP[s.fontSize.bodyFont],
    '--margin-top': `${marginTop}mm`,
    '--margin-bottom': `${marginBottom}mm`,
    '--margin-left': `${marginLeft}mm`,
    '--margin-right': `${marginRight}mm`,
    // Accent colors for Modern template
    '--resume-accent-primary': accentColors.primary,
    '--resume-accent-light': accentColors.light,
  } as React.CSSProperties;
}

/**
 * Template metadata for UI display
 */
export interface TemplateInfo {
  id: TemplateType;
  name: string;
  description: string;
}

export const TEMPLATE_OPTIONS: TemplateInfo[] = [
  {
    id: 'swiss-single',
    name: 'Single Column',
    description: 'Traditional full-width layout with maximum content density',
  },
  {
    id: 'swiss-two-column',
    name: 'Two Column',
    description: 'Experience-focused main column with sidebar for skills',
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Colorful accents with customizable theme colors',
  },
  {
    id: 'modern-two-column',
    name: 'Modern Two Column',
    description: 'Two-column layout with modern colorful accents and themes',
  },
];
