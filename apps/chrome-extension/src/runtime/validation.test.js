import { describe, expect, it } from "vitest";

import {
  normalizePrompt1Data,
  normalizePrompt2Data,
  validatePrompt1Data,
  validatePrompt1MinimalData,
  validatePrompt2Data,
  validatePrompt2MinimalData,
  validateResumeData,
} from "./validation.js";

const validPrompt1 = {
  target_role: "Staff Product Manager",
  target_seniority: "Staff",
  target_domain: "Identity risk",
  company_context: "B2B risk platform",
  role_archetype: "Platform PM",
  gating_requirements: [
    {
      keyword: "identity verification",
      priority: 10,
      type: "exact",
    },
  ],
  high_signal_requirements: [
    {
      keyword: "risk platform",
      priority: 9,
      type: "exact",
    },
  ],
  medium_signal_requirements: [
    {
      keyword: "cross-functional roadmap",
      priority: 6,
      type: "inferred",
    },
  ],
  nice_to_have_keywords: [
    {
      keyword: "fraud prevention",
      priority: 7,
      type: "inferred",
    },
  ],
  target_native_phrases_to_validate: ["risk platform"],
  gating_qualifications: ["5+ years PM experience"],
  near_gate_qualifications: ["Risk platform experience"],
  preferred_qualifications: ["marketplace experience"],
  core_responsibilities: ["Own the risk roadmap"],
  recruiter_hooks: ["Identity and risk PM"],
  hiring_manager_proof: ["Drove risk product strategy"],
  domain_terms: ["identity", "risk"],
  metrics_kpis: ["approval rate"],
  tools_platforms: ["SQL"],
  soft_skills: ["stakeholder management"],
  do_not_fake: ["SOC 2 expertise"],
  deprioritize: ["company perks"],
  jd_notes: ["JD is heavy on domain language"],
  flex_notes: "",
};

const validPrompt2 = {
  validated_role: "Senior Product Manager",
  validated_domain: "Identity risk",
  positioning_thesis: "Senior PM with strong adjacent risk and platform proof",
  top_resume_goals: [
    "Lead with identity and risk relevance",
    "Show platform and execution depth",
    "Stay truthful about adjacency",
  ],
  recommended_title: "Senior Product Manager, Risk Platforms",
  summary_lead:
    "Product leader with identity and risk-adjacent platform experience",
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
      signal: "Identity and risk product ownership",
      support: "adjacent",
      evidence: ["Risk platform roadmap"],
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
      anchor_bullet: "Owned product roadmap for identity systems",
      guardrail: "Do not claim direct fraud-specialist title",
    },
    {
      label: "Cross-functional delivery",
      strength: "high",
      angles: ["Execution"],
      proof_points: ["Partnered with eng"],
      anchor_role: "Technical Product Manager",
      anchor_bullet: "Led delivery with engineering and design",
      guardrail: "Keep scope truthful",
    },
    {
      label: "Customer and business outcomes",
      strength: "medium",
      angles: ["Outcome orientation"],
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
      guardrail: "Keep risk framing adjacent and truthful",
    },
  ],
  bullet_rewrite_instructions: [
    {
      role: "Associate Director of Product",
      action: "rewrite",
      bullet_anchor: "Led roadmap planning",
      merge_with: [],
      placement_hint: "lead",
      guardrail: "Keep risk framing adjacent and truthful",
    },
  ],
  final_skills_list: ["SQL", "Experimentation"],
  phrases_to_mirror: ["identity risk"],
  cannot_claim: ["Direct fraud analyst experience"],
  skills_to_avoid: ["Kubernetes"],
  signals_to_avoid: ["Security architect"],
  gaps: ["No direct fraud-specialist title"],
  flex_notes: "",
};

