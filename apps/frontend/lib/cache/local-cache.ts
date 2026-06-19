/**
 * Thin localStorage cache with TTL.
 * Silently no-ops in SSR or when storage is unavailable (private mode, quota exceeded).
 */

export const CACHE_KEYS = {
  RESUME_LIST: 'rm:resume-list',
  STATUS: 'rm:status',
  SETTINGS_LLM: 'rm:settings:llm',
  SETTINGS_FEATURES: 'rm:settings:features',
  SETTINGS_OUTPUT: 'rm:settings:output',
} as const;

export const CACHE_TTL = {
  RESUME_LIST: 2 * 60 * 1000, // 2 min — mutated often
  STATUS: 10 * 60 * 1000, // 10 min — stable between sessions
  SETTINGS: 60 * 60 * 1000, // 1 hour — rarely changes
} as const;

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/** Read a cached value. Returns null if missing or expired. */
export function readCache<T>(key: string, maxAgeMs: number): T | null {
  const entry = readCacheEntry<T>(key, maxAgeMs);
  return entry ? entry.data : null;
}

/** Read a cached entry including its cachedAt timestamp. Returns null if missing or expired. */
export function readCacheEntry<T>(
  key: string,
  maxAgeMs: number
): { data: T; cachedAt: number } | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.cachedAt > maxAgeMs) return null;
    return { data: entry.data, cachedAt: entry.cachedAt };
  } catch {
    return null;
  }
}

/** Write a value to localStorage with a timestamp. */
export function writeCache<T>(key: string, data: T): void {
  if (!isBrowser()) return;
  try {
    const entry: CacheEntry<T> = { data, cachedAt: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Quota exceeded or private mode — ignore
  }
}

/** Remove one or more cache entries. */
export function invalidateCache(...keys: string[]): void {
  if (!isBrowser()) return;
  for (const key of keys) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}
