import { createHash, randomBytes } from 'crypto';
import * as forge from 'node-forge';

const DEFAULT_TSA_URL = 'https://freetsa.org/tsr';

/**
 * Requests an RFC 3161 timestamp token from a Time Stamping Authority (TSA).
 *
 * This elevates a PAdES Baseline B signature to PAdES Baseline B-T by proving
 * the signature existed at a specific point in time.
 *
 * Flow:
 * 1. Compute SHA-256 of the signature value
 * 2. Build ASN.1 TimeStampReq per RFC 3161
 * 3. POST to TSA with Content-Type: application/timestamp-query
 * 4. Parse TimeStampResp
 * 5. Return the TimeStampToken (a CMS SignedData)
 *
 * The returned token gets embedded as an unsigned attribute in the CMS SignerInfo
 * (OID 1.2.840.113549.1.9.16.2.14).
 *
 * @param signatureBytes - The raw RSA signature to timestamp
 * @param tsaUrl - TSA endpoint URL (defaults to FreeTSA)
 * @returns DER-encoded TimeStampToken
 */
export async function getTimestamp(
  signatureBytes: Buffer,
  tsaUrl: string = DEFAULT_TSA_URL,
): Promise<Buffer> {
  // Step 1: Hash the signature
  const signatureHash = createHash('sha256').update(signatureBytes).digest();

  // Step 2: Build TimeStampReq ASN.1
  const tsReqDer = buildTimeStampReq(signatureHash);

  // Step 3: POST to TSA
  const response = await fetch(tsaUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/timestamp-query',
    },
    body: tsReqDer,
  });

  if (!response.ok) {
    throw new Error(
      `TSA request failed (${response.status}): ${await response.text()}`,
    );
  }

  const responseBytes = Buffer.from(await response.arrayBuffer());

  // Step 4: Parse TimeStampResp and extract TimeStampToken
  return parseTimeStampResp(responseBytes);
}

/**
 * Builds an RFC 3161 TimeStampReq.
 *
 * ASN.1 structure:
 *   TimeStampReq ::= SEQUENCE {
 *     version        INTEGER { v1(1) },
 *     messageImprint MessageImprint,
 *     nonce          INTEGER OPTIONAL,
 *     certReq        BOOLEAN DEFAULT FALSE
 *   }
 *
 *   MessageImprint ::= SEQUENCE {
 *     hashAlgorithm  AlgorithmIdentifier,
 *     hashedMessage  OCTET STRING
 *   }
 */
function buildTimeStampReq(hash: Buffer): Buffer {
  const asn1 = forge.asn1;

  // SHA-256 AlgorithmIdentifier
  const hashAlgorithm = asn1.create(
    asn1.Class.UNIVERSAL,
    asn1.Type.SEQUENCE,
    true,
    [
      asn1.create(
        asn1.Class.UNIVERSAL,
        asn1.Type.OID,
        false,
        asn1.oidToDer('2.16.840.1.101.3.4.2.1').getBytes(), // SHA-256
      ),
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, ''),
    ],
  );

  // MessageImprint
  const messageImprint = asn1.create(
    asn1.Class.UNIVERSAL,
    asn1.Type.SEQUENCE,
    true,
    [
      hashAlgorithm,
      asn1.create(
        asn1.Class.UNIVERSAL,
        asn1.Type.OCTETSTRING,
        false,
        hash.toString('binary'),
      ),
    ],
  );

  // Nonce (random to prevent replay)
  const nonce = randomBytes(8);

  // TimeStampReq
  const tsReq = asn1.create(
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
      // messageImprint
      messageImprint,
      // nonce
      asn1.create(
        asn1.Class.UNIVERSAL,
        asn1.Type.INTEGER,
        false,
        nonce.toString('binary'),
      ),
      // certReq: true (ask TSA to include its certificate)
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.BOOLEAN, false, '\xff'),
    ],
  );

  const derBytes = asn1.toDer(tsReq);
  return Buffer.from(derBytes.getBytes(), 'binary');
}

/**
 * Parses a TimeStampResp and extracts the TimeStampToken.
 *
 * TimeStampResp ::= SEQUENCE {
 *   status          PKIStatusInfo,
 *   timeStampToken  TimeStampToken OPTIONAL
 * }
 *
 * PKIStatusInfo ::= SEQUENCE {
 *   status    PKIStatus,
 *   ...
 * }
 *
 * PKIStatus: 0 = granted, 1 = grantedWithMods, 2 = rejection, ...
 */
function parseTimeStampResp(responseBytes: Buffer): Buffer {
  const asn1 = forge.asn1;

  const resp = asn1.fromDer(
    forge.util.createBuffer(responseBytes.toString('binary')),
  );
  const respValues = resp.value as forge.asn1.Asn1[];

  // First element is PKIStatusInfo
  const statusInfo = respValues[0]!;
  const statusValues = statusInfo.value as forge.asn1.Asn1[];
  const statusAsn1 = statusValues[0]!;
  const status = forge.asn1.derToInteger(statusAsn1.value as string);

  if (status !== 0 && status !== 1) {
    throw new Error(
      `TSA returned error status ${status}. Expected 0 (granted) or 1 (grantedWithMods).`,
    );
  }

  // Second element is the TimeStampToken (a ContentInfo)
  const timeStampToken = respValues[1];
  if (!timeStampToken) {
    throw new Error('TSA response missing TimeStampToken');
  }

  // Re-encode just the TimeStampToken
  const tokenDer = asn1.toDer(timeStampToken);
  return Buffer.from(tokenDer.getBytes(), 'binary');
}
