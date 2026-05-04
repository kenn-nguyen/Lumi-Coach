function isString(value) {
  return typeof value === "string";
}

function isInteger(value) {
  return Number.isInteger(value);
}

function isNullableString(value) {
  return value == null || typeof value === "string";
}

function isStringArray(value) {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function hasMeaningfulText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateExactKeys(value, label, allowedKeys, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }

  const allowed = new Set(allowedKeys);
  Object.keys(value).forEach((key) => {
    if (!allowed.has(key)) {
      errors.push(`${label}.${key} is not allowed.`);
    }
  });
}

function validateStringArrayField(value, label, errors) {
  if (!isStringArray(value)) {
    errors.push(`${label} must be an array of strings.`);
  }
}

function validateKeywordObjects(items, label, errors) {
  const validWhereToUse = new Set([
    "headline",
    "summary",
    "experience",
    "skills",
  ]);
  const validTypes = new Set(["exact", "inferred"]);

  if (!Array.isArray(items)) {
    errors.push(`${label} must be an array.`);
    return;
  }

  items.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push(`${label}[${index}] must be an object.`);
      return;
    }

    validateExactKeys(
      item,
      `${label}[${index}]`,
      ["keyword", "priority", "type", "where_to_use"],
      errors,
    );

    if (!isString(item.keyword)) {
      errors.push(`${label}[${index}].keyword must be a string.`);
    }
    if (!isInteger(item.priority) || item.priority < 1 || item.priority > 10) {
      errors.push(
        `${label}[${index}].priority must be an integer from 1 to 10.`,
      );
    }
    if (!validTypes.has(item.type)) {
      errors.push(
        `${label}[${index}].type must be exactly "exact" or "inferred".`,
      );
    }
    if (!Array.isArray(item.where_to_use)) {
      errors.push(`${label}[${index}].where_to_use must be an array.`);
    } else {
      item.where_to_use.forEach((where, whereIndex) => {
        if (!validWhereToUse.has(where)) {
          errors.push(
            `${label}[${index}].where_to_use[${whereIndex}] must be one of headline, summary, experience, skills.`,
          );
        }
      });
    }
  });
}

function validateSignalMap(items, label, errors) {
  const validSupport = new Set(["direct", "adjacent", "unsupported"]);

  if (!Array.isArray(items)) {
    errors.push(`${label} must be an array.`);
    return;
  }

  items.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push(`${label}[${index}] must be an object.`);
      return;
    }

    validateExactKeys(
      item,
      `${label}[${index}]`,
      ["signal", "support", "evidence", "surface_in"],
      errors,
    );

    if (!isString(item.signal)) {
      errors.push(`${label}[${index}].signal must be a string.`);
    }
    if (!validSupport.has(item.support)) {
      errors.push(
        `${label}[${index}].support must be exactly one of direct, adjacent, unsupported.`,
      );
    }
    validateStringArrayField(
      item.evidence,
      `${label}[${index}].evidence`,
      errors,
    );
    validateStringArrayField(
      item.surface_in,
      `${label}[${index}].surface_in`,
      errors,
    );
  });
}

function validateSelectedStorylines(items, label, errors) {
  const validStrength = new Set(["high", "medium"]);

  if (!Array.isArray(items)) {
    errors.push(`${label} must be an array.`);
    return;
  }

  if (items.length < 3 || items.length > 5) {
    errors.push(`${label} must contain between 3 and 5 items.`);
  }

  items.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push(`${label}[${index}] must be an object.`);
      return;
    }

    validateExactKeys(
      item,
      `${label}[${index}]`,
      [
        "label",
        "strength",
        "angles",
        "proof_points",
        "anchor_role",
        "anchor_bullet",
        "guardrail",
      ],
      errors,
    );

    if (!isString(item.label))
      errors.push(`${label}[${index}].label must be a string.`);
    if (!validStrength.has(item.strength)) {
      errors.push(
        `${label}[${index}].strength must be exactly "high" or "medium".`,
      );
    }
    validateStringArrayField(item.angles, `${label}[${index}].angles`, errors);
    validateStringArrayField(
      item.proof_points,
      `${label}[${index}].proof_points`,
      errors,
    );
    if (!isString(item.anchor_role) || !item.anchor_role.trim()) {
      errors.push(`${label}[${index}].anchor_role must be a non-empty string.`);
    }
    if (!isString(item.anchor_bullet) || !item.anchor_bullet.trim()) {
      errors.push(
        `${label}[${index}].anchor_bullet must be a non-empty string.`,
      );
    }
    if (!isString(item.guardrail) || !item.guardrail.trim()) {
      errors.push(`${label}[${index}].guardrail must be a non-empty string.`);
    }
  });
}

