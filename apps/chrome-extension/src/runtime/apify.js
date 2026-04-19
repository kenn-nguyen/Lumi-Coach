import { APIFY_DEFAULT_LINKEDIN_ACTOR } from './constants.js';
import { logError, logInfo, logWarn } from './log.js';

function toActorPath(actorId = APIFY_DEFAULT_LINKEDIN_ACTOR) {
  return encodeURIComponent(String(actorId).trim().replace('/', '~'));
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeUrl(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return '';
  }

  try {
    return new URL(normalized).toString();
  } catch {
    return normalized;
  }
}

function toStringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

function buildDescription(record) {
  const nestedCandidates = [
    record?.job_info?.description,
    record?.jobInfo?.description,
    record?.job_info?.description_text,
    record?.jobInfo?.descriptionText,
  ];
  const nestedMatch = nestedCandidates.map(normalizeText).find(Boolean);
  if (nestedMatch) {
    return nestedMatch;
  }

  const directCandidates = [
    record?.description,
    record?.jobDescription,
    record?.job_description,
    record?.descriptionText,
    record?.fullDescription,
    record?.text,
    record?.jobText,
  ];
  const directMatch = directCandidates.map(normalizeText).find(Boolean);
  if (directMatch) {
    return directMatch;
  }

  const sectionCandidates = [
    record?.descriptionSections,
    record?.description_sections,
    record?.sections,
  ];
  for (const candidate of sectionCandidates) {
    if (!Array.isArray(candidate)) continue;
    const joined = candidate
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          return [item.heading, item.title, item.text, item.content]
            .map(normalizeText)
            .filter(Boolean)
            .join('\n');
        }
        return '';
      })
      .filter(Boolean)
      .join('\n\n')
      .trim();
    if (joined) {
      return joined;
    }
  }

  const responsibilityLists = [
    toStringArray(record?.responsibilities),
    toStringArray(record?.requirements),
    toStringArray(record?.qualifications),
    toStringArray(record?.skills),
  ]
    .flat()
    .map((item) => `- ${item.trim()}`)
    .filter((item) => item !== '-');

  return responsibilityLists.join('\n').trim();
}

function buildLabeledApifyJobText(record) {
  const jobInfo = record?.job_info || record?.jobInfo || {};
  const companyInfo = record?.company_info || record?.companyInfo || {};

  const title = normalizeText(record?.title || record?.jobTitle || jobInfo?.title);
  const company = normalizeText(
    record?.company ||
      record?.companyName ||
      record?.company_name ||
      companyInfo?.name,
  );
  const location = normalizeText(
    record?.location || record?.jobLocation || record?.place || jobInfo?.location,
  );
  const datePosted = normalizeText(
    record?.datePosted ||
      record?.postedAt ||
      record?.date_posted ||
      jobInfo?.listed_at ||
      jobInfo?.original_listed_at,
  );
  const employmentStatus = normalizeText(jobInfo?.employment_status);
  const experienceLevel = normalizeText(jobInfo?.experience_level);
  const workplaceTypes = Array.isArray(jobInfo?.workplace_types)
    ? jobInfo.workplace_types.map(normalizeText).filter(Boolean)
    : [];
  const description = buildDescription(record);

  const headerLines = [
    title ? `Job Title: ${title}` : '',
    company ? `Company: ${company}` : '',
    location ? `Location: ${location}` : '',
    employmentStatus ? `Employment Type: ${employmentStatus}` : '',
    workplaceTypes.length ? `Workplace Type: ${workplaceTypes.join(', ')}` : '',
    experienceLevel ? `Experience Level: ${experienceLevel}` : '',
    datePosted ? `Date Posted: ${datePosted}` : '',
  ].filter(Boolean);

  const sections = [];
  if (headerLines.length) {
    sections.push(headerLines.join('\n'));
  }
  if (description) {
    sections.push(`Job Description:\n${description}`);
  }

  return sections.join('\n\n').trim();
}

function extractJobIdFromUrl(jobUrl) {
  const normalized = normalizeUrl(jobUrl);
  const match = normalized.match(/\/jobs\/view\/(\d+)/);
  return match?.[1] ?? '';
}