describe("prompt stage validation", () => {
  it("accepts a valid Prompt 1 payload", () => {
    expect(validatePrompt1Data(validPrompt1)).toEqual([]);
  });

  it("accepts string, null, and missing Prompt 1 flex_notes values", () => {
    expect(validatePrompt1Data({ ...validPrompt1, flex_notes: "small note" })).toEqual([]);
    expect(validatePrompt1Data({ ...validPrompt1, flex_notes: null })).toEqual([]);
    const { flex_notes: _flexNotes, ...withoutFlexNotes } = validPrompt1;
    expect(validatePrompt1Data(withoutFlexNotes)).toEqual([]);
  });

  it("rejects non-string Prompt 1 flex_notes values", () => {
    expect(validatePrompt1Data({ ...validPrompt1, flex_notes: { note: "bad" } })).toContain(
      "prompt1.flex_notes must be a string or null.",
    );
  });

  it("accepts a minimal Prompt 1 handoff and normalizes it into the stable runtime shape", () => {
    const minimalPrompt1 = {
      target_role: "Technical Product Manager",
      target_seniority: "Senior",
      target_domain: "Infrastructure",
      gating_requirements: [
        {
          keyword: "platform roadmap",
          priority: 9,
          type: "exact",
        },
      ],
      high_signal_requirements: [
        {
          keyword: "cross-functional delivery",
          priority: 8,
          type: "inferred",
        },
      ],
      flex_notes:
        "hiring_manager_persona: skeptical infrastructure leader who wants concrete execution proof",
    };

    expect(validatePrompt1MinimalData(minimalPrompt1)).toEqual([]);

    const normalized = normalizePrompt1Data(minimalPrompt1);

    expect(normalized.flex_notes).toBe(
      "hiring_manager_persona: skeptical infrastructure leader who wants concrete execution proof",
    );
    expect(normalized.company_context).toBe("");
    expect(normalized.medium_signal_requirements).toEqual([]);
    expect(normalized.jd_notes).toEqual([]);
    expect(validatePrompt1Data(normalized)).toEqual([]);
  });

  it("rejects a partial Prompt 2 payload shaped like a nested signal object", () => {
    expect(
      validatePrompt2Data({
        signal: "Identity risk product ownership",
        support: "direct",
        evidence: ["Risk product roadmap"],
        surface_in: ["summary"],
      }),
    ).not.toEqual([]);
  });

  it("accepts a valid Prompt 2 payload", () => {
    expect(validatePrompt2Data(validPrompt2)).toEqual([]);
  });

  it("accepts string, null, and missing Prompt 2 flex_notes values", () => {
    expect(validatePrompt2Data({ ...validPrompt2, flex_notes: "small note" })).toEqual([]);
    expect(validatePrompt2Data({ ...validPrompt2, flex_notes: null })).toEqual([]);
    const { flex_notes: _flexNotes, ...withoutFlexNotes } = validPrompt2;
    expect(validatePrompt2Data(withoutFlexNotes)).toEqual([]);
  });

  it("rejects non-string Prompt 2 flex_notes values", () => {
    expect(validatePrompt2Data({ ...validPrompt2, flex_notes: ["bad"] })).toContain(
      "prompt2.flex_notes must be a string or null.",
    );
  });

  it("rejects deleted legacy Prompt 2 fields", () => {
    expect(
      validatePrompt2Data({ ...validPrompt2, summary_sentences: 2 }),
    ).toContain("prompt2.summary_sentences is not allowed.");
    expect(
      validatePrompt2Data({ ...validPrompt2, company_context_guidance: [] }),
    ).toContain("prompt2.company_context_guidance is not allowed.");
  });

  it("accepts a minimal Prompt 2 handoff and normalizes missing strategy detail fields", () => {
    const minimalPrompt2 = {
      validated_role: "Technical Product Manager",
      validated_domain: "Infrastructure",
      positioning_thesis:
        "Platform PM with credible infra execution and cross-functional delivery proof",
      top_resume_goals: [
        "Lead with infrastructure relevance",
        "Show execution depth",
      ],
      recommended_title: "Technical Product Manager, Infrastructure",
      summary_lead:
        "Technical product manager with infrastructure-facing platform execution experience",
      final_skills_list: ["SQL", "Experimentation"],
      cannot_claim: ["Direct SRE ownership"],
      flex_notes: "keep the hiring-manager tone direct",
    };

    expect(validatePrompt2MinimalData(minimalPrompt2)).toEqual([]);

    const normalized = normalizePrompt2Data(minimalPrompt2);

    expect(normalized.signal_map).toEqual([]);
    expect(normalized.selected_storylines).toEqual([]);
    expect(normalized.excitement_anchor).toEqual({
      claim: "",
      evidence: "",
      placement: "summary",
      why_distinctive: "",
    });
    expect(normalized).not.toHaveProperty("summary_sentences");
    expect(normalized.flex_notes).toBe("keep the hiring-manager tone direct");
  });

  it("normalizes the source-bullet-selection Prompt 2 bullet schema", () => {
    const minimalPrompt2 = {
      ...validPrompt2,
      bullet_rewrite_instructions: [
        {
          role: "Associate Director of Product",
          action: "merge",
          bullet_anchor: "Led roadmap planning",
          merge_with: ["Prioritized identity-risk workflows with engineering"],
          placement_hint: "top2",
          guardrail: "Keep risk framing adjacent and truthful",
        },
      ],
    };

    const normalized = normalizePrompt2Data(minimalPrompt2);

    expect(normalized.bullet_rewrite_instructions[0]).toEqual({
      role: "Associate Director of Product",
      action: "merge",
      bullet_anchor: "Led roadmap planning",
      merge_with: ["Prioritized identity-risk workflows with engineering"],
      placement_hint: "top2",
      guardrail: "Keep risk framing adjacent and truthful",
    });
  });
});