function validateExperienceEmphasis(items, label, errors) {
  const validActions = new Set(["keep", "rewrite_all"]);

  if (!Array.isArray(items)) {
    errors.push(`${label} must be an array.`);
    return;
  }

  items.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push(`${label}[${index}] must be an object.`);
      return;
    }

    validateExactKeys(
      item,
      `${label}[${index}]`,
      [
        "role",
        "default_action",
        "themes_to_emphasize",
        "proof_points",
        "deemphasize",
        "guardrail",
      ],
      errors,
    );

    if (!isString(item.role))
      errors.push(`${label}[${index}].role must be a string.`);
    if (!validActions.has(item.default_action)) {
      errors.push(
        `${label}[${index}].default_action must be exactly "keep" or "rewrite_all".`,
      );
    }
    validateStringArrayField(
      item.themes_to_emphasize,
      `${label}[${index}].themes_to_emphasize`,
      errors,
    );
    validateStringArrayField(
      item.proof_points,
      `${label}[${index}].proof_points`,
      errors,
    );
    validateStringArrayField(
      item.deemphasize,
      `${label}[${index}].deemphasize`,
      errors,
    );
    if (!isString(item.guardrail))
      errors.push(`${label}[${index}].guardrail must be a string.`);
  });
}

function validateCompanyContextGuidance(items, label, errors) {
  const validActions = new Set(["preserve", "add", "revise", "omit"]);

  if (!Array.isArray(items)) {
    errors.push(`${label} must be an array.`);
    return;
  }

  items.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push(`${label}[${index}] must be an object.`);
      return;
    }

    validateExactKeys(
      item,
      `${label}[${index}]`,
      [
        "role",
        "company",
        "recommended_context",
        "action",
        "evidence",
        "guardrail",
      ],
      errors,
    );

    ["role", "company", "recommended_context", "evidence", "guardrail"].forEach(
      (field) => {
        if (!isString(item[field])) {
          errors.push(`${label}[${index}].${field} must be a string.`);
        }
      },
    );
    if (!validActions.has(item.action)) {
      errors.push(
        `${label}[${index}].action must be exactly one of preserve, add, revise, omit.`,
      );
    }
  });
}

function validateBulletRewriteInstructions(items, label, errors) {
  const validActions = new Set(["rewrite", "add"]);

  if (!Array.isArray(items)) {
    errors.push(`${label} must be an array.`);
    return;
  }

  items.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push(`${label}[${index}] must be an object.`);
      return;
    }

    validateExactKeys(
      item,
      `${label}[${index}]`,
      ["role", "action", "bullet_anchor", "instruction"],
      errors,
    );

    if (!isString(item.role))
      errors.push(`${label}[${index}].role must be a string.`);
    if (!validActions.has(item.action)) {
      errors.push(
        `${label}[${index}].action must be exactly "rewrite" or "add".`,
      );
    }
    if (!isString(item.bullet_anchor)) {
      errors.push(`${label}[${index}].bullet_anchor must be a string.`);
    }
    if (
      !item.instruction ||
      typeof item.instruction !== "object" ||
      Array.isArray(item.instruction)
    ) {
      errors.push(`${label}[${index}].instruction must be an object.`);
    } else {
      validateExactKeys(
        item.instruction,
        `${label}[${index}].instruction`,
        [
          "primary_message",
          "primary_metric",
          "mechanism",
          "optional_context",
          "do_not_include",
        ],
        errors,
      );
      [
        "primary_message",
        "primary_metric",
        "mechanism",
        "optional_context",
      ].forEach((field) => {
        if (!isString(item.instruction[field])) {
          errors.push(
            `${label}[${index}].instruction.${field} must be a string.`,
          );
        }
      });
      validateStringArrayField(
        item.instruction.do_not_include,
        `${label}[${index}].instruction.do_not_include`,
        errors,
      );
    }
  });
}

