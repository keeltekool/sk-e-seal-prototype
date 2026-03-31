import * as forge from 'node-forge';

// --- CMS / PKCS#7 OIDs ---
export const OID_SIGNED_DATA = '1.2.840.113549.1.7.2';
export const OID_DATA = '1.2.840.113549.1.7.1';
export const OID_SHA256 = '2.16.840.1.101.3.4.2.1';
export const OID_RSA_ENCRYPTION = '1.2.840.113549.1.1.1';
export const OID_CONTENT_TYPE = '1.2.840.113549.1.9.3';
export const OID_MESSAGE_DIGEST = '1.2.840.113549.1.9.4';
export const OID_SIGNING_TIME = '1.2.840.113549.1.9.5';
export const OID_TIMESTAMP_TOKEN = '1.2.840.113549.1.9.16.2.14';
export const OID_SIGNING_CERTIFICATE_V2 = '1.2.840.113549.1.9.16.2.47';

/** SHA-256 AlgorithmIdentifier as ASN.1 SEQUENCE { OID, NULL } */
export function sha256AlgorithmId(): forge.asn1.Asn1 {
  const asn1 = forge.asn1;
  return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(OID_SHA256).getBytes()),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, ''),
  ]);
}

/** Convert a forge DER output to Buffer */
export function derToBuffer(der: forge.util.ByteStringBuffer): Buffer {
  return Buffer.from(der.getBytes(), 'binary');
}

/** Parse a Buffer as ASN.1 via node-forge */
export function bufferToAsn1(buf: Buffer): forge.asn1.Asn1 {
  return forge.asn1.fromDer(forge.util.createBuffer(buf.toString('binary')));
}

/** Create an ASN.1 OID node from a dotted OID string */
export function oidNode(oid: string): forge.asn1.Asn1 {
  return forge.asn1.create(
    forge.asn1.Class.UNIVERSAL,
    forge.asn1.Type.OID,
    false,
    forge.asn1.oidToDer(oid).getBytes(),
  );
}
