import { beforeEach, describe, expect, it } from 'vitest';
import { extractJobPostingLd } from './json-ld.js';

function seedScript(json) {
  document.body.innerHTML = `<script type="application/ld+json">${JSON.stringify(json)}</script>`;
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('extractJobPostingLd', () => {
  it('returns empty fields when no JSON-LD is present', () => {
    const result = extractJobPostingLd(document);
    expect(result.title).toBe('');
    expect(result.description).toBe('');
  });

  it('extracts a JobPosting with plain-text description', () => {
    seedScript({
      '@context': 'https://schema.org',
      '@type': 'JobPosting',
      title: 'Product Manager',
      hiringOrganization: { '@type': 'Organization', name: 'Red Gold' },
      jobLocation: { address: { addressLocality: 'Orestes', addressRegion: 'IN' } },
      datePosted: '2026-04-10',
      description: 'About the role. Responsibilities include X, Y, Z.',
    });
    const result = extractJobPostingLd(document);
    expect(result.title).toBe('Product Manager');
    expect(result.company).toBe('Red Gold');
    expect(result.location).toBe('Orestes, IN');
    expect(result.datePosted).toBe('2026-04-10');
    expect(result.description).toContain('Responsibilities');
  });

  it('strips HTML tags from description while preserving whitespace', () => {
    seedScript({
      '@type': 'JobPosting',
      title: 'PM',
      description: '<p>Intro paragraph.</p><ul><li>Bullet one</li><li>Bullet two</li></ul>',
    });
    const result = extractJobPostingLd(document);
    expect(result.description).toContain('Intro paragraph.');
    expect(result.description).toContain('Bullet one');
    expect(result.description).toContain('Bullet two');
    expect(result.description).not.toContain('<p>');
  });
});
