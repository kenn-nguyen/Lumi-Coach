import { linkedInAdapter } from './linkedin/adapter.js';

const ADAPTERS = [linkedInAdapter];

export function getAdapter(hostname) {
  for (const adapter of ADAPTERS) {
    if (adapter.hostnameMatches(hostname)) return adapter;
  }
  return null;
}

export { linkedInAdapter };