function validateExcitementAnchor(value, label, errors) {
  const validPlacements = new Set([
    "summary",
    "first_bullet_of_recent_role",
    "both",
  ]);

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }

  validateExactKeys(
    value,
    label,
    ["claim", "evidence", "placement", "why_distinctive"],
    errors,
  );

  ["claim", "evidence", "why_distinctive"].forEach((field) => {
    if (!isString(value[field])) {
      errors.push(`${label}.${field} must be a string.`);
    }
  });

  if (!validPlacements.has(value.placement)) {
    errors.push(
      `${label}.placement must be exactly one of summary, first_bullet_of_recent_role, both.`,
    );
  }
}

function validateEducationNotes(items, label, errors) {
  if (!Array.isArray(items)) {
    errors.push(`${label} must be an array.`);
    return;
  }

  items.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push(`${label}[${index}] must be an object.`);
      return;
    }

    validateExactKeys(
      item,
      `${label}[${index}]`,
      ["institution", "instruction"],
      errors,
    );

    if (!isString(item.institution)) {
      errors.push(`${label}[${index}].institution must be a string.`);
    }
    if (!isString(item.instruction)) {
      errors.push(`${label}[${index}].instruction must be a string.`);
    }
  });
}

function arrayHasMeaningfulText(value) {
  return Array.isArray(value) && value.some((item) => hasMeaningfulText(item));
}

function workExperienceHasMeaningfulContent(items) {
  return (
    Array.isArray(items) &&
    items.some(
      (item) =>
        hasMeaningfulText(item?.title) ||
        hasMeaningfulText(item?.company) ||
        hasMeaningfulText(item?.years) ||
        hasMeaningfulText(item?.location) ||
        arrayHasMeaningfulText(item?.description),
    )
  );
}

function educationHasMeaningfulContent(items) {
  return (
    Array.isArray(items) &&
    items.some(
      (item) =>
        hasMeaningfulText(item?.institution) ||
        hasMeaningfulText(item?.degree) ||
        hasMeaningfulText(item?.years) ||
        hasMeaningfulText(item?.description),
    )
  );
}

function personalProjectsHasMeaningfulContent(items) {
  return (
    Array.isArray(items) &&
    items.some(
      (item) =>
        hasMeaningfulText(item?.name) ||
        hasMeaningfulText(item?.role) ||
        hasMeaningfulText(item?.years) ||
        hasMeaningfulText(item?.github) ||
        hasMeaningfulText(item?.website) ||
        arrayHasMeaningfulText(item?.description),
    )
  );
}

function additionalHasMeaningfulContent(additional) {
  return Boolean(
    additional &&
    typeof additional === "object" &&
    ["technicalSkills", "languages", "certificationsTraining", "awards"].some(
      (field) => arrayHasMeaningfulText(additional[field]),
    ),
  );
}

function customSectionsHaveMeaningfulContent(customSections) {
  if (
    !customSections ||
    typeof customSections !== "object" ||
    Array.isArray(customSections)
  ) {
    return false;
  }

  return Object.values(customSections).some((section) => {
    if (!section || typeof section !== "object") return false;
    if (hasMeaningfulText(section.text)) return true;
    if (arrayHasMeaningfulText(section.strings)) return true;
    if (Array.isArray(section.items)) {
      return section.items.some(
        (item) =>
          hasMeaningfulText(item?.title) ||
          hasMeaningfulText(item?.subtitle) ||
          hasMeaningfulText(item?.location) ||
          hasMeaningfulText(item?.years) ||
          arrayHasMeaningfulText(item?.description),
      );
    }
    return false;
  });
}

function looksLikeEmptyResumeTemplate(data) {
  const personalInfo = data?.personalInfo;
  const personalInfoHasMeaningfulContent =
    personalInfo &&
    typeof personalInfo === "object" &&
    [
      "name",
      "title",
      "customTagline",
      "email",
      "phone",
      "location",
      "website",
      "linkedin",
      "github",
    ].some((field) => hasMeaningfulText(personalInfo[field]));

  return !(
    personalInfoHasMeaningfulContent ||
    hasMeaningfulText(data?.summary) ||
    workExperienceHasMeaningfulContent(data?.workExperience) ||
    educationHasMeaningfulContent(data?.education) ||
    personalProjectsHasMeaningfulContent(data?.personalProjects) ||
    additionalHasMeaningfulContent(data?.additional) ||
    customSectionsHaveMeaningfulContent(data?.customSections)
  );
}

