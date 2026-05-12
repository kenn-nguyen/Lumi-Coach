import { beforeEach, describe, expect, it, vi } from "vitest";

import { deriveAccountKeyFromUser } from "./account.js";
import { STORAGE_KEYS } from "./constants.js";
import {
  activateAccountWorkspace,
  applyServerPromptDefaultsSyncResult,
  clearAllExtensionLocalData,
  clearExtensionAuth,
  clearExtensionLocalData,
  getActiveAccountKey,
  getExtensionState,
  getPendingExtensionAction,
  getServerPromptDefaults,
  getUserAssets,
  setExtensionState,
  setPromptTemplateAsset,
  setExtensionAuth,
  setMasterResumeContextAsset,
  setPendingExtensionAction,
} from "./storage.js";

function createChromeMock(initialValues = {}) {
  const store = new Map(Object.entries(initialValues));

  const readKeys = (keys) => {
    if (keys == null) {
      return Object.fromEntries(store.entries());
    }

    const keyList = Array.isArray(keys) ? keys : [keys];
    const result = {};
    for (const key of keyList) {
      result[key] = store.get(key);
    }
    return result;
  };

  return {
    store,
    chrome: {
      storage: {
        local: {
          get: vi.fn(async (keys) => readKeys(keys)),
          set: vi.fn(async (values) => {
            Object.entries(values || {}).forEach(([key, value]) => {
              store.set(key, value);
            });
          }),
          remove: vi.fn(async (keys) => {
            const keyList = Array.isArray(keys) ? keys : [keys];
            keyList.forEach((key) => store.delete(key));
          }),
          getBytesInUse: vi.fn(async (keys) => {
            const values = readKeys(keys);
            return new TextEncoder().encode(JSON.stringify(values)).length;
          }),
        },
      },
      action: {
        setBadgeText: vi.fn(async () => {}),
        setBadgeBackgroundColor: vi.fn(async () => {}),
        setTitle: vi.fn(async () => {}),
      },
    },
  };
}

const userA = {
  id: "user-a",
  email: "alpha@example.com",
  name: "Alpha",
};
const userB = {
  id: "user-b",
  email: "beta@example.com",
  name: "Beta",
};
const userASameEmailDifferentId = {
  id: "user-a-new-session-id",
  email: "alpha@example.com",
  name: "Alpha",
};

function createAuth(user) {
  return {
    token: `token-${user.id}`,
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    user,
    connectedAt: new Date().toISOString(),
  };
}

beforeEach(() => {
  const chromeMock = createChromeMock();
  vi.stubGlobal("chrome", chromeMock.chrome);
});

