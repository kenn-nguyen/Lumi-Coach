export type PromptTemplateName = 'prompt1' | 'prompt2' | 'prompt3';

export interface Prompt1Input {
  jobTitle: string;
  company: string;
  location?: string | null;
  sourceUrl: string;
  extractedAt: string;
  jobDescriptionRawText: string;
}

export interface Prompt2Input {
  prompt1Json: unknown;
}

export interface Prompt3Input {
  prompt2Json: unknown;
  currentResume: unknown;
  storyboard: unknown;
}

export interface RenderedPrompt {
  templateName: PromptTemplateName;
  prompt: string;
}
