'use client';

/** The Help sheet: how to set it up, then what every value means. */
export function TrackerHelp() {
  return (
    <section className="grid gap-4 pt-4 lg:grid-cols-2">
      <Card className="lg:col-span-2" title="Setting this up — in order">
        <ol className="grid max-w-[76ch] list-decimal gap-2.5 pl-5 text-sm">
          <li>
            <strong>Add an Apify account.</strong> Settings → Accounts. Paste the API token from
            apify.com → Settings → API &amp; Integrations. A second account is optional; runs switch
            to it when the first hits its quota.
          </li>
          <li>
            <strong>Pick how jobs get scored.</strong> Settings → Scoring. <em>Vertex</em> uses the
            service account on the server. <em>Gemini key</em> uses a free AI Studio key — switch to
            it if the Vertex credit runs out.
          </li>
          <li>
            <strong>Check your profile.</strong> Settings → Profile &amp; rubric. Every score is
            measured against this, so it matters more than any other setting.
          </li>
          <li>
            <strong>Describe the search.</strong> Keywords, location, how recent. Start narrow and
            widen once the scores look right.
          </li>
          <li>
            <strong>Set the schedule</strong> — how often to run, and the quiet hours to skip.
          </li>
          <li>
            <strong>Set the routing rules</strong> — which priorities you keep, which go to the
            assignee, and companies never to delegate.
          </li>
          <li>
            <strong>Run it.</strong> Runs → Run Now.
          </li>
        </ol>
      </Card>

      <Card title="Status">
        <Defs
          rows={[
            ['New', 'Scored, nothing done yet.'],
            ['Networking', 'You are reaching out rather than applying cold.'],
            ['Filled', 'The application form is filled in. Not sent yet.'],
            ['Submitted', 'Application sent. Stamps the applied date.'],
            ['Flagged', 'The assignee stopped and left a note. Needs you.'],
            ['Skip', 'You rejected it by hand. The rules never undo this.'],
            ['Skip (auto)', 'A rule rejected it. Can be re-evaluated later.'],
            ['Closed', 'The posting expired. Re-opens by itself if posted again.'],
          ]}
        />
      </Card>

      <Card title="Owner and action">
        <Defs
          rows={[
            ['(blank)', 'Unmanaged. The routing rules may act on it.'],
            ['Me', 'You claimed it. The rules leave it alone.'],
            ['Assignee', 'You delegated it by hand. Locked to them.'],
            ['Assignee (auto)', 'The rules delegated it. Can be re-routed.'],
            ['Fill & Submit', 'The assignee applies and sends it.'],
            ['Fill Only', 'The assignee fills the form; you send it.'],
          ]}
        />
      </Card>

      <Card title="US visa signal">
        <Defs
          rows={[
            ['Yes (100%)', 'The posting or careers page says they sponsor.'],
            ['Likely (90%)', 'Employer with a steady sponsorship record.'],
            ['Possible (70%)', 'Some evidence, nothing stated.'],
            ['Unclear (50%)', 'Nothing found either way.'],
            ['US required (40%)', 'Clearance or citizenship language.'],
            ['Unlikely (20%)', 'Signals point against it.'],
            ['No (0%)', 'States no sponsorship. Auto-skipped if that rule is on.'],
          ]}
        />
      </Card>

      <Card title="Priority">
        <Defs
          rows={[
            ['P01', 'Rare bullseye. Score 90–100.'],
            ['P02–P03', 'Strong. Worth your own time.'],
            ['P04–P05', "Solid. Usually the assignee's lane."],
            ['P06–P07', 'Weak fit. Apply only if the queue is thin.'],
            ['P10', 'Skip. Aggregators and clear mismatches.'],
          ]}
        />
      </Card>

      <Card className="lg:col-span-2" title="Things worth knowing">
        <Defs
          rows={[
            [
              'Duplicates',
              'The same role posted under several ids is merged into one row by comparing the description, so it is scored once. Every id is kept, which is why a row can have several links.',
            ],
            [
              'Dead links',
              'Postings expire. Mark a link that does not load and nobody retries it. When all of a row’s links are dead, build the resume from the saved description instead.',
            ],
            [
              'Re-posts',
              'A closed role posted again re-opens automatically instead of arriving as a new row.',
            ],
            [
              'Editing the rubric',
              'Changes apply to new jobs on the next run. To re-score jobs you already have, select them and use Reevaluate — that costs money again.',
            ],
            [
              'Pruning',
              'Old rows age out on the dates you choose. Submitted and Networking are never pruned. Saved descriptions are dropped once a role is submitted, closed or skipped.',
            ],
            [
              'What the assignee sees',
              'The same list with the Assigned toggle on. They cannot open Settings or see any keys.',
            ],
          ]}
        />
      </Card>
    </section>
  );
}

function Card({
  title,
  children,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-lg border border-border bg-card shadow-sw-sm ${className}`}
    >
      <header className="border-b border-border bg-secondary/55 px-4 py-3">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.14em]">{title}</h3>
      </header>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Defs({ rows }: { rows: [string, string][] }) {
  return (
    <div className="grid gap-2.5">
      {rows.map(([term, meaning]) => (
        <div key={term} className="grid items-baseline gap-3 text-[13px] sm:grid-cols-[150px_1fr]">
          <b className="font-mono text-[11px]">{term}</b>
          <span className="text-muted-foreground">{meaning}</span>
        </div>
      ))}
    </div>
  );
}
