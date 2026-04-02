import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const DEMO_CLIENT_ID = 'tenant-demo-corp-001';

export async function POST() {
  const sql = neon(process.env.DATABASE_URL!);

  // 6-digit numeric PIN — realistic for SCAL2 authorization
  const pin = crypto.randomInt(100000, 999999).toString();
  const pinHash = await bcrypt.hash(pin, 12);

  const result = await sql`
    UPDATE tenants
    SET pin_hash = ${pinHash}, updated_at = NOW()
    WHERE client_id = ${DEMO_CLIENT_ID}
    RETURNING client_id`;

  if (result.length === 0) {
    return Response.json({ error: 'Demo tenant not found' }, { status: 404 });
  }

  return Response.json({
    pin,
    message: 'Save your PIN now — it will not be shown again.',
  });
}
