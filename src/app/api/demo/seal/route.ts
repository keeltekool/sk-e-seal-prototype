import { SealClient } from '../../../../../packages/client-sdk/src';

export const maxDuration = 60;

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('pdf') as File | null;

  if (!file || file.type !== 'application/pdf') {
    return Response.json({ error: 'PDF file required' }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return Response.json({ error: 'File too large (max 10MB)' }, { status: 400 });
  }

  const clientId = process.env.DEMO_CLIENT_ID;
  const clientSecret = process.env.DEMO_CLIENT_SECRET;
  const pin = process.env.DEMO_PIN;
  const credentialId = process.env.DEMO_CREDENTIAL_ID;

  if (!clientId || !clientSecret || !pin || !credentialId) {
    return Response.json({ error: 'Demo credentials not configured' }, { status: 500 });
  }

  // Determine the base URL for the CSC v2 API (same server)
  // Routes live under /api/ in Next.js App Router, so append /api
  const origin = process.env.API_URL || new URL(request.url).origin;
  const baseUrl = `${origin}/api`;

  const pdfBytes = new Uint8Array(await file.arrayBuffer());
  const originalSize = pdfBytes.length;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      try {
        const client = new SealClient({
          baseUrl,
          clientId,
          clientSecret,
          pin,
          credentialId,
        });

        const result = await client.seal(pdfBytes, {
          onStep: (step) => {
            sendEvent('step', step);
          },
        });

        // Send sealed PDF as base64 in the final event
        const sealedBase64 = Buffer.from(result.sealedPdf).toString('base64');
        sendEvent('complete', {
          totalDurationMs: result.totalDurationMs,
          originalSize,
          sealedSize: result.sealedPdf.length,
          sealedPdfBase64: sealedBase64,
        });
      } catch (err) {
        sendEvent('error', {
          message: err instanceof Error ? err.message : 'Sealing failed',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
