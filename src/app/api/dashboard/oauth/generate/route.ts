// Returns the demo OAuth credentials from env vars.
// In a real portal, this would generate fresh credentials and hash them in the DB.
// For the demo, we return the seed values so the playground and landing page demo
// both work with the same credentials — no DB conflicts.

export async function POST() {
  const clientId = process.env.DEMO_CLIENT_ID;
  const clientSecret = process.env.DEMO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return Response.json({ error: 'Demo credentials not configured. Run seed script.' }, { status: 500 });
  }

  return Response.json({
    clientId,
    clientSecret,
    message: 'Save your client secret now — it will not be shown again.',
  });
}
