import { describe, expect, it } from "vitest";

import {
  createExplicitRunStatus,
  isRehydratableExtensionSessionStatus,
  resolveRunStatusBox,
  shouldClearExplicitStatusOnJobChange,
  shouldRotateRunningStatus,
} from "./run-status.js";

describe("run-status", () => {
  it("hides the box when there is no explicit or preflight status", () => {
    expect(resolveRunStatusBox()).toBeNull();
  });

  it("returns preflight status when no explicit status exists", () => {
    expect(
      resolveRunStatusBox({
        preflightStatus: {
          tone: "info",
          title: "Loading job",
          detail: "Waiting for enough job details to start.",
          actions: [],
        },
      }),
    ).toEqual({
      kind: "preflight",
      tone: "info",
      title: "Loading job",
      detail: "Waiting for enough job details to start.",
      actions: [],
    });
  });

  it("prefers explicit running status over passive preflight state", () => {
    const explicit = createExplicitRunStatus(
      "running",
      "running",
      "Resume draft",
      "Writing the tailored resume.",
    );

    expect(
      resolveRunStatusBox({
        explicitStatus: explicit,
        preflightStatus: {
          tone: "blocked",
          title: "Finish setup",
          detail: "Finish setup to continue.",
          actions: [{ id: "open_settings", label: "Open settings" }],
        },
        runningDetail: "Sharpening the strongest bullets.",
      }),
    ).toEqual({
      kind: "running",
      tone: "running",
      title: "Resume draft",
      detail: "Sharpening the strongest bullets.",
      actions: [],
    });
  });

  it("keeps interrupted and error states sticky over preflight changes", () => {
    const interrupted = createExplicitRunStatus(
      "interrupted",
      "warning",
      "Story bank missing",
      "Continue without a story bank?",
      [{ id: "continue-storyboard", label: "Continue" }],
    );
    const error = createExplicitRunStatus(
      "error",
      "error",
      "Run failed",
      "The draft came back in the wrong format. Try again.",
    );

    expect(
      resolveRunStatusBox({
        explicitStatus: interrupted,
        preflightStatus: {
          tone: "info",
          title: "Loading job",
          detail: "Waiting for enough job details to start.",
        },
      }),
    ).toMatchObject({
      kind: "interrupted",
      tone: "warning",
      title: "Story bank missing",
    });

    expect(
      resolveRunStatusBox({
        explicitStatus: error,
        preflightStatus: {
          tone: "blocked",
          title: "Finish setup",
          detail: "Finish setup to continue.",
        },
      }),
    ).toMatchObject({
      kind: "error",
      tone: "error",
      title: "Run failed",
    });
  });

  it("marks only running statuses for rotation", () => {
    expect(
      shouldRotateRunningStatus(
        createExplicitRunStatus(
          "running",
          "running",
          "Role fit check",
          "Reading the role.",
        ),
      ),
    ).toBe(true);
    expect(
      shouldRotateRunningStatus(
        createExplicitRunStatus(
          "success",
          "success",
          "Opening workspace",
          "Opening your resume.",
        ),
      ),
    ).toBe(false);
  });

  it("clears only sticky terminal and interrupted statuses on job change", () => {
    expect(
      shouldClearExplicitStatusOnJobChange(
        createExplicitRunStatus(
          "success",
          "success",
          "Opening workspace",
          "Opening your resume.",
        ),
      ),
    ).toBe(true);
    expect(
      shouldClearExplicitStatusOnJobChange(
        createExplicitRunStatus(
          "error",
          "error",
          "Run failed",
          "Try again.",
        ),
      ),
    ).toBe(true);
    expect(
      shouldClearExplicitStatusOnJobChange(
        createExplicitRunStatus(
          "interrupted",
          "warning",
          "Story bank missing",
          "Continue without story bank?",
        ),
      ),
    ).toBe(true);
    expect(
      shouldClearExplicitStatusOnJobChange(
        createExplicitRunStatus(
          "canceled",
          "info",
          "Run canceled",
          "Stopped before preview handoff.",
        ),
      ),
    ).toBe(true);
    expect(
      shouldClearExplicitStatusOnJobChange(
        createExplicitRunStatus(
          "running",
          "running",
          "Resume draft",
          "Writing the tailored resume.",
        ),
      ),
    ).toBe(false);
  });

  it("rehydrates only active in-progress extension session statuses", () => {
    expect(isRehydratableExtensionSessionStatus("starting")).toBe(true);
    expect(isRehydratableExtensionSessionStatus("canceling")).toBe(true);
    expect(isRehydratableExtensionSessionStatus("prompt2_done")).toBe(true);
    expect(isRehydratableExtensionSessionStatus("validated")).toBe(true);
    expect(isRehydratableExtensionSessionStatus("canceled")).toBe(false);
    expect(isRehydratableExtensionSessionStatus("patched")).toBe(false);
    expect(isRehydratableExtensionSessionStatus("error")).toBe(false);
  });
});
