'use client';

const SESSION_INVALIDATION_KEY = 'resume_matcher_session_invalidated_at';
const SIGN_OUT_IN_PROGRESS_KEY = 'resume_matcher_signout_in_progress_at';
const SIGN_OUT_IN_PROGRESS_TTL_MS = 2 * 60 * 1000;

export function broadcastSessionInvalidation(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(SESSION_INVALIDATION_KEY, String(Date.now()));
  } catch {
    // Ignore storage failures so sign-out still completes.
  }
}

export function markSignOutInProgress(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(SIGN_OUT_IN_PROGRESS_KEY, String(Date.now()));
  } catch {
    // Ignore storage failures so sign-out still completes.
  }
}

export function clearSignOutInProgress(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(SIGN_OUT_IN_PROGRESS_KEY);
  } catch {
    // Ignore storage failures during cleanup.
  }
}

export function isSignOutInProgress(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const raw = window.localStorage.getItem(SIGN_OUT_IN_PROGRESS_KEY);
    if (!raw) {
      return false;
    }

    const startedAt = Number.parseInt(raw, 10);
    if (!Number.isFinite(startedAt)) {
      clearSignOutInProgress();
      return false;
    }

    if (Date.now() - startedAt > SIGN_OUT_IN_PROGRESS_TTL_MS) {
      clearSignOutInProgress();
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function onSessionInvalidated(callback: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== SESSION_INVALIDATION_KEY || !event.newValue) {
      return;
    }

    callback();
  };

  window.addEventListener('storage', handleStorage);
  return () => window.removeEventListener('storage', handleStorage);
}
