import * as forge from 'node-forge';
import {
  OID_SIGNED_DATA, OID_DATA, OID_RSA_ENCRYPTION, OID_TIMESTAMP_TOKEN,
  sha256AlgorithmId, derToBuffer, bufferToAsn1, oidNode,
} from './asn1-helpers';

const asn1 = forge.asn1;

function integerNode(value: number): forge.asn1.Asn1 {
  return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, asn1.integerToDer(value).getBytes());
}

/**
 * Builds a CMS SignedData (PKCS#7) container in detached mode.
 *
 * Built manually because node-forge's createSignedData() expects to do
 * signing itself, but we already have the raw signature from the CSC v2 API.
 *
 * @param rawSignature - Raw RSA signature bytes from CSC signHash
 * @param signedAttributesDer - DER-encoded SignedAttributes from computeHash()
 * @param signingCert - Parsed forge certificate (avoids PEM round-trip)
 * @param certDerBuffers - All certificates as DER buffers (signing cert first, then chain)
 */
export function buildCmsSignedData(
  rawSignature: Buffer,
  signedAttributesDer: Buffer,
  signingCert: forge.pki.Certificate,
  certDerBuffers: Buffer[],
): Buffer {
  const digestAlgorithms = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [sha256AlgorithmId()]);

  const encapContentInfo = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [oidNode(OID_DATA)]);

  const certificates = asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true,
    certDerBuffers.map((der) => bufferToAsn1(der)),
  );

  // Encode serial number as raw hex bytes (avoids 32-bit overflow with large serials)
  const serialHex = signingCert.serialNumber;
  const serialBytes = forge.util.hexToBytes(serialHex.length % 2 ? '0' + serialHex : serialHex);
  const issuerAndSerial = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    forge.pki.distinguishedNameToAsn1(signingCert.issuer),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, serialBytes),
  ]);

  // Re-tag SignedAttributes from SET (0x31) to [0] IMPLICIT (0xA0)
  // The hash was computed over the SET encoding; CMS SignerInfo requires [0] tagging
  const signedAttrsAsn1 = bufferToAsn1(signedAttributesDer);
  signedAttrsAsn1.tagClass = asn1.Class.CONTEXT_SPECIFIC;
  signedAttrsAsn1.type = 0;

  const signatureAlgorithm = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    oidNode(OID_RSA_ENCRYPTION),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, ''),
  ]);

  const signerInfo = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    integerNode(1),
    issuerAndSerial,
    sha256AlgorithmId(),
    signedAttrsAsn1,
    signatureAlgorithm,
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, rawSignature.toString('binary')),
  ]);

  const signedData = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    integerNode(1),
    digestAlgorithms,
    encapContentInfo,
    certificates,
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [signerInfo]),
  ]);

  const contentInfo = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    oidNode(OID_SIGNED_DATA),
    asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [signedData]),
  ]);

  return derToBuffer(asn1.toDer(contentInfo));
}

/**
 * Adds an RFC 3161 timestamp token as an unsigned attribute to CMS SignedData.
 * Elevates signature from PAdES Baseline B to PAdES Baseline B-T.
 */
export function addTimestampToCms(cmsDer: Buffer, timestampTokenDer: Buffer): Buffer {
  const contentInfo = bufferToAsn1(cmsDer);

  // Navigate: ContentInfo → [0] content → SignedData → signerInfos → signerInfo[0]
  const content = (contentInfo.value as forge.asn1.Asn1[])[1]!;
  const signedData = (content.value as forge.asn1.Asn1[])[0]!;
  const signedDataValues = signedData.value as forge.asn1.Asn1[];
  const signerInfos = signedDataValues[signedDataValues.length - 1]!;
  const signerInfo = (signerInfos.value as forge.asn1.Asn1[])[0]!;

  const timestampAttr = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    oidNode(OID_TIMESTAMP_TOKEN),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [bufferToAsn1(timestampTokenDer)]),
  ]);

  // unsignedAttrs [1] IMPLICIT
  const unsignedAttrs = asn1.create(asn1.Class.CONTEXT_SPECIFIC, 1, true, [timestampAttr]);
  (signerInfo.value as forge.asn1.Asn1[]).push(unsignedAttrs);

  return derToBuffer(asn1.toDer(contentInfo));
}
