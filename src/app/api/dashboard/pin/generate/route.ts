// Returns the demo PIN from env vars.
// In a real portal, this would generate a fresh PIN and hash it in the DB.
// For the demo, we return the seed value so the playground and landing page demo
// both work with the same credentials — no DB conflicts.

export async function POST() {
  const pin = process.env.DEMO_PIN;

  if (!pin) {
    return Response.json({ error: 'Demo PIN not configured. Run seed script.' }, { status: 500 });
  }

  return Response.json({
    pin,
    message: 'Save your PIN now — it will not be shown again.',
  });
}
