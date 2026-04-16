import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createBackendAccessToken } from '@/lib/auth/backend-token';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const secret = process.env.BACKEND_AUTH_SHARED_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'Missing BACKEND_AUTH_SHARED_SECRET' },
      { status: 500 }
    );
  }

  const { token, expiresAt } = createBackendAccessToken(
    {
      sub: session.user.id,
      email: session.user.email,
      name: session.user.name ?? undefined,
      picture: session.user.image ?? undefined,
    },
    secret
  );

  return NextResponse.json({
    token,
    expiresAt,
  });
}
