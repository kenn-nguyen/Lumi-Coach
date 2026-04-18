const SIGNOUT_DEBUG_KEY = 'resumeMatcherSignOutDebug';
const MAX_SIGNOUT_DEBUG_ENTRIES = 60;

type SignOutDebugEntry = {
  event: string;
  details?: Record<string, unknown>;
  href: string;
  timestamp: string;
};

function isBrowser() {
  return typeof window !== 'undefined';
}

function readEntries(): SignOutDebugEntry[] {
  if (!isBrowser()) return [];

  try {
    const raw = window.sessionStorage.getItem(SIGNOUT_DEBUG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SignOutDebugEntry[]) : [];
  } catch {
    return [];
  }
}

function writeEntries(entries: SignOutDebugEntry[]) {
  if (!isBrowser()) return;

  try {
    window.sessionStorage.setItem(
      SIGNOUT_DEBUG_KEY,
      JSON.stringify(entries.slice(-MAX_SIGNOUT_DEBUG_ENTRIES))
    );
  } catch {
    // Ignore storage failures so debugging never breaks sign-out.
  }
}

export function recordSignOutDebug(event: string, details?: Record<string, unknown>) {
  if (!isBrowser()) return;

  const entry: SignOutDebugEntry = {
    event,
    details,
    href: window.location.href,
    timestamp: new Date().toISOString(),
  };

  console.log(`[ResumeMatcherSignOut] ${event}`, entry);

  const entries = readEntries();
  entries.push(entry);
  writeEntries(entries);
}

export function replaySignOutDebug() {
  if (!isBrowser()) return;

  const entries = readEntries();
  if (!entries.length) return;

  console.groupCollapsed(`[ResumeMatcherSignOutReplay] ${entries.length} entries`);
  for (const entry of entries) {
    console.log(`[ResumeMatcherSignOutReplay] ${entry.event}`, entry);
  }
  console.groupEnd();
}

export function clearSignOutDebug() {
  if (!isBrowser()) return;
  window.sessionStorage.removeItem(SIGNOUT_DEBUG_KEY);
}
