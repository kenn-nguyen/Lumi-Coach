import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractFromTestids } from './dom-testid.js';

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = fs.readFileSync(
  path.resolve(THIS_DIR, '../../../../tests/fixtures/linkedin-product-manager-red-gold.html'),
  'utf8',
);

beforeEach(() => {
  document.documentElement.innerHTML = FIXTURE.replace(/^.*<html[^>]*>|<\/html>.*$/gis, '');
});

describe('extractFromTestids', () => {
  it('reads the expandable-text-box into description', () => {
    const result = extractFromTestids(document);
    expect(result.description.length).toBeGreaterThan(200);
    expect(result.descriptionProvenance).toMatch(/testid/);
  });

  it('detects the expander as collapsed', () => {
    const result = extractFromTestids(document);
    expect(result.expanderPresent).toBe(true);
    expect(result.descriptionProvenance).toBe('testid_collapsed');
  });

  it('treats a show-less control as already expanded', () => {
    const button = document.querySelector('[data-testid="expandable-text-button"]');
    button.setAttribute('aria-expanded', 'true');
    button.textContent = 'Show less';

    const result = extractFromTestids(document);
    expect(result.expanderPresent).toBe(false);
    expect(result.descriptionProvenance).toBe('testid_expanded');
  });

  it('ignores unrelated expandable buttons outside the job-description region', () => {
    document.querySelector('[data-testid="expandable-text-button"]')?.remove();
    const unrelated = document.createElement('button');
    unrelated.setAttribute('data-testid', 'expandable-text-button');
    unrelated.textContent = 'Show more';
    document.body.appendChild(unrelated);

    const result = extractFromTestids(document);
    expect(result.expanderPresent).toBe(false);
    expect(result.descriptionProvenance).toBe('testid');
  });

  it('strips follower-count noise from company text', () => {
    const result = extractFromTestids(document);
    expect(result.company).toBe('Red Gold');
  });
});
