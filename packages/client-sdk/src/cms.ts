import * as forge from 'node-forge';

/**
 * Builds a CMS SignedData (PKCS#7) container in detached mode.
 *
 * This is the binary blob that goes into the PDF's /Contents field.
 * Structure per RFC 5652 (CMS) and ETSI EN 319 122-1 (PAdES):
 *
 *   ContentInfo {
 *     contentType: id-signedData (1.2.840.113549.1.7.2)
 *     content: SignedData {
 *       version: 1
 *       digestAlgorithms: { SHA-256 }
 *       encapContentInfo: { id-data } (detached — no content)
 *       certificates: [signingCert, ...chainCerts]
 *       signerInfos: [{
 *         version: 1
 *         sid: issuerAndSerialNumber
 *         digestAlgorithm: SHA-256
 *         signedAttrs: [contentType, signingTime, messageDigest]
 *         signatureAlgorithm: rsaEncryption
 *         signature: <raw RSA signature from CSC signHash>
 *       }]
 *     }
 *   }
 *
 * We build this manually with node-forge ASN.1 because node-forge's
 * createSignedData() expects to do signing itself, but we already have
 * the raw signature from the CSC v2 API.
 *
 * @param rawSignature - Raw RSA signature bytes from CSC signHash (base64-decoded)
 * @param signedAttributesDer - DER-encoded SignedAttributes from computeHash()
 * @param certificatePem - Signing certificate in PEM format
 * @param chainPems - Optional intermediate/root certificates in PEM format
 * @returns DER-encoded CMS SignedData as Buffer
 */
export function buildCmsSignedData(
  rawSignature: Buffer,
  signedAttributesDer: Buffer,
  certificatePem: string,
  chainPems: string[] = [],
): Buffer {
  const asn1 = forge.asn1;

  // Parse the signing certificate to extract issuer and serial number
  const cert = forge.pki.certificateFromPem(certificatePem);

  // --- OIDs ---
  const oidSignedData = asn1.oidToDer('1.2.840.113549.1.7.2').getBytes();
  const oidData = asn1.oidToDer('1.2.840.113549.1.7.1').getBytes();
  const oidSha256 = asn1.oidToDer('2.16.840.1.101.3.4.2.1').getBytes();
  const oidRsaEncryption = asn1.oidToDer('1.2.840.113549.1.1.1').getBytes();

  // --- DigestAlgorithm: SHA-256 ---
  const digestAlgorithm = asn1.create(
    asn1.Class.UNIVERSAL,
    asn1.Type.SEQUENCE,
    true,
    [
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, oidSha256),
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, ''),
    ],
  );

  // --- DigestAlgorithms SET ---
  const digestAlgorithms = asn1.create(
    asn1.Class.UNIVERSAL,
    asn1.Type.SET,
    true,
    [digestAlgorithm],
  );

  // --- EncapContentInfo (detached — no eContent) ---
  const encapContentInfo = asn1.create(
    asn1.Class.UNIVERSAL,
    asn1.Type.SEQUENCE,
    true,
    [asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, oidData)],
  );

  // --- Certificates [0] IMPLICIT ---
  const allCerts = [certificatePem, ...chainPems];
  const certAsn1List = allCerts.map((pem) => {
    const c = forge.pki.certificateFromPem(pem);
    return forge.pki.certificateToAsn1(c);
  });
  const certificates = asn1.create(
    asn1.Class.CONTEXT_SPECIFIC,
    0,
    true,
    certAsn1List,
  );

  // --- SignerInfo ---
  // IssuerAndSerialNumber
  const issuerAndSerial = asn1.create(
    asn1.Class.UNIVERSAL,
    asn1.Type.SEQUENCE,
    true,
    [
      // Issuer: copy from cert
      forge.pki.distinguishedNameToAsn1(cert.issuer),
      // SerialNumber
      asn1.create(
        asn1.Class.UNIVERSAL,
        asn1.Type.INTEGER,
        false,
        asn1.integerToDer(parseInt(cert.serialNumber, 16)).getBytes(),
      ),
    ],
  );

  // SignedAttributes as [0] IMPLICIT (re-tag the SET from 0x31 to 0xA0)
  // The DER from computeHash() is a SET (0x31). For SignerInfo, it must be
  // tagged as [0] IMPLICIT (0xA0), but the hash was computed over the SET encoding.
  const signedAttrsAsn1 = asn1.fromDer(
    forge.util.createBuffer(signedAttributesDer.toString('binary')),
  );
  // Re-tag: change from UNIVERSAL SET to CONTEXT_SPECIFIC [0] constructed
  signedAttrsAsn1.tagClass = asn1.Class.CONTEXT_SPECIFIC;
  signedAttrsAsn1.type = 0;

  // Signature algorithm: rsaEncryption
  const signatureAlgorithm = asn1.create(
    asn1.Class.UNIVERSAL,
    asn1.Type.SEQUENCE,
    true,
    [
      asn1.create(
        asn1.Class.UNIVERSAL,
        asn1.Type.OID,
        false,
        oidRsaEncryption,
      ),
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, ''),
    ],
  );

  // SignerInfo
  const signerInfo = asn1.create(
    asn1.Class.UNIVERSAL,
    asn1.Type.SEQUENCE,
    true,
    [
      // version: 1
      asn1.create(
        asn1.Class.UNIVERSAL,
        asn1.Type.INTEGER,
        false,
        asn1.integerToDer(1).getBytes(),
      ),
      // issuerAndSerialNumber
      issuerAndSerial,
      // digestAlgorithm
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, oidSha256),
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, ''),
      ]),
      // signedAttrs [0] IMPLICIT
      signedAttrsAsn1,
      // signatureAlgorithm
      signatureAlgorithm,
      // signature
      asn1.create(
        asn1.Class.UNIVERSAL,
        asn1.Type.OCTETSTRING,
        false,
        rawSignature.toString('binary'),
      ),
    ],
  );

  // --- SignerInfos SET ---
  const signerInfos = asn1.create(
    asn1.Class.UNIVERSAL,
    asn1.Type.SET,
    true,
    [signerInfo],
  );

  // --- SignedData SEQUENCE ---
  const signedData = asn1.create(
    asn1.Class.UNIVERSAL,
    asn1.Type.SEQUENCE,
    true,
    [
      // version: 1
      asn1.create(
        asn1.Class.UNIVERSAL,
        asn1.Type.INTEGER,
        false,
        asn1.integerToDer(1).getBytes(),
      ),
      digestAlgorithms,
      encapContentInfo,
      certificates,
      signerInfos,
    ],
  );

  // --- ContentInfo wrapper ---
  const contentInfo = asn1.create(
    asn1.Class.UNIVERSAL,
    asn1.Type.SEQUENCE,
    true,
    [
      asn1.create(
        asn1.Class.UNIVERSAL,
        asn1.Type.OID,
        false,
        oidSignedData,
      ),
      asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [signedData]),
    ],
  );

  // DER-encode
  const derBytes = asn1.toDer(contentInfo);
  return Buffer.from(derBytes.getBytes(), 'binary');
}