function validateSectionMetaItem(item, index, errors) {
  const validSectionTypes = new Set([
    "personalInfo",
    "text",
    "itemList",
    "stringList",
  ]);
  if (!item || typeof item !== "object") {
    errors.push(`sectionMeta[${index}] must be an object.`);
    return;
  }
  if (!isString(item.id))
    errors.push(`sectionMeta[${index}].id must be a string.`);
  if (!isString(item.key))
    errors.push(`sectionMeta[${index}].key must be a string.`);
  if (!isString(item.displayName))
    errors.push(`sectionMeta[${index}].displayName must be a string.`);
  if (!validSectionTypes.has(item.sectionType)) {
    errors.push(
      `sectionMeta[${index}].sectionType must be one of personalInfo, text, itemList, stringList.`,
    );
  }
  if (typeof item.isDefault !== "boolean")
    errors.push(`sectionMeta[${index}].isDefault must be a boolean.`);
  if (typeof item.isVisible !== "boolean")
    errors.push(`sectionMeta[${index}].isVisible must be a boolean.`);
  if (!Number.isInteger(item.order))
    errors.push(`sectionMeta[${index}].order must be an integer.`);
}

function validateCustomSection(section, key, errors) {
  const validSectionTypes = new Set([
    "text",
    "itemList",
    "stringList",
    "personalInfo",
  ]);
  if (!section || typeof section !== "object") {
    errors.push(`customSections.${key} must be an object.`);
    return;
  }
  if (!validSectionTypes.has(section.sectionType)) {
    errors.push(`customSections.${key}.sectionType is invalid.`);
  }
  if (section.sectionType === "text" && !isNullableString(section.text)) {
    errors.push(`customSections.${key}.text must be a string or null.`);
  }
  if (
    section.sectionType === "stringList" &&
    section.strings != null &&
    !isStringArray(section.strings)
  ) {
    errors.push(
      `customSections.${key}.strings must be an array of strings or null.`,
    );
  }
  if (section.sectionType === "itemList" && section.items != null) {
    if (!Array.isArray(section.items)) {
      errors.push(`customSections.${key}.items must be an array or null.`);
    } else {
      section.items.forEach((item, index) => {
        if (!item || typeof item !== "object") {
          errors.push(
            `customSections.${key}.items[${index}] must be an object.`,
          );
          return;
        }
        if (!Number.isInteger(item.id))
          errors.push(
            `customSections.${key}.items[${index}].id must be an integer.`,
          );
        if (!isString(item.title))
          errors.push(
            `customSections.${key}.items[${index}].title must be a string.`,
          );
        if (!isNullableString(item.subtitle))
          errors.push(
            `customSections.${key}.items[${index}].subtitle must be a string or null.`,
          );
        if (!isNullableString(item.location))
          errors.push(
            `customSections.${key}.items[${index}].location must be a string or null.`,
          );
        if (!isString(item.years))
          errors.push(
            `customSections.${key}.items[${index}].years must be a string.`,
          );
        if (!isStringArray(item.description))
          errors.push(
            `customSections.${key}.items[${index}].description must be an array of strings.`,
          );
      });
    }
  }
}

