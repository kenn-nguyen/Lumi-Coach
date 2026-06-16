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

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableNote(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeKeywordObjectArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      keyword: normalizeString(item.keyword),
      priority:
        isInteger(item.priority) && item.priority >= 1 && item.priority <= 10
          ? item.priority
          : 5,
      type: item.type === "inferred" ? "inferred" : "exact",
    }));
}

function normalizeSignalMap(value) {
  const validSupport = new Set(["direct", "adjacent", "unsupported"]);
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      signal: normalizeString(item.signal),
      support: validSupport.has(item.support) ? item.support : "unsupported",
      evidence: normalizeStringArray(item.evidence),
      surface_in: normalizeStringArray(item.surface_in),
    }));
}

function normalizeSelectedStorylines(value) {
  const validStrength = new Set(["high", "medium"]);
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      label: normalizeString(item.label),
      strength: validStrength.has(item.strength) ? item.strength : "medium",
      angles: normalizeStringArray(item.angles),
      proof_points: normalizeStringArray(item.proof_points),
      anchor_role: normalizeString(item.anchor_role),
      anchor_bullet: normalizeString(item.anchor_bullet),
      guardrail: normalizeString(item.guardrail),
    }));
}

function normalizeExperienceEmphasis(value) {
  const validActions = new Set(["keep", "rewrite_all"]);
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      role: normalizeString(item.role),
      default_action: validActions.has(item.default_action)
        ? item.default_action
        : "keep",
      themes_to_emphasize: normalizeStringArray(item.themes_to_emphasize),
      proof_points: normalizeStringArray(item.proof_points),
      deemphasize: normalizeStringArray(item.deemphasize),
      guardrail: normalizeString(item.guardrail),
    }));
}

function normalizeBulletRewriteInstructions(value) {
  const validActions = new Set(["rewrite", "merge"]);
  const validPlacementHints = new Set(["lead", "top2", "normal"]);
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      role: normalizeString(item.role),
      action: validActions.has(item.action) ? item.action : "rewrite",
      bullet_anchor: normalizeString(item.bullet_anchor),
      merge_with: normalizeStringArray(item.merge_with),
      placement_hint: validPlacementHints.has(item.placement_hint)
        ? item.placement_hint
        : "normal",
      guardrail: normalizeString(item.guardrail),
    }));
}

