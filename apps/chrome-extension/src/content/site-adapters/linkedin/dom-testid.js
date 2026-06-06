import { FIELD_PROVENANCE } from '../../../shared/job-snapshot.js';
import { getExpandableTextButtonState } from '../shared/expand-text.js';

function normalize(text) {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeCompanyText(text) {
  const normalized = normalize(text);
  if (!normalized) return '';
  return normalized.replace(/\b\d[\d,]*\s+followers\b/i, '').replace(/\s+/g, ' ').trim();
}

function findDescriptionRegion(descNode, doc) {
  if (!(descNode instanceof Element)) return doc;

  let current = descNode.parentElement;
  while (
    current &&
    current !== doc.body &&
    current !== doc.documentElement &&
    current.tagName !== 'MAIN'
  ) {
    if (current.querySelector('[data-testid="expandable-text-button"]')) {
      return current;
    }
    current = current.parentElement;
  }

  return descNode.closest('[data-testid="job-details"], section, article, div') || doc;
}

/**
 * @param {Document} doc
 * @returns {{
 *   title: string,
 *   company: string,
 *   location: string,
 *   description: string,
 *   descriptionProvenance: 'testid' | 'testid_collapsed' | 'missing',
 *   expanderPresent: boolean,
 *   descriptionNode: Element | null
 * }}
 */
export function extractFromTestids(doc) {
  const descNode = doc.querySelector('[data-testid="expandable-text-box"]');
  const descriptionRegion = findDescriptionRegion(descNode, doc);
  const expanderBtn = descriptionRegion.querySelector(
    '[data-testid="expandable-text-button"]',
  );
  const expanderState = getExpandableTextButtonState(expanderBtn);
  const titleNode = doc.querySelector('[data-testid="job-title"], main h1');
  const companyNode = doc.querySelector('[data-testid="hiring-company"], a[href*="/company/"]');
  const locationNode = doc.querySelector('[data-testid="job-location"]');

  const descriptionText = descNode ? normalize(descNode.textContent) : '';
  let descriptionProvenance = FIELD_PROVENANCE.missing;
  if (descNode) {
    descriptionProvenance = !expanderBtn
      ? FIELD_PROVENANCE.testid
      : expanderState === 'expanded'
        ? FIELD_PROVENANCE.testid_expanded
        : expanderState === 'collapsed'
          ? FIELD_PROVENANCE.testid_collapsed
          : FIELD_PROVENANCE.testid;
  }

  return {
    title: titleNode ? normalize(titleNode.textContent) : '',
    company: companyNode ? normalizeCompanyText(companyNode.textContent) : '',
    location: locationNode ? normalize(locationNode.textContent) : '',
    description: descriptionText,
    descriptionProvenance,
    expanderPresent: Boolean(expanderBtn) && expanderState !== 'expanded',
    descriptionNode: descNode,
  };
}
