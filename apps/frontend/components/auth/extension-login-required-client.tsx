'use client';

import { useEffect } from 'react';

type ExtensionLoginRequiredClientProps = {
  extensionId: string;
};

export function ExtensionLoginRequiredClient({
  extensionId,
}: ExtensionLoginRequiredClientProps) {
  useEffect(() => {
    if (!extensionId) {
      return;
    }

    const chromeRuntime = (window as Window & { chrome?: any }).chrome?.runtime;
    if (!chromeRuntime?.sendMessage) {
      return;
    }

    chromeRuntime.sendMessage(
      extensionId,
      { type: 'SOM_EXTENSION_LOGIN_REQUIRED' },
      () => {
        void chromeRuntime.lastError;
      }
    );
  }, [extensionId]);

  return null;
}