export function validateResumeData(data) {
  const errors = [];
  if (!data || typeof data !== "object") {
    return ["Resume data must be an object."];
  }

  const personalInfo = data.personalInfo;
  if (!personalInfo || typeof personalInfo !== "object") {
    errors.push("personalInfo must be an object.");
  } else {
    ["name", "title", "email", "phone", "location"].forEach((field) => {
      if (!isString(personalInfo[field])) {
        errors.push(`personalInfo.${field} must be a string.`);
      }
    });
    ["customTagline", "website", "linkedin", "github"].forEach((field) => {
      if (!isNullableString(personalInfo[field])) {
        errors.push(`personalInfo.${field} must be a string or null.`);
      }
    });
  }

  if (!isString(data.summary)) errors.push("summary must be a string.");

  if (!Array.isArray(data.workExperience)) {
    errors.push("workExperience must be an array.");
  } else {
    data.workExperience.forEach((item, index) => {
      if (!Number.isInteger(item.id))
        errors.push(`workExperience[${index}].id must be an integer.`);
      if (!isString(item.title))
        errors.push(`workExperience[${index}].title must be a string.`);
      if (!isString(item.company))
        errors.push(`workExperience[${index}].company must be a string.`);
      if (!isNullableString(item.location))
        errors.push(
          `workExperience[${index}].location must be a string or null.`,
        );
      if (!isNullableString(item.context))
        errors.push(
          `workExperience[${index}].context must be a string or null.`,
        );
      if (!isString(item.years))
        errors.push(`workExperience[${index}].years must be a string.`);
      if (!isStringArray(item.description))
        errors.push(
          `workExperience[${index}].description must be an array of strings.`,
        );
    });
  }

  if (!Array.isArray(data.education)) {
    errors.push("education must be an array.");
  } else {
    data.education.forEach((item, index) => {
      if (!Number.isInteger(item.id))
        errors.push(`education[${index}].id must be an integer.`);
      if (!isString(item.institution))
        errors.push(`education[${index}].institution must be a string.`);
      if (!isString(item.degree))
        errors.push(`education[${index}].degree must be a string.`);
      if (!isString(item.years))
        errors.push(`education[${index}].years must be a string.`);
      if (!isNullableString(item.description))
        errors.push(
          `education[${index}].description must be a string or null.`,
        );
    });
  }

  if (!Array.isArray(data.personalProjects)) {
    errors.push("personalProjects must be an array.");
  } else {
    data.personalProjects.forEach((item, index) => {
      if (!Number.isInteger(item.id))
        errors.push(`personalProjects[${index}].id must be an integer.`);
      if (!isString(item.name))
        errors.push(`personalProjects[${index}].name must be a string.`);
      if (!isString(item.role))
        errors.push(`personalProjects[${index}].role must be a string.`);
      if (!isString(item.years))
        errors.push(`personalProjects[${index}].years must be a string.`);
      if (!isNullableString(item.github))
        errors.push(
          `personalProjects[${index}].github must be a string or null.`,
        );
      if (!isNullableString(item.website))
        errors.push(
          `personalProjects[${index}].website must be a string or null.`,
        );
      if (!isStringArray(item.description))
        errors.push(
          `personalProjects[${index}].description must be an array of strings.`,
        );
    });
  }

  const additional = data.additional;
  if (!additional || typeof additional !== "object") {
    errors.push("additional must be an object.");
  } else {
    [
      "technicalSkills",
      "languages",
      "certificationsTraining",
      "awards",
    ].forEach((field) => {
      if (!isStringArray(additional[field])) {
        errors.push(`additional.${field} must be an array of strings.`);
      }
    });
  }

  if (!Array.isArray(data.sectionMeta)) {
    errors.push("sectionMeta must be an array.");
  } else {
    data.sectionMeta.forEach((item, index) =>
      validateSectionMetaItem(item, index, errors),
    );
  }

  if (
    !data.customSections ||
    typeof data.customSections !== "object" ||
    Array.isArray(data.customSections)
  ) {
    errors.push("customSections must be an object.");
  } else {
    Object.entries(data.customSections).forEach(([key, section]) =>
      validateCustomSection(section, key, errors),
    );
  }

  if (errors.length === 0 && looksLikeEmptyResumeTemplate(data)) {
    errors.push("Resume data appears to be an empty schema template.");
  }

  return errors;
}

