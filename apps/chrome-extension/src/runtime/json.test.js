import { describe, expect, it } from "vitest";

import {
  extractJsonFromText,
  extractPrompt3PayloadFromText,
  extractPrompt4ResumeDataFromText,
} from "./json.js";
import { validatePrompt2Data } from "./validation.js";

const validPrompt2 = {
  validated_role: "Senior Product Manager",
  validated_domain: "Identity risk",
  positioning_thesis: "Senior PM with adjacent risk and platform proof",
  top_resume_goals: [
    "Lead with identity and risk relevance",
    "Show platform execution depth",
    "Stay truthful about adjacency",
  ],
  recommended_title: "Senior Product Manager, Risk Platforms",
  summary_lead: "Product leader with risk-adjacent platform experience",
  summary_focus: [
    "Identity risk",
    "Platform execution",
    "Cross-functional leadership",
  ],
  excitement_anchor: {
    claim: "Risk-platform roadmap ownership with measurable funnel outcomes",
    evidence:
      "Associate Director of Product role, risk roadmap and funnel proof",
    placement: "both",
    why_distinctive:
      "Combines platform ownership, risk relevance, and measurable execution proof",
  },
  signal_map: [
    {
      signal: "Identity and risk platform ownership",
      support: "adjacent",
      evidence: ["Platform roadmap"],
      surface_in: ["headline", "summary"],
    },
  ],
  selected_storylines: [
    {
      label: "Risk platform strategy",
      strength: "high",
      angles: ["Platform leadership"],
      proof_points: ["Owned roadmap"],
      anchor_role: "Associate Director of Product",
      anchor_bullet: "Owned roadmap for identity systems",
      guardrail: "Keep framing adjacent and truthful",
    },
    {
      label: "Cross-functional delivery",
      strength: "high",
      angles: ["Execution"],
      proof_points: ["Partnered with eng"],
      anchor_role: "Technical Product Manager",
      anchor_bullet: "Led delivery with engineering and design",
      guardrail: "Do not invent scope",
    },
    {
      label: "Outcome orientation",
      strength: "medium",
      angles: ["Business outcomes"],
      proof_points: ["Improved funnel metrics"],
      anchor_role: "Product Manager",
      anchor_bullet: "Improved approval funnel performance",
      guardrail: "Do not invent metrics",
    },
  ],
  experience_emphasis: [
    {
      role: "Associate Director of Product",
      default_action: "rewrite_all",
      themes_to_emphasize: ["Risk platform"],
      proof_points: ["Platform roadmap"],
      deemphasize: ["Low-signal ops"],
      guardrail: "Keep framing truthful",
    },
  ],
  bullet_rewrite_instructions: [
    {
      role: "Associate Director of Product",
      action: "rewrite",
      bullet_anchor: "Led roadmap planning",
      merge_with: [],
      placement_hint: "lead",
      guardrail: "Keep framing truthful",
    },
  ],
  final_skills_list: ["SQL", "Experimentation"],
  phrases_to_mirror: ["identity risk"],
  cannot_claim: ["Direct fraud analyst experience"],
  skills_to_avoid: ["Kubernetes"],
  signals_to_avoid: ["Security architect"],
  gaps: ["No direct fraud-specialist title"],
};

