'use client';

import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import { Button } from '@/components/ui/button';

interface BackendWakingScreenProps {
  elapsedMs: number;
  gaveUp: boolean;
  onRetry: () => void;
}

// Calibrated to a typical Render free-tier cold start. The bar fills toward 90%
// over this window and holds there until the backend answers, so it reads as
// "working" rather than "stuck".
const EXPECTED_MS = 45_000;
const FAILSAFE_MS = 70_000;

export function BackendWakingScreen({ elapsedMs, gaveUp, onRetry }: BackendWakingScreenProps) {
  const seconds = Math.floor(elapsedMs / 1000);
  const progress = Math.min(90, (elapsedMs / EXPECTED_MS) * 90);
  const showFailsafe = elapsedMs >= FAILSAFE_MS;

  const statusLine =
    seconds < 12 ? 'Starting the server…' : seconds < 30 ? 'Almost there…' : 'Nearly ready…';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(18,24,38,0.45)] px-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md border border-black bg-card p-8 shadow-sw-card">
        {gaveUp ? (
          // Terminal state — polling stopped after 3 minutes without a response.
          <>
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
              <h2 className="font-serif text-xl font-semibold tracking-[-0.02em]">
                Still can&apos;t reach the server
              </h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              The server hasn&apos;t responded in a few minutes — it may be restarting or
              temporarily down. This usually clears up on its own. Try again, or check back shortly.
            </p>
            <Button variant="outline" size="sm" className="mt-6" onClick={onRetry}>
              Try again
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
              <h2 className="font-serif text-xl font-semibold tracking-[-0.02em]">
                Waking up the server
              </h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              The server sleeps when idle to keep Lumi Coach free. First load takes about 30 seconds
              — hang tight, this only happens after a quiet spell.
            </p>

            {/* Progress bar — hard-edged Swiss style */}
            <div className="mt-6 h-2 w-full overflow-hidden border border-black bg-secondary">
              <div
                className="h-full bg-primary transition-[width] duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              <span>{statusLine}</span>
              <span>{seconds}s</span>
            </div>

            {showFailsafe && (
              <div className="mt-6 border-t border-border pt-4">
                <p className="text-xs text-muted-foreground">
                  Taking longer than usual. You can keep waiting, or retry.
                </p>
                <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
                  Retry
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
