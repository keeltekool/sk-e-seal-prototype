import { SealClient } from '../../../../../packages/client-sdk/src';

export const maxDuration = 60;

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('pdf') as File | null;
  const credentialId = formData.get('credentialId') as string | null;
  const clientId = formData.get('clientId') as string | null;
  const clientSecret = formData.get('clientSecret') as string | null;
  const pin = formData.get('pin') as string | null;

  if (!file || file.type !== 'application/pdf') {
    return Response.json({ error: 'PDF file required' }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return Response.json({ error: 'File too large (max 10MB)' }, { status: 400 });
  }

  if (!credentialId || !clientId || !clientSecret || !pin) {
    return Response.json({
      error: 'All credentials required: clientId, clientSecret, pin, credentialId',
    }, { status: 400 });
  }

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
        const client = new SealClient({ baseUrl, clientId, clientSecret, pin, credentialId });

        const result = await client.seal(pdfBytes, {
          onStep: (step) => {
            sendEvent('step', {
              ...step,
              // Tag whether this is an API call or client-side SDK operation
              executionContext: ['token_obtained', 'credential_authorized', 'hash_signed'].includes(step.name)
                ? 'api' : 'client-sdk',
            });
          },
        });

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
