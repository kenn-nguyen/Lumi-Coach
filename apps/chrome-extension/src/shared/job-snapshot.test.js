import { describe, expect, it } from 'vitest';
import {
  createEmptySnapshot,
  evaluateReadiness,
  FIELD_PROVENANCE,
  JOB_READINESS_STATE,
} from './job-snapshot.js';

describe('createEmptySnapshot', () => {
  it('returns a snapshot with all provenance set to missing and confidence low', () => {
    const snap = createEmptySnapshot({ sourceUrl: 'https://www.linkedin.com/jobs/view/1/' });
    expect(snap.sourceUrl).toBe('https://www.linkedin.com/jobs/view/1/');
    expect(snap.provenance.description).toBe(FIELD_PROVENANCE.missing);
    expect(snap.quality.confidence).toBe('low');
    expect(snap.quality.descriptionExpanded).toBe(false);
  });
});

describe('evaluateReadiness', () => {
  it('returns not_supported_page when snapshot has no sourceUrl', () => {
    const snap = createEmptySnapshot({ sourceUrl: '' });
    expect(evaluateReadiness(snap)).toBe(JOB_READINESS_STATE.not_supported_page);
  });

  it('returns full_jd_ready in full mode with company + long description', () => {
    const snap = createEmptySnapshot({ sourceUrl: 'x' });
    snap.company = 'Red Gold';
    snap.rawText = 'a'.repeat(600);
    snap.provenance.company = FIELD_PROVENANCE.testid;
    snap.provenance.description = FIELD_PROVENANCE.testid_expanded;
    snap.quality.descriptionLength = 600;
    snap.quality.confidence = 'high';
    expect(evaluateReadiness(snap, { mode: 'full' })).toBe(JOB_READINESS_STATE.full_jd_ready);
  });

  it('returns job_preview_ready in preview mode for the same snapshot', () => {
    const snap = createEmptySnapshot({ sourceUrl: 'x' });
    snap.company = 'Red Gold';
    snap.rawText = 'a'.repeat(600);
    snap.provenance.company = FIELD_PROVENANCE.testid;
    snap.provenance.description = FIELD_PROVENANCE.testid_expanded;
    snap.quality.descriptionLength = 600;
    snap.quality.confidence = 'high';
    expect(evaluateReadiness(snap, { mode: 'preview' })).toBe(JOB_READINESS_STATE.job_preview_ready);
  });

  it('returns full_jd_ready for a long collapsed testid description that does not look truncated', () => {
    const snap = createEmptySnapshot({ sourceUrl: 'x' });
    snap.title = 'Manager, Product Management';
    snap.rawText = `${'a'.repeat(6925)}.`;
    snap.provenance.description = FIELD_PROVENANCE.testid_collapsed;
    snap.quality.descriptionLength = snap.rawText.length;
    snap.quality.confidence = 'medium';
    snap.quality.looksTruncated = false;
    expect(evaluateReadiness(snap, { mode: 'full' })).toBe(JOB_READINESS_STATE.full_jd_ready);
  });

  it('keeps short collapsed testid descriptions out of full-run readiness', () => {
    const snap = createEmptySnapshot({ sourceUrl: 'x' });
    snap.title = 'Manager, Product Management';
    snap.rawText = 'a'.repeat(600);
    snap.provenance.description = FIELD_PROVENANCE.testid_collapsed;
    snap.quality.descriptionLength = snap.rawText.length;
    snap.quality.confidence = 'medium';
    snap.quality.looksTruncated = false;
    expect(evaluateReadiness(snap, { mode: 'full' })).toBe(JOB_READINESS_STATE.job_preview_ready);
  });

  it('returns scrape_recoverable when only heuristic description was found', () => {
    const snap = createEmptySnapshot({ sourceUrl: 'x' });
    snap.company = 'Red Gold';
    snap.rawText = 'a'.repeat(600);
    snap.provenance.description = FIELD_PROVENANCE.heuristic;
    snap.quality.descriptionLength = 600;
    snap.quality.confidence = 'low';
    expect(evaluateReadiness(snap, { mode: 'full' })).toBe(JOB_READINESS_STATE.scrape_recoverable);
  });
});
