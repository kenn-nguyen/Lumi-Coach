'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  type ApifyAccount,
  fetchSettings,
  pruneOldData,
  reassignByRules,
  saveSettings,
  skipNoVisa,
  validateSetup,
} from '@/lib/api/tracker';

type Status = 'idle' | 'saving' | 'saved' | 'error';

const LABEL = 'font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground';

/** Settings, Prompt and Apify_Accounts, combined as they are in the plan. */
export function TrackerSettings({ onToast }: { onToast: (message: string) => void }) {
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [accounts, setAccounts] = React.useState<ApifyAccount[]>([]);
  const [status, setStatus] = React.useState<Record<string, Status>>({});
  const [loading, setLoading] = React.useState(true);
  const [pruneDays, setPruneDays] = React.useState('90');
  const [pruneDates, setPruneDates] = React.useState({
    posted_at: false,
    listed_at: true,
    imported_at: true,
  });
  const [confirmPrune, setConfirmPrune] = React.useState(false);

  React.useEffect(() => {
    fetchSettings()
      .then((body) => {
        setValues(body.settings);
        setAccounts(body.apify_accounts);
      })
      .catch((e: Error) => onToast(`Could not load settings: ${e.message}`))
      .finally(() => setLoading(false));
  }, [onToast]);

  async function save(section: string, keys: string[]) {
    setStatus((s) => ({ ...s, [section]: 'saving' }));
    try {
      await saveSettings(Object.fromEntries(keys.map((k) => [k, values[k] ?? ''])));
      setStatus((s) => ({ ...s, [section]: 'saved' }));
      setTimeout(() => setStatus((s) => ({ ...s, [section]: 'idle' })), 1800);
    } catch (e) {
      setStatus((s) => ({ ...s, [section]: 'error' }));
      onToast((e as Error).message);
    }
  }

  function field(key: string, label: string, hint?: string, rows = 0) {
    return (
      <label className="grid gap-1.5">
        <span className={LABEL}>{label}</span>
        {rows > 0 ? (
          <textarea
            rows={rows}
            value={values[key] ?? ''}
            onChange={(e) => setValues({ ...values, [key]: e.target.value })}
            className="w-full rounded border border-border bg-card p-2 text-[13px] leading-relaxed"
          />
        ) : (
          <input
            value={values[key] ?? ''}
            onChange={(e) => setValues({ ...values, [key]: e.target.value })}
            className="w-full rounded border border-border bg-card px-2.5 py-2 text-[13px]"
          />
        )}
        {hint && <span className="text-[11.5px] text-muted-foreground">{hint}</span>}
      </label>
    );
  }

  if (loading) return <p className="pt-6 text-sm text-muted-foreground">Loading settings…</p>;

  return (
    <div className="grid gap-4 pt-4 lg:grid-cols-2">
      <Section
        className="lg:col-span-2"
        title="Profile & rubric — what jobs are scored against"
        status={status.prompt}
        onSave={() => save('prompt', ['TARGET_PROFILE', 'SCORING_INSTRUCTIONS'])}
      >
        <div className="grid gap-3 md:grid-cols-2">
          {field('TARGET_PROFILE', 'Your profile', 'The single biggest lever on score quality.', 8)}
          {field(
            'SCORING_INSTRUCTIONS',
            'Scoring rubric',
            'Blank uses the built-in rubric. Changes apply to new jobs; use Reevaluate for ones you already have.',
            8
          )}
        </div>
      </Section>

      <Section
        title="Search & schedule"
        status={status.search}
        onSave={() =>
          save('search', [
            'APIFY_RUN_INPUT',
            'APIFY_LOOKBACK_HOURS',
            'APIFY_MAX_LOOKBACK_HOURS',
            'RUN_INTERVAL_HOURS',
            'QUIET_START_HOUR',
            'QUIET_END_HOUR',
          ])
        }
      >
        {field(
          'APIFY_RUN_INPUT',
          'What to search LinkedIn for',
          'Passed to the Apify search actor.',
          5
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {field(
            'APIFY_LOOKBACK_HOURS',
            'Lookback (hours)',
            'Blank computes it from the last run.'
          )}
          {field('APIFY_MAX_LOOKBACK_HOURS', 'Max lookback')}
          {field('RUN_INTERVAL_HOURS', 'Check every (hours)')}
          {field('QUIET_START_HOUR', 'Quiet from (Pacific)')}
          {field('QUIET_END_HOUR', 'Quiet until (Pacific)')}
        </div>
      </Section>

      <Section
        title="Scoring"
        status={status.scoring}
        onSave={() =>
          save('scoring', [
            'GEMINI_API_ROUTE',
            'SCORING_MODEL',
            'SCORING_THINKING_LEVEL',
            'SCORING_PARALLEL_REQUESTS',
            'SCORING_RPM_LIMIT',
            'VERTEX_PROJECT_ID',
            'VERTEX_LOCATION',
          ])
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {field('GEMINI_API_ROUTE', 'AI route', "'vertex' or 'developer'.")}
          {field('SCORING_MODEL', 'Model')}
          {field('SCORING_THINKING_LEVEL', 'Thinking')}
          {field('SCORING_PARALLEL_REQUESTS', 'Parallel requests')}
          {field('VERTEX_PROJECT_ID', 'Vertex project')}
          {field('VERTEX_LOCATION', 'Vertex location')}
        </div>
        <p className="text-[11.5px] text-muted-foreground">
          Switch to the Gemini key route if the Vertex credit runs out — nothing else changes.
        </p>
      </Section>

      <Section
        title="Routing & delegation"
        status={status.routing}
        onSave={() =>
          save('routing', [
            'AUTO_RESERVE_PRIORITIES',
            'AUTO_ASSIGN_PRIORITIES',
            'AUTO_ASSIGN_MIN_SCORE',
            'AUTO_ASSIGN_VISA',
            'AUTO_SKIP_VISA_NO',
            'RESERVED_COMPANIES',
            'AUTO_ASSIGN_EXCLUDE_COMPANIES',
          ])
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {field('AUTO_RESERVE_PRIORITIES', 'Keep for me')}
          {field('AUTO_ASSIGN_PRIORITIES', 'Send to assignee')}
          {field('AUTO_ASSIGN_MIN_SCORE', 'Minimum score to send')}
          {field('AUTO_SKIP_VISA_NO', 'Skip no-sponsorship roles', 'TRUE or FALSE.')}
        </div>
        {field('AUTO_ASSIGN_VISA', 'Visa signals eligible for delegation')}
        {field('RESERVED_COMPANIES', 'Never delegate these companies', undefined, 2)}
        {field('AUTO_ASSIGN_EXCLUDE_COMPANIES', 'Never apply to these companies', undefined, 2)}
      </Section>

      <Section
        title="Notifications"
        status={status.notify}
        onSave={() => save('notify', ['NOTIFY_EMAIL', 'NOTIFY_ASSIGNEE_EMAIL'])}
      >
        {field('NOTIFY_EMAIL', 'Your email', 'P01 alerts and failure notices.')}
        {field(
          'NOTIFY_ASSIGNEE_EMAIL',
          "Assignee's email",
          'Told when new jobs reach their queue.'
        )}
      </Section>

      <Section className="lg:col-span-2" title="Accounts & upkeep">
        <div className="overflow-x-auto rounded border border-border">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-secondary/55">
                {['Apify account', 'Search key', 'Detail key', 'On'].map((h) => (
                  <th
                    key={h}
                    className="border-b border-border px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.label}>
                  <td className="border-b border-border px-3 py-2 font-mono text-xs">{a.label}</td>
                  <td className="border-b border-border px-3 py-2 font-mono tracking-[0.18em] text-muted-foreground">
                    {a.batch_key_set ? '••••••••' : '—'}
                  </td>
                  <td className="border-b border-border px-3 py-2 font-mono tracking-[0.18em] text-muted-foreground">
                    {a.detail_key_set ? '••••••••' : '—'}
                  </td>
                  <td className="border-b border-border px-3 py-2 text-xs">
                    {a.active ? 'yes' : 'no'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11.5px] text-muted-foreground">
          Keys are write-only: once saved they are never sent back to the browser. Runs rotate to
          the next account when one hits its quota.
        </p>

        <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className={LABEL}>Prune older than (days)</span>
            <input
              value={pruneDays}
              onChange={(e) => setPruneDays(e.target.value)}
              className="w-full rounded border border-border bg-card px-2.5 py-2 text-[13px]"
            />
          </label>
          <div className="grid gap-1.5">
            <span className={LABEL}>Measured against</span>
            {(['posted_at', 'listed_at', 'imported_at'] as const).map((key) => (
              <label key={key} className="flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={pruneDates[key]}
                  onChange={(e) => setPruneDates({ ...pruneDates, [key]: e.target.checked })}
                />
                <span className="font-mono text-xs">{key}</span>
              </label>
            ))}
          </div>
        </div>
        <p className="text-[11.5px] text-muted-foreground">
          Submitted and Networking rows are never pruned. Choosing more dates prunes more.
        </p>

        <div className="flex flex-wrap gap-2">
          {confirmPrune ? (
            <>
              <Button
                size="sm"
                variant="destructive"
                onClick={async () => {
                  const r = await pruneOldData({ days: Number(pruneDays) || 90, ...pruneDates });
                  onToast(
                    `Pruned ${r.pruned_jobs} jobs and dropped ${r.dropped_descriptions} descriptions.`
                  );
                  setConfirmPrune(false);
                }}
              >
                Yes, delete them
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmPrune(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setConfirmPrune(true)}>
              Prune old data…
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const r = await reassignByRules();
              onToast(
                `Re-applied the rules: ${r.assigned} assigned, ${r.reserved} reserved, ${r.skipped} skipped.`
              );
            }}
          >
            Reassign by Rules
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const r = await skipNoVisa();
              onToast(`${r.updated} no-sponsorship jobs skipped.`);
            }}
          >
            Skip All No-Visa Jobs
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const r = await validateSetup();
              onToast(
                r.ok
                  ? `All good — ${r.route} route, ${r.apify_accounts} Apify accounts.`
                  : r.problems.join('; ')
              );
            }}
          >
            Validate Config
          </Button>
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
  status,
  onSave,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  status?: Status;
  onSave?: () => void;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-lg border border-border bg-card shadow-sw-sm ${className}`}
    >
      <header className="flex items-baseline justify-between gap-3 border-b border-border bg-secondary/55 px-4 py-3">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.14em]">{title}</h3>
        <div className="flex items-center gap-3">
          {status && status !== 'idle' && (
            <span
              className={`font-mono text-[10px] uppercase tracking-wider ${status === 'saved' ? 'text-success' : status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}
            >
              {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Error'}
            </span>
          )}
          {onSave && (
            <Button size="sm" variant="outline" onClick={onSave}>
              Save
            </Button>
          )}
        </div>
      </header>
      <div className="grid gap-3.5 p-4">{children}</div>
    </div>
  );
}
