/**
 * @typedef {'json_ld' | 'testid' | 'testid_expanded' | 'testid_collapsed' | 'class' | 'heuristic' | 'manual' | 'missing'} FieldProvenance
 * @typedef {'high' | 'medium' | 'low'} Confidence
 *
 * @typedef {Object} JobSnapshot
 * @property {'linkedin'} source
 * @property {string} sourceUrl
 * @property {string} title
 * @property {string} company
 * @property {string} location
 * @property {string|null} datePosted
 * @property {string} rawText
 * @property {string} extractedAt
 * @property {{ title: FieldProvenance, company: FieldProvenance, location: FieldProvenance, datePosted: FieldProvenance, description: FieldProvenance }} provenance
 * @property {{ descriptionLength: number, descriptionExpanded: boolean, expandedAttempted: boolean, expandedSucceeded: boolean, textLengthBefore: number, textLengthAfter: number, looksTruncated: boolean, confidence: Confidence }} quality
 * @property {Record<string, unknown>} diagnostics
 * @property {string} [readiness]
 */

export const FIELD_PROVENANCE = Object.freeze({
  json_ld: 'json_ld',
  testid: 'testid',
  testid_expanded: 'testid_expanded',
  testid_collapsed: 'testid_collapsed',
  class: 'class',
  heuristic: 'heuristic',
  manual: 'manual',
  missing: 'missing',
});

export const JOB_READINESS_STATE = Object.freeze({
  not_supported_page: 'not_supported_page',
  loading_job: 'loading_job',
  job_preview_ready: 'job_preview_ready',
  full_jd_ready: 'full_jd_ready',
  scrape_recoverable: 'scrape_recoverable',
  manual_jd_ready: 'manual_jd_ready',
  blocked_auth: 'blocked_auth',
  blocked_resume: 'blocked_resume',
  blocked_provider: 'blocked_provider',
});

const RUN_READY_DESCRIPTION_MIN = 400;
const PREVIEW_READY_DESCRIPTION_MIN = 120;

/**
 * @param {{ sourceUrl?: string, source?: 'linkedin' }} [init]
 * @returns {JobSnapshot}
 */
export function createEmptySnapshot(init = {}) {
  return {
    source: init.source ?? 'linkedin',
    sourceUrl: init.sourceUrl ?? '',
    title: '',
    company: '',
    location: '',
    datePosted: null,
    rawText: '',
    extractedAt: new Date().toISOString(),
    provenance: {
      title: FIELD_PROVENANCE.missing,
      company: FIELD_PROVENANCE.missing,
      location: FIELD_PROVENANCE.missing,
      datePosted: FIELD_PROVENANCE.missing,
      description: FIELD_PROVENANCE.missing,
    },
    quality: {
      descriptionLength: 0,
      descriptionExpanded: false,
      expandedAttempted: false,
      expandedSucceeded: false,
      textLengthBefore: 0,
      textLengthAfter: 0,
      looksTruncated: false,
      confidence: 'low',
    },
    diagnostics: {},
  };
}

/**
 * @param {JobSnapshot} snapshot
 * @param {{ mode?: 'preview' | 'full' }} [options]
 * @returns {string}
 */
export function evaluateReadiness(snapshot, options = {}) {
  const mode = options.mode ?? 'full';
  if (!snapshot?.sourceUrl) return JOB_READINESS_STATE.not_supported_page;

  const descProv = snapshot.provenance?.description ?? FIELD_PROVENANCE.missing;
  const descLen = snapshot.quality?.descriptionLength ?? 0;
  const confidence = snapshot.quality?.confidence ?? 'low';

  if (descProv === FIELD_PROVENANCE.manual && descLen >= PREVIEW_READY_DESCRIPTION_MIN) {
    return JOB_READINESS_STATE.manual_jd_ready;
  }

  if (descProv === FIELD_PROVENANCE.heuristic) {
    return descLen >= PREVIEW_READY_DESCRIPTION_MIN
      ? JOB_READINESS_STATE.scrape_recoverable
      : JOB_READINESS_STATE.loading_job;
  }

  const hasStrongDescription =
    (descProv === FIELD_PROVENANCE.json_ld ||
      descProv === FIELD_PROVENANCE.testid_expanded ||
      descProv === FIELD_PROVENANCE.testid ||
      descProv === FIELD_PROVENANCE.class) &&
    descLen >= RUN_READY_DESCRIPTION_MIN &&
    confidence !== 'low';

  if (hasStrongDescription && (snapshot.company || snapshot.title)) {
    return mode === 'preview'
      ? JOB_READINESS_STATE.job_preview_ready
      : JOB_READINESS_STATE.full_jd_ready;
  }

  if (descLen >= PREVIEW_READY_DESCRIPTION_MIN && (snapshot.company || snapshot.title)) {
    return JOB_READINESS_STATE.job_preview_ready;
  }

  return JOB_READINESS_STATE.loading_job;
}
