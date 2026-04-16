import { extractKeywords } from './keyword-matcher';

export interface Prompt2StrategyArtifact {
  positioning_thesis?: unknown;
  top_resume_goals?: unknown;
  recommended_title?: unknown;
  summary_lead?: unknown;
  summary_focus?: unknown;
  signal_map?: unknown;
  selected_storylines?: unknown;
  experience_emphasis?: unknown;
  final_skills_list?: unknown;
  phrases_to_mirror?: unknown;
}

export interface StrategyBriefSection {
  title: string;
  items: string[];
}

export interface StrategyBrief {
  positioningThesis: string | null;
  recommendedTitle: string | null;
  summaryLead: string | null;
  sections: StrategyBriefSection[];
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function collectStringField(items: unknown, field: string): string[] {
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      return asText((item as Record<string, unknown>)[field]);
    })
    .filter((item): item is string => Boolean(item));
}

function collectStringArrayField(items: unknown, field: string): string[] {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }
    return asStringArray((item as Record<string, unknown>)[field]);
  });
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function buildSection(title: string, items: string[]): StrategyBriefSection | null {
  const deduped = unique(items);
  return deduped.length > 0 ? { title, items: deduped } : null;
}

export function buildStrategyBrief(
  artifact: Record<string, unknown> | null | undefined,
  labels: {
    topGoals: string;
    summaryFocus: string;
    signalsToSurface: string;
    storylines: string;
    experienceThemes: string;
    mirrorPhrases: string;
    finalSkills: string;
  }
): StrategyBrief | null {
  if (!artifact) {
    return null;
  }

  const prompt2 = artifact as Prompt2StrategyArtifact;
  const sections = [
    buildSection(labels.topGoals, asStringArray(prompt2.top_resume_goals)),
    buildSection(labels.summaryFocus, asStringArray(prompt2.summary_focus)),
    buildSection(labels.signalsToSurface, collectStringField(prompt2.signal_map, 'signal')),
    buildSection(labels.storylines, collectStringField(prompt2.selected_storylines, 'label')),
    buildSection(
      labels.experienceThemes,
      collectStringArrayField(prompt2.experience_emphasis, 'themes_to_emphasize')
    ),
    buildSection(labels.mirrorPhrases, asStringArray(prompt2.phrases_to_mirror)),
    buildSection(labels.finalSkills, asStringArray(prompt2.final_skills_list)),
  ].filter((section): section is StrategyBriefSection => Boolean(section));

  if (
    !asText(prompt2.positioning_thesis) &&
    !asText(prompt2.recommended_title) &&
    !asText(prompt2.summary_lead) &&
    sections.length === 0
  ) {
    return null;
  }

  return {
    positioningThesis: asText(prompt2.positioning_thesis),
    recommendedTitle: asText(prompt2.recommended_title),
    summaryLead: asText(prompt2.summary_lead),
    sections,
  };
}

export function extractStrategyKeywords(
  artifact: Record<string, unknown> | null | undefined
): Set<string> {
  if (!artifact) {
    return new Set();
  }

  const prompt2 = artifact as Prompt2StrategyArtifact;
  const sourceParts = [
    ...asStringArray(prompt2.top_resume_goals),
    ...asStringArray(prompt2.summary_focus),
    ...collectStringField(prompt2.signal_map, 'signal'),
    ...collectStringField(prompt2.selected_storylines, 'label'),
    ...collectStringArrayField(prompt2.selected_storylines, 'angles'),
    ...collectStringArrayField(prompt2.selected_storylines, 'proof_points'),
    ...collectStringArrayField(prompt2.experience_emphasis, 'themes_to_emphasize'),
    ...asStringArray(prompt2.final_skills_list),
    ...asStringArray(prompt2.phrases_to_mirror),
  ];

  return extractKeywords(sourceParts.join('\n'));
}