/**
 * Adds an unsigned attribute to an existing CMS SignedData.
 * Used to add the RFC 3161 timestamp token as an unsigned attribute.
 *
 * @param cmsDer - Existing CMS SignedData DER bytes
 * @param timestampTokenDer - The RFC 3161 TimeStampToken DER bytes
 * @returns Updated CMS SignedData DER with timestamp as unsigned attribute
 */
export function addTimestampToCms(
  cmsDer: Buffer,
  timestampTokenDer: Buffer,
): Buffer {
  const asn1 = forge.asn1;

  // OID for id-aa-signatureTimeStampToken (1.2.840.113549.1.9.16.2.14)
  const oidTimestampToken = asn1
    .oidToDer('1.2.840.113549.1.9.16.2.14')
    .getBytes();

  // Parse existing CMS
  const contentInfo = asn1.fromDer(forge.util.createBuffer(cmsDer.toString('binary')));

  // Navigate: ContentInfo → [0] content → SignedData → signerInfos → signerInfo[0]
  const content = (contentInfo.value as forge.asn1.Asn1[])[1]; // [0] EXPLICIT
  const signedData = (content!.value as forge.asn1.Asn1[])[0]!;
  const signedDataValues = signedData.value as forge.asn1.Asn1[];

  // SignerInfos is the last element in SignedData
  const signerInfos = signedDataValues[signedDataValues.length - 1]!;
  const signerInfo = (signerInfos.value as forge.asn1.Asn1[])[0]!;

  // Build the unsigned attribute: id-aa-signatureTimeStampToken
  const timestampAttr = asn1.create(
    asn1.Class.UNIVERSAL,
    asn1.Type.SEQUENCE,
    true,
    [
      asn1.create(
        asn1.Class.UNIVERSAL,
        asn1.Type.OID,
        false,
        oidTimestampToken,
      ),
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [
        // The TimeStampToken is itself a ContentInfo — embed the raw DER
        asn1.fromDer(forge.util.createBuffer(timestampTokenDer.toString('binary'))),
      ]),
    ],
  );

  // Create unsignedAttrs [1] IMPLICIT SET
  const unsignedAttrs = asn1.create(
    asn1.Class.CONTEXT_SPECIFIC,
    1,
    true,
    [timestampAttr],
  );

  // Append unsignedAttrs to signerInfo
  (signerInfo.value as forge.asn1.Asn1[]).push(unsignedAttrs);

  // Re-encode
  const derBytes = asn1.toDer(contentInfo);
  return Buffer.from(derBytes.getBytes(), 'binary');
}
