import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Resume, { type ResumeData } from '@/components/dashboard/resume-component';
import { DEFAULT_TEMPLATE_SETTINGS } from '@/lib/types/template-settings';
import { DEFAULT_SECTION_META } from '@/lib/utils/section-helpers';

const resumeData: ResumeData = {
  personalInfo: {
    name: 'Hung Nguyen',
    title: 'Software Engineer',
  },
  workExperience: [
    {
      id: 1,
      title: 'Software Engineer',
      company: 'Acme',
      years: 'Jun 2021 - Aug 2023',
      description: ['Built production systems.'],
    },
  ],
  education: [
    {
      id: 1,
      institution: 'State University',
      degree: 'B.S. Computer Science',
      years: '06/2018 - 05/2020',
    },
  ],
  personalProjects: [
    {
      id: 1,
      name: 'Portfolio Builder',
      role: 'Creator',
      years: 'June 2020 - Present',
      description: ['Built a project.'],
    },
  ],
  sectionMeta: [
    ...DEFAULT_SECTION_META,
    {
      id: 'custom_1',
      key: 'custom_1',
      displayName: 'Custom Dates',
      sectionType: 'itemList',
      isDefault: false,
      isVisible: true,
      order: 6,
    },
  ],
  customSections: {
    custom_1: {
      sectionType: 'itemList',
      items: [
        {
          id: 1,
          title: 'Hackathon',
          years: 'Sep 2019 - Oct 2019',
          description: ['Custom item-list date stays month/year.'],
        },
      ],
    },
  },
};

describe('Resume date display rendering', () => {
  it('renders year-only dates for built-in experience, education, and projects', () => {
    const { container } = render(
      <Resume
        resumeData={resumeData}
        settings={{
          ...DEFAULT_TEMPLATE_SETTINGS,
          dateDisplay: 'year-only',
        }}
      />
    );

    expect(container.textContent).toContain('2021 - 2023');
    expect(container.textContent).toContain('2018 - 2020');
    expect(container.textContent).toContain('2020 - Present');
  });

  it('does not apply year-only conversion to custom item-list sections', () => {
    const { container } = render(
      <Resume
        resumeData={resumeData}
        settings={{
          ...DEFAULT_TEMPLATE_SETTINGS,
          dateDisplay: 'year-only',
        }}
      />
    );

    expect(container.textContent).toContain('Sep 2019 - Oct 2019');
  });
});
