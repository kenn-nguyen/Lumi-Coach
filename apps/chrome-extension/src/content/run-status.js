export const ACTIVE_REHYDRATABLE_SESSION_STATUSES = new Set([
  "starting",
  "bootstrap_master",
  "scraped",
  "prompt1_done",
  "prompt2_done",
  "prompt3_done",
  "validated",
  "canceling",
]);

export function createExplicitRunStatus(
  kind,
  tone,
  title,
  detail = "",
  actions = [],
) {
  if (!kind || kind === "none") {
    return null;
  }

  return {
    kind,
    tone: tone || "neutral",
    title: title || "",
    detail: detail || "",
    actions: Array.isArray(actions) ? actions : [],
  };
}

export function resolveRunStatusBox({
  explicitStatus = null,
  preflightStatus = null,
  runningDetail = "",
} = {}) {
  if (explicitStatus?.kind && explicitStatus.kind !== "none") {
    return {
      ...explicitStatus,
      detail:
        explicitStatus.kind === "running" && runningDetail
          ? runningDetail
          : explicitStatus.detail || "",
      actions: Array.isArray(explicitStatus.actions)
        ? explicitStatus.actions
        : [],
    };
  }

  if (preflightStatus) {
    return {
      kind: "preflight",
      actions: Array.isArray(preflightStatus.actions)
        ? preflightStatus.actions
        : [],
      ...preflightStatus,
    };
  }

  return null;
}

export function shouldRotateRunningStatus(explicitStatus) {
  return explicitStatus?.kind === "running";
}

export function shouldClearExplicitStatusOnJobChange(explicitStatus) {
  return ["success", "error", "interrupted", "canceled"].includes(
    explicitStatus?.kind || "",
  );
}

export function isRehydratableExtensionSessionStatus(status) {
  return ACTIVE_REHYDRATABLE_SESSION_STATUSES.has(String(status || "").trim());
}
