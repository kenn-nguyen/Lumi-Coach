export function qaCheckDescription(
  text,
  {
    expandedAttempted = false,
    expandedSucceeded = false,
    textLengthBefore = 0,
    textLengthAfter = 0,
  } = {},
) {
  const normalized = (text || "").replace(/\s+/g, " ").trim();
  const issues = [];
  let confidenceDelta = 0;

  if (normalized.length < 120) {
    issues.push({ code: "too_short", severity: "error" });
    return {
      passed: false,
      shouldBlock: true,
      confidenceDelta: -2,
      issues,
      metrics: {
        length: normalized.length,
        expandedAttempted,
        expandedSucceeded,
        textLengthBefore,
        textLengthAfter,
      },
    };
  }

  if (normalized.length < 400) {
    issues.push({ code: "short_description", severity: "warn" });
    confidenceDelta -= 1;
  }

  if (
    expandedAttempted &&
    !expandedSucceeded &&
    textLengthAfter <= textLengthBefore
  ) {
    issues.push({ code: "expand_no_gain", severity: "warn" });
    if (normalized.length < 2000) {
      confidenceDelta -= 1;
    }
  }

  return {
    passed: true,
    shouldBlock: false,
    confidenceDelta,
    issues,
    metrics: {
      length: normalized.length,
      expandedAttempted,
      expandedSucceeded,
      textLengthBefore,
      textLengthAfter,
    },
  };
}
