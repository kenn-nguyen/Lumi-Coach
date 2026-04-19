import { createEmptySnapshot, evaluateReadiness, FIELD_PROVENANCE } from '../../../shared/job-snapshot.js';
import { scoreConfidence } from '../shared/confidence.js';
import { tryExpandJobDescription } from '../shared/expand-text.js';
import { extractJobPostingLd } from '../shared/json-ld.js';
import { qaCheckDescription } from '../shared/qa.js';
import { reconcile } from '../shared/reconcile.js';
import { extractFromLegacyClasses } from './dom-class.js';
import { extractHeuristic } from './heuristic.js';
import { extractFromTestids } from './dom-testid.js';

function normalizeUrl(href) {
  try {
    const parsed = new URL(href);
    const currentJobId = parsed.searchParams.get('currentJobId')?.trim();
    if (currentJobId) {
      return `${parsed.origin}/jobs/view/${currentJobId}/`;
    }
  } catch {}

  const canonicalMatch = href.match(/\/jobs\/view\/(\d+)/);
  if (canonicalMatch) {
    try {
      const origin = new URL(href).origin;
      return `${origin}/jobs/view/${canonicalMatch[1]}/`;
    } catch {
      return href;
    }
  }
  return href;
}

function deriveLinkedInJobUrl(doc, href) {
  const normalizedHref = normalizeUrl(href);
  if (/\/jobs\/view\/\d+\//.test(normalizedHref)) {
    return normalizedHref;
  }

  const linkCandidates = [
    doc.querySelector('a[href*="/jobs/view/"][href*="currentJobId="]'),
    doc.querySelector('a[href*="/jobs/view/"]'),
    doc.querySelector('link[rel="canonical"]'),
  ];

  for (const candidate of linkCandidates) {
    const rawHref =
      candidate?.href ||
      candidate?.getAttribute?.('href') ||
      '';
    const normalized = normalizeUrl(rawHref);
    if (/\/jobs\/view\/\d+\//.test(normalized)) {
      return normalized;
    }
  }

  return normalizedHref;
}

function applyConfidenceDelta(confidence, delta, shouldBlock) {
  if (shouldBlock) return 'low';

  const order = ['low', 'medium', 'high'];
  const startIndex = Math.max(0, order.indexOf(confidence));
  const nextIndex = Math.max(0, Math.min(order.length - 1, startIndex + delta));
  return order[nextIndex] || 'low';
}

export const linkedInAdapter = {
  hostnameMatches(hostname) {
    return /(^|\.)linkedin\.com$/.test(hostname);
  },

  async snapshot(doc, options) {
    const mode = options?.mode ?? 'preview';
    const href = options?.locationHref ?? doc.location?.href ?? '';
    const snapshot = createEmptySnapshot({
      sourceUrl: deriveLinkedInJobUrl(doc, href),
    });

    const ld = extractJobPostingLd(doc);
    const testid = extractFromTestids(doc);

    if (mode === 'full' && testid.expanderPresent) {
      const exp = await tryExpandJobDescription(doc);
      snapshot.quality.expandedAttempted = exp.expandedAttempted;
      snapshot.quality.expandedSucceeded = exp.expandedSucceeded;
      snapshot.quality.textLengthBefore = exp.textLengthBefore;
      snapshot.quality.textLengthAfter = exp.textLengthAfter;
      if (exp.expandedSucceeded && testid.descriptionNode) {
        testid.description = (testid.descriptionNode.textContent || '').replace(/\s+/g, ' ').trim();
        testid.descriptionProvenance = FIELD_PROVENANCE.testid_expanded;
        snapshot.quality.descriptionExpanded = true;
      }
    }

    const classes = extractFromLegacyClasses(doc);
    const heuristic =
      !ld.description && !testid.description && !classes.description
        ? extractHeuristic(doc)
        : { description: '', descriptionProvenance: FIELD_PROVENANCE.missing };

    const reconciled = reconcile({ ld, testid, classes, heuristic });
    snapshot.title = reconciled.title;
    snapshot.company = reconciled.company;
    snapshot.location = reconciled.location;
    snapshot.datePosted = reconciled.datePosted;
    snapshot.rawText = reconciled.description;
    snapshot.provenance = reconciled.provenance;
    snapshot.quality.descriptionLength = reconciled.description.length;

    const { confidence, looksTruncated } = scoreConfidence({
      description: reconciled.description,
      descriptionProvenance: reconciled.provenance.description,
      title: reconciled.title,
      company: reconciled.company,
    });
    const qa = qaCheckDescription(reconciled.description, {
      ldDescription: ld.description,
      provenance: reconciled.provenance.description,
    });

    snapshot.quality.confidence = applyConfidenceDelta(
      confidence,
      qa.confidenceDelta,
      qa.shouldBlock,
    );
    snapshot.quality.looksTruncated = looksTruncated;
    snapshot.diagnostics = {
      mode,
      hasJsonLd: Boolean(ld.description || ld.title),
      hasTestids: Boolean(testid.description || testid.title),
      hasLegacyClasses: Boolean(classes.description || classes.title),
      heuristicUsed: reconciled.provenance.description === FIELD_PROVENANCE.heuristic,
      qa,
    };
    snapshot.readiness = evaluateReadiness(snapshot, { mode });
    return snapshot;
  },
};
