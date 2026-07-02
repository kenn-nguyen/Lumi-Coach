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

  throw new Error(
    `Unable to parse JSON from model output.${describeJsonParseFailure(trimmed)}`,
  );
}

// Best-effort diagnostic appended to the parse-failure error: the underlying
// JSON.parse message plus a window of text around the reported position, so logs
// reveal exactly which character broke parsing (unescaped quote, stray char,
// truncation) instead of a generic failure.
function describeJsonParseFailure(text) {
  const candidate = sliceLikelyJsonBlock(text, null) ?? text;
  try {
    JSON.parse(candidate);
    return "";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const posMatch = message.match(/position (\d+)/);
    if (!posMatch) {
      return ` (${message})`;
    }
    const pos = Number(posMatch[1]);
    const start = Math.max(0, pos - 60);
    const end = Math.min(candidate.length, pos + 60);
    const snippet = candidate
      .slice(start, end)
      .replace(/\n/g, "\\n")
      .replace(/\t/g, "\\t");
    return ` (${message}; near: …${snippet}…)`;
  }
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

  // Last resort: repair the JSON corruptions ChatGPT's web UI commonly
  // introduces (smart/curly quotes substituted for ASCII quotes, exotic
  // whitespace, trailing commas) and retry. This runs ONLY after every strict
  // attempt above has already failed, so it can salvage otherwise-unparseable
  // web-automation output without a model round-trip, and can never alter a
  // response that already parsed cleanly.
  const repairedText = repairLenientJson(sanitizedText);

  // Build the repair candidates to try, widest-net last. The control-char
  // escaper handles the dominant remaining failure: the model emits a raw
  // newline / tab / CR INSIDE a string value (e.g. a multi-line bullet), which
  // JSON.parse rejects ("Bad control character in string literal"). It walks the
  // text tracking string state and escapes those chars only inside strings, so
  // it preserves content and can never corrupt already-valid JSON.
  const candidates = [repairedText];
  const controlEscaped = escapeRawControlCharsInStrings(repairedText);
  if (controlEscaped !== repairedText) {
    candidates.push(controlEscaped);
  }

  for (const candidate of candidates) {
    if (candidate === text || candidate === sanitizedText) {
      continue;
    }
    try {
      const parsed = JSON.parse(candidate);
      if (matchesValidator(parsed, validator)) {
        return parsed;
      }
    } catch {}

    const repairedSlice = sliceLikelyJsonBlock(candidate, validator);
    if (repairedSlice) {
      return JSON.parse(repairedSlice);
    }
  }

  return undefined;
}

// Escape raw control characters (newline, carriage return, tab) that appear
// INSIDE JSON string literals. Valid JSON requires these to be escaped (\n, \r,
// \t); LLM web output frequently emits them literally inside multi-line string
// values. Characters outside strings are untouched, so structural formatting is
// preserved and well-formed JSON passes through unchanged.
function escapeRawControlCharsInStrings(text) {
  if (typeof text !== "string" || !text) {
    return text;
  }

  let out = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (!inString) {
      if (char === '"') {
        inString = true;
      }
      out += char;
      continue;
    }

    if (escaped) {
      escaped = false;
      out += char;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      out += char;
      continue;
    }
    if (char === '"') {
      inString = false;
      out += char;
      continue;
    }
    if (char === "\n") {
      out += "\\n";
      continue;
    }
    if (char === "\r") {
      out += "\\r";
      continue;
    }
    if (char === "\t") {
      out += "\\t";
      continue;
    }
    out += char;
  }

  return out;
}

function repairLenientJson(text) {
  if (typeof text !== "string" || !text) {
    return text;
  }

  return (
    text
      // Zero-width and BOM characters (zero-width space/joiner, word joiner,
      // byte-order mark). These are invisible, never valid JSON syntax, and
      // LLM web output occasionally sprinkles them between tokens — a complete,
      // correct-looking response that still won't JSON.parse is the fingerprint.
      .replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, "")
      // Stray control characters (excluding tab/newline/CR, which are valid
      // JSON whitespace between tokens). Raw control chars are invalid JSON.
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      // Typographic double quotes -> straight ". The web UI substitutes these
      // for ASCII quotes when JSON is rendered outside a fenced code block,
      // which is the single most common reason JSON.parse fails on web output.
      .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
      // Typographic single quotes / primes -> straight '
      .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
      // Non-breaking and other exotic Unicode spaces -> normal space
      .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000\u2028\u2029]/g, " ")
      // Trailing commas before a closing brace or bracket. A comma inside a
      // string is followed by string content, not `}`/`]`, so this targets
      // only structural trailing commas. (We deliberately do NOT strip `//`
      // comments because that would corrupt URLs like "https://...".)
      .replace(/,(\s*[}\]])/g, "$1")
  );
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
