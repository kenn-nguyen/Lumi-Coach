import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createBackendAccessToken } from '@/lib/auth/backend-token';

const DEFAULT_EXTENSION_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

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

  const configuredTtl = Number.parseInt(
    process.env.EXTENSION_AUTH_TOKEN_TTL_SECONDS || '',
    10
  );
  const expiresInSeconds =
    Number.isFinite(configuredTtl) && configuredTtl > 0
      ? configuredTtl
      : DEFAULT_EXTENSION_TOKEN_TTL_SECONDS;

  const { token, expiresAt } = createBackendAccessToken(
    {
      sub: session.user.id,
      email: session.user.email,
      name: session.user.name ?? undefined,
      picture: session.user.image ?? undefined,
    },
    secret,
    {
      expiresInSeconds,
    }
  );

  return NextResponse.json({
    token,
    expiresAt,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name ?? null,
      image: session.user.image ?? null,
    },
  });
}
