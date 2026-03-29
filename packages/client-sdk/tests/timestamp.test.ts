import { describe, it, expect } from 'vitest';
import { getTimestamp } from '../src/timestamp';
import * as forge from 'node-forge';

describe('RFC 3161 Timestamp', () => {
  // This is an integration test that hits the real FreeTSA server.
  // It's slow (~1-3s) but validates the full flow.
  it(
    'should get a valid timestamp token from FreeTSA',
    async () => {
      // Create some fake signature bytes to timestamp
      const fakeSignature = Buffer.from(
        'This is a fake RSA signature for testing timestamps',
      );

      const timestampTokenDer = await getTimestamp(fakeSignature);

      expect(timestampTokenDer).toBeInstanceOf(Buffer);
      expect(timestampTokenDer.length).toBeGreaterThan(100);

      // Parse the token to verify it's valid ASN.1 (ContentInfo)
      const asn1 = forge.asn1.fromDer(
        forge.util.createBuffer(timestampTokenDer.toString('binary')),
      );

      // Should be a SEQUENCE (ContentInfo)
      expect(asn1.tagClass).toBe(forge.asn1.Class.UNIVERSAL);
      expect(asn1.type).toBe(forge.asn1.Type.SEQUENCE);

      // First element should be OID for signedData (timestamp token is CMS SignedData)
      const values = asn1.value as forge.asn1.Asn1[];
      const contentTypeOid = forge.asn1.derToOid(values[0]!.value as string);
      expect(contentTypeOid).toBe('1.2.840.113549.1.7.2'); // signedData
    },
    { timeout: 15000 },
  );
});
