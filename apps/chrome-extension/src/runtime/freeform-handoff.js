const TRANSCRIPT_PREFIX_PATTERNS = [/^You said:\s*/i, /^Claude responded:\s*/i];
const TRANSCRIPT_NOISE_LINE_PATTERNS = [
  /^Show more$/i,
  /^\d{1,2}:\d{2}\s*(AM|PM)$/i,
];

function normalizeLineEndings(text) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function trimTrailingNoiseLines(lines) {
  const nextLines = [...lines];
  while (nextLines.length > 0) {
    const candidate = nextLines.at(-1)?.trim() || "";
    if (
      !candidate ||
      TRANSCRIPT_NOISE_LINE_PATTERNS.some((pattern) => pattern.test(candidate))
    ) {
      nextLines.pop();
      continue;
    }
    break;
  }
  return nextLines;
}

function findHeadingAnchorIndex(lines, expectedHeadings) {
  if (!Array.isArray(expectedHeadings) || expectedHeadings.length === 0) {
    return -1;
  }

  const normalizedHeadings = expectedHeadings
    .map((heading) => String(heading || "").trim())
    .filter(Boolean);
  if (normalizedHeadings.length === 0) {
    return -1;
  }

  const primaryHeading = normalizedHeadings[0];
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const trimmedLine = lines[index].trim();
    if (trimmedLine === primaryHeading) {
      return index;
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const trimmedLine = lines[index].trim();
    if (!trimmedLine) continue;
    if (normalizedHeadings.includes(trimmedLine)) {
      return index;
    }
  }
  return -1;
}

export function cleanFreeformHandoffText(rawText, options = {}) {
  const source =
    typeof rawText === "string" ? normalizeLineEndings(rawText).trim() : "";
  if (!source) return "";

  let cleaned = source;
  for (const pattern of TRANSCRIPT_PREFIX_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }

  let lines = cleaned
    .split("\n")
    .map((line) => line.trimEnd());

  const firstHeadingIndex = findHeadingAnchorIndex(
    lines,
    options.expectedHeadings,
  );
  if (firstHeadingIndex > 0) {
    lines = lines.slice(firstHeadingIndex);
  }

  lines = lines.filter(
    (line) =>
      !TRANSCRIPT_NOISE_LINE_PATTERNS.some((pattern) => pattern.test(line.trim())),
  );
  lines = trimTrailingNoiseLines(lines);

  return lines.join("\n").trim();
}
