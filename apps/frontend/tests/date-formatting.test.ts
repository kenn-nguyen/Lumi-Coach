import { describe, expect, it } from 'vitest';
import { formatDateRange } from '@/lib/utils';

describe('formatDateRange', () => {
  it('keeps month-year mode behavior for normalized date ranges', () => {
    expect(formatDateRange('Jun 2021 Aug 2023')).toBe('Jun 2021 - Aug 2023');
    expect(formatDateRange('2021 2023')).toBe('2021 - 2023');
    expect(formatDateRange('June 2021 Present')).toBe('June 2021 - Present');
  });

  it('renders supported date ranges as year-only output', () => {
    const options = { dateDisplay: 'year-only' as const };

    expect(formatDateRange('Jun 2021 - Aug 2023', options)).toBe('2021 - 2023');
    expect(formatDateRange('June 2021 - Present', options)).toBe('2021 - Present');
    expect(formatDateRange('06/2021 - 08/2023', options)).toBe('2021 - 2023');
    expect(formatDateRange('2021 - 2023', options)).toBe('2021 - 2023');
    expect(formatDateRange('2021 Present', options)).toBe('2021 - Present');
    expect(formatDateRange('2021', options)).toBe('2021');
  });

  it('supports present/current style terminal values without changing saved text', () => {
    const options = { dateDisplay: 'year-only' as const };

    expect(formatDateRange('June 2021 - Current', options)).toBe('2021 - Current');
    expect(formatDateRange('June 2021 - Now', options)).toBe('2021 - Now');
    expect(formatDateRange('June 2021 - Ongoing', options)).toBe('2021 - Ongoing');
  });

  it('leaves ambiguous or free-text dates unchanged in year-only mode', () => {
    const options = { dateDisplay: 'year-only' as const };

    expect(formatDateRange('Spring 2021', options)).toBe('Spring 2021');
    expect(formatDateRange('Summer 2020 - Fall 2021', options)).toBe('Summer 2020 - Fall 2021');
    expect(formatDateRange('Q1 2021', options)).toBe('Q1 2021');
    expect(formatDateRange('Class of 2021', options)).toBe('Class of 2021');
    expect(formatDateRange('Worked through 2021', options)).toBe('Worked through 2021');
  });
});
