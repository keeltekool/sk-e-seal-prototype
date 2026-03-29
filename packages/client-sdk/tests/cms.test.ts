import { describe, it, expect } from 'vitest';
import { buildCmsSignedData } from '../src/cms';
import { derToBuffer } from '../src/asn1-helpers';
import * as forge from 'node-forge';

function generateTestCert() {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

  const attrs = [
    { name: 'commonName', value: 'Test E-Seal Certificate' },
    { name: 'organizationName', value: 'Test Org' },
    { name: 'countryName', value: 'EE' },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const certDer = derToBuffer(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)));
  return { cert, certDer, privateKey: keys.privateKey };
}

function createTestSignature(privateKey: forge.pki.rsa.PrivateKey, data: string = 'test') {
  const md = forge.md.sha256.create();
  md.update(data, 'utf8');
  return Buffer.from(privateKey.sign(md), 'binary');
}

function createMinimalSignedAttrsDer() {
  const asn1 = forge.asn1;
  const attrs = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false,
        asn1.oidToDer('1.2.840.113549.1.9.3').getBytes()),
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false,
          asn1.oidToDer('1.2.840.113549.1.7.1').getBytes()),
      ]),
    ]),
  ]);
  return derToBuffer(asn1.toDer(attrs));
}

describe('CMS SignedData assembly', () => {
  it('should build a valid DER-encoded CMS ContentInfo', () => {
    const { cert, certDer, privateKey } = generateTestCert();
    const rawSignature = createTestSignature(privateKey, 'test-signed-attributes');
    const signedAttrsDer = createMinimalSignedAttrsDer();

    const cmsDer = buildCmsSignedData(rawSignature, signedAttrsDer, cert, [certDer]);

    expect(cmsDer).toBeInstanceOf(Buffer);
    expect(cmsDer.length).toBeGreaterThan(0);

    const parsed = forge.asn1.fromDer(forge.util.createBuffer(cmsDer.toString('binary')));
    expect(parsed.tagClass).toBe(forge.asn1.Class.UNIVERSAL);
    expect(parsed.type).toBe(forge.asn1.Type.SEQUENCE);

    const values = parsed.value as forge.asn1.Asn1[];
    const contentTypeOid = forge.asn1.derToOid(values[0]!.value as string);
    expect(contentTypeOid).toBe('1.2.840.113549.1.7.2');
  });

  it('should include the signing certificate', () => {
    const { cert, certDer, privateKey } = generateTestCert();
    const rawSignature = createTestSignature(privateKey);
    const signedAttrsDer = createMinimalSignedAttrsDer();

    const cmsDer = buildCmsSignedData(rawSignature, signedAttrsDer, cert, [certDer]);

    const asn1Parsed = forge.asn1.fromDer(forge.util.createBuffer(cmsDer.toString('binary')));
    const p7 = forge.pkcs7.messageFromAsn1(asn1Parsed) as any;
    expect(p7.certificates).toHaveLength(1);
  });

  it('should include the raw signature in SignerInfo', () => {
    const { cert, certDer, privateKey } = generateTestCert();
    const rawSignature = createTestSignature(privateKey, 'test-data');
    const signedAttrsDer = createMinimalSignedAttrsDer();

    const cmsDer = buildCmsSignedData(rawSignature, signedAttrsDer, cert, [certDer]);

    const asn1Parsed = forge.asn1.fromDer(forge.util.createBuffer(cmsDer.toString('binary')));
    const p7 = forge.pkcs7.messageFromAsn1(asn1Parsed) as any;
    expect(p7.rawCapture.signerInfos).toBeDefined();
  });

  it('should handle multiple chain certificates', () => {
    const root = generateTestCert();
    const intermediate = generateTestCert();
    const rawSignature = createTestSignature(root.privateKey);
    const signedAttrsDer = createMinimalSignedAttrsDer();

    const cmsDer = buildCmsSignedData(
      rawSignature, signedAttrsDer, root.cert, [root.certDer, intermediate.certDer],
    );

    const asn1Parsed = forge.asn1.fromDer(forge.util.createBuffer(cmsDer.toString('binary')));
    const p7 = forge.pkcs7.messageFromAsn1(asn1Parsed) as any;
    expect(p7.certificates).toHaveLength(2);
  });
});
