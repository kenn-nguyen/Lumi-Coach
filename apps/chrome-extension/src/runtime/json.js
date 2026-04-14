export function extractJsonFromText(rawText) {
  const trimmed = rawText.trim();

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    return tryParseJson(fencedMatch[1]);
  }

  return tryParseJson(trimmed);
}

export function extractPrompt3PayloadFromText(rawText) {
  const parsed = extractJsonFromText(rawText);
  const hasWrappedResumeData =
    parsed &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed) &&
    parsed.resume_data &&
    typeof parsed.resume_data === 'object' &&
    !Array.isArray(parsed.resume_data);

  if (!hasWrappedResumeData) {
    return {
      parsed,
      resumeData: parsed,
      generationFeedback: null,
      usedLegacyShape: true,
    };
  }

  return {
    parsed,
    resumeData: parsed.resume_data,
    generationFeedback: normalizeGenerationFeedback(parsed.generation_feedback),
    usedLegacyShape: false,
  };
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const directSlice = sliceLikelyJsonBlock(text);
    if (directSlice) {
      return JSON.parse(directSlice);
    }
    const sanitizedText = sanitizeHtmlArtifacts(text);
    if (sanitizedText !== text) {
      try {
        return JSON.parse(sanitizedText);
      } catch {
        const sanitizedSlice = sliceLikelyJsonBlock(sanitizedText);
        if (sanitizedSlice) {
          return JSON.parse(sanitizedSlice);
        }
      }
    }
    throw new Error('Unable to parse JSON from model output.');
  }
}

function normalizeGenerationFeedback(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const summary = typeof value.summary === 'string' ? value.summary.trim() : '';
  const pros = normalizeFeedbackItems(value.pros);
  const cons = normalizeFeedbackItems(value.cons);
  const caveats = normalizeFeedbackItems(value.caveats);

  if (!summary && pros.length === 0 && cons.length === 0 && caveats.length === 0) {
    return null;
  }

  return {
    summary,
    pros,
    cons,
    caveats,
  };
}

function normalizeFeedbackItems(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function sliceLikelyJsonBlock(text) {
  const objectSlice = findBalancedJsonSlice(text, '{', '}');
  if (objectSlice) {
    return objectSlice;
  }

  const arraySlice = findBalancedJsonSlice(text, '[', ']');
  if (arraySlice) {
    return arraySlice;
  }

  return null;
}

function findBalancedJsonSlice(text, openChar, closeChar) {
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== openChar) continue;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < text.length; index += 1) {
      const char = text[index];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === '\\') {
          escaped = true;
          continue;
        }
        if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === openChar) {
        depth += 1;
        continue;
      }

      if (char === closeChar) {
        depth -= 1;
        if (depth === 0) {
          const candidate = text.slice(start, index + 1).trim();
          try {
            JSON.parse(candidate);
            return candidate;
          } catch {
            break;
          }
        }
      }
    }
  }

  return null;
}

function sanitizeHtmlArtifacts(text) {
  let sanitized = typeof text === 'string' ? text : '';
  if (!sanitized) {
    return sanitized;
  }

  sanitized = sanitized
    .replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1')
    .replace(/<\/?(?:div|p|span|strong|em|code|pre|br)\b[^>]*>/gi, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  return sanitized;
}
