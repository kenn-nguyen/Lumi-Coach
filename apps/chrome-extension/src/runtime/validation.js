function isString(value) {
  return typeof value === 'string';
}

function isNullableString(value) {
  return value == null || typeof value === 'string';
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function hasMeaningfulText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function arrayHasMeaningfulText(value) {
  return Array.isArray(value) && value.some((item) => hasMeaningfulText(item));
}

function workExperienceHasMeaningfulContent(items) {
  return Array.isArray(items) && items.some((item) =>
    hasMeaningfulText(item?.title) ||
    hasMeaningfulText(item?.company) ||
    hasMeaningfulText(item?.years) ||
    hasMeaningfulText(item?.location) ||
    arrayHasMeaningfulText(item?.description)
  );
}

function educationHasMeaningfulContent(items) {
  return Array.isArray(items) && items.some((item) =>
    hasMeaningfulText(item?.institution) ||
    hasMeaningfulText(item?.degree) ||
    hasMeaningfulText(item?.years) ||
    hasMeaningfulText(item?.description)
  );
}

function personalProjectsHasMeaningfulContent(items) {
  return Array.isArray(items) && items.some((item) =>
    hasMeaningfulText(item?.name) ||
    hasMeaningfulText(item?.role) ||
    hasMeaningfulText(item?.years) ||
    hasMeaningfulText(item?.github) ||
    hasMeaningfulText(item?.website) ||
    arrayHasMeaningfulText(item?.description)
  );
}

function additionalHasMeaningfulContent(additional) {
  return Boolean(
    additional &&
    typeof additional === 'object' &&
    ['technicalSkills', 'languages', 'certificationsTraining', 'awards'].some((field) =>
      arrayHasMeaningfulText(additional[field])
    )
  );
}

function customSectionsHaveMeaningfulContent(customSections) {
  if (!customSections || typeof customSections !== 'object' || Array.isArray(customSections)) {
    return false;
  }

  return Object.values(customSections).some((section) => {
    if (!section || typeof section !== 'object') return false;
    if (hasMeaningfulText(section.text)) return true;
    if (arrayHasMeaningfulText(section.strings)) return true;
    if (Array.isArray(section.items)) {
      return section.items.some((item) =>
        hasMeaningfulText(item?.title) ||
        hasMeaningfulText(item?.subtitle) ||
        hasMeaningfulText(item?.location) ||
        hasMeaningfulText(item?.years) ||
        arrayHasMeaningfulText(item?.description)
      );
    }
    return false;
  });
}

function looksLikeEmptyResumeTemplate(data) {
  const personalInfo = data?.personalInfo;
  const personalInfoHasMeaningfulContent =
    personalInfo &&
    typeof personalInfo === 'object' &&
    [
      'name',
      'title',
      'customTagline',
      'email',
      'phone',
      'location',
      'website',
      'linkedin',
      'github',
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
  const validSectionTypes = new Set(['personalInfo', 'text', 'itemList', 'stringList']);
  if (!item || typeof item !== 'object') {
    errors.push(`sectionMeta[${index}] must be an object.`);
    return;
  }
  if (!isString(item.id)) errors.push(`sectionMeta[${index}].id must be a string.`);
  if (!isString(item.key)) errors.push(`sectionMeta[${index}].key must be a string.`);
  if (!isString(item.displayName)) errors.push(`sectionMeta[${index}].displayName must be a string.`);
  if (!validSectionTypes.has(item.sectionType)) {
    errors.push(`sectionMeta[${index}].sectionType must be one of personalInfo, text, itemList, stringList.`);
  }
  if (typeof item.isDefault !== 'boolean') errors.push(`sectionMeta[${index}].isDefault must be a boolean.`);
  if (typeof item.isVisible !== 'boolean') errors.push(`sectionMeta[${index}].isVisible must be a boolean.`);
  if (!Number.isInteger(item.order)) errors.push(`sectionMeta[${index}].order must be an integer.`);
}

function validateCustomSection(section, key, errors) {
  const validSectionTypes = new Set(['text', 'itemList', 'stringList', 'personalInfo']);
  if (!section || typeof section !== 'object') {
    errors.push(`customSections.${key} must be an object.`);
    return;
  }
  if (!validSectionTypes.has(section.sectionType)) {
    errors.push(`customSections.${key}.sectionType is invalid.`);
  }
  if (section.sectionType === 'text' && !isNullableString(section.text)) {
    errors.push(`customSections.${key}.text must be a string or null.`);
  }
  if (section.sectionType === 'stringList' && section.strings != null && !isStringArray(section.strings)) {
    errors.push(`customSections.${key}.strings must be an array of strings or null.`);
  }
  if (section.sectionType === 'itemList' && section.items != null) {
    if (!Array.isArray(section.items)) {
      errors.push(`customSections.${key}.items must be an array or null.`);
    } else {
      section.items.forEach((item, index) => {
        if (!item || typeof item !== 'object') {
          errors.push(`customSections.${key}.items[${index}] must be an object.`);
          return;
        }
        if (!Number.isInteger(item.id)) errors.push(`customSections.${key}.items[${index}].id must be an integer.`);
        if (!isString(item.title)) errors.push(`customSections.${key}.items[${index}].title must be a string.`);
        if (!isNullableString(item.subtitle)) errors.push(`customSections.${key}.items[${index}].subtitle must be a string or null.`);
        if (!isNullableString(item.location)) errors.push(`customSections.${key}.items[${index}].location must be a string or null.`);
        if (!isString(item.years)) errors.push(`customSections.${key}.items[${index}].years must be a string.`);
        if (!isStringArray(item.description)) errors.push(`customSections.${key}.items[${index}].description must be an array of strings.`);
      });
    }
  }
}

export function validateResumeData(data) {
  const errors = [];
  if (!data || typeof data !== 'object') {
    return ['Resume data must be an object.'];
  }

  const personalInfo = data.personalInfo;
  if (!personalInfo || typeof personalInfo !== 'object') {
    errors.push('personalInfo must be an object.');
  } else {
    ['name', 'title', 'email', 'phone', 'location'].forEach((field) => {
      if (!isString(personalInfo[field])) {
        errors.push(`personalInfo.${field} must be a string.`);
      }
    });
    ['customTagline', 'website', 'linkedin', 'github'].forEach((field) => {
      if (!isNullableString(personalInfo[field])) {
        errors.push(`personalInfo.${field} must be a string or null.`);
      }
    });
  }

  if (!isString(data.summary)) errors.push('summary must be a string.');

  if (!Array.isArray(data.workExperience)) {
    errors.push('workExperience must be an array.');
  } else {
    data.workExperience.forEach((item, index) => {
      if (!Number.isInteger(item.id)) errors.push(`workExperience[${index}].id must be an integer.`);
      if (!isString(item.title)) errors.push(`workExperience[${index}].title must be a string.`);
      if (!isString(item.company)) errors.push(`workExperience[${index}].company must be a string.`);
      if (!isNullableString(item.location)) errors.push(`workExperience[${index}].location must be a string or null.`);
      if (!isString(item.years)) errors.push(`workExperience[${index}].years must be a string.`);
      if (!isStringArray(item.description)) errors.push(`workExperience[${index}].description must be an array of strings.`);
    });
  }

  if (!Array.isArray(data.education)) {
    errors.push('education must be an array.');
  } else {
    data.education.forEach((item, index) => {
      if (!Number.isInteger(item.id)) errors.push(`education[${index}].id must be an integer.`);
      if (!isString(item.institution)) errors.push(`education[${index}].institution must be a string.`);
      if (!isString(item.degree)) errors.push(`education[${index}].degree must be a string.`);
      if (!isString(item.years)) errors.push(`education[${index}].years must be a string.`);
      if (!isNullableString(item.description)) errors.push(`education[${index}].description must be a string or null.`);
    });
  }

  if (!Array.isArray(data.personalProjects)) {
    errors.push('personalProjects must be an array.');
  } else {
    data.personalProjects.forEach((item, index) => {
      if (!Number.isInteger(item.id)) errors.push(`personalProjects[${index}].id must be an integer.`);
      if (!isString(item.name)) errors.push(`personalProjects[${index}].name must be a string.`);
      if (!isString(item.role)) errors.push(`personalProjects[${index}].role must be a string.`);
      if (!isString(item.years)) errors.push(`personalProjects[${index}].years must be a string.`);
      if (!isNullableString(item.github)) errors.push(`personalProjects[${index}].github must be a string or null.`);
      if (!isNullableString(item.website)) errors.push(`personalProjects[${index}].website must be a string or null.`);
      if (!isStringArray(item.description)) errors.push(`personalProjects[${index}].description must be an array of strings.`);
    });
  }

  const additional = data.additional;
  if (!additional || typeof additional !== 'object') {
    errors.push('additional must be an object.');
  } else {
    ['technicalSkills', 'languages', 'certificationsTraining', 'awards'].forEach((field) => {
      if (!isStringArray(additional[field])) {
        errors.push(`additional.${field} must be an array of strings.`);
      }
    });
  }

  if (!Array.isArray(data.sectionMeta)) {
    errors.push('sectionMeta must be an array.');
  } else {
    data.sectionMeta.forEach((item, index) => validateSectionMetaItem(item, index, errors));
  }

  if (!data.customSections || typeof data.customSections !== 'object' || Array.isArray(data.customSections)) {
    errors.push('customSections must be an object.');
  } else {
    Object.entries(data.customSections).forEach(([key, section]) => validateCustomSection(section, key, errors));
  }

  if (errors.length === 0 && looksLikeEmptyResumeTemplate(data)) {
    errors.push('Resume data appears to be an empty schema template.');
  }

  return errors;
}
