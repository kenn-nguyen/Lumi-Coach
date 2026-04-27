import { FIELD_PROVENANCE } from '../../../shared/job-snapshot.js';

const STRONG_SOURCES = new Set([
  FIELD_PROVENANCE.json_ld,
  FIELD_PROVENANCE.testid,
  FIELD_PROVENANCE.testid_expanded,
  FIELD_PROVENANCE.class,
]);

function looksTruncated(text) {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.endsWith('…')) return true;
  const last = trimmed.slice(-1);
  if (/[.!?"')\]]/.test(last)) return false;
  return trimmed.length < 3000;
}

export function scoreConfidence(fields) {
  const descProv = fields.descriptionProvenance ?? FIELD_PROVENANCE.missing;
  const descLen = (fields.description || '').length;
  const truncated = looksTruncated(fields.description);

  if (descProv === FIELD_PROVENANCE.heuristic) {
    return { confidence: 'low', looksTruncated: truncated };
  }
  if (descProv === FIELD_PROVENANCE.missing || descLen === 0) {
    return { confidence: 'low', looksTruncated: false };
  }
  if (descProv === FIELD_PROVENANCE.testid_collapsed) {
    return { confidence: 'medium', looksTruncated: truncated };
  }
  if (!STRONG_SOURCES.has(descProv)) {
    return { confidence: 'low', looksTruncated: truncated };
  }
  if (descLen < 400 || truncated) {
    return { confidence: 'medium', looksTruncated: truncated };
  }
  return { confidence: 'high', looksTruncated: false };
}
