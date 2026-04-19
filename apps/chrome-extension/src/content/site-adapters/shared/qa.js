const JD_KEYWORDS = [
  'responsib',
  'requir',
  'qualif',
  'experienc',
  'skill',
  'position',
  'candidate',
  'years',
  'ability',
  'manage',
  'support',
];

const CHROME_PATTERNS = [
  /\bsign in to save this job\b/i,
  /\bsimilar jobs\b/i,
  /\bsee who'?s applied\b/i,
  /\bcookie preferences?\b/i,
  /©\s*\d{4}\s+linkedin\b/i,
  /\bpeople you may know\b/i,
  /\breport this job\b/i,
  /\bpeople also viewed\b/i,
];

function countKeywordHits(text) {
  const lower = text.toLowerCase();
  return JD_KEYWORDS.filter((stem) => lower.includes(stem)).length;
}

function countBlocks(text) {
  const paragraphBlocks = text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter((part) => part.length > 40).length;

  const bulletLines = (text.match(/^\s*[-*•]\s+\S+/gm) || []).length;
  return Math.max(paragraphBlocks, bulletLines > 1 ? 2 : 1);
}

function tokenizeForSimilarity(text) {
  return new Set(
    text
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 4),
  );
}

function jaccardSimilarity(aText, bText) {
  const a = tokenizeForSimilarity(aText);
  const b = tokenizeForSimilarity(bText);
  if (!a.size && !b.size) return 1;

  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection += 1;
  }

  const union = new Set([...a, ...b]).size;
  return union === 0 ? 1 : intersection / union;
}

export function qaCheckDescription(
  text,
  { ldDescription = '', provenance = 'missing' } = {},
) {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  const issues = [];
  let confidenceDelta = 0;

  if (normalized.length < 120) {
    issues.push({ code: 'too_short', severity: 'error' });
    return {
      passed: false,
      shouldBlock: true,
      confidenceDelta: -2,
      issues,
      metrics: {
        length: normalized.length,
        keywordHits: 0,
        blockCount: 0,
        chromeMatchCount: 0,
      },
    };
  }

  const keywordHits = countKeywordHits(normalized);
  const blockCount = countBlocks((text || '').trim());
  const chromeMatches = CHROME_PATTERNS.filter((pattern) => pattern.test(normalized));
  const chromeMatchCount = chromeMatches.length;

  if (chromeMatchCount >= 2) {
    issues.push({ code: 'contains_page_chrome', severity: 'error' });
  } else if (chromeMatchCount === 1) {
    issues.push({ code: 'possible_page_chrome', severity: 'warn' });
    confidenceDelta -= 1;
  }

  if (keywordHits < 2) {
    issues.push({ code: 'low_keyword_density', severity: 'warn' });
    confidenceDelta -= 1;
  }

  if (blockCount < 2 && keywordHits < 3 && normalized.length < 1200) {
    issues.push({ code: 'weak_structure', severity: 'warn' });
    confidenceDelta -= 1;
  }

  if (normalized.length > 15000) {
    issues.push({ code: 'unusually_long', severity: 'warn' });
    confidenceDelta -= 1;
  }

  if (
    ldDescription &&
    ldDescription.length > 300 &&
    normalized.length > 300 &&
    provenance !== 'json_ld'
  ) {
    const lengthRatio =
      Math.max(normalized.length, ldDescription.length) /
      Math.max(1, Math.min(normalized.length, ldDescription.length));
    const jaccard = jaccardSimilarity(normalized, ldDescription);
    if (lengthRatio < 2.5 && jaccard < 0.22) {
      issues.push({ code: 'sources_diverge', severity: 'warn', jaccard });
      confidenceDelta -= 1;
    }
  }

  const shouldBlock = issues.some((issue) => issue.severity === 'error');

  return {
    passed: !shouldBlock,
    shouldBlock,
    confidenceDelta,
    issues,
    metrics: {
      length: normalized.length,
      keywordHits,
      blockCount,
      chromeMatchCount,
    },
  };
}