describe("extractJsonFromText", () => {
  it("selects a schema-valid Prompt 2 object instead of the first nested parseable object", () => {
    const rawText = [
      "Here is the strategy object:",
      '{"signal":"Identity and risk product ownership","support":"direct","evidence":["Risk platform roadmap"],"surface_in":["headline","summary"]}',
      "Final answer:",
      JSON.stringify(validPrompt2, null, 2),
    ].join("\n\n");

    const parsed = extractJsonFromText(rawText, {
      validate: (candidate) => validatePrompt2Data(candidate).length === 0,
    });

    expect(parsed.validated_role).toBe("Senior Product Manager");
    expect(parsed.signal_map).toHaveLength(1);
  });

  it("extracts optional Prompt 3 flex_notes from the wrapped output", () => {
    const parsed = extractPrompt3PayloadFromText(
      JSON.stringify({
        resume_data: { personalInfo: {}, summary: "" },
        generation_feedback: {
          summary: "Ready.",
          prompt_setup: {
            prompt_profile_id: "profile2",
            prompt3_version_id: "prompt3-version-abcdef123456",
            system_prompt_version_id: "system-version-fedcba654321",
          },
        },
        flex_notes: "reserved handoff note",
      }),
    );

    expect(parsed.flexNotes).toBe("reserved handoff note");
    expect(parsed.usedLegacyShape).toBe(false);
    expect(parsed.generationFeedback).toEqual({
      summary: "Ready.",
      pros: [],
      cons: [],
      caveats: [],
      prompt_setup: {
        prompt_profile_id: "profile2",
        prompt3_version_id: "prompt3-version-abcdef123456",
        system_prompt_version_id: "system-version-fedcba654321",
      },
    });
  });

  it("extracts Prompt 4 resume_data without prompt-level flex_notes", () => {
    const resumeData = {
      personalInfo: {},
      summary: "Resume summary",
      workExperience: [],
    };

    const parsed = extractPrompt4ResumeDataFromText(
      JSON.stringify({
        resume_data: resumeData,
        flex_notes: "reserved extraction note",
      }),
    );

    expect(parsed).toEqual(resumeData);
  });

  describe("lenient repair of web-UI JSON corruptions", () => {
    it("repairs smart/curly double quotes used as delimiters", () => {
      const corrupted = "{“name”: “Jane Doe”, “role”: “PM”}";
      const parsed = extractJsonFromText(corrupted);
      expect(parsed).toEqual({ name: "Jane Doe", role: "PM" });
    });

    it("repairs curly quotes inside a fenced code block", () => {
      const corrupted = "```json\n{“skill”: “SQL”}\n```";
      const parsed = extractJsonFromText(corrupted);
      expect(parsed).toEqual({ skill: "SQL" });
    });

    it("repairs trailing commas before closing braces and brackets", () => {
      const corrupted = '{"skills": ["SQL", "Python",], "name": "Jane",}';
      const parsed = extractJsonFromText(corrupted);
      expect(parsed).toEqual({ skills: ["SQL", "Python"], name: "Jane" });
    });

    it("repairs non-breaking spaces between tokens", () => {
      const corrupted = '{ "name": "Jane" }';
      const parsed = extractJsonFromText(corrupted);
      expect(parsed).toEqual({ name: "Jane" });
    });

    it("repairs corrupted JSON surrounded by prose", () => {
      const corrupted =
        "Sure! Here is the JSON:\n{“summary”: “Done”,}\nLet me know if you need changes.";
      const parsed = extractJsonFromText(corrupted);
      expect(parsed).toEqual({ summary: "Done" });
    });

    it("recovers JSON with invisible zero-width / BOM characters between tokens", () => {
      // BOM (U+FEFF), zero-width space (U+200B), word joiner (U+2060) between
      // tokens — invisible, valid-looking, but rejected by JSON.parse.
      const corrupted = '{\uFEFF"name":\u200B "Jane", "role":\u2060 "PM"}';
      const parsed = extractJsonFromText(corrupted);
      expect(parsed).toEqual({ name: "Jane", role: "PM" });
    });

    it("recovers JSON with a stray control character between tokens", () => {
      const corrupted = '{"name": "Jane",\u0007 "role": "PM"}';
      const parsed = extractJsonFromText(corrupted);
      expect(parsed).toEqual({ name: "Jane", role: "PM" });
    });

    it("does not corrupt URLs (no naive // comment stripping)", () => {
      const text = '{"website": "https://example.com/path", "n": 1}';
      const parsed = extractJsonFromText(text);
      expect(parsed).toEqual({ website: "https://example.com/path", n: 1 });
    });

    it("still throws when there is genuinely no JSON", () => {
      expect(() => extractJsonFromText("no json here at all")).toThrow();
    });
  });
});
