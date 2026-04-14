import { getUserAssets } from './storage.js';

const TEMPLATE_PATHS = {
  prompt1: 'src/prompts/prompt1.txt',
  prompt2: 'src/prompts/prompt2.txt',
  prompt3: 'src/prompts/prompt3.txt',
};

const PLACEHOLDER_PATTERN = /\{\{([A-Z0-9_]+)\}\}/g;
const templateCache = new Map();

function getTemplateAssetKey(templateName) {
  return `${templateName}TemplateAsset`;
}

function resolveExtensionAssetUrl(path) {
  return chrome.runtime.getURL(path);
}

async function fetchTemplateText(path) {
  const response = await fetch(resolveExtensionAssetUrl(path));
  if (!response.ok) {
    throw new Error(`Failed to load prompt template at "${path}" (status ${response.status}).`);
  }
  return await response.text();
}

export function clearPromptTemplateCache() {
  templateCache.clear();
}

export async function loadPromptTemplate(templateName) {
  const cached = templateCache.get(templateName);
  if (cached) return cached;

  const assets = await getUserAssets();
  const overrideAsset = assets?.[getTemplateAssetKey(templateName)];
  const template = overrideAsset?.content?.trim()
    ? overrideAsset.content
    : await fetchTemplateText(TEMPLATE_PATHS[templateName]);

  templateCache.set(templateName, template);
  return template;
}

function normalizeText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value, null, 2);
}

function renderTemplate(template, replacements) {
  const rendered = template.replace(PLACEHOLDER_PATTERN, (match, placeholder) => {
    return placeholder in replacements ? replacements[placeholder] : match;
  });

  const unresolved = rendered.match(PLACEHOLDER_PATTERN);
  if (unresolved?.length) {
    throw new Error(`Unresolved prompt placeholders remain: ${unresolved.join(', ')}`);
  }
  return rendered.trim();
}

export async function renderPrompt1(input) {
  const template = await loadPromptTemplate('prompt1');
  const rendered = renderTemplate(template, {
    JOB_TITLE: normalizeText(input.jobTitle),
    COMPANY: normalizeText(input.company),
    LOCATION: normalizeText(input.location),
    SOURCE_URL: normalizeText(input.sourceUrl),
    EXTRACTED_AT: normalizeText(input.extractedAt),
    JOB_DESCRIPTION: normalizeText(input.jobDescriptionRawText),
  });

  const customInstruction = normalizeText(input.customInstruction);
  if (!customInstruction) {
    return rendered;
  }

  return `${rendered}\n\nAdditional Prompt 1 instruction:\nTreat these user-provided keywords or concepts as extra screening signals to evaluate for importance, but do not force them into the output if the JD does not support them.\n${customInstruction}`;
}

export async function renderPrompt2(input) {
  const template = await loadPromptTemplate('prompt2');
  return renderTemplate(template, {
    PROMPT1_JSON: JSON.stringify(input.prompt1Json),
  });
}

export async function renderPrompt3(input) {
  const template = await loadPromptTemplate('prompt3');
  return renderTemplate(template, {
    PROMPT2_JSON: JSON.stringify(input.prompt2Json),
    CURRENT_RESUME: typeof input.currentResume === 'string'
      ? input.currentResume.trim()
      : JSON.stringify(input.currentResume, null, 2),
    STORYBOARD: typeof input.storyboard === 'string'
      ? input.storyboard.trim()
      : JSON.stringify(input.storyboard, null, 2),
  });
}
