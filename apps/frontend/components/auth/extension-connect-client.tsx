'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

type ConnectStatus = 'connecting' | 'success' | 'error';

type ExtensionConnectClientProps = {
  extensionId: string;
};

export function ExtensionConnectClient({ extensionId }: ExtensionConnectClientProps) {
  const [status, setStatus] = useState<ConnectStatus>('connecting');
  const [message, setMessage] = useState('Connecting your extension…');

  useEffect(() => {
    let cancelled = false;

    const connect = async () => {
      if (!extensionId) {
        setStatus('error');
        setMessage('Missing extension identifier.');
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
        setMessage('Extension connected. You can return to the job page.');
      } catch (error) {
        if (cancelled) return;
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Failed to connect extension.');
      }
    };

    void connect();

    return () => {
      cancelled = true;
    };
  }, [extensionId]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F0F0E8] px-6">
      <div className="w-full max-w-md border-2 border-black bg-[#E5E5E0] p-8 shadow-[8px_8px_0px_0px_#000000]">
        <div className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-blue-700">
            SOM Career Coach
          </p>
          <h1 className="font-serif text-4xl text-black">Connect Extension</h1>
          <p className="text-sm text-gray-700">{message}</p>
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
