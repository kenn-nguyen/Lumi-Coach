'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { useSession } from 'next-auth/react';
import { fetchSystemStatus, type SystemStatus } from '@/lib/api/config';
import {
  CACHE_KEYS,
  CACHE_TTL,
  readCacheEntry,
  writeCache,
  invalidateCache,
} from '@/lib/cache/local-cache';

// Cache duration constants
const STATUS_STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes for DB stats

interface CachedStatus {
  status: SystemStatus | null;
  lastFetched: number | null;
  lastLlmCheck: number | null;
  isLoading: boolean;
  error: string | null;
}

function readPersistedStatus(): CachedStatus {
  const entry = readCacheEntry<SystemStatus>(CACHE_KEYS.STATUS, CACHE_TTL.STATUS);
  if (entry) {
    return {
      status: entry.data,
      lastFetched: entry.cachedAt,
      lastLlmCheck: entry.cachedAt,
      isLoading: false,
      error: null,
    };
  }
  return { status: null, lastFetched: null, lastLlmCheck: null, isLoading: true, error: null };
}

interface StatusCacheContextValue {
  // Cached data
  status: SystemStatus | null;
  isLoading: boolean;
  error: string | null;
  lastFetched: Date | null;

  // Actions
  refreshStatus: () => Promise<void>;
  refreshLlmHealth: () => Promise<void>;

  // Increment counters (for optimistic updates)
  incrementResumes: () => void;
  decrementResumes: () => void;
  incrementJobs: () => void;
  incrementImprovements: () => void;
  setHasMasterResume: (value: boolean) => void;
}

const StatusCacheContext = createContext<StatusCacheContextValue | null>(null);

