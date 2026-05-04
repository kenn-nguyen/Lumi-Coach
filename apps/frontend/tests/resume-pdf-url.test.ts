import { describe, expect, it } from 'vitest';
import { getResumePdfUrl } from '@/lib/api/resume';
import { DEFAULT_TEMPLATE_SETTINGS } from '@/lib/types/template-settings';

describe('getResumePdfUrl', () => {
  it('includes the date display mode when template settings are provided', () => {
    const url = new URL(
      getResumePdfUrl('resume-123', {
        ...DEFAULT_TEMPLATE_SETTINGS,
        dateDisplay: 'year-only',
      }),
      'http://localhost'
    );

    expect(url.searchParams.get('dateDisplay')).toBe('year-only');
  });

  it('leaves dateDisplay absent when using print route defaults', () => {
    const url = new URL(getResumePdfUrl('resume-123'), 'http://localhost');

    expect(url.searchParams.get('dateDisplay')).toBeNull();
  });
});