const validResumeData = {
  personalInfo: {
    name: "Hung Nguyen",
    title: "Product Manager",
    customTagline: null,
    email: "hung@example.com",
    phone: "555-555-5555",
    location: "Seattle, WA",
    website: null,
    linkedin: null,
    github: null,
  },
  summary: "Product manager with marketplace experience.",
  workExperience: [
    {
      id: 1,
      title: "Product Manager",
      company: "Amazon",
      location: "Seattle, WA",
      website: "https://amazon.com/seller-services",
      context:
        "Helping sellers list products through product testing services.",
      years: "2021 - Present",
      description: ["Launched seller-facing workflows."],
    },
  ],
  education: [
    {
      id: 1,
      institution: "University of Washington",
      degree: "BS Informatics",
      years: "2016 - 2020",
      description: null,
    },
  ],
  personalProjects: [],
  additional: {
    technicalSkills: ["SQL"],
    languages: [],
    certificationsTraining: [],
    awards: [],
  },
  sectionMeta: [
    {
      id: "personal_info",
      key: "personalInfo",
      displayName: "Personal Info",
      sectionType: "personalInfo",
      isDefault: true,
      isVisible: true,
      order: 0,
    },
  ],
  customSections: {},
};

describe("resume data validation", () => {
  it("accepts string, null, and missing work experience context values", () => {
    expect(validateResumeData(validResumeData)).toEqual([]);

    const nullContext = {
      ...validResumeData,
      workExperience: [{ ...validResumeData.workExperience[0], context: null }],
    };
    expect(validateResumeData(nullContext)).toEqual([]);

    const { context: _context, ...experienceWithoutContext } =
      validResumeData.workExperience[0];
    const missingContext = {
      ...validResumeData,
      workExperience: [experienceWithoutContext],
    };
    expect(validateResumeData(missingContext)).toEqual([]);
  });

  it("rejects non-string work experience context values", () => {
    const invalidContext = {
      ...validResumeData,
      workExperience: [{ ...validResumeData.workExperience[0], context: 42 }],
    };

    expect(validateResumeData(invalidContext)).toContain(
      "workExperience[0].context must be a string or null.",
    );
  });

  it("accepts string, null, and missing work experience website values", () => {
    expect(validateResumeData(validResumeData)).toEqual([]);

    const nullWebsite = {
      ...validResumeData,
      workExperience: [{ ...validResumeData.workExperience[0], website: null }],
    };
    expect(validateResumeData(nullWebsite)).toEqual([]);

    const { website: _website, ...experienceWithoutWebsite } =
      validResumeData.workExperience[0];
    const missingWebsite = {
      ...validResumeData,
      workExperience: [experienceWithoutWebsite],
    };
    expect(validateResumeData(missingWebsite)).toEqual([]);
  });

  it("rejects non-string work experience website values", () => {
    const invalidWebsite = {
      ...validResumeData,
      workExperience: [{ ...validResumeData.workExperience[0], website: 42 }],
    };

    expect(validateResumeData(invalidWebsite)).toContain(
      "workExperience[0].website must be a string or null.",
    );
  });
});
