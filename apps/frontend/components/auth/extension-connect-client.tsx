'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { captureEvent, POSTHOG_EVENTS } from '@/lib/analytics/posthog';

type ConnectStatus = 'connecting' | 'success' | 'error';

type ExtensionConnectClientProps = {
  extensionId: string;
};

export function ExtensionConnectClient({ extensionId }: ExtensionConnectClientProps) {
  const [status, setStatus] = useState<ConnectStatus>('connecting');
  const [message, setMessage] = useState('Connecting your extension and returning you to LinkedIn…');

  useEffect(() => {
    let cancelled = false;
    captureEvent(POSTHOG_EVENTS.EXTENSION_CONNECT_STARTED, {
      extension_id_present: Boolean(extensionId),
    });

    const connect = async () => {
      if (!extensionId) {
        setStatus('error');
        setMessage('Missing extension identifier.');
        captureEvent(POSTHOG_EVENTS.EXTENSION_CONNECT_FAILED, {
          reason: 'missing_extension_identifier',
        });
        return;
      }

      try {
        const response = await fetch('/api/auth/extension-token', {
          cache: 'no-store',
          credentials: 'same-origin',
        });

        if (!response.ok) {
          throw new Error('Failed to create extension access token.');
        }

        const payload = await response.json();
        const chromeRuntime = (window as Window & { chrome?: any }).chrome?.runtime;

        if (!chromeRuntime?.sendMessage) {
          throw new Error('Chrome extension messaging is not available in this browser tab.');
        }

        await new Promise<void>((resolve, reject) => {
          chromeRuntime.sendMessage(
            extensionId,
            {
              type: 'SOM_EXTENSION_CONNECT_COMPLETE',
              payload,
            },
            (result: { ok?: boolean; error?: string }) => {
              const runtimeError = chromeRuntime.lastError;
              if (runtimeError?.message) {
                reject(new Error(runtimeError.message));
                return;
              }
              if (!result?.ok) {
                reject(new Error(result?.error || 'The extension rejected the connection.'));
                return;
              }
              resolve();
            }
          );
        });

        if (cancelled) return;
        setStatus('success');
        setMessage('Connected. Returning you to LinkedIn…');
        captureEvent(POSTHOG_EVENTS.EXTENSION_CONNECT_SUCCEEDED);
      } catch (error) {
        if (cancelled) return;
        setStatus('error');
        const resolvedMessage = error instanceof Error ? error.message : 'Failed to connect extension.';
        setMessage(resolvedMessage);
        captureEvent(POSTHOG_EVENTS.EXTENSION_CONNECT_FAILED, {
          reason: resolvedMessage,
        });
      }
    };

    void connect();

    return () => {
      cancelled = true;
    };
  }, [extensionId]);

  return (
    <main className="skin-page-brand min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-[28px] border border-border bg-white/90 p-8 shadow-sw-card backdrop-blur-[10px]">
        <div className="space-y-2">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            SOM Career Coach
          </p>
          <h1 className="font-serif text-4xl tracking-[-0.04em] text-foreground">
            Connect Extension
          </h1>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>

        <div className="mt-8 flex gap-3">
          {status === 'error' ? (
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          ) : null}
          <Button variant="outline" onClick={() => window.close()}>
            Close
          </Button>
        </div>
      </div>
    </main>
  );
}
