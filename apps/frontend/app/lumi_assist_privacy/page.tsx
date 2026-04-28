import type { Metadata } from 'next';
import { createPageMetadata } from '@/lib/seo';

export const metadata: Metadata = {
  ...createPageMetadata({
    title: 'Privacy Policy for Lumi Assist',
    description: 'Privacy Policy for the Lumi Assist Chrome extension.',
    path: '/lumi_assist_privacy',
    keywords: ['lumi assist privacy policy', 'chrome extension privacy policy'],
  }),
};

const sections = [
  {
    title: 'Information Lumi Assist Handles',
    body: ['Lumi Assist may read information from supported pages that the user opens, including:'],
    bullets: [
      'LinkedIn profile information visible on the page, such as names, headlines, profile URLs, locations, profile summaries, activity snippets, education, and experience details',
      'Visible LinkedIn messaging thread content when the user imports or uses conversation context',
      'User-entered notes, goals, prompt settings, and edited draft messages',
      'Generated summaries, outreach drafts, and related drafting context',
      'Supported page URLs needed to connect LinkedIn profile pages and messaging threads',
    ],
  },
  {
    title: 'How Information Is Used',
    body: [
      'Lumi Assist uses this information only to provide its single purpose: helping users organize LinkedIn relationship context and draft personalized outreach messages.',
      'Information may be used to:',
    ],
    bullets: [
      'Populate the side panel with relevant LinkedIn profile or conversation context',
      'Save local recipient records, notes, goals, summaries, and drafts',
      'Generate prompt content for supported AI websites',
      'Help users copy an edited message draft for manual use',
    ],
  },
  {
    title: 'Local Storage',
    body: [
      'Lumi Assist stores extension data locally using Chrome storage on the user’s device. This may include sender profile context, recipient records, notes, goals, visible conversation imports, summaries, drafts, and extension settings.',
      'Lumi Assist does not operate its own backend server for storing this data.',
    ],
  },
  {
    title: 'Sharing With Third Parties',
    body: [
      'When the user chooses to generate a draft, Lumi Assist may send selected LinkedIn profile, conversation, sender profile, notes, and drafting context to supported AI websites such as ChatGPT or Gemini through the user’s logged-in browser session.',
      'Those third-party services process submitted information according to their own privacy policies and account settings.',
      'Lumi Assist does not sell user data. Lumi Assist does not transfer user data to advertising platforms, data brokers, or other information resellers.',
    ],
  },
  {
    title: 'Data Not Collected',
    body: ['Lumi Assist does not intentionally collect or store:'],
    bullets: [
      'Financial or payment information',
      'Health information',
      'Passwords or authentication credentials',
      'Creditworthiness or lending information',
    ],
  },
  {
    title: 'User Control',
    body: [
      'Users can edit drafts before copying them. Lumi Assist does not automatically send LinkedIn messages.',
      'Users can remove extension data by clearing the extension’s stored data in Chrome or by uninstalling the extension.',
    ],
  },
  {
    title: 'Limited Use Disclosure',
    body: [
      'Lumi Assist uses user data only to provide and improve its single purpose. Lumi Assist does not use or transfer user data for purposes unrelated to drafting and organizing LinkedIn outreach context. Lumi Assist does not use or transfer user data to determine creditworthiness or for lending purposes.',
    ],
  },
  {
    title: 'Contact',
    body: [
      'For privacy questions about Lumi Assist, contact the developer through the support contact listed on the Chrome Web Store listing.',
    ],
  },
];

export default function LumiAssistPrivacyPage() {
  return (
    <main className="min-h-screen bg-[#F0F0E8] px-6 py-10 text-black sm:px-8 sm:py-14">
      <article className="mx-auto max-w-3xl border border-black bg-white p-6 shadow-[8px_8px_0_0_rgba(0,0,0,0.14)] sm:p-10">
        <header className="border-b border-black pb-6">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#1D4ED8]">
            Lumi Assist
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-none tracking-[-0.04em] sm:text-5xl">
            Privacy Policy for Lumi Assist
          </h1>
          <p className="mt-4 text-sm leading-7 text-black/75">Effective date: April 28, 2026</p>
          <p className="mt-5 text-base leading-8 text-black/80">
            Lumi Assist is a Chrome extension that helps users draft personalized LinkedIn outreach
            messages from LinkedIn profile and messaging context.
          </p>
        </header>

        <div className="mt-8 space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="font-serif text-2xl tracking-[-0.03em]">{section.title}</h2>
              <div className="mt-3 space-y-3 text-sm leading-7 text-black/80 sm:text-base">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.bullets ? (
                  <ul className="list-disc space-y-2 pl-5">
                    {section.bullets.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
