import { createPageMetadata, toAbsoluteUrl } from '@/lib/seo';
import Homepage from '@/components/home/homepage';

const homepageStructuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      name: 'Lumi Coach',
      url: toAbsoluteUrl('/'),
      description:
        'Lumi Coach helps MBA students and recent grads tailor resumes for LinkedIn job applications with AI.',
    },
    {
      '@type': 'SoftwareApplication',
      name: 'Lumi Coach',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web, Chrome Extension',
      url: toAbsoluteUrl('/'),
      description:
        'AI resume builder and Chrome extension for tailoring resumes to LinkedIn job postings.',
      featureList: [
        'Resume tailoring from LinkedIn job pages',
        'AI-assisted resume rewriting',
        'Job-specific application workflow',
        'Story bank support for stronger application evidence',
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What does Lumi Coach do?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Lumi Coach helps MBA students and recent grads tailor a stronger resume for a live LinkedIn job posting without leaving the job-search workflow.',
          },
        },
        {
          '@type': 'Question',
          name: 'Who is Lumi Coach for?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'It is built for MBA candidates, recent graduates, and job seekers who need to react quickly when a promising role appears late in the recruiting cycle.',
          },
        },
        {
          '@type': 'Question',
          name: 'How does the Chrome extension fit into the workflow?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'The extension starts from the LinkedIn job page, captures the job context, and opens the polished draft inside Lumi Coach for review and final edits.',
          },
        },
      ],
    },
  ],
};

export const metadata = createPageMetadata({
  title: 'AI Resume Builder for LinkedIn Job Applications',
  description:
    'Use Lumi Coach to tailor resumes faster for LinkedIn job postings with an AI-assisted workflow built for MBA students and recent grads.',
  path: '/',
  keywords: [
    'ai resume builder',
    'linkedin resume builder',
    'resume tailoring tool',
    'chrome extension for linkedin jobs',
    'mba resume builder',
  ],
});

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homepageStructuredData) }}
      />
      <Homepage />
    </>
  );
}
