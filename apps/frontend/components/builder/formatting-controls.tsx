'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import {
  type TemplateSettings,
  type TemplateType,
  type PageSize,
  type SpacingLevel,
  type HeaderFontFamily,
  type BodyFontFamily,
  type AccentColor,
  DEFAULT_TEMPLATE_SETTINGS,
  TEMPLATE_OPTIONS,
  PAGE_SIZE_INFO,
  ACCENT_COLOR_MAP,
} from '@/lib/types/template-settings';
import { TemplateThumbnail } from './template-selector';
import { useTranslations } from '@/lib/i18n';
import { ToggleSwitch } from '@/components/ui/toggle-switch';

interface FormattingControlsProps {
  settings: TemplateSettings;
  onChange: (settings: TemplateSettings) => void;
  defaultExpanded?: boolean;
}

/**
 * Formatting Controls Panel
 *
 * Provides user controls for adjusting resume layout:
 * - Template selection with visual thumbnails
 * - Page size (A4 / US Letter)
 * - Margins (top, bottom, left, right)
 * - Section/item spacing
 * - Line height
 * - Font sizes
 *
 * Swiss design: Square buttons, monospace labels, high contrast
 */
export const FormattingControls: React.FC<FormattingControlsProps> = ({
  settings,
  onChange,
  defaultExpanded = false,
}) => {
  const { t } = useTranslations();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleTemplateChange = (template: TemplateType) => {
    onChange({ ...settings, template });
  };

  const handlePageSizeChange = (pageSize: PageSize) => {
    onChange({ ...settings, pageSize });
  };

  const handleMarginChange = (key: keyof TemplateSettings['margins'], value: number) => {
    onChange({
      ...settings,
      margins: { ...settings.margins, [key]: value },
    });
  };

  const handleSpacingChange = (key: keyof TemplateSettings['spacing'], value: SpacingLevel) => {
    onChange({
      ...settings,
      spacing: { ...settings.spacing, [key]: value },
    });
  };

  const handleFontChange = (key: keyof TemplateSettings['fontSize'], value: SpacingLevel) => {
    onChange({
      ...settings,
      fontSize: { ...settings.fontSize, [key]: value },
    });
  };

  const handleHeaderFontChange = (headerFont: HeaderFontFamily) => {
    onChange({
      ...settings,
      fontSize: { ...settings.fontSize, headerFont },
    });
  };

  const handleBodyFontChange = (bodyFont: BodyFontFamily) => {
    onChange({
      ...settings,
      fontSize: { ...settings.fontSize, bodyFont },
    });
  };

  const handleCompactModeToggle = (nextChecked?: boolean) => {
    onChange({
      ...settings,
      compactMode: typeof nextChecked === 'boolean' ? nextChecked : !settings.compactMode,
    });
  };

  const handleShowContactIconsToggle = (nextChecked?: boolean) => {
    onChange({
      ...settings,
      showContactIcons: typeof nextChecked === 'boolean' ? nextChecked : !settings.showContactIcons,
    });
  };

  const handleDateDisplayToggle = (nextChecked?: boolean) => {
    const checked =
      typeof nextChecked === 'boolean' ? nextChecked : settings.dateDisplay !== 'year-only';
    onChange({
      ...settings,
      dateDisplay: checked ? 'year-only' : 'month-year',
    });
  };

  const handleFitOnePageToggle = (nextChecked?: boolean) => {
    onChange({
      ...settings,
      fitOnePage: typeof nextChecked === 'boolean' ? nextChecked : !settings.fitOnePage,
    });
  };

  const handleAccentColorChange = (accentColor: AccentColor) => {
    onChange({ ...settings, accentColor });
  };

  const handleReset = () => {
    onChange(DEFAULT_TEMPLATE_SETTINGS);
  };

  const templateLabels = React.useMemo(
    () => ({
      'swiss-single': {
        name: t('builder.formatting.templates.swissSingle.name'),
        description: t('builder.formatting.templates.swissSingle.description'),
      },
      'swiss-two-column': {
        name: t('builder.formatting.templates.swissTwoColumn.name'),
        description: t('builder.formatting.templates.swissTwoColumn.description'),
      },
      modern: {
        name: t('builder.formatting.templates.modern.name'),
        description: t('builder.formatting.templates.modern.description'),
      },
      'modern-two-column': {
        name: t('builder.formatting.templates.modernTwoColumn.name'),
        description: t('builder.formatting.templates.modernTwoColumn.description'),
      },
    }),
    [t]
  );

  const getFontLabel = (font: HeaderFontFamily | BodyFontFamily) => {
    if (font === 'sans-serif') return t('builder.formatting.fontNames.sans');
    if (font === 'serif') return t('builder.formatting.fontNames.serif');
    return t('builder.formatting.fontNames.mono');
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-[rgba(255,253,248,0.92)] shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
      {/* Header - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-5 py-4 transition-colors hover:bg-secondary/30"
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-700"></div>
          <span className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-foreground">
            {t('builder.formatting.panelTitle')}
          </span>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500" />
        )}
      </button>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="space-y-5 border-t border-border px-5 py-5">
          <div
            className="grid justify-start gap-5"
            style={{ gridTemplateColumns: 'max-content minmax(340px, 430px)' }}
          >
            {/* Page Size Selection */}
            <div className="w-fit">
              <h4 className="mb-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-gray-600">
                {t('builder.formatting.pageSize')}
              </h4>
              <div className="flex flex-col gap-2">
                {(Object.keys(PAGE_SIZE_INFO) as PageSize[]).map((size) => (
                  <button
                    key={size}
                    onClick={() => handlePageSizeChange(size)}
                    className={`w-[88px] rounded-xl px-2.5 py-2.5 font-mono text-xs transition-all ${
                      settings.pageSize === size
                        ? 'border border-blue-500 bg-white text-blue-700 shadow-[0_8px_18px_rgba(37,99,235,0.14)]'
                        : 'border border-border bg-white text-gray-600 hover:border-gray-400 hover:bg-secondary/20'
                    }`}
                    title={PAGE_SIZE_INFO[size].dimensions}
                  >
                    <div className="font-bold">
                      {size === 'A4' ? 'A4' : t('builder.pageSize.usLetter')}
                    </div>
                    <div className="text-[8px] leading-tight opacity-70">
                      {PAGE_SIZE_INFO[size].dimensions}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Template Selection */}
            <div className="w-full max-w-[430px]">
              <h4 className="mb-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-gray-600">
                {t('builder.formatting.template')}
              </h4>
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_OPTIONS.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateChange(template.id)}
                    className={`group flex h-[88px] w-[80px] flex-none items-center justify-center rounded-[20px] border p-2 transition-all ${
                      settings.template === template.id
                        ? 'border-blue-500 bg-white shadow-[0_8px_18px_rgba(37,99,235,0.14)]'
                        : 'border-border bg-white hover:border-gray-400 hover:bg-secondary/20'
                    }`}
                    title={templateLabels[template.id].description}
                  >
                    <div className="flex h-full w-full items-center justify-center">
                      <TemplateThumbnail
                        type={template.id}
                        isActive={settings.template === template.id}
                      />
                    </div>
                  </button>
                ))}
              </div>

              {/* Accent Color Selection - Visible for Modern templates */}
              {(settings.template === 'modern' || settings.template === 'modern-two-column') && (
                <div className="mt-3">
                  <h4 className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                    {t('builder.formatting.accentColor')}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(ACCENT_COLOR_MAP) as AccentColor[]).map((color) => (
                      <button
                        key={color}
                        onClick={() => handleAccentColorChange(color)}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 font-mono text-xs transition-all ${
                          settings.accentColor === color
                            ? 'border-blue-500 bg-white shadow-[0_8px_18px_rgba(37,99,235,0.14)]'
                            : 'border-border bg-white hover:border-gray-400 hover:bg-secondary/20'
                        }`}
                        title={t(`builder.formatting.accentColors.${color}`)}
                      >
                        <span
                          className="h-4 w-4 border border-gray-400"
                          style={{ backgroundColor: ACCENT_COLOR_MAP[color].primary }}
                        />
                        <span>{t(`builder.formatting.accentColors.${color}`)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div
            className="grid justify-start gap-4"
            style={{ gridTemplateColumns: 'minmax(220px, 260px) minmax(340px, 520px)' }}
          >
            {/* Margins Section */}
            <div className="w-full max-w-[260px]">
              <h4 className="mb-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-gray-600">
                {t('builder.formatting.margins')}
              </h4>
              <div className="flex flex-col gap-1 rounded-xl border border-border bg-white px-2.5 py-2.5">
                <MarginSlider
                  label={t('builder.formatting.margin.top')}
                  value={settings.margins.top}
                  onChange={(v) => handleMarginChange('top', v)}
                />
                <MarginSlider
                  label={t('builder.formatting.margin.bottom')}
                  value={settings.margins.bottom}
                  onChange={(v) => handleMarginChange('bottom', v)}
                />
                <MarginSlider
                  label={t('builder.formatting.margin.left')}
                  value={settings.margins.left}
                  onChange={(v) => handleMarginChange('left', v)}
                />
                <MarginSlider
                  label={t('builder.formatting.margin.right')}
                  value={settings.margins.right}
                  onChange={(v) => handleMarginChange('right', v)}
                />
              </div>
            </div>

            {/* Spacing Section */}
            <div className="w-fit max-w-[390px]">
              <h4 className="mb-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-gray-600">
                {t('builder.formatting.spacing')}
              </h4>
              <div className="w-fit flex flex-col gap-1 rounded-xl border border-border bg-white px-2.5 py-2">
                <SpacingSelector
                  label={t('builder.formatting.spacingSection')}
                  value={settings.spacing.section}
                  onChange={(v) => handleSpacingChange('section', v)}
                />
                <SpacingSelector
                  label={t('builder.formatting.spacingItems')}
                  value={settings.spacing.item}
                  onChange={(v) => handleSpacingChange('item', v)}
                />
                <SpacingSelector
                  label={t('builder.formatting.spacingLines')}
                  value={settings.spacing.lineHeight}
                  onChange={(v) => handleSpacingChange('lineHeight', v)}
                />
              </div>
            </div>
          </div>

          <div className="w-fit max-w-[390px]">
            {/* Typography Section */}
            <div>
              <h4 className="mb-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-gray-600">
                {t('builder.formatting.fontSize')}
              </h4>
              <div className="space-y-2 rounded-xl border border-border bg-white px-3 py-2.5">
                <SpacingSelector
                  label={t('builder.formatting.baseFontSize')}
                  value={settings.fontSize.base}
                  onChange={(v) => handleFontChange('base', v)}
                  labelWidthClass="w-[88px]"
                />
                <SpacingSelector
                  label={t('builder.formatting.headerScale')}
                  value={settings.fontSize.headerScale}
                  onChange={(v) => handleFontChange('headerScale', v)}
                  labelWidthClass="w-[88px]"
                />
                {/* Header Font Family */}
                <div className="flex items-center gap-1.5">
                  <span className="w-[88px] font-mono text-xs text-gray-600">
                    {t('builder.formatting.headerFontFamily')}
                  </span>
                  <div className="flex gap-1">
                    {(['serif', 'sans-serif', 'mono'] as HeaderFontFamily[]).map((font) => (
                      <button
                        key={font}
                        onClick={() => handleHeaderFontChange(font)}
                        className={`rounded-lg px-2.5 py-1 font-mono text-xs transition-all ${
                          settings.fontSize.headerFont === font
                            ? 'border border-blue-500 bg-blue-700 text-white shadow-[0_6px_14px_rgba(37,99,235,0.16)]'
                            : 'border border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                        }`}
                        style={{
                          fontFamily:
                            font === 'serif'
                              ? 'Georgia, serif'
                              : font === 'mono'
                                ? 'monospace'
                                : 'system-ui, sans-serif',
                        }}
                      >
                        {getFontLabel(font)}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Body Font Family */}
                <div className="flex items-center gap-1.5">
                  <span className="w-[88px] font-mono text-xs text-gray-600">
                    {t('builder.formatting.bodyFontFamily')}
                  </span>
                  <div className="flex gap-1">
                    {(['serif', 'sans-serif', 'mono'] as BodyFontFamily[]).map((font) => (
                      <button
                        key={font}
                        onClick={() => handleBodyFontChange(font)}
                        className={`rounded-lg px-2.5 py-1 font-mono text-xs transition-all ${
                          settings.fontSize.bodyFont === font
                            ? 'border border-blue-500 bg-blue-700 text-white shadow-[0_6px_14px_rgba(37,99,235,0.16)]'
                            : 'border border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                        }`}
                        style={{
                          fontFamily:
                            font === 'serif'
                              ? 'Georgia, serif'
                              : font === 'mono'
                                ? 'monospace'
                                : 'system-ui, sans-serif',
                        }}
                      >
                        {getFontLabel(font)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2.5 border-t border-gray-200 pt-2.5">
                  <ToggleSwitch
                    checked={settings.compactMode}
                    onCheckedChange={handleCompactModeToggle}
                    label="Compact"
                    display="inline"
                  />
                  <ToggleSwitch
                    checked={settings.showContactIcons}
                    onCheckedChange={handleShowContactIconsToggle}
                    label="Icons"
                    display="inline"
                  />
                  <div title={t('builder.formatting.yearOnlyDatesHint')}>
                    <ToggleSwitch
                      checked={settings.dateDisplay === 'year-only'}
                      onCheckedChange={handleDateDisplayToggle}
                      label={t('builder.formatting.yearOnlyDates')}
                      display="inline"
                    />
                  </div>
                  <div title={t('builder.formatting.fitOnePageHint')}>
                    <ToggleSwitch
                      checked={settings.fitOnePage}
                      onCheckedChange={handleFitOnePageToggle}
                      label={t('builder.formatting.fitOnePage')}
                      display="inline"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Reset Button */}
          <div className="border-t border-gray-200 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="h-10 w-full rounded-xl border-border bg-white text-foreground hover:bg-secondary/30"
            >
              <RotateCcw className="w-3 h-3" />
              {t('builder.formatting.resetDefaults')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Margin Slider Component
 *
 * Range input for margin values (5-25mm)
 */
interface MarginSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

const MarginSlider: React.FC<MarginSliderProps> = ({ label, value, onChange }) => {
  return (
    <div className="flex min-h-5 items-center gap-1">
      <span className="w-12 shrink-0 font-mono text-[11px] text-gray-600">{label}</span>
      <input
        type="range"
        min={5}
        max={25}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="h-1.5 w-[120px] flex-none appearance-none rounded-full bg-gray-200 cursor-pointer
                   [&::-webkit-slider-thumb]:appearance-none
                   [&::-webkit-slider-thumb]:w-3
                   [&::-webkit-slider-thumb]:h-3
                   [&::-webkit-slider-thumb]:rounded-full
                   [&::-webkit-slider-thumb]:bg-blue-600
                   [&::-webkit-slider-thumb]:border-none
                   [&::-webkit-slider-thumb]:cursor-pointer
                   [&::-moz-range-thumb]:w-3
                   [&::-moz-range-thumb]:h-3
                   [&::-moz-range-thumb]:rounded-full
                   [&::-moz-range-thumb]:bg-blue-600
                   [&::-moz-range-thumb]:border-none
                   [&::-moz-range-thumb]:cursor-pointer"
      />
      <span className="w-4 text-right font-mono text-[11px] text-gray-800">{value}</span>
    </div>
  );
};

/**
 * Spacing Selector Component
 *
 * Button group for selecting spacing levels (1-5)
 */
interface SpacingSelectorProps {
  label: string;
  value: SpacingLevel;
  onChange: (value: SpacingLevel) => void;
  labelWidthClass?: string;
}

const SpacingSelector: React.FC<SpacingSelectorProps> = ({
  label,
  value,
  onChange,
  labelWidthClass = 'w-[74px]',
}) => {
  const levels: SpacingLevel[] = [1, 2, 3, 4, 5];

  return (
    <div className="flex items-center gap-1">
      <span className={`${labelWidthClass} font-mono text-xs text-gray-600`}>{label}</span>
      <div className="flex gap-0.5">
        {levels.map((level) => (
          <button
            key={level}
            onClick={() => onChange(level)}
            className={`h-7 w-7 rounded-lg font-mono text-xs transition-all ${
              value === level
                ? 'border border-blue-500 bg-blue-700 text-white shadow-[0_6px_14px_rgba(37,99,235,0.16)]'
                : 'border border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            }`}
          >
            {level}
          </button>
        ))}
      </div>
    </div>
  );
};

export default FormattingControls;
