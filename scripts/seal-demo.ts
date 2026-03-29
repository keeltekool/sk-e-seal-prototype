/**
 * CLI Demo: Seal a PDF document using the CSC v2 API.
 *
 * Usage:
 *   npx tsx scripts/seal-demo.ts <input.pdf>
 *
 * Environment variables (or .env.local):
 *   API_URL              - CSC v2 API base URL (default: http://localhost:3000)
 *   DEMO_CLIENT_ID       - OAuth2 client_id
 *   DEMO_CLIENT_SECRET   - OAuth2 client_secret
 *   DEMO_PIN             - SCAL2 PIN
 *   DEMO_CREDENTIAL_ID   - Credential ID to use for sealing
 *
 * Example:
 *   API_URL=http://localhost:3000 \
 *   DEMO_CLIENT_ID=demo-tenant-001 \
 *   DEMO_CLIENT_SECRET=demo-secret-001 \
 *   DEMO_PIN=12345 \
 *   DEMO_CREDENTIAL_ID=<from credentials/list> \
 *   npx tsx scripts/seal-demo.ts test-files/sample.pdf
 */
import { readFileSync, writeFileSync } from 'fs';
import { config } from 'dotenv';
import { SealClient } from '../packages/client-sdk/src';

// Load .env.local
config({ path: '.env.local' });

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: npx tsx scripts/seal-demo.ts <input.pdf>');
    process.exit(1);
  }

  const clientId = process.env.DEMO_CLIENT_ID;
  const clientSecret = process.env.DEMO_CLIENT_SECRET;
  const pin = process.env.DEMO_PIN;
  const credentialId = process.env.DEMO_CREDENTIAL_ID;

  if (!clientId || !clientSecret || !pin || !credentialId) {
    console.error('Missing required environment variables:');
    console.error(
      '  DEMO_CLIENT_ID, DEMO_CLIENT_SECRET, DEMO_PIN, DEMO_CREDENTIAL_ID',
    );
    console.error('\nSet them in .env.local or as environment variables.');
    process.exit(1);
  }

  const client = new SealClient({
    baseUrl: process.env.API_URL || 'http://localhost:3000',
    clientId,
    clientSecret,
    pin,
    credentialId,
  });

  const pdfBytes = readFileSync(inputPath);

  console.log(`\n  Sealing: ${inputPath}`);
  console.log(`  Size: ${pdfBytes.length} bytes`);
  console.log('');

  const result = await client.seal(new Uint8Array(pdfBytes), {
    onStep: (step) => {
      const ms = String(step.durationMs).padStart(5);
      console.log(`  [${ms}ms] ${step.name}: ${step.description}`);
    },
  });

  const outputPath = inputPath.replace(/\.pdf$/i, '-sealed.pdf');
  writeFileSync(outputPath, result.sealedPdf);

  console.log('');
  console.log(`  Output: ${outputPath}`);
  console.log(`  Total:  ${result.totalDurationMs}ms`);
  console.log(`  Steps:  ${result.steps.length}`);
  console.log('');
}

main().catch((err) => {
  console.error('\nSealing failed:', err.message);
  process.exit(1);
});
