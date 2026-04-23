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

    const currentJobId = normalizeNumericId(
      parsed.searchParams.get("currentJobId"),
    );
    const viewMatch = parsed.pathname.match(/^\/jobs\/view\/(\d+)\/?$/);
    const selectedJobId = viewMatch?.[1] || currentJobId;
    const canonicalJobUrl = selectedJobId
      ? `${parsed.origin}/jobs/view/${selectedJobId}/`
      : "";

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
