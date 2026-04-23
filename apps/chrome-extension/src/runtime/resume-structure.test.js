import { describe, expect, it } from "vitest";

import { alignSectionMetaToSourceResume } from "./resume-structure.js";

describe("resume structure preservation", () => {
  it("preserves source resume section labels and order in tailored output", () => {
    const sourceResume = {
      sectionMeta: [
        { id: "personalInfo", key: "personalInfo", displayName: "Personal Info", sectionType: "personalInfo", isDefault: true, isVisible: true, order: 0 },
        { id: "summary", key: "summary", displayName: "Summary", sectionType: "text", isDefault: true, isVisible: true, order: 1 },
        { id: "workExperience", key: "workExperience", displayName: "Relevant Experience", sectionType: "itemList", isDefault: true, isVisible: true, order: 2 },
        { id: "personalProjects", key: "personalProjects", displayName: "Projects", sectionType: "itemList", isDefault: true, isVisible: true, order: 3 },
        { id: "education", key: "education", displayName: "Education", sectionType: "itemList", isDefault: true, isVisible: true, order: 4 },
      ],
    };

    const generatedResume = {
      sectionMeta: [
        { id: "personalInfo", key: "personalInfo", displayName: "Personal Info", sectionType: "personalInfo", isDefault: true, isVisible: true, order: 0 },
        { id: "summary", key: "summary", displayName: "Summary", sectionType: "text", isDefault: true, isVisible: true, order: 1 },
        { id: "workExperience", key: "workExperience", displayName: "Experience", sectionType: "itemList", isDefault: true, isVisible: true, order: 2 },
        { id: "education", key: "education", displayName: "Education", sectionType: "itemList", isDefault: true, isVisible: true, order: 3 },
        { id: "personalProjects", key: "personalProjects", displayName: "Projects", sectionType: "itemList", isDefault: true, isVisible: true, order: 4 },
      ],
    };

    const aligned = alignSectionMetaToSourceResume(sourceResume, generatedResume);

    expect(aligned.sectionMeta.map((item) => item.key)).toEqual([
      "personalInfo",
      "summary",
      "workExperience",
      "personalProjects",
      "education",
    ]);
    expect(aligned.sectionMeta[2].displayName).toBe("Relevant Experience");
  });
});
