import type {
  Prompt1Input,
  Prompt2Input,
  Prompt3Input,
  PromptTemplateName,
  RenderedPrompt,
} from '../types/prompting';

const TEMPLATE_PATHS: Record<PromptTemplateName, string> = {
  prompt1: 'src/prompts/prompt1.txt',
  prompt2: 'src/prompts/prompt2.txt',
  prompt3: 'src/prompts/prompt3.txt',
};

const PLACEHOLDER_PATTERN = /\{\{([A-Z0-9_]+)\}\}/g;
const templateCache = new Map<PromptTemplateName, string>();

function resolveExtensionAssetUrl(path: string): string {
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(path);
  }

  return `/${path}`;
}

async function fetchTemplateText(path: string): Promise<string> {
  const response = await fetch(resolveExtensionAssetUrl(path));
  if (!response.ok) {
    throw new Error(`Failed to load prompt template at "${path}" (status ${response.status}).`);
  }

  return await response.text();
}

export async function loadPromptTemplate(templateName: PromptTemplateName): Promise<string> {
  const cached = templateCache.get(templateName);
  if (cached) {
    return cached;
  }

  const template = await fetchTemplateText(TEMPLATE_PATHS[templateName]);
  templateCache.set(templateName, template);
  return template;
}

export function clearPromptTemplateCache(): void {
  templateCache.clear();
}

function normalizeText(value: unknown): string {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value, null, 2);
}

function stringifyJsonCompact(value: unknown): string {
  return JSON.stringify(value);
}

function serializeResumeValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  return JSON.stringify(value, null, 2);
}

function serializeStoryboardValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  return JSON.stringify(value, null, 2);
}

function getMissingPlaceholders(template: string, replacements: Record<string, string>): string[] {
  const found = new Set<string>();

  template.replace(PLACEHOLDER_PATTERN, (_match, placeholder: string) => {
    found.add(placeholder);
    return '';
  });

  return Array.from(found).filter((placeholder) => !(placeholder in replacements));
}

function renderTemplate(template: string, replacements: Record<string, string>): string {
  const missing = getMissingPlaceholders(template, replacements);
  if (missing.length > 0) {
    throw new Error(`Missing prompt template values: ${missing.join(', ')}`);
  }

  const rendered = template.replace(PLACEHOLDER_PATTERN, (match, placeholder: string) => {
    return placeholder in replacements ? replacements[placeholder] : match;
  });

  const unresolved = rendered.match(PLACEHOLDER_PATTERN);
  if (unresolved?.length) {
    throw new Error(`Unresolved prompt placeholders remain: ${unresolved.join(', ')}`);
  }

  return rendered.trim();
}

export async function renderPrompt1(input: Prompt1Input): Promise<RenderedPrompt> {
  const template = await loadPromptTemplate('prompt1');
  return {
    templateName: 'prompt1',
    prompt: renderTemplate(template, {
      JOB_TITLE: normalizeText(input.jobTitle),
      COMPANY: normalizeText(input.company),
      LOCATION: normalizeText(input.location),
      SOURCE_URL: normalizeText(input.sourceUrl),
      EXTRACTED_AT: normalizeText(input.extractedAt),
      JOB_DESCRIPTION: normalizeText(input.jobDescriptionRawText),
    }),
  };
}

export async function renderPrompt2(input: Prompt2Input): Promise<RenderedPrompt> {
  const template = await loadPromptTemplate('prompt2');
  return {
    templateName: 'prompt2',
    prompt: renderTemplate(template, {
      PROMPT1_JSON: stringifyJsonCompact(input.prompt1Json),
    }),
  };
}

export async function renderPrompt3(input: Prompt3Input): Promise<RenderedPrompt> {
  const template = await loadPromptTemplate('prompt3');
  return {
    templateName: 'prompt3',
    prompt: renderTemplate(template, {
      PROMPT2_JSON: stringifyJsonCompact(input.prompt2Json),
      CURRENT_RESUME: serializeResumeValue(input.currentResume),
      STORYBOARD: serializeStoryboardValue(input.storyboard),
    }),
  };
}
