import { describe, expect, it } from 'vitest';
import { extractFromLegacyClasses } from './dom-class.js';

describe('extractFromLegacyClasses', () => {
  it('extracts fields from legacy selectors', () => {
    document.body.innerHTML = `
      <h1 class="job-details-jobs-unified-top-card__job-title">Product Manager</h1>
      <a class="job-details-jobs-unified-top-card__company-name">Red Gold</a>
      <div class="job-details-jobs-unified-top-card__primary-description-container">Orestes, IN</div>
      <div class="posted-time-ago__text">3 days ago</div>
      <div class="jobs-box__html-content">Responsibilities include shipping roadmap and coordinating launches.</div>
    `;
    const result = extractFromLegacyClasses(document);
    expect(result.title).toBe('Product Manager');
    expect(result.company).toBe('Red Gold');
    expect(result.location).toBe('Orestes, IN');
    expect(result.datePosted).toBe('3 days ago');
    expect(result.descriptionProvenance).toBe('class');
  });
});
