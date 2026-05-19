export const LINKEDIN_ROUTE_MODE = Object.freeze({
  hidden: "hidden",
  manual: "manual",
  waiting: "waiting",
  active: "active",
});

function normalizeNumericId(value) {
  const trimmed = String(value || "").trim();
  return /^\d+$/.test(trimmed) ? trimmed : "";
}

function extractJobIdFromViewPath(pathname) {
  const match = String(pathname || "").match(/^\/jobs\/view\/([^/?#]+)\/?$/);
  const slugOrId = match?.[1] || "";
  const trailingIdMatch = slugOrId.match(/(\d+)$/);
  return normalizeNumericId(trailingIdMatch?.[1]);
}

export function extractLinkedInJobIdFromUrl(urlValue) {
  try {
    const parsed = new URL(urlValue);
    const currentJobId = normalizeNumericId(
      parsed.searchParams.get("currentJobId"),
    );
    return currentJobId || extractJobIdFromViewPath(parsed.pathname);
  } catch {
    return "";
  }
}

export function canonicalizeLinkedInJobUrl(urlValue) {
  try {
    const parsed = new URL(urlValue);
    const selectedJobId = extractLinkedInJobIdFromUrl(parsed.href);
    return selectedJobId
      ? `${parsed.origin}/jobs/view/${selectedJobId}/`
      : "";
  } catch {
    return "";
  }
}

export function isLinkedInJobsShellUrl(urlValue) {
  try {
    const parsed = new URL(urlValue);
    return (
      parsed.hostname === "www.linkedin.com" &&
      parsed.pathname.startsWith("/jobs")
    );
  } catch {
    return false;
  }
}

export function classifyLinkedInJobsRoute(urlValue) {
  const fallback = {
    mode: LINKEDIN_ROUTE_MODE.manual,
    isJobsShell: false,
    isBrowsingSurface: false,
    isSelectedJob: false,
    selectedJobId: "",
    canonicalJobUrl: "",
    url: String(urlValue || ""),
  };

  try {
    const parsed = new URL(urlValue);
    if (
      parsed.hostname !== "www.linkedin.com" ||
      !parsed.pathname.startsWith("/jobs")
    ) {
      return fallback;
    }

    const selectedJobId = extractLinkedInJobIdFromUrl(parsed.href);
    const canonicalJobUrl = canonicalizeLinkedInJobUrl(parsed.href);

    if (selectedJobId) {
      return {
        mode: LINKEDIN_ROUTE_MODE.active,
        isJobsShell: true,
        isBrowsingSurface: false,
        isSelectedJob: true,
        selectedJobId,
        canonicalJobUrl,
        url: parsed.href,
      };
    }

    const isRoot = parsed.pathname === "/jobs" || parsed.pathname === "/jobs/";
    const isBrowsingSurface =
      parsed.pathname.startsWith("/jobs/search") ||
      parsed.pathname.startsWith("/jobs/collections/");

    return {
      mode:
        !isRoot && isBrowsingSurface
          ? LINKEDIN_ROUTE_MODE.waiting
          : LINKEDIN_ROUTE_MODE.manual,
      isJobsShell: true,
      isBrowsingSurface,
      isSelectedJob: false,
      selectedJobId: "",
      canonicalJobUrl: "",
      url: parsed.href,
    };
  } catch {
    return fallback;
  }
}
