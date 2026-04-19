import { FIELD_PROVENANCE } from '../../../shared/job-snapshot.js';

function normalize(text) {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeCompanyText(text) {
  const normalized = normalize(text);
  if (!normalized) return '';
  return normalized.replace(/\b\d[\d,]*\s+followers\b/i, '').replace(/\s+/g, ' ').trim();
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
  const expanderBtn = doc.querySelector('[data-testid="expandable-text-button"]');
  const titleNode = doc.querySelector('[data-testid="job-title"], main h1');
  const companyNode = doc.querySelector('[data-testid="hiring-company"], a[href*="/company/"]');
  const locationNode = doc.querySelector('[data-testid="job-location"]');

  const descriptionText = descNode ? normalize(descNode.textContent) : '';
  let descriptionProvenance = FIELD_PROVENANCE.missing;
  if (descNode) {
    descriptionProvenance = expanderBtn
      ? FIELD_PROVENANCE.testid_collapsed
      : FIELD_PROVENANCE.testid;
  }

  return {
    title: titleNode ? normalize(titleNode.textContent) : '',
    company: companyNode ? normalizeCompanyText(companyNode.textContent) : '',
    location: locationNode ? normalize(locationNode.textContent) : '',
    description: descriptionText,
    descriptionProvenance,
    expanderPresent: Boolean(expanderBtn),
    descriptionNode: descNode,
  };
}
