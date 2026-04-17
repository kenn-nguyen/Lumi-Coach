import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

const authNetworkingState = globalThis as typeof globalThis & {
  __resumeMatcherIpv4DispatcherInstalled?: boolean;
};

// Some local resolvers return an invalid IPv6 answer (`::`) for Google.
// Prefer IPv4 in local dev so Auth.js can reach Google's OIDC endpoints.
if (
  process.env.NODE_ENV !== 'production' &&
  typeof EdgeRuntime === 'undefined' &&
  !authNetworkingState.__resumeMatcherIpv4DispatcherInstalled
) {
  // Use a dynamic require so Turbopack does not try to bundle undici's Node internals.
  const { Agent, setGlobalDispatcher } = eval(
    'require',
  )('undici') as typeof import('undici');
  setGlobalDispatcher(new Agent({ connect: { family: 4 } }));
  authNetworkingState.__resumeMatcherIpv4DispatcherInstalled = true;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: 'jwt',
  },
  providers: [
    Google({
      allowDangerousEmailAccountLinking: false,
    }),
  ],
  callbacks: {
    async jwt({ token }) {
      if (token.sub) {
        token.userId = token.sub;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = (token.userId as string | undefined) ?? token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: '/sign-in',
  },
});
