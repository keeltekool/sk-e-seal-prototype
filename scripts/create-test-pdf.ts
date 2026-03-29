/**
 * Creates a simple test PDF for the seal demo.
 * Usage: npx tsx scripts/create-test-pdf.ts
 */
import { writeFileSync } from 'fs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

async function main() {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([595, 842]); // A4
  const { height } = page.getSize();

  // Title
  page.drawText('Test Invoice', {
    x: 50,
    y: height - 80,
    size: 24,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });

  // Subtitle
  page.drawText('Qualified E-Seal by SK ID — Test Document', {
    x: 50,
    y: height - 110,
    size: 12,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  // Body
  const lines = [
    'Invoice #: TEST-2026-001',
    'Date: 2026-03-29',
    'From: SK ID Solutions AS',
    'To: Test Customer OÜ',
    '',
    'Description                          Amount',
    '---------------------------------------------',
    'Remote E-Seal Service (monthly)      €150.00',
    'API calls (5,000 seals)              €250.00',
    'Support package                       €50.00',
    '---------------------------------------------',
    'Total                                €450.00',
    '',
    '',
    'This document will be sealed with a CSC v2 compliant',
    'qualified e-seal using the prototype service.',
  ];

  let y = height - 160;
  for (const line of lines) {
    page.drawText(line, {
      x: 50,
      y,
      size: 11,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= 20;
  }

  const pdfBytes = await pdfDoc.save();
  writeFileSync('test-files/sample.pdf', pdfBytes);
  console.log(`Created test-files/sample.pdf (${pdfBytes.byteLength} bytes)`);
}

main().catch(console.error);
