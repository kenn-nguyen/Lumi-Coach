import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Resume, { type ResumeData } from '@/components/dashboard/resume-component';
import { DEFAULT_TEMPLATE_SETTINGS, type TemplateType } from '@/lib/types/template-settings';

const templates: TemplateType[] = [
  'swiss-single',
  'swiss-two-column',
  'modern',
  'modern-two-column',
];

const resumeData: ResumeData = {
  personalInfo: {
    name: 'Hung Nguyen',
    title: 'Software Engineer',
  },
  workExperience: [
    {
      id: 1,
      title: 'Platform Lead',
      company: 'Acme',
      website: 'https://www.acme.com/case-study/',
      location: 'New York, NY',
      context: 'Series B identity platform',
      years: 'Jun 2021 - Aug 2023',
      description: ['Built production systems.'],
    },
  ],
  education: [],
  personalProjects: [],
  additional: {},
};

describe('Resume experience website link rendering', () => {
  templates.forEach((template) => {
    it(`renders the experience website link in ${template}`, () => {
      const { container } = render(
        <Resume
          resumeData={resumeData}
          settings={{
            ...DEFAULT_TEMPLATE_SETTINGS,
            template,
          }}
        />
      );

      const link = container.querySelector<HTMLAnchorElement>(
        'a[href="https://www.acme.com/case-study/"]'
      );

      expect(link).not.toBeNull();
      expect(link?.textContent).toContain('acme.com/case-study');
      expect(link?.textContent).not.toContain('https://');
      expect(link?.textContent).not.toContain('www.');
      expect(link?.closest('span')?.textContent).toContain('Acme');
      expect(container.textContent).toContain('Experience');
    });

    it(`defaults to company-first experience headers in ${template}`, () => {
      const { container } = render(
        <Resume
          resumeData={resumeData}
          settings={{
            ...DEFAULT_TEMPLATE_SETTINGS,
            template,
          }}
        />
      );

      const text = container.textContent ?? '';
      expect(text.indexOf('Acme')).toBeGreaterThanOrEqual(0);
      expect(text.indexOf('Acme')).toBeLessThan(text.indexOf('Series B identity platform'));
      expect(text.indexOf('Series B identity platform')).toBeLessThan(
        text.indexOf('Platform Lead')
      );
    });

    it(`can render role-first experience headers in ${template}`, () => {
      const { container } = render(
        <Resume
          resumeData={resumeData}
          settings={{
            ...DEFAULT_TEMPLATE_SETTINGS,
            template,
            experienceHeaderOrder: 'role-first',
          }}
        />
      );

      const text = container.textContent ?? '';
      expect(text.indexOf('Platform Lead')).toBeGreaterThanOrEqual(0);
      expect(text.indexOf('Platform Lead')).toBeLessThan(text.indexOf('Acme'));
      expect(text.indexOf('Acme')).toBeLessThan(text.indexOf('Series B identity platform'));
    });
  });
});
