'use client';

import { useEffect } from 'react';
import { saveExtensionBridgeState } from '@/lib/auth/extension-bridge';

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

type ExtensionLoginRequiredClientProps = {
  extensionId: string;
  sourceTabId?: string;
};

export function ExtensionLoginRequiredClient({
  extensionId,
  sourceTabId,
}: ExtensionLoginRequiredClientProps) {
  useEffect(() => {
    if (!extensionId) {
      return;
    }

    saveExtensionBridgeState(extensionId, sourceTabId);

    const chromeRuntime = (window as WindowWithChromeRuntime).chrome?.runtime;
    if (!chromeRuntime?.sendMessage) {
      return;
    }

    chromeRuntime.sendMessage(
      extensionId,
      { type: 'SOM_EXTENSION_LOGIN_REQUIRED', sourceTabId },
      () => {
        void chromeRuntime.lastError;
      }
    );
  }, [extensionId, sourceTabId]);

  return null;
}
