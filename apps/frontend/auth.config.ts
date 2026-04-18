import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';

const authConfig = {
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
} satisfies NextAuthConfig;

export default authConfig;
