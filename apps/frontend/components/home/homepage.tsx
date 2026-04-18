import Image from 'next/image';
import Link from 'next/link';

const CHROME_WEB_STORE_URL = 'https://chromewebstore.google.com/';

const coreBenefits = [
  'Fast and easy',
  'Tailor for every job you apply',
  'Sits inside the LinkedIn page',
];

const supportingPoints = [
  {
    title: 'No copy-paste workflow',
    body: 'Open Lumi Coach from the job page and keep the context where you already work.',
  },
  {
    title: 'Tailor faster',
    body: 'Generate a stronger draft for each role without rebuilding your process every time.',
  },
  {
    title: 'Stay organized',
    body: 'Keep your runs, resume outputs, and job context connected in one workflow.',
  },
];

function ExtensionMock() {
  return (
    <div className="rounded-[34px] border border-white/70 bg-[linear-gradient(180deg,rgba(229,240,252,0.94)_0%,rgba(205,223,241,0.96)_100%)] p-3 shadow-[0_24px_60px_rgba(61,94,135,0.18)] backdrop-blur-[20px]">
      <div className="overflow-hidden rounded-[28px] border border-white/70 bg-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
        <div className="flex items-center justify-between border-b border-white/60 px-5 py-4">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Lumi Coach" width={34} height={34} className="size-8" />
            <span className="text-[1.15rem] font-semibold tracking-[-0.04em] text-slate-900">
              Lumi Coach
            </span>
          </div>
          <div className="flex items-center gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="flex size-10 items-center justify-center rounded-full border border-white/65 bg-white/28 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
              >
                <div className="size-3.5 rounded-full border border-current/35" />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5 px-5 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="max-w-[10.5ch] text-[2.55rem] font-semibold leading-[0.94] tracking-[-0.07em] text-slate-900 sm:text-[2.7rem]">
                Forward Deployed Product Manager
              </h3>
              <p className="mt-4 text-[1.05rem] font-semibold tracking-[-0.03em] text-slate-800">
                Glean
              </p>
              <p className="mt-3 max-w-[28ch] text-[0.95rem] leading-7 text-slate-700">
                Reposted 2 days ago • Over 100 people clicked apply
              </p>
            </div>

            <div className="flex size-13 shrink-0 items-center justify-center rounded-full bg-[#34c759] text-[1.75rem] font-bold text-white shadow-[0_10px_26px_rgba(52,199,89,0.38)]">
              ✓
            </div>
          </div>

          <div className="rounded-[22px] border border-white/80 bg-white/78 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
            <span className="block max-w-[22ch] text-[0.95rem] leading-8 tracking-normal text-slate-500">
              Want to tell me extra useful info for this run?
            </span>
          </div>

          <div className="flex gap-4">
            <div className="flex min-h-22 flex-1 items-center justify-center rounded-[28px] border border-white/85 bg-white/78 text-[1.65rem] font-semibold tracking-[-0.04em] text-slate-800 shadow-[0_12px_24px_rgba(61,94,135,0.08)]">
              Minimize
            </div>
            <div className="flex min-h-22 flex-[1.65] items-center justify-center rounded-[28px] bg-[#1677ff] text-[1.65rem] font-semibold tracking-[-0.04em] text-white shadow-[0_18px_34px_rgba(22,119,255,0.32)]">
              Tailor
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BenefitCard({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-[28px] border border-white/60 bg-white/45 p-6 shadow-[0_18px_36px_rgba(61,94,135,0.08)] backdrop-blur-[18px]">
      <h3 className="text-2xl font-semibold tracking-[-0.05em] text-slate-900">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-700 sm:text-base">{body}</p>
    </article>
  );
}

export default function Homepage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#edf5ff_0%,#dce8f5_45%,#eaf2fb_100%)] text-slate-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col px-5 pb-20 pt-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-4 rounded-full border border-white/70 bg-white/35 px-5 py-3 shadow-[0_18px_40px_rgba(61,94,135,0.08)] backdrop-blur-[18px]">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Lumi Coach" width={40} height={40} className="size-10" />
            <span className="text-xl font-semibold tracking-[-0.05em] text-slate-900 sm:text-2xl">
              Lumi Coach
            </span>
          </div>

          <Link
            href="/sign-in"
            className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            Sign in
          </Link>
        </header>

        <section className="grid gap-10 py-12 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
          <div className="flex flex-col gap-8">
            <div>
              <p className="inline-flex rounded-full border border-white/65 bg-white/38 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2453ff] shadow-[0_10px_22px_rgba(61,94,135,0.06)] backdrop-blur-[16px]">
                Chrome Extension
              </p>
              <h1 className="mt-5 max-w-[8ch] text-5xl font-semibold leading-[0.9] tracking-[-0.08em] text-slate-900 sm:text-6xl lg:text-7xl">
                Fast tailoring, right inside LinkedIn.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-slate-700">
                Install the Lumi Coach extension to tailor for every job you apply, without leaving
                the page.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {coreBenefits.map((benefit) => (
                <div
                  key={benefit}
                  className="rounded-full border border-white/70 bg-white/45 px-4 py-2 text-sm font-medium text-slate-800 shadow-[0_12px_24px_rgba(61,94,135,0.05)] backdrop-blur-[16px]"
                >
                  {benefit}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <a
                href={CHROME_WEB_STORE_URL}
                className="inline-flex min-h-14 items-center justify-center rounded-full bg-[#1677ff] px-7 text-base font-semibold text-white shadow-[0_20px_40px_rgba(22,119,255,0.3)] transition hover:translate-y-[1px] hover:opacity-95"
              >
                Add to Chrome
              </a>
              <span className="text-sm text-slate-600">
                One click install. Open it directly on any LinkedIn job.
              </span>
            </div>
          </div>

          <ExtensionMock />
        </section>

        <section className="grid gap-5 border-t border-white/50 py-12 md:grid-cols-3">
          {supportingPoints.map((point) => (
            <BenefitCard key={point.title} title={point.title} body={point.body} />
          ))}
        </section>

        <section className="mt-2 rounded-[36px] border border-white/65 bg-white/35 px-6 py-8 shadow-[0_24px_54px_rgba(61,94,135,0.08)] backdrop-blur-[20px] sm:px-8 sm:py-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2453ff]">
                Why this converts
              </p>
              <h2 className="mt-4 max-w-[12ch] text-4xl font-semibold leading-[0.94] tracking-[-0.07em] text-slate-900 sm:text-5xl">
                Everything the user needs is already on the job page.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-700">
                Lumi Coach is built for the moment someone is actively applying. The extension sits
                inside LinkedIn, keeps the workflow light, and makes tailoring each role feel
                immediate instead of tedious.
              </p>
            </div>

            <div className="flex flex-col items-start gap-3 lg:items-end">
              <a
                href={CHROME_WEB_STORE_URL}
                className="inline-flex min-h-14 items-center justify-center rounded-full bg-slate-950 px-7 text-base font-semibold text-white shadow-[0_20px_40px_rgba(15,23,42,0.24)] transition hover:translate-y-[1px] hover:opacity-95"
              >
                Add to Chrome
              </a>
              <Link
                href="/sign-in"
                className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
              >
                Already installed? Sign in
              </Link>
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-4 border-t border-white/55 py-8 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl">
            Lumi Coach helps users tailor resumes inside LinkedIn and review the result in the web
            app.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link
              href="/privacy"
              className="font-medium text-slate-700 transition hover:text-slate-950"
            >
              Privacy Policy
            </Link>
            <Link
              href="/sign-in"
              className="font-medium text-slate-700 transition hover:text-slate-950"
            >
              Sign in
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
