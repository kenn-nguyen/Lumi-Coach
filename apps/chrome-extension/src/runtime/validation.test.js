import { describe, expect, it } from "vitest";

import { validatePrompt1Data, validatePrompt2Data } from "./validation.js";

const validPrompt1 = {
  target_role: "Staff Product Manager",
  target_seniority: "Staff",
  target_domain: "Identity risk",
  company_context: "B2B risk platform",
  role_archetype: "Platform PM",
  must_have_keywords: [
    {
      keyword: "identity verification",
      priority: 10,
      type: "exact",
      where_to_use: ["headline", "experience"],
    },
  ],
  nice_to_have_keywords: [
    {
      keyword: "fraud prevention",
      priority: 7,
      type: "inferred",
      where_to_use: ["summary"],
    },
  ],
  exact_phrases_to_mirror: ["risk platform"],
  required_qualifications: ["5+ years PM experience"],
  preferred_qualifications: ["marketplace experience"],
  core_responsibilities: ["Own the risk roadmap"],
  recruiter_hooks: ["Identity and risk PM"],
  hiring_manager_proof: ["Drove risk product strategy"],
  domain_terms: ["identity", "risk"],
  metrics_kpis: ["approval rate"],
  tools_platforms: ["SQL"],
  soft_skills: ["stakeholder management"],
  keywords_to_repeat_naturally: ["identity", "risk"],
  section_targets: {
    headline: ["Identity Risk PM"],
    summary: ["Risk strategy"],
    experience: ["Risk roadmap"],
    skills: ["SQL"],
  },
  do_not_fake: ["SOC 2 expertise"],
  deprioritize: ["company perks"],
  jd_notes: ["JD is heavy on domain language"],
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
  summary_lead: "Product leader with identity and risk-adjacent platform experience",
  summary_focus: ["Identity risk", "Platform execution", "Cross-functional leadership"],
  summary_sentences: 2,
  voice: "Sharp and credible",
  adjacent_framing: "Position as adjacent rather than exact match",
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
      instruction: "Lead with platform and risk outcomes",
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
};

describe("prompt stage validation", () => {
  it("accepts a valid Prompt 1 payload", () => {
    expect(validatePrompt1Data(validPrompt1)).toEqual([]);
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
});
