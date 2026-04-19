import type { Metadata } from 'next';
import StoryBankPage from '@/components/home/story-bank-page';
import { createPageMetadata, toAbsoluteUrl } from '@/lib/seo';

export const metadata: Metadata = {
  ...createPageMetadata({
    title: 'Story Bank Guide for Resume Tailoring',
    description:
      'Learn how to build a story bank so AI can tailor your resume with sharper evidence, stronger bullets, and reusable interview stories.',
    path: '/story-bank',
    keywords: [
      'story bank',
      'resume story bank',
      'career stories for resumes',
      'star stories for interviews',
      'resume tailoring guide',
    ],
    type: 'article',
  }),
};

const storyBankStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Story Bank Guide for Resume Tailoring',
  description:
    'A practical guide to building a story bank that helps AI tailor resumes and interview answers with stronger evidence.',
  mainEntityOfPage: toAbsoluteUrl('/story-bank'),
  author: {
    '@type': 'Organization',
    name: 'Lumi Coach',
  },
  publisher: {
    '@type': 'Organization',
    name: 'Lumi Coach',
  },
};

export default function StoryBankRoute(): React.ReactElement {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(storyBankStructuredData) }}
      />
      <StoryBankPage />
    </>
  );
}
