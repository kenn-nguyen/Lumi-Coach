import { createHmac } from 'node:crypto';

type BackendTokenPayload = {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
};

const encoder = new TextEncoder();

function base64UrlEncode(value: string | Uint8Array): string {
  const buffer =
    typeof value === 'string' ? Buffer.from(value, 'utf8') : Buffer.from(value);
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function signSegment(data: string, secret: string): string {
  return createHmac('sha256', encoder.encode(secret)).update(data).digest('base64url');
}

export function createBackendAccessToken(
  payload: Omit<BackendTokenPayload, 'iss' | 'aud' | 'iat' | 'exp'>,
  secret: string,
  {
    issuer = 'resume-matcher-frontend',
    audience = 'resume-matcher-backend',
    expiresInSeconds = 60 * 15,
  }: {
    issuer?: string;
    audience?: string;
    expiresInSeconds?: number;
  } = {}
): { token: string; expiresAt: number } {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + expiresInSeconds;
  const fullPayload: BackendTokenPayload = {
    ...payload,
    iss: issuer,
    aud: audience,
    iat: now,
    exp,
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = signSegment(signingInput, secret);

  return {
    token: `${signingInput}.${signature}`,
    expiresAt: exp,
  };
}