export function StatusCacheProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status: authStatus } = useSession();
  const currentUserIdRef = useRef<string | null>(null);
  // Start with empty state so server and client render identically during hydration.
  // The persisted (localStorage) value is loaded in useLayoutEffect before first paint.
  const [cache, setCache] = useState<CachedStatus>({
    status: null,
    lastFetched: null,
    lastLlmCheck: null,
    isLoading: true,
    error: null,
  });

  useLayoutEffect(() => {
    const persisted = readPersistedStatus();
    if (persisted.status !== null) {
      setCache(persisted);
    }
  }, []);

  const mountedRef = useRef(true);

  // Fetch full status from backend
  const refreshStatus = useCallback(async () => {
    if (authStatus !== 'authenticated') return;
    setCache((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const status = await fetchSystemStatus();
      if (!mountedRef.current) return;

      const now = Date.now();
      writeCache(CACHE_KEYS.STATUS, status);
      setCache({
        status,
        lastFetched: now,
        lastLlmCheck: now,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      if (!mountedRef.current) return;
      setCache((prev) => ({
        ...prev,
        isLoading: false,
        error: (err as Error).message || 'Failed to fetch status',
      }));
    }
  }, [authStatus]);

  // Refresh just LLM health (called periodically)
  const refreshLlmHealth = useCallback(async () => {
    if (authStatus !== 'authenticated') return;
    try {
      const status = await fetchSystemStatus();
      if (!mountedRef.current) return;

      const now = Date.now();
      writeCache(CACHE_KEYS.STATUS, status);
      setCache((prev) => ({
        ...prev,
        status: status,
        lastFetched: now,
        lastLlmCheck: now,
      }));
    } catch (err) {
      // Silent fail for background refresh - keep existing data
      console.error('Background LLM health check failed:', err);
    }
  }, [authStatus]);

  // Counter update methods (optimistic updates)
  const incrementResumes = useCallback(() => {
    setCache((prev) => {
      if (!prev.status) return prev;
      return {
        ...prev,
        status: {
          ...prev.status,
          database_stats: {
            ...prev.status.database_stats,
            total_resumes: prev.status.database_stats.total_resumes + 1,
          },
        },
      };
    });
  }, []);

  const decrementResumes = useCallback(() => {
    setCache((prev) => {
      if (!prev.status) return prev;
      return {
        ...prev,
        status: {
          ...prev.status,
          database_stats: {
            ...prev.status.database_stats,
            total_resumes: Math.max(0, prev.status.database_stats.total_resumes - 1),
          },
        },
      };
    });
  }, []);

  const incrementJobs = useCallback(() => {
    setCache((prev) => {
      if (!prev.status) return prev;
      return {
        ...prev,
        status: {
          ...prev.status,
          database_stats: {
            ...prev.status.database_stats,
            total_jobs: prev.status.database_stats.total_jobs + 1,
          },
        },
      };
    });
  }, []);

  const incrementImprovements = useCallback(() => {
    setCache((prev) => {
      if (!prev.status) return prev;
      return {
        ...prev,
        status: {
          ...prev.status,
          database_stats: {
            ...prev.status.database_stats,
            total_improvements: prev.status.database_stats.total_improvements + 1,
          },
        },
      };
    });
  }, []);

  const setHasMasterResume = useCallback((value: boolean) => {
    setCache((prev) => {
      if (!prev.status) return prev;
      return {
        ...prev,
        status: {
          ...prev.status,
          has_master_resume: value,
          database_stats: {
            ...prev.status.database_stats,
            has_master_resume: value,
          },
        },
      };
    });
  }, []);

  // Fetch on first load, and reset + re-fetch when the account changes.
  useEffect(() => {
    mountedRef.current = true;

    if (authStatus === 'authenticated') {
      const userId = session?.user?.id ?? null;
      if (userId !== currentUserIdRef.current) {
        // Different account — clear stale data before fetching.
        currentUserIdRef.current = userId;
        invalidateCache(CACHE_KEYS.STATUS);
        setCache({
          status: null,
          lastFetched: null,
          lastLlmCheck: null,
          isLoading: true,
          error: null,
        });
      }
      refreshStatus();
    } else if (authStatus === 'unauthenticated') {
      currentUserIdRef.current = null;
      invalidateCache(CACHE_KEYS.STATUS);
      setCache({
        status: null,
        lastFetched: null,
        lastLlmCheck: null,
        isLoading: false,
        error: null,
      });
    }
    // authStatus === 'loading': NextAuth is still resolving the session.
    // Middleware guarantees only authenticated users reach this shell, so
    // don't override the useLayoutEffect's cached-data state with isLoading:true.
    // The initial useState already captures the loading state; cached data
    // (if any) should remain visible until auth settles.

    return () => {
      mountedRef.current = false;
    };
  }, [authStatus, session?.user?.id, refreshStatus]);

  // No periodic refresh — status is fetched on first load and manually via refreshStatus/refreshLlmHealth.

  const value: StatusCacheContextValue = {
    status: cache.status,
    isLoading: cache.isLoading,
    error: cache.error,
    lastFetched: cache.lastFetched ? new Date(cache.lastFetched) : null,
    refreshStatus,
    refreshLlmHealth,
    incrementResumes,
    decrementResumes,
    incrementJobs,
    incrementImprovements,
    setHasMasterResume,
  };

  return <StatusCacheContext.Provider value={value}>{children}</StatusCacheContext.Provider>;
}

export function useStatusCache() {
  const context = useContext(StatusCacheContext);
  if (!context) {
    throw new Error('useStatusCache must be used within a StatusCacheProvider');
  }
  return context;
}

/**
 * Hook to check if status data is stale (older than threshold)
 */
export function useIsStatusStale(thresholdMs: number = STATUS_STALE_THRESHOLD): boolean {
  const { lastFetched } = useStatusCache();
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    if (!lastFetched) {
      setIsStale(true);
      return;
    }

    const checkStale = () => {
      const elapsed = Date.now() - lastFetched.getTime();
      setIsStale(elapsed > thresholdMs);
    };

    checkStale();
    const interval = setInterval(checkStale, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [lastFetched, thresholdMs]);

  return isStale;
}
