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
  summary_sentences: 2,
  voice: "Sharp and credible",
  adjacent_framing: "Position as adjacent rather than exact match",
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
  company_context_guidance: [
    {
      role: "Associate Director of Product",
      company: "RiskCo",
      recommended_context:
        "B2B risk platform serving enterprise financial institutions",
      action: "add",
      evidence:
        "Source resume describes enterprise financial-institution customers",
      guardrail:
        "Do not include candidate-owned outcome metrics in company context",
    },
  ],
  bullet_rewrite_instructions: [
    {
      role: "Associate Director of Product",
      action: "rewrite",
      bullet_anchor: "Led roadmap planning",
      instruction: {
        primary_message:
          "Show platform roadmap ownership for identity-risk workflows",
        primary_metric: "",
        mechanism:
          "sequencing roadmap priorities across product and engineering",
        optional_context: "for risk and approval workflows",
        do_not_include: ["direct fraud-specialist title"],
      },
    },
  ],
  education_notes: [],
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
        generation_feedback: null,
        flex_notes: "reserved handoff note",
      }),
    );

    expect(parsed.flexNotes).toBe("reserved handoff note");
    expect(parsed.usedLegacyShape).toBe(false);
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
});
