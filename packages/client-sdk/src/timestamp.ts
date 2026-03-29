import { createHash, randomBytes } from 'crypto';
import * as forge from 'node-forge';
import { OID_SHA256, sha256AlgorithmId, derToBuffer, bufferToAsn1 } from './asn1-helpers';

const asn1 = forge.asn1;

export const DEFAULT_TSA_URL = 'https://freetsa.org/tsr';

/**
 * Requests an RFC 3161 timestamp token from a Time Stamping Authority.
 * Elevates PAdES Baseline B → Baseline B-T.
 *
 * The returned token gets embedded as an unsigned attribute in CMS SignerInfo
 * (OID 1.2.840.113549.1.9.16.2.14).
 */
export async function getTimestamp(
  signatureBytes: Buffer,
  tsaUrl: string = DEFAULT_TSA_URL,
): Promise<Buffer> {
  const signatureHash = createHash('sha256').update(signatureBytes).digest();
  const tsReqDer = buildTimeStampReq(signatureHash);

  const response = await fetch(tsaUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/timestamp-query' },
    body: new Uint8Array(tsReqDer),
  });

  if (!response.ok) {
    throw new Error(`TSA request failed (${response.status}): ${await response.text()}`);
  }

  return parseTimeStampResp(Buffer.from(await response.arrayBuffer()));
}

/**
 * Builds an RFC 3161 TimeStampReq with SHA-256, random nonce, certReq=true.
 */
function buildTimeStampReq(hash: Buffer): Buffer {
  const messageImprint = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    sha256AlgorithmId(),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, hash.toString('binary')),
  ]);

  const tsReq = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, asn1.integerToDer(1).getBytes()),
    messageImprint,
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, randomBytes(8).toString('binary')),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.BOOLEAN, false, '\xff'), // certReq: true
  ]);

  return derToBuffer(asn1.toDer(tsReq));
}

/**
 * Parses TimeStampResp, validates status (0=granted, 1=grantedWithMods),
 * and extracts the TimeStampToken.
 */
function parseTimeStampResp(responseBytes: Buffer): Buffer {
  const resp = bufferToAsn1(responseBytes);
  const respValues = resp.value as forge.asn1.Asn1[];

  const statusInfo = respValues[0]!;
  const statusAsn1 = (statusInfo.value as forge.asn1.Asn1[])[0]!;
  const status = forge.asn1.derToInteger(statusAsn1.value as string);

  if (status !== 0 && status !== 1) {
    throw new Error(`TSA returned error status ${status}. Expected 0 (granted) or 1 (grantedWithMods).`);
  }

  const timeStampToken = respValues[1];
  if (!timeStampToken) {
    throw new Error('TSA response missing TimeStampToken');
  }

  return derToBuffer(asn1.toDer(timeStampToken));
}
