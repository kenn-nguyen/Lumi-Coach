import { describe, expect, it } from "vitest";

import {
  validatePrompt1Data,
  validatePrompt2Data,
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
  education_notes: [
    {
      institution: "Yale School of Management",
      instruction: "Keep concise",
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

  it("accepts Prompt 2 summary_sentences of 1 or 2 only", () => {
    expect(
      validatePrompt2Data({ ...validPrompt2, summary_sentences: 1 }),
    ).toEqual([]);
    expect(
      validatePrompt2Data({ ...validPrompt2, summary_sentences: 2 }),
    ).toEqual([]);
    expect(
      validatePrompt2Data({ ...validPrompt2, summary_sentences: 3 }),
    ).toContain("prompt2.summary_sentences must be 1 or 2.");
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
