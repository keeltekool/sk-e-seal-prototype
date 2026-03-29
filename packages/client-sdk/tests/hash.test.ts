import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { computeHash } from '../src/hash';
import { preparePdf } from '../src/pdf';
import { PDFDocument } from 'pdf-lib';
import * as forge from 'node-forge';

describe('Hash computation', () => {
  async function createPreparedPdf() {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([595, 842]);
    const pdfBytes = new Uint8Array(await pdfDoc.save());
    return preparePdf(pdfBytes);
  }

  it('should compute pdfHash as SHA-256 of byte ranges', async () => {
    const prepared = await createPreparedPdf();
    const fixedTime = new Date('2026-03-29T12:00:00Z');

    const result = computeHash(
      prepared.preparedPdf,
      prepared.byteRange,
      fixedTime,
    );

    // Verify pdfHash manually
    const manualHash = createHash('sha256');
    manualHash.update(
      Buffer.from(
        prepared.preparedPdf.buffer,
        prepared.preparedPdf.byteOffset + prepared.byteRange[0],
        prepared.byteRange[1],
      ),
    );
    manualHash.update(
      Buffer.from(
        prepared.preparedPdf.buffer,
        prepared.preparedPdf.byteOffset + prepared.byteRange[2],
        prepared.byteRange[3],
      ),
    );
    expect(result.pdfHash).toEqual(manualHash.digest());
  });

  it('should return a 32-byte signedAttributesHash', async () => {
    const prepared = await createPreparedPdf();
    const result = computeHash(prepared.preparedPdf, prepared.byteRange);

    // SHA-256 = 32 bytes
    expect(result.signedAttributesHash.length).toBe(32);
    expect(result.pdfHash.length).toBe(32);
  });

  it('should produce valid DER-encoded SignedAttributes', async () => {
    const prepared = await createPreparedPdf();
    const fixedTime = new Date('2026-03-29T12:00:00Z');

    const result = computeHash(
      prepared.preparedPdf,
      prepared.byteRange,
      fixedTime,
    );

    // Parse the DER to verify it's valid ASN.1
    const asn1 = forge.asn1.fromDer(
      forge.util.createBuffer(result.signedAttributesDer),
    );

    // Should be a SET (tag 0x31)
    expect(asn1.tagClass).toBe(forge.asn1.Class.UNIVERSAL);
    expect(asn1.type).toBe(forge.asn1.Type.SET);
    expect(asn1.constructed).toBe(true);

    // Should have 3 attributes: contentType, signingTime, messageDigest
    expect(asn1.value).toHaveLength(3);
  });

  it('should embed pdfHash as messageDigest in SignedAttributes', async () => {
    const prepared = await createPreparedPdf();
    const fixedTime = new Date('2026-03-29T12:00:00Z');

    const result = computeHash(
      prepared.preparedPdf,
      prepared.byteRange,
      fixedTime,
    );

    // Parse DER and find messageDigest attribute
    const asn1 = forge.asn1.fromDer(
      forge.util.createBuffer(result.signedAttributesDer),
    );

    const attrs = asn1.value as forge.asn1.Asn1[];
    // messageDigest OID: 1.2.840.113549.1.9.4
    const messageDigestOid = forge.asn1.oidToDer('1.2.840.113549.1.9.4').getBytes();

    let foundDigest = false;
    for (const attr of attrs) {
      const seq = attr.value as forge.asn1.Asn1[];
      const oid = seq[0];
      if (oid && oid.value === messageDigestOid) {
        // The SET contains an OCTET STRING with the hash
        const set = seq[1] as forge.asn1.Asn1;
        const octetString = (set.value as forge.asn1.Asn1[])[0];
        const digestBytes = Buffer.from(octetString!.value as string, 'binary');
        expect(digestBytes).toEqual(result.pdfHash);
        foundDigest = true;
      }
    }
    expect(foundDigest).toBe(true);
  });

  it('signedAttributesHash should be SHA-256 of the DER bytes', async () => {
    const prepared = await createPreparedPdf();
    const result = computeHash(prepared.preparedPdf, prepared.byteRange);

    const expectedHash = createHash('sha256')
      .update(result.signedAttributesDer)
      .digest();
    expect(result.signedAttributesHash).toEqual(expectedHash);
  });

  it('should be deterministic for the same input and time', async () => {
    const prepared = await createPreparedPdf();
    const fixedTime = new Date('2026-03-29T12:00:00Z');

    const result1 = computeHash(
      prepared.preparedPdf,
      prepared.byteRange,
      fixedTime,
    );
    const result2 = computeHash(
      prepared.preparedPdf,
      prepared.byteRange,
      fixedTime,
    );

    expect(result1.pdfHash).toEqual(result2.pdfHash);
    expect(result1.signedAttributesHash).toEqual(result2.signedAttributesHash);
    expect(result1.signedAttributesDer).toEqual(result2.signedAttributesDer);
  });
});
