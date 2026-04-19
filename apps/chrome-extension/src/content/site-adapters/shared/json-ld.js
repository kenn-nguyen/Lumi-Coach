function stripHtml(html) {
  if (typeof html !== 'string' || !html) return '';
  const withBreaks = html
    .replace(/<\/(p|li|ul|ol|div|br|h[1-6])[^>]*>/gi, '\n')
    .replace(/<br\s*\/?\s*>/gi, '\n');
  const doc = new DOMParser().parseFromString(`<div>${withBreaks}</div>`, 'text/html');
  const text = doc.body?.textContent ?? '';
  return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function pickJobPosting(parsed) {
  if (!parsed) return null;
  const candidates = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed['@graph'])
      ? parsed['@graph']
      : [parsed];
  for (const candidate of candidates) {
    if (
      candidate &&
      (candidate['@type'] === 'JobPosting' ||
        (Array.isArray(candidate['@type']) && candidate['@type'].includes('JobPosting')))
    ) {
      return candidate;
    }
  }
  return null;
}

function formatLocation(job) {
  const loc = job?.jobLocation;
  const entries = Array.isArray(loc) ? loc : loc ? [loc] : [];
  for (const entry of entries) {
    const addr = entry?.address ?? entry;
    const parts = [addr?.addressLocality, addr?.addressRegion, addr?.addressCountry]
      .filter((value) => typeof value === 'string' && value.trim());
    if (parts.length) return parts.join(', ');
  }
  return '';
}

/**
 * @param {Document} doc
 * @returns {{ title: string, company: string, location: string, datePosted: string|null, description: string }}
 */
export function extractJobPostingLd(doc) {
  const empty = { title: '', company: '', location: '', datePosted: null, description: '' };
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    let parsed;
    try {
      parsed = JSON.parse(script.textContent || 'null');
    } catch {
      continue;
    }
    const job = pickJobPosting(parsed);
    if (!job) continue;
    return {
      title: typeof job.title === 'string' ? job.title.trim() : '',
      company: typeof job.hiringOrganization?.name === 'string' ? job.hiringOrganization.name.trim() : '',
      location: formatLocation(job),
      datePosted: typeof job.datePosted === 'string' ? job.datePosted.trim() : null,
      description: stripHtml(job.description),
    };
  }
  return empty;
}
