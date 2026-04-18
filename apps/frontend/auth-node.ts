import NextAuth from 'next-auth';
import { Agent, setGlobalDispatcher } from 'undici';
import authConfig from './auth.config';

const authNetworkingState = globalThis as typeof globalThis & {
  __resumeMatcherIpv4DispatcherInstalled?: boolean;
};

// Some local resolvers return an invalid IPv6 answer (`::`) for Google.
// Prefer IPv4 in local dev so Auth.js can reach Google's OIDC endpoints.
if (
  process.env.NODE_ENV !== 'production' &&
  !authNetworkingState.__resumeMatcherIpv4DispatcherInstalled
) {
  setGlobalDispatcher(new Agent({ connect: { family: 4 } }));
  authNetworkingState.__resumeMatcherIpv4DispatcherInstalled = true;
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
