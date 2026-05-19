import { describe, expect, it } from "vitest";
import {
  canonicalizeLinkedInJobUrl,
  classifyLinkedInJobsRoute,
  extractLinkedInJobIdFromUrl,
  isLinkedInJobsShellUrl,
  LINKEDIN_ROUTE_MODE,
} from "./linkedin-route.js";

describe("isLinkedInJobsShellUrl", () => {
  it("matches LinkedIn jobs shell URLs including the exact root path", () => {
    expect(isLinkedInJobsShellUrl("https://www.linkedin.com/jobs")).toBe(true);
    expect(isLinkedInJobsShellUrl("https://www.linkedin.com/jobs/")).toBe(true);
    expect(
      isLinkedInJobsShellUrl(
        "https://www.linkedin.com/jobs/collections/recommended/?currentJobId=1",
      ),
    ).toBe(true);
  });

  it("rejects non-jobs or non-LinkedIn URLs", () => {
    expect(isLinkedInJobsShellUrl("https://www.linkedin.com/feed/")).toBe(false);
    expect(isLinkedInJobsShellUrl("https://example.com/jobs")).toBe(false);
  });
});

describe("classifyLinkedInJobsRoute", () => {
  it("classifies the exact jobs root as manual", () => {
    expect(
      classifyLinkedInJobsRoute("https://www.linkedin.com/jobs").mode,
    ).toBe(LINKEDIN_ROUTE_MODE.manual);
  });

  it("classifies jobs search pages without a selected job as waiting", () => {
    const route = classifyLinkedInJobsRoute(
      "https://www.linkedin.com/jobs/search/?keywords=product",
    );
    expect(route.mode).toBe(LINKEDIN_ROUTE_MODE.waiting);
    expect(route.isBrowsingSurface).toBe(true);
    expect(route.isSelectedJob).toBe(false);
  });

  it("classifies collection pages without a selected job as waiting", () => {
    const route = classifyLinkedInJobsRoute(
      "https://www.linkedin.com/jobs/collections/top-startups/",
    );
    expect(route.mode).toBe(LINKEDIN_ROUTE_MODE.waiting);
    expect(route.isBrowsingSurface).toBe(true);
  });

  it("classifies currentJobId URLs as active", () => {
    const route = classifyLinkedInJobsRoute(
      "https://www.linkedin.com/jobs/search/?currentJobId=4271361827",
    );
    expect(route.mode).toBe(LINKEDIN_ROUTE_MODE.active);
    expect(route.selectedJobId).toBe("4271361827");
    expect(route.canonicalJobUrl).toBe(
      "https://www.linkedin.com/jobs/view/4271361827/",
    );
  });

  it("classifies canonical view URLs as active", () => {
    const route = classifyLinkedInJobsRoute(
      "https://www.linkedin.com/jobs/view/4394207970/",
    );
    expect(route.mode).toBe(LINKEDIN_ROUTE_MODE.active);
    expect(route.selectedJobId).toBe("4394207970");
  });

  it("classifies slugged view URLs as active", () => {
    const route = classifyLinkedInJobsRoute(
      "https://www.linkedin.com/jobs/view/product-manager-commerce-systems-at-stripe-4413483608/?trk=public_jobs_topcard-title",
    );
    expect(route.mode).toBe(LINKEDIN_ROUTE_MODE.active);
    expect(route.selectedJobId).toBe("4413483608");
    expect(route.canonicalJobUrl).toBe(
      "https://www.linkedin.com/jobs/view/4413483608/",
    );
  });

  it("classifies non-jobs LinkedIn pages as manual", () => {
    const route = classifyLinkedInJobsRoute(
      "https://www.linkedin.com/feed/",
    );
    expect(route.mode).toBe(LINKEDIN_ROUTE_MODE.manual);
    expect(route.isJobsShell).toBe(false);
  });

  it("classifies non-LinkedIn websites as manual", () => {
    const route = classifyLinkedInJobsRoute("https://example.com/careers");
    expect(route.mode).toBe(LINKEDIN_ROUTE_MODE.manual);
    expect(route.isJobsShell).toBe(false);
  });
});

describe("LinkedIn job URL helpers", () => {
  it("extracts a job id from slugged LinkedIn view URLs", () => {
    expect(
      extractLinkedInJobIdFromUrl(
        "https://www.linkedin.com/jobs/view/product-manager-commerce-systems-at-stripe-4413483608/?trk=public_jobs_topcard-title",
      ),
    ).toBe("4413483608");
  });

  it("canonicalizes slugged LinkedIn view URLs", () => {
    expect(
      canonicalizeLinkedInJobUrl(
        "https://www.linkedin.com/jobs/view/product-manager-commerce-systems-at-stripe-4413483608/?trk=public_jobs_topcard-title",
      ),
    ).toBe("https://www.linkedin.com/jobs/view/4413483608/");
  });
});