function scoreRecordMatch(record, sourceUrl, sourceJobId) {
  const recordUrl = normalizeUrl(record?.url || record?.link || record?.jobUrl || record?.job_url);
  const recordJobId =
    normalizeText(record?.jobId || record?.job_id || record?.id) ||
    extractJobIdFromUrl(recordUrl);
  const description = buildDescription(record);

  let score = description.length;
  if (sourceJobId && recordJobId && sourceJobId === recordJobId) {
    score += 5000;
  }
  if (sourceUrl && recordUrl && sourceUrl === recordUrl) {
    score += 2500;
  }
  if (record?.title) {
    score += 100;
  }
  if (record?.company || record?.companyName) {
    score += 100;
  }
  return score;
}

export function normalizeApifyJobRecord(record, sourceUrl = '') {
  const description = buildDescription(record);
  const labeledText = buildLabeledApifyJobText(record);
  const jobInfo = record?.job_info || record?.jobInfo || {};
  const companyInfo = record?.company_info || record?.companyInfo || {};
  return {
    source: 'apify',
    sourceUrl:
      normalizeUrl(
        record?.url ||
          record?.link ||
          record?.jobUrl ||
          record?.job_url ||
          jobInfo?.url ||
          jobInfo?.job_url,
      ) ||
      normalizeUrl(sourceUrl),
    title: normalizeText(record?.title || record?.jobTitle || jobInfo?.title),
    company: normalizeText(
      record?.company ||
        record?.companyName ||
        record?.company_name ||
        companyInfo?.name,
    ),
    location: normalizeText(
      record?.location || record?.jobLocation || record?.place || jobInfo?.location,
    ),
    datePosted:
      normalizeText(
        record?.datePosted ||
          record?.postedAt ||
          record?.date_posted ||
          jobInfo?.listed_at ||
          jobInfo?.original_listed_at ||
          jobInfo?.date_posted,
      ) || null,
    extractedAt: new Date().toISOString(),
    rawText: labeledText || description,
    diagnostics: {
      source: 'apify',
      actorRecordUrl: normalizeUrl(record?.url || record?.link || record?.jobUrl || record?.job_url),
      rawTextLength: description.length,
      labeledTextLength: labeledText.length,
      rawDescription: description,
    },
  };
}

export async function runApifyLinkedInFallback(sourceUrl, settings = {}) {
  const normalizedSourceUrl = normalizeUrl(sourceUrl);
  const apiToken = normalizeText(settings.apiToken);
  const actorId = APIFY_DEFAULT_LINKEDIN_ACTOR;
  const sourceJobId = extractJobIdFromUrl(normalizedSourceUrl);

  if (!normalizedSourceUrl) {
    throw new Error('Apify fallback requires a LinkedIn job URL.');
  }
  if (!apiToken) {
    throw new Error('Apify fallback requires an API token.');
  }
  if (!sourceJobId) {
    throw new Error('Apify fallback requires a LinkedIn job URL with a job id.');
  }

  const endpoint = `https://api.apify.com/v2/acts/${toActorPath(actorId)}/run-sync-get-dataset-items`;
  const input = {
    job_id: [sourceJobId],
  };

  logInfo('ApifyFallback', 'Running Apify LinkedIn fallback.', {
    actorId,
    sourceUrl: normalizedSourceUrl,
  });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    logError('ApifyFallback', 'Apify fallback request failed.', {
      actorId,
      status: response.status,
      body,
    });
    throw new Error(`Apify fallback failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const items = Array.isArray(payload) ? payload : [];
  if (items.length === 0) {
    logWarn('ApifyFallback', 'Apify returned no job records.', {
      actorId,
      sourceUrl: normalizedSourceUrl,
    });
    throw new Error('Apify fallback returned no job records.');
  }

  const bestRecord = items
    .slice()
    .sort(
      (left, right) =>
        scoreRecordMatch(right, normalizedSourceUrl, sourceJobId) -
        scoreRecordMatch(left, normalizedSourceUrl, sourceJobId),
    )[0];

  const normalized = normalizeApifyJobRecord(bestRecord, normalizedSourceUrl);
  if (!normalized.rawText) {
    throw new Error('Apify fallback returned a record without a readable description.');
  }

  normalized.diagnostics = {
    ...normalized.diagnostics,
    actorId,
    itemCount: items.length,
    requestedJobId: sourceJobId,
  };

  logInfo('ApifyFallback', 'Apify fallback completed.', {
    actorId,
    itemCount: items.length,
    rawTextLength: normalized.rawText.length,
    sourceUrl: normalized.sourceUrl,
  });

  return normalized;
}