function normalizeExcitementAnchor(value) {
  const validPlacements = new Set([
    "summary",
    "first_bullet_of_recent_role",
    "both",
  ]);

  return {
    claim: normalizeString(value?.claim),
    evidence: normalizeString(value?.evidence),
    placement: validPlacements.has(value?.placement)
      ? value.placement
      : "summary",
    why_distinctive: normalizeString(value?.why_distinctive),
  };
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
      ["keyword", "priority", "type"],
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

function validateBulletRewriteInstructions(items, label, errors) {
  const validActions = new Set(["rewrite", "merge"]);
  const validPlacementHints = new Set(["lead", "top2", "normal"]);

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
      ["role", "action", "bullet_anchor", "merge_with", "placement_hint", "guardrail"],
      errors,
    );

    if (!isString(item.role))
      errors.push(`${label}[${index}].role must be a string.`);
    if (!validActions.has(item.action)) {
      errors.push(
        `${label}[${index}].action must be exactly "rewrite" or "merge".`,
      );
    }
    if (!isString(item.bullet_anchor)) {
      errors.push(`${label}[${index}].bullet_anchor must be a string.`);
    }
    validateStringArrayField(
      item.merge_with,
      `${label}[${index}].merge_with`,
      errors,
    );
    if (!validPlacementHints.has(item.placement_hint)) {
      errors.push(
        `${label}[${index}].placement_hint must be exactly "lead", "top2", or "normal".`,
      );
    }
    if (!isString(item.guardrail)) {
      errors.push(`${label}[${index}].guardrail must be a string.`);
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
      if (!isNullableString(item.website))
        errors.push(
          `workExperience[${index}].website must be a string or null.`,
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
    "target_native_phrases_to_validate",
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
    "do_not_fake",
    "deprioritize",
    "jd_notes",
    "flex_notes",
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
    "target_native_phrases_to_validate",
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
    "do_not_fake",
    "deprioritize",
    "jd_notes",
  ].forEach((field) => {
    validateStringArrayField(data[field], `prompt1.${field}`, errors);
  });

  if (!isNullableString(data.flex_notes)) {
    errors.push("prompt1.flex_notes must be a string or null.");
  }

  return errors;
}

export function validatePrompt1MinimalData(data) {
  const errors = [];

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return ["Prompt 1 data must be an object."];
  }

  ["target_role", "target_seniority", "target_domain"].forEach((field) => {
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

  if ("flex_notes" in data && !isNullableString(data.flex_notes)) {
    errors.push("prompt1.flex_notes must be a string or null.");
  }

  return errors;
}

export function normalizePrompt1Data(data) {
  return {
    target_role: normalizeString(data?.target_role),
    target_seniority: normalizeString(data?.target_seniority),
    target_domain: normalizeString(data?.target_domain),
    company_context: normalizeString(data?.company_context),
    role_archetype: normalizeString(data?.role_archetype),
    gating_requirements: normalizeKeywordObjectArray(data?.gating_requirements),
    high_signal_requirements: normalizeKeywordObjectArray(
      data?.high_signal_requirements,
    ),
    medium_signal_requirements: normalizeKeywordObjectArray(
      data?.medium_signal_requirements,
    ),
    nice_to_have_keywords: normalizeKeywordObjectArray(
      data?.nice_to_have_keywords,
    ),
    target_native_phrases_to_validate: normalizeStringArray(
      data?.target_native_phrases_to_validate,
    ),
    gating_qualifications: normalizeStringArray(data?.gating_qualifications),
    near_gate_qualifications: normalizeStringArray(
      data?.near_gate_qualifications,
    ),
    preferred_qualifications: normalizeStringArray(
      data?.preferred_qualifications,
    ),
    core_responsibilities: normalizeStringArray(data?.core_responsibilities),
    recruiter_hooks: normalizeStringArray(data?.recruiter_hooks),
    hiring_manager_proof: normalizeStringArray(data?.hiring_manager_proof),
    domain_terms: normalizeStringArray(data?.domain_terms),
    metrics_kpis: normalizeStringArray(data?.metrics_kpis),
    tools_platforms: normalizeStringArray(data?.tools_platforms),
    soft_skills: normalizeStringArray(data?.soft_skills),
    do_not_fake: normalizeStringArray(data?.do_not_fake),
    deprioritize: normalizeStringArray(data?.deprioritize),
    jd_notes: normalizeStringArray(data?.jd_notes),
    flex_notes: normalizeNullableNote(data?.flex_notes),
  };
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
    "signal_map",
    "selected_storylines",
    "experience_emphasis",
    "bullet_rewrite_instructions",
    "final_skills_list",
    "phrases_to_mirror",
    "cannot_claim",
    "skills_to_avoid",
    "signals_to_avoid",
    "gaps",
    "excitement_anchor",
    "flex_notes",
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
  validateBulletRewriteInstructions(
    data.bullet_rewrite_instructions,
    "prompt2.bullet_rewrite_instructions",
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

  if (!isNullableString(data.flex_notes)) {
    errors.push("prompt2.flex_notes must be a string or null.");
  }

  return errors;
}

export function validatePrompt2MinimalData(data) {
  const errors = [];

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return ["Prompt 2 data must be an object."];
  }

  [
    "validated_role",
    "validated_domain",
    "positioning_thesis",
    "recommended_title",
    "summary_lead",
  ].forEach((field) => {
    if (!isString(data[field])) {
      errors.push(`prompt2.${field} must be a string.`);
    }
  });

  ["top_resume_goals", "final_skills_list", "cannot_claim"].forEach((field) => {
    validateStringArrayField(data[field], `prompt2.${field}`, errors);
  });

  if ("flex_notes" in data && !isNullableString(data.flex_notes)) {
    errors.push("prompt2.flex_notes must be a string or null.");
  }

  return errors;
}

export function normalizePrompt2Data(data) {
  return {
    validated_role: normalizeString(data?.validated_role),
    validated_domain: normalizeString(data?.validated_domain),
    positioning_thesis: normalizeString(data?.positioning_thesis),
    top_resume_goals: normalizeStringArray(data?.top_resume_goals),
    recommended_title: normalizeString(data?.recommended_title),
    summary_lead: normalizeString(data?.summary_lead),
    summary_focus: normalizeStringArray(data?.summary_focus),
    excitement_anchor: normalizeExcitementAnchor(data?.excitement_anchor),
    signal_map: normalizeSignalMap(data?.signal_map),
    selected_storylines: normalizeSelectedStorylines(data?.selected_storylines),
    experience_emphasis: normalizeExperienceEmphasis(
      data?.experience_emphasis,
    ),
    bullet_rewrite_instructions: normalizeBulletRewriteInstructions(
      data?.bullet_rewrite_instructions,
    ),
    final_skills_list: normalizeStringArray(data?.final_skills_list),
    phrases_to_mirror: normalizeStringArray(data?.phrases_to_mirror),
    cannot_claim: normalizeStringArray(data?.cannot_claim),
    skills_to_avoid: normalizeStringArray(data?.skills_to_avoid),
    signals_to_avoid: normalizeStringArray(data?.signals_to_avoid),
    gaps: normalizeStringArray(data?.gaps),
    flex_notes: normalizeNullableNote(data?.flex_notes),
  };
}
