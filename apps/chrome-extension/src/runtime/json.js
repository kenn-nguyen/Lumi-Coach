export function extractJsonFromText(rawText, options = {}) {
  const trimmed = rawText.trim();
  const validator = typeof options.validate === "function" ? options.validate : null;

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    const parsedFromFence = tryParseJson(fencedMatch[1], validator);
    if (parsedFromFence !== undefined) {
      return parsedFromFence;
    }
  }

  const parsed = tryParseJson(trimmed, validator);
  if (parsed !== undefined) {
    return parsed;
  }

  throw new Error("Unable to parse JSON from model output.");
}

export function extractPrompt3PayloadFromText(rawText) {
  const parsed = extractJsonFromText(rawText);
  const hasWrappedResumeData =
    parsed &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    parsed.resume_data &&
    typeof parsed.resume_data === "object" &&
    !Array.isArray(parsed.resume_data);

  if (!hasWrappedResumeData) {
    return {
      parsed,
      resumeData: parsed,
      generationFeedback: null,
      flexNotes: null,
      usedLegacyShape: true,
    };
  }

  return {
    parsed,
    resumeData: parsed.resume_data,
    generationFeedback: normalizeGenerationFeedback(parsed.generation_feedback),
    flexNotes: normalizeFlexibleNotes(parsed.flex_notes),
    usedLegacyShape: false,
  };
}

export function extractPrompt4ResumeDataFromText(rawText) {
  return extractPrompt4PayloadFromText(rawText).resumeData;
}

export function extractPrompt4PayloadFromText(rawText) {
  const parsed = extractJsonFromText(rawText);
  const hasWrappedResumeData =
    parsed &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    parsed.resume_data &&
    typeof parsed.resume_data === "object" &&
    !Array.isArray(parsed.resume_data);

  return {
    parsed,
    resumeData: hasWrappedResumeData ? parsed.resume_data : parsed,
    flexNotes: hasWrappedResumeData
      ? normalizeFlexibleNotes(parsed.flex_notes)
      : null,
    usedLegacyShape: !hasWrappedResumeData,
  };
}

function tryParseJson(text, validator) {
  try {
    const parsed = JSON.parse(text);
    if (matchesValidator(parsed, validator)) {
      return parsed;
    }
  } catch {}

  const directSlice = sliceLikelyJsonBlock(text, validator);
  if (directSlice) {
    return JSON.parse(directSlice);
  }

  const sanitizedText = sanitizeHtmlArtifacts(text);
  if (sanitizedText !== text) {
    try {
      const parsed = JSON.parse(sanitizedText);
      if (matchesValidator(parsed, validator)) {
        return parsed;
      }
    } catch {}

    const sanitizedSlice = sliceLikelyJsonBlock(sanitizedText, validator);
    if (sanitizedSlice) {
      return JSON.parse(sanitizedSlice);
    }
  }

  return undefined;
}

function normalizeGenerationFeedback(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const summary = typeof value.summary === "string" ? value.summary.trim() : "";
  const pros = normalizeFeedbackItems(value.pros);
  const cons = normalizeFeedbackItems(value.cons);
  const caveats = normalizeFeedbackItems(value.caveats);
  const promptSetup = normalizePromptSetup(value.prompt_setup);

  if (
    !summary &&
    pros.length === 0 &&
    cons.length === 0 &&
    caveats.length === 0 &&
    !promptSetup
  ) {
    return null;
  }

  return {
    summary,
    pros,
    cons,
    caveats,
    ...(promptSetup ? { prompt_setup: promptSetup } : {}),
  };
}

function normalizePromptSetup(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const promptProfileId =
    typeof value.prompt_profile_id === "string"
      ? value.prompt_profile_id.trim()
      : "";
  const prompt3VersionId =
    typeof value.prompt3_version_id === "string"
      ? value.prompt3_version_id.trim()
      : "";
  const systemPromptVersionId =
    typeof value.system_prompt_version_id === "string"
      ? value.system_prompt_version_id.trim()
      : "";

  if (!promptProfileId && !prompt3VersionId && !systemPromptVersionId) {
    return null;
  }

  return {
    prompt_profile_id: promptProfileId || null,
    prompt3_version_id: prompt3VersionId || null,
    system_prompt_version_id: systemPromptVersionId || null,
  };
}

function normalizeFlexibleNotes(value) {
  if (typeof value !== "string") {
    return null;
  }
  return value.trim() || null;
}

function normalizeFeedbackItems(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function matchesValidator(parsed, validator) {
  if (!validator) {
    return true;
  }

  try {
    return validator(parsed) === true;
  } catch {
    return false;
  }
}

function sliceLikelyJsonBlock(text, validator) {
  const objectSlice = findBalancedJsonSlice(text, "{", "}", validator);
  if (objectSlice) {
    return objectSlice;
  }

  const arraySlice = findBalancedJsonSlice(text, "[", "]", validator);
  if (arraySlice) {
    return arraySlice;
  }

  return null;
}

function findBalancedJsonSlice(text, openChar, closeChar, validator) {
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
        if (char === "\\") {
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
            const parsed = JSON.parse(candidate);
            if (matchesValidator(parsed, validator)) {
              return candidate;
            }
          } catch {
            continue;
          }
        }
      }
    }
  }

  return null;
}

function sanitizeHtmlArtifacts(text) {
  let sanitized = typeof text === "string" ? text : "";
  if (!sanitized) {
    return sanitized;
  }

  sanitized = sanitized
    .replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, "$1")
    .replace(/<\/?(?:div|p|span|strong|em|code|pre|br)\b[^>]*>/gi, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  return sanitized;
}
