import { describe, expect, it } from 'vitest';

import { normalizeApifyJobRecord } from './apify.js';

describe('normalizeApifyJobRecord', () => {
  it('normalizes common Apify job fields into the orchestrator snapshot shape', () => {
    const snapshot = normalizeApifyJobRecord(
      {
        title: 'Senior Product Manager',
        companyName: 'Red Gold',
        location: 'Indiana, United States',
        datePosted: '2026-04-17',
        url: 'https://www.linkedin.com/jobs/view/4387987722/',
        description:
          'About the role\n\nResponsibilities include roadmap ownership and cross-functional leadership.',
      },
      'https://www.linkedin.com/jobs/view/4387987722/',
    );

    expect(snapshot.source).toBe('apify');
    expect(snapshot.title).toBe('Senior Product Manager');
    expect(snapshot.company).toBe('Red Gold');
    expect(snapshot.location).toBe('Indiana, United States');
    expect(snapshot.sourceUrl).toBe(
      'https://www.linkedin.com/jobs/view/4387987722/',
    );
    expect(snapshot.rawText).toContain('Job Title: Senior Product Manager');
    expect(snapshot.rawText).toContain('Company: Red Gold');
    expect(snapshot.rawText).toContain('Location: Indiana, United States');
    expect(snapshot.rawText).toContain('Date Posted: 2026-04-17');
    expect(snapshot.rawText).toContain('Job Description:');
    expect(snapshot.rawText).toContain('Responsibilities include roadmap');
  });

  it('builds a description from structured sections when no direct description exists', () => {
    const snapshot = normalizeApifyJobRecord(
      {
        title: 'Product Manager',
        company: 'Red Gold',
        sections: [
          { heading: 'Summary', text: 'Own product strategy.' },
          { heading: 'Qualifications', content: '5+ years experience.' },
        ],
      },
      'https://www.linkedin.com/jobs/view/123/',
    );

    expect(snapshot.rawText).toContain('Job Title: Product Manager');
    expect(snapshot.rawText).toContain('Company: Red Gold');
    expect(snapshot.rawText).toContain('Job Description:');
    expect(snapshot.rawText).toContain('Summary');
    expect(snapshot.rawText).toContain('Own product strategy.');
    expect(snapshot.rawText).toContain('5+ years experience.');
  });

  it('normalizes the apimaestro nested job detail response shape', () => {
    const snapshot = normalizeApifyJobRecord(
      {
        job_info: {
          title: 'Forward Deployed Product Manager',
          description:
            'Own customer deployments, lead integrations, and turn ambiguous requirements into shipped product.',
          location: 'San Francisco Bay Area',
          employment_status: 'Full-time',
          workplace_types: ['HYBRID'],
          listed_at: '2026-04-15T17:51:38',
        },
        company_info: {
          name: 'Glean',
        },
      },
      'https://www.linkedin.com/jobs/view/1234567890/',
    );

    expect(snapshot.title).toBe('Forward Deployed Product Manager');
    expect(snapshot.company).toBe('Glean');
    expect(snapshot.location).toBe('San Francisco Bay Area');
    expect(snapshot.rawText).toContain(
      'Job Title: Forward Deployed Product Manager',
    );
    expect(snapshot.rawText).toContain('Company: Glean');
    expect(snapshot.rawText).toContain('Location: San Francisco Bay Area');
    expect(snapshot.rawText).toContain('Employment Type: Full-time');
    expect(snapshot.rawText).toContain('Workplace Type: HYBRID');
    expect(snapshot.rawText).toContain('Date Posted: 2026-04-15T17:51:38');
    expect(snapshot.rawText).toContain('Job Description:');
    expect(snapshot.rawText).toContain('Own customer deployments');
  });
});
