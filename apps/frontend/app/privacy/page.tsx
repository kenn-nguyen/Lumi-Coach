import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | Lumi Coach',
  description: 'Privacy Policy for the Lumi Coach web app and Chrome extension.',
};

const sections = [
  {
    title: 'Scope',
    body: [
      'This policy applies to the Lumi Coach website, authenticated web application, and Chrome extension.',
      'The Chrome extension is designed to help users tailor a resume for a LinkedIn job posting and open the result inside Lumi Coach.',
    ],
  },
  {
    title: 'Information We Process',
    body: [
      'Account and sign-in data, such as the name, email address, and profile image returned by your Google sign-in session.',
      'Resume and job-application data that you choose to upload, edit, or generate, including resume content, contact details, storyboard content, tailored resume outputs, and job descriptions.',
      'LinkedIn job-page content that the extension reads from the active job posting, including title, company, location, source URL, and job description text.',
      'Extension settings and local working data, including prompt templates, run history, extension session state, and provider settings.',
      'If you choose a direct provider API mode, your OpenAI, Anthropic, or Google AI API key is stored locally in your browser extension storage and used to send your requests directly to that provider.',
      'Website and product analytics data may be collected on the web app to understand page visits and product usage.',
    ],
  },
  {
    title: 'How We Use Information',
    body: [
      'To authenticate you and keep your Lumi Coach account signed in.',
      'To create, clone, patch, preview, and organize resumes and related job context inside Lumi Coach.',
      'To run the Chrome extension workflow, including scraping the current LinkedIn job posting, preparing prompts, generating tailored resume output, and opening the result for review.',
      'To store your extension preferences and recover in-progress work if a run is interrupted.',
      'To operate, secure, debug, and improve the product.',
    ],
  },
  {
    title: 'Local-Only Storage in the Chrome Extension',
    body: [
      'The extension stores certain data locally in Chrome storage, including uploaded resume context, storyboard files, prompt templates, run history, extension auth tokens, and optional provider API keys.',
      'User-supplied provider API keys are not sent to Lumi Coach servers merely because they are saved in the extension. They are used only when you select that provider mode and initiate a request.',
    ],
  },
  {
    title: 'When Data Is Shared',
    body: [
      'With Lumi Coach services when needed to sign you in, issue extension access tokens, upload job descriptions, update resumes, link job context, or open your generated result.',
      'With the AI provider you explicitly choose when you run a generation flow. Depending on your settings, this may be OpenAI, Anthropic, or Google.',
      'With service providers that help operate the web app, such as hosting, authentication, and analytics providers.',
      'When required by law, legal process, or to protect the rights, safety, and security of Lumi Coach and its users.',
    ],
  },
  {
    title: 'Retention',
    body: [
      'Data stored in your browser extension remains there until you clear it, remove the extension, or replace it with newer values.',
      'Data stored in your Lumi Coach account remains available until you delete it or your account data is otherwise removed from the service.',
    ],
  },
  {
    title: 'Your Choices',
    body: [
      'You can sign out of Lumi Coach at any time.',
      'You can remove local extension data by clearing extension storage or uninstalling the extension.',
      'You can stop using direct provider API modes at any time and remove any saved provider API key from extension settings.',
    ],
  },
  {
    title: 'Contact',
    body: [
      'For privacy questions about Lumi Coach or the Chrome extension, use the contact method listed in the Chrome Web Store listing or the public Lumi Coach website where this policy is published.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="skin-page-brand min-h-screen px-6 py-10 sm:px-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="border border-black bg-[#f6f2e8] p-6 shadow-[8px_8px_0_0_rgba(0,0,0,0.12)] sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[#1D4ED8]">
                Lumi Coach
              </p>
              <h1 className="font-serif text-4xl leading-none tracking-[-0.05em] text-black sm:text-6xl">
                Privacy Policy
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-black/75 sm:text-base">
                Effective date: April 18, 2026. This page is intended to satisfy the public privacy
                policy requirement for the Lumi Coach web app and Chrome extension.
              </p>
            </div>

            <div className="flex flex-col gap-3 self-start text-left sm:text-right">
              <Link
                href="/"
                className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-black underline underline-offset-4"
              >
                Back to Home
              </Link>
              <Link
                href="/sign-in"
                className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-black underline underline-offset-4"
              >
                Sign In
              </Link>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[0.34fr_0.66fr]">
          <aside className="border border-black bg-white/90 p-6 shadow-[8px_8px_0_0_rgba(0,0,0,0.08)]">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[#1D4ED8]">
              Disclosure Summary
            </p>
            <div className="mt-5 space-y-5 text-sm leading-7 text-black/80">
              <p>
                The extension reads LinkedIn job-posting content, stores working state locally, and
                sends data only to Lumi Coach services and the AI provider selected by the user.
              </p>
              <p>
                User-provided OpenAI, Anthropic, and Google AI API keys are stored locally in the
                extension and are not uploaded to Lumi Coach servers just because they were saved.
              </p>
            </div>
          </aside>

          <div className="space-y-6">
            {sections.map((section) => (
              <section
                key={section.title}
                className="border border-black bg-white/92 p-6 shadow-[8px_8px_0_0_rgba(0,0,0,0.08)] sm:p-7"
              >
                <h2 className="font-serif text-2xl tracking-[-0.04em] text-black sm:text-3xl">
                  {section.title}
                </h2>
                <div className="mt-4 space-y-3 text-sm leading-7 text-black/80 sm:text-base">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
