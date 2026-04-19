import { describe, expect, it } from 'vitest';
import { qaCheckDescription } from './qa.js';

describe('qaCheckDescription', () => {
  it('hard-blocks obvious short junk', () => {
    const result = qaCheckDescription('too short');
    expect(result.shouldBlock).toBe(true);
    expect(result.issues[0]?.code).toBe('too_short');
  });

  it('keeps a plausible JD as pass with no hard block', () => {
    const text = `
Responsibilities:
- Lead roadmap planning and execution
- Partner with engineering and design

Requirements:
- 5+ years of product experience
- Strong communication skills
`;
    const result = qaCheckDescription(text);
    expect(result.shouldBlock).toBe(false);
    expect(result.metrics.keywordHits).toBeGreaterThanOrEqual(2);
  });

  it('flags LinkedIn page chrome as blocking when clearly contaminated', () => {
    const text = `
Sign in to save this job. Similar jobs. People also viewed.
Responsibilities include leading roadmap planning and requirements gathering.
`;
    const result = qaCheckDescription(text);
    expect(result.shouldBlock).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'contains_page_chrome')).toBe(true);
  });
});
