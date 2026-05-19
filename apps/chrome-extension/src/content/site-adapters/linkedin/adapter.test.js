import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { linkedInAdapter } from './adapter.js';

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = fs.readFileSync(
  path.resolve(THIS_DIR, '../../../../tests/fixtures/linkedin-product-manager-red-gold.html'),
  'utf8',
);

beforeEach(() => {
  document.documentElement.innerHTML = FIXTURE.replace(/^.*<html[^>]*>|<\/html>.*$/gis, '');
});

describe('linkedInAdapter', () => {
  it('canonicalizes collection URLs that carry currentJobId', async () => {
    const snapshot = await linkedInAdapter.snapshot(document, {
      mode: 'preview',
      locationHref:
        'https://www.linkedin.com/jobs/collections/top-startups/?currentJobId=4292077039&discover=true&discoveryOrigin=JOBS_HOME_EXPANDED_JOB_COLLECTIONS&subscriptionOrigin=JOBS_HOME',
    });

    expect(snapshot.sourceUrl).toBe(
      'https://www.linkedin.com/jobs/view/4292077039/',
    );
    expect(snapshot.readiness).toBe('job_preview_ready');
  });

  it('returns preview-ready snapshot without expansion in preview mode', async () => {
    const snapshot = await linkedInAdapter.snapshot(document, {
      mode: 'preview',
      locationHref: 'https://www.linkedin.com/jobs/view/4387987722/',
    });
    expect(snapshot.company).toBe('Red Gold');
    expect(snapshot.quality.descriptionExpanded).toBe(false);
    expect(snapshot.readiness).toBe('job_preview_ready');
  });

  it('canonicalizes slugged LinkedIn view URLs', async () => {
    const snapshot = await linkedInAdapter.snapshot(document, {
      mode: 'preview',
      locationHref:
        'https://www.linkedin.com/jobs/view/product-manager-commerce-systems-at-stripe-4413483608/?trk=public_jobs_topcard-title',
    });
    expect(snapshot.sourceUrl).toBe(
      'https://www.linkedin.com/jobs/view/4413483608/',
    );
    expect(snapshot.readiness).toBe('job_preview_ready');
  });

  it('returns full-jd-ready after expansion in full mode', async () => {
    const box = document.querySelector('[data-testid="expandable-text-box"]');
    const nested = document.querySelector('[style*="pointer-events: auto"]');
    nested.addEventListener('click', () => {
      box.textContent = `${box.textContent} ${'x'.repeat(800)}`;
      document.querySelector('[data-testid="expandable-text-button"]')?.remove();
    });
    const snapshot = await linkedInAdapter.snapshot(document, {
      mode: 'full',
      locationHref: 'https://www.linkedin.com/jobs/view/4387987722/',
    });
    expect(snapshot.quality.expandedAttempted).toBe(true);
    expect(snapshot.provenance.description).toBe('testid_expanded');
    expect(snapshot.readiness).toBe('full_jd_ready');
  });
});
