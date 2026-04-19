import { logError, logInfo, logWarn } from './log.js';

function buildRunReadyError(snapshot) {
  const error = new Error(
    `Unable to extract a run-ready LinkedIn job description. Readiness: ${snapshot.readiness}. Expand the job description on the page and retry, or paste the JD manually.`,
  );
  error.snapshot = snapshot;
  return error;
}

export async function scrapeLinkedInJob(tabId) {
  logInfo('LinkedInScrape', 'Requesting full-mode job snapshot from content script.', {
    tabId,
  });

  const response = await new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type: 'SCRAPE_JOB_FULL' }, (result) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message || 'Content script did not respond.'));
        return;
      }
      resolve(result);
    });
  });

  if (!response?.ok) {
    logError('LinkedInScrape', 'Snapshot request rejected.', response);
    throw new Error(response?.error || 'LinkedIn scrape returned no snapshot.');
  }

  const snapshot = response.snapshot;
  logInfo('LinkedInScrape', 'Snapshot received.', {
    sourceUrl: snapshot.sourceUrl,
    readiness: snapshot.readiness,
    confidence: snapshot.quality?.confidence,
    provenance: snapshot.provenance,
    descriptionLength: snapshot.quality?.descriptionLength,
    looksTruncated: snapshot.quality?.looksTruncated,
    expandedSucceeded: snapshot.quality?.expandedSucceeded,
  });

  if (
    snapshot.readiness !== 'full_jd_ready' &&
    snapshot.readiness !== 'manual_jd_ready'
  ) {
    logWarn('LinkedInScrape', 'Snapshot is not run-ready.', {
      readiness: snapshot.readiness,
      confidence: snapshot.quality?.confidence,
    });
    throw buildRunReadyError(snapshot);
  }

  return snapshot;
}
