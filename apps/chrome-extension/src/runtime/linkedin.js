import { logError, logInfo, logWarn } from './log.js';

function normalizeText(value) {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

export async function scrapeLinkedInJob(tabId) {
  logInfo('LinkedInScrape', 'Starting LinkedIn scrape.', { tabId });

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const selectors = {
        title: [
          '.job-details-jobs-unified-top-card__job-title',
          '.top-card-layout__title',
          '.jobs-unified-top-card__job-title',
          '[data-test-id="job-details-job-title"]',
          'main h1',
          'h1',
        ],
        company: [
          '.job-details-jobs-unified-top-card__company-name',
          '.topcard__org-name-link',
          '.jobs-unified-top-card__company-name',
          '[data-test-id="job-details-company-name"]',
          'main a[href*="/company/"]',
        ],
        location: [
          '.job-details-jobs-unified-top-card__primary-description-container',
          '.topcard__flavor--bullet',
          '.jobs-unified-top-card__bullet',
          '[data-test-id="job-details-location"]',
        ],
        datePosted: [
          '.job-details-jobs-unified-top-card__tertiary-description-container',
          '.posted-time-ago__text',
          '[data-test-id="job-details-posted-date"]',
          'span[class*="posted-time"]',
        ],
        description: [
          '.jobs-description',
          '.jobs-description-content__text',
          '.jobs-box__html-content',
          '.show-more-less-html__markup',
          '[data-test-id="job-details-description"]',
          '[data-testid="expandable-text-box"]',
        ],
      };

      const firstText = (list) => {
        for (const selector of list) {
          const text = document.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
          if (text) return text;
        }
        return '';
      };

      const descriptionNode = selectors.description
        .map((selector) => document.querySelector(selector))
        .find(Boolean);

      const rawText = descriptionNode?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      const url = window.location.href;
      const jobIdMatch = url.match(/\/jobs\/view\/(\d+)/);
      const sourceUrl = jobIdMatch ? `${window.location.origin}/jobs/view/${jobIdMatch[1]}/` : url;

      const diagnostics = {
        url,
        titleSelectorHit: selectors.title.find((selector) => Boolean(document.querySelector(selector))) ?? null,
        companySelectorHit: selectors.company.find((selector) => Boolean(document.querySelector(selector))) ?? null,
        locationSelectorHit: selectors.location.find((selector) => Boolean(document.querySelector(selector))) ?? null,
        datePostedSelectorHit: selectors.datePosted.find((selector) => Boolean(document.querySelector(selector))) ?? null,
        descriptionSelectorHit: selectors.description.find((selector) => Boolean(document.querySelector(selector))) ?? null,
        bodyTextLength: document.body?.innerText?.trim().length ?? 0,
        rawTextLength: rawText.length,
        titleLength: firstText(selectors.title).length,
        companyLength: firstText(selectors.company).length,
        locationLength: firstText(selectors.location).length,
      };

      return {
        source: 'linkedin',
        sourceUrl,
        title: firstText(selectors.title),
        company: firstText(selectors.company),
        location: firstText(selectors.location),
        datePosted: firstText(selectors.datePosted) || null,
        extractedAt: new Date().toISOString(),
        rawText,
        diagnostics,
      };
    },
  });

  if (!result) {
    logError('LinkedInScrape', 'Script execution returned no result.', { tabId });
    throw new Error('LinkedIn scrape returned no data from the active page.');
  }

  logInfo('LinkedInScrape', 'Raw LinkedIn scrape result received.', result.diagnostics ?? result);

  if (!result?.rawText) {
    logWarn('LinkedInScrape', 'No readable job description found.', result.diagnostics ?? result);
    throw new Error('Unable to extract a readable LinkedIn job description from the active page. Check the page console for [ResumeMatcherExt][LinkedInScrape] logs.');
  }

  const normalized = {
    ...result,
    title: normalizeText(result.title),
    company: normalizeText(result.company),
    location: normalizeText(result.location),
    rawText: normalizeText(result.rawText),
  };

  logInfo('LinkedInScrape', 'LinkedIn scrape normalized successfully.', {
    sourceUrl: normalized.sourceUrl,
    title: normalized.title,
    company: normalized.company,
    location: normalized.location,
    rawTextLength: normalized.rawText.length,
  });

  return normalized;
}
