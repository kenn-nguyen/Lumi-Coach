'use client';

const EXACT_STORAGE_KEYS = [
  'master_resume_id',
  'resume_builder_draft',
  'resume_builder_settings',
  'resume_builder_editor_width',
] as const;

const PREFIX_STORAGE_KEYS = ['ai_strategy_brief:'] as const;

export function clearProtectedClientState(): void {
  if (typeof window === 'undefined') {
    return;
  }

  for (const key of EXACT_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
  }

  const keysToRemove: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) {
      continue;
    }

    if (PREFIX_STORAGE_KEYS.some((prefix) => key.startsWith(prefix))) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    window.localStorage.removeItem(key);
  }
}
