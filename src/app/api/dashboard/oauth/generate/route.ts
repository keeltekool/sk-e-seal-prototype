import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const DEMO_CLIENT_ID = 'tenant-demo-corp-001';

export async function POST() {
  const sql = neon(process.env.DATABASE_URL!);

  const clientSecret = crypto.randomBytes(32).toString('hex');
  const clientSecretHash = await bcrypt.hash(clientSecret, 12);

  const result = await sql`
    UPDATE tenants
    SET client_secret_hash = ${clientSecretHash}, updated_at = NOW()
    WHERE client_id = ${DEMO_CLIENT_ID}
    RETURNING client_id`;

  if (result.length === 0 || !result[0]) {
    return Response.json({ error: 'Demo tenant not found' }, { status: 404 });
  }

  return Response.json({
    clientId: result[0].client_id as string,
    clientSecret,
    message: 'Save your client secret now — it will not be shown again.',
  });
}
