import Link from 'next/link';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '500', '700'],
});

export default function Hero() {
  return (
    <section
      className={`relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#0f172a] ${inter.className}`}
    >
      <div
        aria-hidden="true"
        className="absolute -left-[5%] -top-[5%] h-[110%] w-[110%] scale-[1.02] bg-cover bg-center brightness-40 blur-[12px]"
        style={{
          backgroundImage:
            "url('https://i0.wp.com/www.sparkadmissions.com/wp-content/uploads/2020/03/Yale_Acceptance_Rate.jpg')",
        }}
      />

      <div className="relative z-10 w-[min(90%,650px)] rounded-[24px] border border-white/10 bg-white/3 px-8 py-16 text-center shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] backdrop-blur-[20px] md:px-12">
        <h1 className="mb-6 text-[clamp(2.25rem,6vw,3rem)] font-bold leading-[1.1] tracking-[-0.03em] text-white">
          <span className="bg-[linear-gradient(135deg,#ffffff_0%,#a5b4fc_100%)] bg-clip-text text-transparent">
            Your Unfair AI
          </span>
          <br />
          Career Advantage.
        </h1>

        <p className="mb-10 px-0 text-base leading-8 font-light text-slate-400 md:px-4 md:text-lg">
          One platform to <strong className="font-medium text-slate-200">tailor resumes</strong>,{' '}
          <strong className="font-medium text-slate-200">generate AI edits</strong>, and{' '}
          <strong className="font-medium text-slate-200">strategize your next move</strong>.
        </p>

        <Link
          href="/dashboard"
          className="inline-block rounded-full bg-white px-10 py-4 text-lg font-medium text-[#0f172a] no-underline shadow-[0_4px_15px_rgba(255,255,255,0.1)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-[0_8px_25px_rgba(255,255,255,0.25)]"
        >
          Launch Lumi Coach
        </Link>

        <span className="mt-6 block text-sm font-medium uppercase tracking-[0.05em] text-slate-500">
          Built exclusively for SOM Students.
        </span>
      </div>
    </section>
  );
}
