import { describe, it, expect } from 'vitest';
import { buildCmsSignedData } from '../src/cms';
import * as forge from 'node-forge';

// Generate a self-signed test certificate and key for testing
function generateTestCert() {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(
    cert.validity.notBefore.getFullYear() + 1,
  );

  const attrs = [
    { name: 'commonName', value: 'Test E-Seal Certificate' },
    { name: 'organizationName', value: 'Test Org' },
    { name: 'countryName', value: 'EE' },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  return {
    cert,
    certPem: forge.pki.certificateToPem(cert),
    privateKey: keys.privateKey,
  };
}

describe('CMS SignedData assembly', () => {
  it('should build a valid DER-encoded CMS ContentInfo', () => {
    const { certPem, privateKey } = generateTestCert();

    // Create a fake signature (sign some data with the test key)
    const md = forge.md.sha256.create();
    md.update('test-signed-attributes', 'utf8');
    const signature = privateKey.sign(md);
    const rawSignature = Buffer.from(signature, 'binary');

    // Create fake signed attributes DER
    const asn1 = forge.asn1;
    const signedAttrs = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.OID,
          false,
          asn1.oidToDer('1.2.840.113549.1.9.3').getBytes(),
        ),
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [
          asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.OID,
            false,
            asn1.oidToDer('1.2.840.113549.1.7.1').getBytes(),
          ),
        ]),
      ]),
    ]);
    const signedAttrsDer = Buffer.from(
      asn1.toDer(signedAttrs).getBytes(),
      'binary',
    );

    const cmsDer = buildCmsSignedData(
      rawSignature,
      signedAttrsDer,
      certPem,
    );

    expect(cmsDer).toBeInstanceOf(Buffer);
    expect(cmsDer.length).toBeGreaterThan(0);

    // Parse it back to verify structure
    const parsed = asn1.fromDer(forge.util.createBuffer(cmsDer));

    // Should be a SEQUENCE (ContentInfo)
    expect(parsed.tagClass).toBe(asn1.Class.UNIVERSAL);
    expect(parsed.type).toBe(asn1.Type.SEQUENCE);

    // First element should be OID for signedData
    const values = parsed.value as forge.asn1.Asn1[];
    const contentTypeOid = forge.asn1.derToOid(
      (values[0]!.value as string),
    );
    expect(contentTypeOid).toBe('1.2.840.113549.1.7.2');
  });

  it('should include the signing certificate', () => {
    const { certPem, privateKey } = generateTestCert();

    const md = forge.md.sha256.create();
    md.update('test', 'utf8');
    const rawSignature = Buffer.from(privateKey.sign(md), 'binary');

    const asn1 = forge.asn1;
    const signedAttrs = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, []);
    const signedAttrsDer = Buffer.from(
      asn1.toDer(signedAttrs).getBytes(),
      'binary',
    );

    const cmsDer = buildCmsSignedData(
      rawSignature,
      signedAttrsDer,
      certPem,
    );

    // Parse and verify PKCS#7 structure using node-forge
    const asn1Parsed = asn1.fromDer(forge.util.createBuffer(cmsDer));
    const p7 = forge.pkcs7.messageFromAsn1(asn1Parsed);

    expect(p7.type).toBe('1.2.840.113549.1.7.2'); // signedData
    expect((p7 as any).certificates).toHaveLength(1);
  });

  it('should include the raw signature in SignerInfo', () => {
    const { certPem, privateKey } = generateTestCert();

    const md = forge.md.sha256.create();
    md.update('test-data', 'utf8');
    const rawSignature = Buffer.from(privateKey.sign(md), 'binary');

    const asn1 = forge.asn1;
    const signedAttrs = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.OID,
          false,
          asn1.oidToDer('1.2.840.113549.1.9.3').getBytes(),
        ),
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [
          asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.OID,
            false,
            asn1.oidToDer('1.2.840.113549.1.7.1').getBytes(),
          ),
        ]),
      ]),
    ]);
    const signedAttrsDer = Buffer.from(
      asn1.toDer(signedAttrs).getBytes(),
      'binary',
    );

    const cmsDer = buildCmsSignedData(
      rawSignature,
      signedAttrsDer,
      certPem,
    );

    // Parse and check signerInfos
    const asn1Parsed = asn1.fromDer(forge.util.createBuffer(cmsDer));
    const p7 = forge.pkcs7.messageFromAsn1(asn1Parsed) as any;

    expect(p7.rawCapture.signerInfos).toBeDefined();
  });

  it('should handle multiple chain certificates', () => {
    const root = generateTestCert();
    const intermediate = generateTestCert();

    const md = forge.md.sha256.create();
    md.update('test', 'utf8');
    const rawSignature = Buffer.from(root.privateKey.sign(md), 'binary');

    const asn1 = forge.asn1;
    const signedAttrs = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, []);
    const signedAttrsDer = Buffer.from(
      asn1.toDer(signedAttrs).getBytes(),
      'binary',
    );

    const cmsDer = buildCmsSignedData(
      rawSignature,
      signedAttrsDer,
      root.certPem,
      [intermediate.certPem],
    );

    const asn1Parsed = asn1.fromDer(forge.util.createBuffer(cmsDer));
    const p7 = forge.pkcs7.messageFromAsn1(asn1Parsed) as any;

    expect(p7.certificates).toHaveLength(2);
  });
});