describe("account-scoped extension storage", () => {
  it("migrates legacy shared data into the authenticated account workspace", async () => {
    const legacyChrome = createChromeMock({
      [STORAGE_KEYS.extensionAuth]: createAuth(userA),
      [STORAGE_KEYS.masterResumeContextAsset]: {
        filename: "alpha-resume.md",
        content: "# Alpha",
      },
      [STORAGE_KEYS.storyboardAsset]: {
        filename: "alpha-story.md",
        content: "Story",
      },
    });
    vi.stubGlobal("chrome", legacyChrome.chrome);

    const accountKey = deriveAccountKeyFromUser(userA);
    await activateAccountWorkspace(userA);

    const assets = await getUserAssets();
    expect(assets.activeAccountKey).toBe(accountKey);
    expect(assets.masterResumeContextAsset?.filename).toBe("alpha-resume.md");
    expect(assets.storyboardAsset?.filename).toBe("alpha-story.md");
    expect(legacyChrome.store.has(STORAGE_KEYS.masterResumeContextAsset)).toBe(
      false,
    );
    expect(
      legacyChrome.store.get(
        `account::${accountKey}::${STORAGE_KEYS.masterResumeContextAsset}`,
      ),
    ).toEqual({
      filename: "alpha-resume.md",
      content: "# Alpha",
    });
  });

  it("keeps local workspaces isolated when switching accounts", async () => {
    await setExtensionAuth(createAuth(userA));
    await activateAccountWorkspace(userA);
    await setMasterResumeContextAsset({
      filename: "alpha-resume.md",
      content: "# Alpha",
    });

    await setExtensionAuth(createAuth(userB));
    await activateAccountWorkspace(userB);
    expect((await getUserAssets()).masterResumeContextAsset).toBeNull();

    await setMasterResumeContextAsset({
      filename: "beta-resume.md",
      content: "# Beta",
    });

    await setExtensionAuth(createAuth(userA));
    await activateAccountWorkspace(userA);
    expect((await getUserAssets()).masterResumeContextAsset?.filename).toBe(
      "alpha-resume.md",
    );

    await setExtensionAuth(createAuth(userB));
    await activateAccountWorkspace(userB);
    expect((await getUserAssets()).masterResumeContextAsset?.filename).toBe(
      "beta-resume.md",
    );
  });

  it("does not carry a pending action across accounts after sign-out", async () => {
    await setExtensionAuth(createAuth(userA));
    await activateAccountWorkspace(userA);
    await setPendingExtensionAction({
      type: "generate_active_job",
      tabId: 17,
      activeRunJob: { title: "Alpha role" },
    });

    await clearExtensionAuth();
    await setExtensionAuth(createAuth(userB));
    await activateAccountWorkspace(userB);

    expect(await getPendingExtensionAction()).toBeNull();
  });

  it("reuses the same workspace when the same email signs back in with a different id", async () => {
    await setExtensionAuth(createAuth(userA));
    await activateAccountWorkspace(userA);
    await setMasterResumeContextAsset({
      filename: "alpha-resume.md",
      content: "# Alpha",
    });

    await clearExtensionAuth();

    await setExtensionAuth(createAuth(userASameEmailDifferentId));
    await activateAccountWorkspace(userASameEmailDifferentId);

    expect((await getUserAssets()).masterResumeContextAsset?.filename).toBe(
      "alpha-resume.md",
    );
    expect(await getActiveAccountKey()).toBe("email:alpha%40example.com");
  });

  it("clears only the active account data unless the browser-wide reset is used", async () => {
    await setExtensionAuth(createAuth(userA));
    await activateAccountWorkspace(userA);
    await setMasterResumeContextAsset({
      filename: "alpha-resume.md",
      content: "# Alpha",
    });

    await setExtensionAuth(createAuth(userB));
    await activateAccountWorkspace(userB);
    await setMasterResumeContextAsset({
      filename: "beta-resume.md",
      content: "# Beta",
    });

    await clearExtensionLocalData();
    expect((await getUserAssets()).masterResumeContextAsset).toBeNull();

    await setExtensionAuth(createAuth(userA));
    await activateAccountWorkspace(userA);
    expect((await getUserAssets()).masterResumeContextAsset?.filename).toBe(
      "alpha-resume.md",
    );

    await clearAllExtensionLocalData();
    expect(await getActiveAccountKey()).toBeNull();
    expect((await getUserAssets()).masterResumeContextAsset).toBeNull();
    expect((await getUserAssets()).extensionAuth).toBeNull();
  });

  it("stores only a small extension checkpoint locally", async () => {
    const chromeMock = createChromeMock();
    vi.stubGlobal("chrome", chromeMock.chrome);

    await setExtensionAuth(createAuth(userA));
    await activateAccountWorkspace(userA);

    await setExtensionState({
      sessionId: "run-123",
      status: "prompt2_done",
      jobSnapshot: {
        source: "linkedin_dom",
        sourceUrl: "https://www.linkedin.com/jobs/view/123/",
        title: "Senior PM",
        company: "Acme",
        location: "Remote",
        rawText: "very long job description",
        diagnostics: { huge: true },
        quality: { confidence: "high", descriptionLength: 1234 },
      },
      resumeSource: "very long resume markdown",
      prompt1Input: "prompt 1 input",
      prompt1Raw: "{\"raw\":true}",
      prompt1Result: { parsed: true },
      patchPayload: { huge: true },
      prompt3ValidationErrors: ["bad field"],
      patchError: "Something failed",
    });

    const extensionState = await getExtensionState();
    const accountKey = await getActiveAccountKey();
    const storedState = chromeMock.store.get(
      `account::${accountKey}::${STORAGE_KEYS.extensionSession}`,
    );
    expect(extensionState.sessionId).toBe("run-123");
    expect(extensionState.jobSnapshot?.title).toBe("Senior PM");
    expect(extensionState.jobSnapshot).not.toHaveProperty("rawText");
    expect(extensionState.prompt3ValidationErrors).toEqual(["bad field"]);
    expect(storedState).not.toHaveProperty("prompt1Input");
    expect(storedState).not.toHaveProperty("resumeSource");
    expect(storedState).not.toHaveProperty("patchPayload");
  });

  it("compacts oversized local storage before writing new checkpoints", async () => {
    const chromeMock = createChromeMock();
    vi.stubGlobal("chrome", chromeMock.chrome);

    await setExtensionAuth(createAuth(userA));
    await activateAccountWorkspace(userA);
    const accountKey = await getActiveAccountKey();
    const sessionKey = `account::${accountKey}::${STORAGE_KEYS.extensionSession}`;

    chromeMock.store.set(sessionKey, {
      sessionId: "run-legacy",
      prompt1Raw: "x".repeat(500_000),
      resumeSource: "y".repeat(500_000),
    });

    await setExtensionState({
      sessionId: "run-next",
      status: "scraped",
    });

    const storedState = chromeMock.store.get(sessionKey);

    expect(storedState.sessionId).toBe("run-next");
    expect(storedState).not.toHaveProperty("prompt1Raw");
    expect(storedState).not.toHaveProperty("resumeSource");
  });

  it("stores server-managed prompt artifacts separately from user overrides", async () => {
    await setExtensionAuth(createAuth(userA));
    await activateAccountWorkspace(userA);

    const syncResult = await applyServerPromptDefaultsSyncResult({
      changed: {
        "prompt1.template": "SERVER PROMPT 1",
        "system.guardrails": "SERVER SYSTEM",
      },
      removed: [],
      manifest: {
        "prompt1.template": "hash-1",
        "system.guardrails": "hash-2",
      },
    });

    expect(syncResult.changedKeys).toEqual([
      "prompt1.template",
      "system.guardrails",
    ]);
    expect(await getServerPromptDefaults()).toEqual({
      artifacts: {
        "prompt1.template": "SERVER PROMPT 1",
        "system.guardrails": "SERVER SYSTEM",
      },
      manifest: {
        "prompt1.template": "hash-1",
        "system.guardrails": "hash-2",
      },
      lastSyncedAt: expect.any(String),
    });
    expect((await getUserAssets()).prompt1TemplateAsset).toBeNull();
  });

  it("stores profile-scoped system prompt body overrides", async () => {
    await setExtensionAuth(createAuth(userA));
    await activateAccountWorkspace(userA);

    await setPromptTemplateAsset("systemPrompt", {
      filename: "system.txt",
      content: "override",
    });

    expect((await getUserAssets()).systemPromptTemplateAsset).toMatchObject({
      filename: "system.txt",
      content: "override",
    });
  });

  it("removes deleted server-managed prompt artifacts during sync", async () => {
    await setExtensionAuth(createAuth(userA));
    await activateAccountWorkspace(userA);
    await applyServerPromptDefaultsSyncResult({
      changed: {
        "prompt1.template": "SERVER PROMPT 1",
        "prompt1.output_contract": "CONTRACT",
      },
      removed: [],
      manifest: {
        "prompt1.template": "hash-1",
        "prompt1.output_contract": "hash-2",
      },
    });

    const syncResult = await applyServerPromptDefaultsSyncResult({
      changed: {},
      removed: ["prompt1.output_contract"],
      manifest: {
        "prompt1.template": "hash-1",
      },
    });

    expect(syncResult.changedKeys).toContain("prompt1.output_contract");
    expect((await getServerPromptDefaults()).artifacts).toEqual({
      "prompt1.template": "SERVER PROMPT 1",
    });
  });
});
