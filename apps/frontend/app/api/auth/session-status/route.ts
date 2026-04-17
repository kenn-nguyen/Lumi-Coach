import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json(
      {
        authenticated: false,
      },
      {
        status: 401,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  return NextResponse.json(
    {
      authenticated: true,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name ?? null,
      },
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
