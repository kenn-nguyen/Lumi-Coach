import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormattingControls } from '@/components/builder/formatting-controls';
import { DEFAULT_TEMPLATE_SETTINGS } from '@/lib/types/template-settings';

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        'builder.formatting.panelTitle': 'Page Setup and Formatting',
        'builder.formatting.yearOnlyDates': 'Year only',
        'builder.formatting.yearOnlyDatesHint':
          'Show supported month/year dates as years only in preview and PDF.',
        'builder.formatting.pageSize': 'Page Size',
        'builder.formatting.template': 'Template',
        'builder.formatting.templates.swissSingle.description': 'Single column',
        'builder.formatting.templates.swissTwoColumn.description': 'Two column',
        'builder.formatting.templates.modern.description': 'Modern',
        'builder.formatting.templates.modernTwoColumn.description': 'Modern two column',
        'builder.formatting.margins': 'Margins',
        'builder.formatting.margin.top': 'Top',
        'builder.formatting.margin.bottom': 'Bottom',
        'builder.formatting.margin.left': 'Left',
        'builder.formatting.margin.right': 'Right',
        'builder.formatting.spacing': 'Spacing',
        'builder.formatting.spacingSection': 'Section',
        'builder.formatting.spacingItems': 'Items',
        'builder.formatting.spacingLines': 'Lines',
        'builder.formatting.fontSize': 'Typography',
        'builder.formatting.baseFontSize': 'Base size',
        'builder.formatting.headerScale': 'Header scale',
        'builder.formatting.headerFontFamily': 'Header font',
        'builder.formatting.bodyFontFamily': 'Body font',
        'builder.formatting.fontNames.serif': 'Serif',
        'builder.formatting.fontNames.sans': 'Sans',
        'builder.formatting.fontNames.mono': 'Mono',
        'builder.formatting.resetDefaults': 'Reset',
        'builder.pageSize.usLetter': 'US Letter',
      };
      return labels[key] ?? key;
    },
  }),
}));

describe('FormattingControls date display setting', () => {
  it('updates template settings when year-only dates is toggled', () => {
    const onChange = vi.fn();
    const initialSettings = {
      ...DEFAULT_TEMPLATE_SETTINGS,
      dateDisplay: 'month-year' as const,
    };

    render(<FormattingControls settings={initialSettings} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Page Setup and Formatting' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Year only' }));

    expect(onChange).toHaveBeenCalledWith({
      ...initialSettings,
      dateDisplay: 'year-only',
    });
  });
});