export function validatePrompt1Data(data) {
  const errors = [];
  const allowedTopLevelKeys = [
    "target_role",
    "target_seniority",
    "target_domain",
    "company_context",
    "role_archetype",
    "gating_requirements",
    "high_signal_requirements",
    "medium_signal_requirements",
    "nice_to_have_keywords",
    "exact_phrases_to_mirror",
    "gating_qualifications",
    "near_gate_qualifications",
    "preferred_qualifications",
    "core_responsibilities",
    "recruiter_hooks",
    "hiring_manager_proof",
    "domain_terms",
    "metrics_kpis",
    "tools_platforms",
    "soft_skills",
    "keywords_to_repeat_naturally",
    "section_targets",
    "do_not_fake",
    "deprioritize",
    "jd_notes",
  ];

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return ["Prompt 1 data must be an object."];
  }

  validateExactKeys(data, "prompt1", allowedTopLevelKeys, errors);

  [
    "target_role",
    "target_seniority",
    "target_domain",
    "company_context",
    "role_archetype",
  ].forEach((field) => {
    if (!isString(data[field])) {
      errors.push(`prompt1.${field} must be a string.`);
    }
  });

  validateKeywordObjects(
    data.gating_requirements,
    "prompt1.gating_requirements",
    errors,
  );
  validateKeywordObjects(
    data.high_signal_requirements,
    "prompt1.high_signal_requirements",
    errors,
  );
  validateKeywordObjects(
    data.medium_signal_requirements,
    "prompt1.medium_signal_requirements",
    errors,
  );
  validateKeywordObjects(
    data.nice_to_have_keywords,
    "prompt1.nice_to_have_keywords",
    errors,
  );

  [
    "exact_phrases_to_mirror",
    "gating_qualifications",
    "near_gate_qualifications",
    "preferred_qualifications",
    "core_responsibilities",
    "recruiter_hooks",
    "hiring_manager_proof",
    "domain_terms",
    "metrics_kpis",
    "tools_platforms",
    "soft_skills",
    "keywords_to_repeat_naturally",
    "do_not_fake",
    "deprioritize",
    "jd_notes",
  ].forEach((field) => {
    validateStringArrayField(data[field], `prompt1.${field}`, errors);
  });

  if (
    !data.section_targets ||
    typeof data.section_targets !== "object" ||
    Array.isArray(data.section_targets)
  ) {
    errors.push("prompt1.section_targets must be an object.");
  } else {
    validateExactKeys(
      data.section_targets,
      "prompt1.section_targets",
      ["headline", "summary", "experience", "skills"],
      errors,
    );
    ["headline", "summary", "experience", "skills"].forEach((field) => {
      validateStringArrayField(
        data.section_targets[field],
        `prompt1.section_targets.${field}`,
        errors,
      );
    });
  }

  return errors;
}

export function validatePrompt2Data(data) {
  const errors = [];
  const allowedTopLevelKeys = [
    "validated_role",
    "validated_domain",
    "positioning_thesis",
    "top_resume_goals",
    "recommended_title",
    "summary_lead",
    "summary_focus",
    "summary_sentences",
    "voice",
    "adjacent_framing",
    "signal_map",
    "selected_storylines",
    "experience_emphasis",
    "company_context_guidance",
    "bullet_rewrite_instructions",
    "education_notes",
    "final_skills_list",
    "phrases_to_mirror",
    "cannot_claim",
    "skills_to_avoid",
    "signals_to_avoid",
    "gaps",
    "excitement_anchor",
  ];

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return ["Prompt 2 data must be an object."];
  }

  validateExactKeys(data, "prompt2", allowedTopLevelKeys, errors);

  [
    "validated_role",
    "validated_domain",
    "positioning_thesis",
    "recommended_title",
    "summary_lead",
    "voice",
    "adjacent_framing",
  ].forEach((field) => {
    if (!isString(data[field])) {
      errors.push(`prompt2.${field} must be a string.`);
    }
  });

  validateStringArrayField(
    data.top_resume_goals,
    "prompt2.top_resume_goals",
    errors,
  );
  if (
    Array.isArray(data.top_resume_goals) &&
    data.top_resume_goals.length !== 3
  ) {
    errors.push("prompt2.top_resume_goals must contain exactly 3 items.");
  }
  validateStringArrayField(data.summary_focus, "prompt2.summary_focus", errors);
  if (!isInteger(data.summary_sentences) || data.summary_sentences !== 2) {
    errors.push("prompt2.summary_sentences must be exactly 2.");
  }

  validateSignalMap(data.signal_map, "prompt2.signal_map", errors);
  validateSelectedStorylines(
    data.selected_storylines,
    "prompt2.selected_storylines",
    errors,
  );
  validateExperienceEmphasis(
    data.experience_emphasis,
    "prompt2.experience_emphasis",
    errors,
  );
  validateCompanyContextGuidance(
    data.company_context_guidance,
    "prompt2.company_context_guidance",
    errors,
  );
  validateBulletRewriteInstructions(
    data.bullet_rewrite_instructions,
    "prompt2.bullet_rewrite_instructions",
    errors,
  );
  validateEducationNotes(
    data.education_notes,
    "prompt2.education_notes",
    errors,
  );
  validateExcitementAnchor(
    data.excitement_anchor,
    "prompt2.excitement_anchor",
    errors,
  );

  [
    "final_skills_list",
    "phrases_to_mirror",
    "cannot_claim",
    "skills_to_avoid",
    "signals_to_avoid",
    "gaps",
  ].forEach((field) => {
    validateStringArrayField(data[field], `prompt2.${field}`, errors);
  });

  return errors;
}
