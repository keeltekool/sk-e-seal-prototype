// CSC v2 Spec §11.4 — credentials/list
// Returns list of credential IDs available to the authenticated tenant.
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, isAuthError } from '@/lib/middleware';
import { getDb } from '@/lib/db';

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const sql = getDb();
  const rows = await sql`SELECT credential_id FROM credentials WHERE tenant_id = ${auth.tenantId} AND status = ${'active'}`;

  return NextResponse.json({
    credentialIDs: rows.map(r => r.credential_id),
  });
}
