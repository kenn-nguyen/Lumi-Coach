import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(__dirname, "../manifest.json");

function readManifest() {
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

describe("manifest content script scope", () => {
  it("auto-loads the floating extension only on LinkedIn", () => {
    const manifest = readManifest();

    expect(manifest.content_scripts).toHaveLength(1);
    expect(manifest.content_scripts[0].matches).toEqual([
      "https://www.linkedin.com/*",
    ]);
  });
});
