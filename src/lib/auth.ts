// OAuth2 token generation and validation utilities.
// CSC v2 Spec §8: All CSC API calls require a valid access token.
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const TOKEN_EXPIRY = '1h';

export async function hashSecret(secret: string): Promise<string> {
  return bcrypt.hash(secret, 12);
}

export async function verifySecret(secret: string, hash: string): Promise<boolean> {
  return bcrypt.compare(secret, hash);
}

export async function generateAccessToken(tenantId: string, clientId: string): Promise<string> {
  return new SignJWT({ tenantId, clientId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .setIssuer('qualified-eseal-by-sk-id')
    .sign(JWT_SECRET);
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, JWT_SECRET, {
    issuer: 'qualified-eseal-by-sk-id',
  });
  return payload as { tenantId: string; clientId: string };
}
