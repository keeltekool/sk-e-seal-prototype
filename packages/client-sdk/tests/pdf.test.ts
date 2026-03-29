import { describe, it, expect } from 'vitest';
import { preparePdf, injectSignature } from '../src/pdf';
import { PDFDocument } from 'pdf-lib';

describe('PDF preparation', () => {
  async function createTestPdf(): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([595, 842]); // A4
    const bytes = await pdfDoc.save();
    return new Uint8Array(bytes);
  }

  it('should add a signature placeholder to a PDF', async () => {
    const pdfBytes = await createTestPdf();
    const result = await preparePdf(pdfBytes);

    expect(result.preparedPdf).toBeInstanceOf(Uint8Array);
    expect(result.preparedPdf.length).toBeGreaterThan(pdfBytes.length);
    expect(result.byteRange).toHaveLength(4);
    expect(result.byteRange[0]).toBe(0);
    expect(result.byteRange[1]).toBeGreaterThan(0);
    expect(result.byteRange[2]).toBeGreaterThan(result.byteRange[1]);
    expect(result.byteRange[3]).toBeGreaterThan(0);
    expect(result.signaturePlaceholderOffset).toBeGreaterThan(0);
    expect(result.signaturePlaceholderLength).toBeGreaterThan(0);
  });

  it('should produce valid byte ranges that cover the entire PDF', async () => {
    const pdfBytes = await createTestPdf();
    const result = await preparePdf(pdfBytes);

    // byteRange[1] + signaturePlaceholderLength + byteRange[3] should equal total PDF length
    const totalCoverage =
      result.byteRange[1] +
      result.signaturePlaceholderLength +
      result.byteRange[3];
    expect(totalCoverage).toBe(result.preparedPdf.length);

    // byteRange[2] should equal byteRange[1] + placeholder length
    expect(result.byteRange[2]).toBe(
      result.byteRange[1] + result.signaturePlaceholderLength,
    );
  });

  it('should contain /adbe.pkcs7.detached SubFilter in the prepared PDF', async () => {
    const pdfBytes = await createTestPdf();
    const result = await preparePdf(pdfBytes);

    const pdfText = Buffer.from(result.preparedPdf).toString('latin1');
    expect(pdfText).toContain('adbe.pkcs7.detached');
  });

  it('should contain actual ByteRange values (not placeholders)', async () => {
    const pdfBytes = await createTestPdf();
    const result = await preparePdf(pdfBytes);

    const pdfText = Buffer.from(result.preparedPdf).toString('latin1');
    const byteRangeStr = `/ByteRange [${result.byteRange.join(' ')}]`;
    expect(pdfText).toContain(byteRangeStr);
  });
});

describe('Signature injection', () => {
  async function createTestPdf(): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([595, 842]);
    const bytes = await pdfDoc.save();
    return new Uint8Array(bytes);
  }

  it('should inject a hex signature into the placeholder', async () => {
    const pdfBytes = await createTestPdf();
    const prepared = await preparePdf(pdfBytes);

    // Create a fake signature (just some hex data)
    const fakeSignatureHex = 'deadbeef'.repeat(100);

    const sealed = injectSignature(
      prepared.preparedPdf,
      fakeSignatureHex,
      prepared.signaturePlaceholderOffset,
      prepared.signaturePlaceholderLength,
    );

    expect(sealed).toBeInstanceOf(Uint8Array);
    expect(sealed.length).toBe(prepared.preparedPdf.length);

    // The signature should be present in the output
    const sealedText = Buffer.from(sealed).toString('latin1');
    expect(sealedText).toContain(fakeSignatureHex);
  });

  it('should throw if signature exceeds placeholder capacity', async () => {
    const pdfBytes = await createTestPdf();
    const prepared = await preparePdf(pdfBytes);

    // Create a signature that's way too large
    const oversizedHex = 'ff'.repeat(prepared.signaturePlaceholderLength);

    expect(() =>
      injectSignature(
        prepared.preparedPdf,
        oversizedHex,
        prepared.signaturePlaceholderOffset,
        prepared.signaturePlaceholderLength,
      ),
    ).toThrow('exceeds placeholder capacity');
  });
});
