import { FIELD_PROVENANCE } from '../../../shared/job-snapshot.js';

function normalize(text) {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function firstText(doc, selectors) {
  for (const selector of selectors) {
    const text = normalize(doc.querySelector(selector)?.textContent);
    if (text) return text;
  }
  return '';
}

export function extractFromLegacyClasses(doc) {
  const title = firstText(doc, [
    '.job-details-jobs-unified-top-card__job-title',
    '.top-card-layout__title',
    '.jobs-unified-top-card__job-title',
    '[data-test-id="job-details-job-title"]',
    'main h1',
    'h1',
  ]);
  const company = firstText(doc, [
    '.job-details-jobs-unified-top-card__company-name',
    '.topcard__org-name-link',
    '.jobs-unified-top-card__company-name',
    '[data-test-id="job-details-company-name"]',
  ]);
  const location = firstText(doc, [
    '.job-details-jobs-unified-top-card__primary-description-container',
    '.topcard__flavor--bullet',
    '.jobs-unified-top-card__bullet',
    '[data-test-id="job-details-location"]',
  ]);
  const datePosted = firstText(doc, [
    '.job-details-jobs-unified-top-card__tertiary-description-container',
    '.posted-time-ago__text',
    '[data-test-id="job-details-posted-date"]',
    'span[class*="posted-time"]',
  ]);
  const description = firstText(doc, [
    '.jobs-description',
    '.jobs-description-content__text',
    '.jobs-box__html-content',
    '.show-more-less-html__markup',
    '[data-test-id="job-details-description"]',
  ]);

  return {
    title,
    company,
    location,
    datePosted: datePosted || null,
    description,
    descriptionProvenance: description ? FIELD_PROVENANCE.class : FIELD_PROVENANCE.missing,
  };
}
