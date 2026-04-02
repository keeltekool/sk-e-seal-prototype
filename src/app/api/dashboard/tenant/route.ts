import { neon } from '@neondatabase/serverless';

const DEMO_CLIENT_ID = 'tenant-demo-corp-001';

export async function GET() {
  const sql = neon(process.env.DATABASE_URL!);

  const tenants = await sql`
    SELECT t.id, t.name, t.client_id, t.status, t.created_at,
      (SELECT COUNT(*) FROM credentials c WHERE c.tenant_id = t.id)::int as total_credentials,
      (SELECT COUNT(*) FROM credentials c WHERE c.tenant_id = t.id AND c.status = 'active')::int as active_credentials,
      (SELECT COUNT(*) FROM credentials c WHERE c.tenant_id = t.id AND c.status = 'suspended')::int as suspended_credentials
    FROM tenants t
    WHERE t.client_id = ${DEMO_CLIENT_ID}
    LIMIT 1`;

  if (tenants.length === 0) {
    return Response.json({ error: 'Demo tenant not found. Run: npx tsx scripts/seed.ts' }, { status: 404 });
  }

  return Response.json({ tenant: tenants[0] });
}
