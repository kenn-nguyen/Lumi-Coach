import { describe, expect, it } from 'vitest';
import { getResumePdfUrl } from '@/lib/api/resume';
import { DEFAULT_TEMPLATE_SETTINGS } from '@/lib/types/template-settings';

describe('getResumePdfUrl', () => {
  it('includes output settings when template settings are provided', () => {
    const url = new URL(
      getResumePdfUrl('resume-123', {
        ...DEFAULT_TEMPLATE_SETTINGS,
        dateDisplay: 'year-only',
        fitOnePage: false,
      }),
      'http://localhost'
    );

    expect(url.searchParams.get('dateDisplay')).toBe('year-only');
    expect(url.searchParams.get('fitOnePage')).toBe('false');
  });

  it('leaves output settings absent when using print route defaults', () => {
    const url = new URL(getResumePdfUrl('resume-123'), 'http://localhost');

    expect(url.searchParams.get('dateDisplay')).toBeNull();
    expect(url.searchParams.get('fitOnePage')).toBeNull();
  });
});
