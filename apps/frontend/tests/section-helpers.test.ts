import { describe, expect, it } from 'vitest';
import type { ResumeData } from '@/components/dashboard/resume-component';
import { getMissingDefaultSections, restoreDefaultSection } from '@/lib/utils/section-helpers';

describe('section helpers', () => {
  it('reports removed built-in sections as restorable defaults', () => {
    const resumeData: ResumeData = {
      summary: 'PM',
      workExperience: [],
      education: [],
      personalProjects: [],
      additional: {
        technicalSkills: [],
        languages: [],
        certificationsTraining: [],
        awards: [],
      },
      sectionMeta: [
        {
          id: 'personalInfo',
          key: 'personalInfo',
          displayName: 'Personal Info',
          sectionType: 'personalInfo',
          isDefault: true,
          isVisible: true,
          order: 0,
        },
        {
          id: 'summary',
          key: 'summary',
          displayName: 'Summary',
          sectionType: 'text',
          isDefault: true,
          isVisible: true,
          order: 1,
        },
        {
          id: 'workExperience',
          key: 'workExperience',
          displayName: 'Experience',
          sectionType: 'itemList',
          isDefault: true,
          isVisible: true,
          order: 2,
        },
        {
          id: 'education',
          key: 'education',
          displayName: 'Education',
          sectionType: 'itemList',
          isDefault: true,
          isVisible: true,
          order: 3,
        },
        {
          id: 'additional',
          key: 'additional',
          displayName: 'Skills & Awards',
          sectionType: 'stringList',
          isDefault: true,
          isVisible: true,
          order: 5,
        },
      ],
      customSections: {},
    };

    expect(getMissingDefaultSections(resumeData).map((section) => section.key)).toEqual([
      'personalProjects',
    ]);
  });

  it('restores a removed built-in section without creating a custom duplicate', () => {
    const resumeData: ResumeData = {
      personalProjects: [
        {
          id: 1,
          name: 'Resume Matcher',
          role: 'Founder',
          years: '2024 - Present',
          description: ['Built the app'],
        },
      ],
      sectionMeta: [
        {
          id: 'personalInfo',
          key: 'personalInfo',
          displayName: 'Personal Info',
          sectionType: 'personalInfo',
          isDefault: true,
          isVisible: true,
          order: 0,
        },
        {
          id: 'summary',
          key: 'summary',
          displayName: 'Summary',
          sectionType: 'text',
          isDefault: true,
          isVisible: true,
          order: 1,
        },
      ],
      customSections: {},
    };

    const restored = restoreDefaultSection(resumeData, 'personalProjects');

    expect(restored.sectionMeta?.some((section) => section.key === 'personalProjects')).toBe(true);
    expect(restored.customSections).toEqual({});
    expect(restored.personalProjects).toEqual(resumeData.personalProjects);
  });
});
