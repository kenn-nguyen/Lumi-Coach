import { describe, expect, it } from 'vitest';
import { buildContactDisplay } from '@/components/resume/contact-utils';

describe('buildContactDisplay', () => {
  it('builds a LinkedIn profile URL from a bare slug', () => {
    const result = buildContactDisplay('LinkedIn', 'kenn-nguyen');

    expect(result.href).toBe('https://www.linkedin.com/in/kenn-nguyen');
    expect(result.displayText).toBe('kenn-nguyen');
    expect(result.socialSlug).toBe('kenn-nguyen');
  });

  it('builds a LinkedIn profile URL from a full LinkedIn path', () => {
    const result = buildContactDisplay('LinkedIn', 'linkedin.com/in/kenn-nguyen');

    expect(result.href).toBe('https://www.linkedin.com/in/kenn-nguyen');
    expect(result.displayText).toBe('linkedin.com/in/kenn-nguyen');
    expect(result.socialSlug).toBe('kenn-nguyen');
  });

  it('preserves full LinkedIn URLs', () => {
    const result = buildContactDisplay(
      'LinkedIn',
      'https://www.linkedin.com/in/kenn-nguyen?utm_source=test'
    );

    expect(result.href).toBe('https://www.linkedin.com/in/kenn-nguyen?utm_source=test');
    expect(result.displayText).toBe('linkedin.com/in/kenn-nguyen');
    expect(result.socialSlug).toBe('kenn-nguyen');
  });

  it('builds a GitHub URL from a bare handle', () => {
    const result = buildContactDisplay('GitHub', 'kenn-nguyen');

    expect(result.href).toBe('https://github.com/kenn-nguyen');
    expect(result.displayText).toBe('kenn-nguyen');
    expect(result.socialSlug).toBe('kenn-nguyen');
  });

  it('builds a GitHub URL from a full GitHub path', () => {
    const result = buildContactDisplay('GitHub', 'github.com/kenn-nguyen');

    expect(result.href).toBe('https://github.com/kenn-nguyen');
    expect(result.displayText).toBe('github.com/kenn-nguyen');
    expect(result.socialSlug).toBe('kenn-nguyen');
  });
});
