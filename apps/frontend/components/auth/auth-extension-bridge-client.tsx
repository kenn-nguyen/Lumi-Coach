'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  EXTENSION_BRIDGE_STORAGE_KEY,
  KNOWN_EXTENSION_STORAGE_KEY,
  clearExtensionBridgeState,
  getExtensionBridgeState,
  getKnownExtensionState,
  saveKnownExtensionState,
} from '@/lib/auth/extension-bridge';
import { clearSignOutInProgress, isSignOutInProgress } from '@/lib/auth/cross-tab-session';
import { replaySignOutDebug } from '@/lib/auth/signout-debug';

type ChromeSendResult = {
  ok?: boolean;
  error?: string;
};

type ChromeRuntimeLike = {
  sendMessage: (
    extensionId: string,
    message: unknown,
    callback?: (result?: ChromeSendResult) => void
  ) => void;
  lastError?: {
    message?: string;
  };
};

type WindowWithChromeRuntime = Window & {
  chrome?: { runtime?: ChromeRuntimeLike };
};

export function AuthExtensionBridgeClient() {
  const { status } = useSession();
  const lastAttemptRef = useRef<string | null>(null);
  const [bridgeStateVersion, setBridgeStateVersion] = useState(0);

  useEffect(() => {
    replaySignOutDebug();
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === EXTENSION_BRIDGE_STORAGE_KEY || event.key === KNOWN_EXTENSION_STORAGE_KEY) {
        setBridgeStateVersion((current) => current + 1);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    if (status === 'loading') return;

    const bridgeState = getExtensionBridgeState();
    const knownState = getKnownExtensionState();
    const targetState = status === 'authenticated' ? bridgeState : knownState;
    if (!targetState?.extensionId) {
      return;
    }

    const attemptKey = `${status}:${targetState.extensionId}:${targetState.sourceTabId || ''}`;
    if (lastAttemptRef.current === attemptKey) return;
    lastAttemptRef.current = attemptKey;

    const chromeRuntime = (window as WindowWithChromeRuntime).chrome?.runtime;
    if (!chromeRuntime?.sendMessage) return;

    let cancelled = false;

    const sendSignedOut = async () => {
      try {
        await new Promise<void>((resolve, reject) => {
          chromeRuntime.sendMessage(
            targetState.extensionId,
            {
              type: 'SOM_EXTENSION_SIGNED_OUT',
            },
            (result?: ChromeSendResult) => {
              const runtimeError = chromeRuntime.lastError;
              if (runtimeError?.message) {
                reject(new Error(runtimeError.message));
                return;
              }
              if (!result?.ok) {
                reject(new Error(result?.error || 'The extension rejected the sign-out sync.'));
                return;
              }
              resolve();
            }
          );
        });
      } catch (error) {
        if (cancelled) return;
        console.warn('[ResumeMatcherAuthBridge] Extension sign-out sync failed.', error);
        lastAttemptRef.current = null;
      }
    };

    const syncAuthenticatedState = async () => {
      if (isSignOutInProgress()) {
        lastAttemptRef.current = null;
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

        await new Promise<void>((resolve, reject) => {
          chromeRuntime.sendMessage(
            targetState.extensionId,
            {
              type: 'SOM_EXTENSION_AUTH_SYNC',
              payload: {
                ...payload,
                sourceTabId: bridgeState?.sourceTabId || knownState?.sourceTabId || null,
              },
            },
            (result?: ChromeSendResult) => {
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
        saveKnownExtensionState(
          targetState.extensionId,
          bridgeState?.sourceTabId || knownState?.sourceTabId
        );
        clearExtensionBridgeState();
        clearSignOutInProgress();
      } catch (error) {
        if (cancelled) return;
        console.warn('[ResumeMatcherAuthBridge] Automatic extension connection failed.', error);
        lastAttemptRef.current = null;
      }
    };

    if (status === 'authenticated') {
      void syncAuthenticatedState();
    } else {
      clearSignOutInProgress();
      void sendSignedOut();
    }

    return () => {
      cancelled = true;
    };
  }, [bridgeStateVersion, status]);

  return null;
}
