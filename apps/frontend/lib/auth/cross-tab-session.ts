'use client';

const SESSION_INVALIDATION_KEY = 'resume_matcher_session_invalidated_at';

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
