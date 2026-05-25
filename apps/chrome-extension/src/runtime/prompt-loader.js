import { getUserAssets, getServerPromptDefaults } from "./storage.js";
import {
  getDefaultPromptTemplateArtifactKey,
  getPromptArtifactDefinition,
  getPackagedPromptArtifactText,
  getPromptOutputContractArtifactKey,
  getPromptOverrideAssetField,
  getPromptTemplateArtifactKey,
  shouldAppendSharedPromptOutputContract,
  SYSTEM_GUARDRAILS_ARTIFACT_KEY,
} from "./prompt-defaults.js";

const PLACEHOLDER_PATTERN = /\{\{([A-Z0-9_]+)\}\}/g;
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const templateCache = new Map();

export function clearPromptTemplateCache() {
  templateCache.clear();
}

function fallbackHashText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export async function hashPromptText(text) {
  const normalized = typeof text === "string" ? text : "";
  const subtle = globalThis.crypto?.subtle;
  if (!subtle || typeof TextEncoder === "undefined") {
    return fallbackHashText(normalized);
  }

  const digest = await subtle.digest(
    "SHA-256",
    new TextEncoder().encode(normalized),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getTemplateCacheKey(templateName, promptProfileId, promptDefaultsMode) {
  const profileKey = promptProfileId || "profile1";
  const defaultsModeKey = promptDefaultsMode || "server";
  return `${templateName}:${profileKey}:${defaultsModeKey}`;
}

function parsePromptFrontmatter(rawContent) {
  const text =
    typeof rawContent === "string" ? rawContent.replace(/^\uFEFF/, "") : "";
  const frontmatterMatch = FRONTMATTER_PATTERN.exec(text);
  if (!frontmatterMatch) {
    return { body: text, frontmatter: {} };
  }

  const rawFrontmatter = frontmatterMatch[1];
  const body = text.slice(frontmatterMatch[0].length);
  const frontmatter = {};

  for (const line of rawFrontmatter.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (!key) continue;

    frontmatter[key] = rawValue.replace(/^["']|["']$/g, "");
  }

  return { body, frontmatter };
}

function addFrontmatterMetadata(metadata, frontmatter) {
  if (!frontmatter || !Object.keys(frontmatter).length) {
    return metadata;
  }

  return {
    ...metadata,
    promptArtifact: frontmatter.prompt_artifact ?? null,
    promptVersion: frontmatter.prompt_version ?? null,
    promptLabel: frontmatter.prompt_label ?? null,
    promptNotes: frontmatter.prompt_notes ?? null,
    aiUpdateNotes: frontmatter.ai_update_notes ?? null,
    frontmatter,
  };
}

async function buildArtifactMetadata({
  artifactKey,
  content,
  source,
  manifestHash = null,
  filename = null,
  uploadedAt = null,
  frontmatter = {},
}) {
  let metadata = {
    artifactKey,
    source,
    hash: manifestHash || (await hashPromptText(content)),
  };

  if (filename) {
    metadata.filename = filename;
  }
  if (uploadedAt) {
    metadata.uploadedAt = uploadedAt;
  }

  metadata = addFrontmatterMetadata(metadata, frontmatter);

  return metadata;
}

async function buildPromptVersionId(templateName, artifacts) {
  const versionInput = [
    templateName,
    ...artifacts
      .map(
        (artifact) =>
          `${artifact.artifactKey}:${artifact.source}:${artifact.hash}`,
      )
      .sort(),
  ].join("|");
  return hashPromptText(versionInput);
}

async function loadSharedAppendBlockWithMetadata(
  templateName,
  promptProfileId = null,
  promptDefaultsMode = "server",
) {
  if (
    !shouldAppendSharedPromptOutputContract(templateName, promptProfileId)
  ) {
    return {
      text: "",
      metadata: null,
    };
  }
  const loaded = await loadDefaultArtifactWithMetadata(
    getPromptOutputContractArtifactKey(templateName),
    { promptDefaultsMode },
  );
  const text = loaded.text.trim();
  return {
    text,
    metadata: text ? loaded.metadata : null,
  };
}

async function loadDefaultArtifactWithMetadata(
  artifactKey,
  { promptDefaultsMode = "server" } = {},
) {
  const useServerDefaults = promptDefaultsMode !== "extension";
  const defaults = useServerDefaults ? await getServerPromptDefaults() : null;
  const cached = useServerDefaults ? defaults?.artifacts?.[artifactKey] : null;
  if (useServerDefaults && typeof cached === "string") {
    const parsed = parsePromptFrontmatter(cached);
    return {
      text: parsed.body,
      metadata: await buildArtifactMetadata({
        artifactKey,
        content: cached,
        source: "server",
        manifestHash: defaults?.manifest?.[artifactKey] ?? null,
        frontmatter: parsed.frontmatter,
      }),
    };
  }

  const text = await getPackagedPromptArtifactText(artifactKey);
  const definition = getPromptArtifactDefinition(artifactKey);
  const parsed = parsePromptFrontmatter(text);
  return {
    text: parsed.body,
    metadata: await buildArtifactMetadata({
      artifactKey,
      content: text,
      source: "packaged",
      filename: definition?.fileName ?? null,
      frontmatter: parsed.frontmatter,
    }),
  };
}

async function loadProfileDefaultTemplateWithMetadata(
  templateName,
  promptProfileId,
  promptDefaultsMode = "server",
) {
  return loadDefaultArtifactWithMetadata(
    getDefaultPromptTemplateArtifactKey(templateName, promptProfileId),
    { promptDefaultsMode },
  );
}

export async function loadPromptTemplateWithMetadata(templateName, profile) {
  const assets = await getUserAssets();
  const cacheKey = getTemplateCacheKey(
    templateName,
    assets?.activePromptProfileId,
    assets?.promptDefaultsMode,
  );
  const cached = templateCache.get(cacheKey);
  if (cached) return cached;

  const overrideAsset = assets?.[getPromptOverrideAssetField(templateName)];
  const templateArtifactKey = getPromptTemplateArtifactKey(templateName);
  const parsedOverride = overrideAsset?.content?.trim()
    ? parsePromptFrontmatter(overrideAsset.content)
    : null;
  const promptDefaultsMode = assets?.promptDefaultsMode ?? "server";
  const templatePart = overrideAsset?.content?.trim()
      ? {
        text: parsedOverride.body,
        metadata: await buildArtifactMetadata({
          artifactKey: templateArtifactKey,
          content: overrideAsset.content,
          source: "user_override",
          filename: overrideAsset.filename ?? null,
          uploadedAt: overrideAsset.uploadedAt ?? null,
          frontmatter: parsedOverride.frontmatter,
        }),
      }
    : await loadProfileDefaultTemplateWithMetadata(
        templateName,
        assets?.activePromptProfileId,
        promptDefaultsMode,
      );
  const sharedAppendPart =
    await loadSharedAppendBlockWithMetadata(
      templateName,
      assets?.activePromptProfileId,
      promptDefaultsMode,
    );
  const mergedParts = [templatePart.text.trim(), sharedAppendPart.text].filter(
    Boolean,
  );
  const merged = mergedParts.join("\n\n");
  const artifacts = [templatePart.metadata, sharedAppendPart.metadata].filter(
    Boolean,
  );
  const metadata = {
    templateName,
    activePromptProfileId: assets?.activePromptProfileId ?? null,
    versionId: await buildPromptVersionId(templateName, artifacts),
    artifacts,
  };
  const result = {
    text: merged,
    metadata,
  };

  templateCache.set(cacheKey, result);
  return result;
}

export async function loadPromptTemplate(templateName, profile) {
  return (await loadPromptTemplateWithMetadata(templateName, profile)).text;
}

export async function loadSystemPromptGuardrailsWithMetadata() {
  const assets = await getUserAssets();
  const loaded = await loadDefaultArtifactWithMetadata(
    SYSTEM_GUARDRAILS_ARTIFACT_KEY,
    { promptDefaultsMode: assets?.promptDefaultsMode ?? "server" },
  );
  const text = loaded.text.trim();
  const artifacts = loaded.metadata ? [loaded.metadata] : [];
  const metadata = {
    templateName: "systemPrompt",
    versionId: await buildPromptVersionId("systemPrompt", artifacts),
    artifacts,
    renderedHash: await hashPromptText(text),
    renderedAt: new Date().toISOString(),
  };
  return {
    text,
    metadata,
  };
}

export async function loadSystemPromptGuardrails() {
  return (await loadSystemPromptGuardrailsWithMetadata()).text;
}

export async function renderSystemPromptWithMetadata(input, profile) {
  const [guardrails, body] = await Promise.all([
    loadSystemPromptGuardrailsWithMetadata(),
    loadPromptTemplateWithMetadata("systemPrompt", profile),
  ]);
  const bodyText = body.text
    ? renderTemplate(body.text, buildPromptReplacements(input))
    : "";
  const text = [guardrails.text, bodyText].filter(Boolean).join("\n\n");
  const artifacts = [
    ...(guardrails.metadata ? guardrails.metadata.artifacts : []),
    ...(body.metadata?.artifacts ?? []),
  ];

  return {
    text,
    metadata: {
      templateName: "systemPrompt",
      activePromptProfileId:
        body.metadata?.activePromptProfileId ?? input?.activePromptProfileId ?? null,
      versionId: await buildPromptVersionId("systemPrompt", artifacts),
      artifacts,
      renderedHash: await hashPromptText(text),
      renderedAt: new Date().toISOString(),
    },
  };
}

function normalizeText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return JSON.stringify(value, null, 2);
}

function stringifyJson(value) {
  if (value == null) return "";
  return JSON.stringify(value, null, 2);
}

function extractHiringManagerPersonaFromFlexNotes(prompt1Json = null) {
  const flexNotes =
    typeof prompt1Json?.flex_notes === "string"
      ? prompt1Json.flex_notes.trim()
      : "";
  if (!flexNotes) {
    return "";
  }
  const match = flexNotes.match(/^hiring_manager_persona:\s*(.+)$/i);
  if (!match) {
    return "";
  }
  return match[1].trim();
}

function buildPromptReplacements(input = {}) {
  const jobSnapshot = input.jobSnapshot ?? {};
  const customInstruction = normalizeText(input.customInstruction);
  const currentResume =
    typeof input.currentResume === "string"
      ? input.currentResume.trim()
      : stringifyJson(input.currentResume);
  const storyboard =
    typeof input.storyboard === "string"
      ? input.storyboard.trim()
      : stringifyJson(input.storyboard);

  return {
    JOB_TITLE: normalizeText(input.jobTitle ?? jobSnapshot.title),
    COMPANY: normalizeText(input.company ?? jobSnapshot.company),
    LOCATION: normalizeText(input.location ?? jobSnapshot.location),
    SOURCE_URL: normalizeText(input.sourceUrl ?? jobSnapshot.sourceUrl),
    EXTRACTED_AT: normalizeText(input.extractedAt ?? jobSnapshot.extractedAt),
    JOB_DESCRIPTION: normalizeText(
      input.jobDescriptionRawText ?? jobSnapshot.rawText,
    ),
    JOB_SNAPSHOT_JSON: stringifyJson(jobSnapshot),
    CUSTOM_INSTRUCTION: customInstruction,
    CUSTOM_INSTRUCTION_BLOCK: customInstruction
      ? `Additional instruction:\n${customInstruction}`
      : "",
    PROMPT1_JSON: stringifyJson(input.prompt1Json),
    PROMPT1_RESPONSE: normalizeText(input.prompt1Response),
    PROMPT1_HIRING_MANAGER_PERSONA_FROM_FLEX_NOTES:
      extractHiringManagerPersonaFromFlexNotes(input.prompt1Json),
    PROMPT2_JSON: stringifyJson(input.prompt2Json),
    PROMPT2_RESPONSE: normalizeText(input.prompt2Response),
    CURRENT_RESUME: currentResume,
    MASTER_RESUME: currentResume,
    MASTER_RESUME_MARKDOWN: currentResume,
    STORYBOARD: storyboard,
    SYSTEM_PROMPT: normalizeText(input.systemPrompt),
  };
}

function renderTemplate(template, replacements) {
  const rendered = template.replace(
    PLACEHOLDER_PATTERN,
    (match, placeholder) => {
      return placeholder in replacements ? replacements[placeholder] : match;
    },
  );

  const unresolved = rendered.match(PLACEHOLDER_PATTERN);
  if (unresolved?.length) {
    throw new Error(
      `Unresolved prompt placeholders remain: ${unresolved.join(", ")}`,
    );
  }
  return rendered.trim();
}

async function renderPromptWithMetadata(templateName, input, profile) {
  const loaded = await loadPromptTemplateWithMetadata(templateName, profile);
  const text = renderTemplate(loaded.text, buildPromptReplacements(input));
  return {
    text,
    metadata: {
      ...loaded.metadata,
      renderedHash: await hashPromptText(text),
      renderedAt: new Date().toISOString(),
    },
  };
}

async function renderPrompt(templateName, input, profile) {
  return (await renderPromptWithMetadata(templateName, input, profile)).text;
}

export async function renderPrompt1WithMetadata(input, profile) {
  const rendered = await renderPromptWithMetadata("prompt1", input, profile);
  const customInstruction = normalizeText(input.customInstruction);
  if (!customInstruction || rendered.text.includes(customInstruction)) {
    return rendered;
  }
  const text = `${rendered.text}\n\nAdditional Prompt 1 instruction:\nTreat these user-provided keywords or concepts as extra screening signals to evaluate for importance, but do not force them into the output if the JD does not support them.\n${customInstruction}`;
  return {
    text,
    metadata: {
      ...rendered.metadata,
      renderedHash: await hashPromptText(text),
      renderedAt: new Date().toISOString(),
      customInstructionAppended: true,
    },
  };
}

export async function renderPrompt1(input, profile) {
  return (await renderPrompt1WithMetadata(input, profile)).text;
}

export async function renderPrompt2WithMetadata(input, profile) {
  return renderPromptWithMetadata("prompt2", input, profile);
}

export async function renderPrompt2(input, profile) {
  return (await renderPrompt2WithMetadata(input, profile)).text;
}

export async function renderPrompt3WithMetadata(input, profile) {
  return renderPromptWithMetadata("prompt3", input, profile);
}

export async function renderPrompt3(input, profile) {
  return (await renderPrompt3WithMetadata(input, profile)).text;
}

export async function renderPrompt4WithMetadata(input, profile) {
  return renderPromptWithMetadata("prompt4", input, profile);
}

export async function renderPrompt4(input, profile) {
  return (await renderPrompt4WithMetadata(input, profile)).text;
}

export async function buildPromptRunMetadata({
  profile,
  promptProfileId = null,
  prompts = {},
  systemPrompt = null,
}) {
  const promptEntries = Object.entries(prompts).filter(
    ([, value]) => value && typeof value === "object",
  );
  const promptSetInput = [
    systemPrompt ? `systemPrompt:${systemPrompt.versionId}` : "",
    ...promptEntries
      .map(([promptName, metadata]) => `${promptName}:${metadata.versionId}`)
      .sort(),
  ]
    .filter(Boolean)
    .join("|");

  return {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    promptSetId: await hashPromptText(promptSetInput),
    provider: {
      id: profile?.id ?? null,
      label: profile?.label ?? null,
      vendor: profile?.vendor ?? null,
      mode: profile?.mode ?? null,
      model: profile?.model ?? null,
      apiBaseUrl: profile?.apiBaseUrl ?? null,
      targetUrl: profile?.targetUrl ?? null,
    },
    promptProfileId,
    systemPrompt,
    prompts: Object.fromEntries(promptEntries),
  };
}
