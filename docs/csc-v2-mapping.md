# CSC v2 Specification Mapping

> Maps every CSC v2 API specification section to the exact file and function that implements it.
>
> Spec: [CSC API v2.0.0.2](https://cloudsignatureconsortium.org/wp-content/uploads/2023/04/csc-api-v2.0.0.2.pdf)

## Endpoint Mapping

### Section 8 — Authentication

| Spec Section | Requirement | Implementation | File:Line |
|---|---|---|---|
| §8 | All CSC API calls require a valid access token | Bearer token validation | `src/lib/middleware.ts:11` — `authenticateRequest()` |
| §8 | OAuth 2.0 Client Credentials flow | Token issuance (RFC 6749 §4.4) | `src/app/api/oauth2/token/route.ts:7` |
| §8 | Support `application/x-www-form-urlencoded` | Both form + JSON body parsing | `src/app/api/oauth2/token/route.ts:15-25` |
| §8 | Token response: `access_token`, `token_type`, `expires_in` | RFC 6749 §5.1 response format | `src/app/api/oauth2/token/route.ts:76-80` |

### Section 11.1 — info

| Spec Section | Requirement | Implementation | File:Line |
|---|---|---|---|
| §11.1 | `specs` — API version | `"2.0.0.2"` | `src/app/api/csc/v2/info/route.ts:8` |
| §11.1 | `name` — service name | `"Qualified E-Seal by SK ID"` | `src/app/api/csc/v2/info/route.ts:9` |
| §11.1 | `region` — country code | `"EE"` (Estonia) | `src/app/api/csc/v2/info/route.ts:11` |
| §11.1 | `authType` — authentication methods | `["oauth2"]` | `src/app/api/csc/v2/info/route.ts:14` |
| §11.1 | `methods` — available API methods | 4 methods listed | `src/app/api/csc/v2/info/route.ts:16` |
| §11.1 | `signAlgorithms` — supported sign algos | sha256WithRSAEncryption (OID `1.2.840.113549.1.1.11`) | `src/app/api/csc/v2/info/route.ts:17-19` |
| §11.1 | `hashAlgorithms` — supported hash algos | SHA-256 (OID `2.16.840.1.101.3.4.2.1`) | `src/app/api/csc/v2/info/route.ts:21-23` |
| §11.1 | No authentication required | No `authenticateRequest()` call | `src/app/api/csc/v2/info/route.ts:6` |

### Section 11.4 — credentials/list

| Spec Section | Requirement | Implementation | File:Line |
|---|---|---|---|
| §11.4 | Return `credentialIDs` array | Query credentials table, map to IDs | `src/app/api/csc/v2/credentials/list/route.ts:12-15` |
| §11.4 | Filter by authenticated tenant | `WHERE tenant_id = auth.tenantId` | `src/app/api/csc/v2/credentials/list/route.ts:12` |
| §11.4 | Require valid access token | `authenticateRequest()` guard | `src/app/api/csc/v2/credentials/list/route.ts:8-9` |

### Section 11.4 — credentials/info

| Spec Section | Requirement | Implementation | File:Line |
|---|---|---|---|
| §11.4 | `key.status` — enabled/disabled | Maps from credential `status` field | `src/app/api/csc/v2/credentials/info/route.ts:59` |
| §11.4 | `key.algo` — key algorithm OIDs | RSA OID `1.2.840.113549.1.1.1` | `src/app/api/csc/v2/credentials/info/route.ts:60` |
| §11.4 | `key.len` — key bit length | From `key_length` column (2048) | `src/app/api/csc/v2/credentials/info/route.ts:61` |
| §11.4 | `cert.certificates` — base64 DER chain | PEM → forge parse → DER → base64 | `src/app/api/csc/v2/credentials/info/route.ts:40-54` |
| §11.4 | `cert.issuerDN`, `cert.subjectDN` | Parsed from X.509 cert attributes | `src/app/api/csc/v2/credentials/info/route.ts:37-38` |
| §11.4 | `authMode` — explicit for SCAL2 | `"explicit"` | `src/app/api/csc/v2/credentials/info/route.ts:72` |
| §11.4 | `SCAL` — security assurance level | From `scal` column (SCAL2) | `src/app/api/csc/v2/credentials/info/route.ts:73` |
| §11.4 | `PIN.presence` — whether PIN is required | `"true"` for SCAL2 | `src/app/api/csc/v2/credentials/info/route.ts:74-78` |

### Section 11.4 — credentials/authorize (SCAL2)

| Spec Section | Requirement | Implementation | File:Line |
|---|---|---|---|
| §11.4 | Input: `credentialID`, `PIN`, `hash[]` | Request body parsing + validation | `src/app/api/csc/v2/credentials/authorize/route.ts:19-39` |
| §11.4 | PIN verification | bcrypt compare against `pin_hash` | `src/app/api/csc/v2/credentials/authorize/route.ts:52-60` |
| §11.4 | Return SAD token | JWT with credentialID, tenantId, hashValues | `src/app/api/csc/v2/credentials/authorize/route.ts:64-75` |
| §11.4 | SAD expiry | 5-minute TTL | `src/app/api/csc/v2/credentials/authorize/route.ts:13,63` |
| §11.4 | SAD is single-use | Stored in `sad_tokens` table, `used` flag | `src/app/api/csc/v2/credentials/authorize/route.ts:78,82` |
| §11.4 | SAD bound to specific hashes | `hashValues` embedded in JWT payload | `src/app/api/csc/v2/credentials/authorize/route.ts:67` |

### Section 11.7 — signatures/signHash

| Spec Section | Requirement | Implementation | File:Line |
|---|---|---|---|
| §11.7 | Input: `credentialID`, `SAD`, `hash[]` | Request body parsing + validation | `src/app/api/csc/v2/signatures/signHash/route.ts:22-29` |
| §11.7 | Verify SAD token | JWT verify with issuer + subject claims | `src/app/api/csc/v2/signatures/signHash/route.ts:33-44` |
| §11.7 | SAD bound to credential + tenant | Payload field comparison | `src/app/api/csc/v2/signatures/signHash/route.ts:47-52` |
| §11.7 | SAD single-use enforcement | Check `used` flag, then `SET used = TRUE` | `src/app/api/csc/v2/signatures/signHash/route.ts:54-74` |
| §11.7 | RSA PKCS#1 v1.5 signing | DigestInfo(SHA-256 OID, hash) → `sign('NONE')` | `src/app/api/csc/v2/signatures/signHash/route.ts:94-108` |
| §11.7 | Return `signatures[]` in base64 | Array of base64-encoded RSA signatures | `src/app/api/csc/v2/signatures/signHash/route.ts:117-119` |
| §11.7 | Support multiple hashes per call | Loop over `hash[]` array | `src/app/api/csc/v2/signatures/signHash/route.ts:91` |

## SDK Module Mapping

The client SDK implements the client-side operations described in CSC v2's usage guidelines and referenced standards.

| Standard | Requirement | SDK Module | File:Line |
|---|---|---|---|
| PAdES (ETSI 319 142) | Signature placeholder with ByteRange | `preparePdf()` | `packages/client-sdk/src/pdf.ts:28` |
| PAdES (ETSI 319 142) | `adbe.pkcs7.detached` SubFilter | Via `@signpdf/placeholder-pdf-lib` | `packages/client-sdk/src/pdf.ts:34-41` |
| RFC 5652 (CMS) | SignedAttributes: contentType + signingTime + messageDigest | `buildSignedAttributesDer()` | `packages/client-sdk/src/hash.ts:51` |
| RFC 5652 (CMS) | Hash DER-encoded SignedAttributes (not raw PDF) | `computeHash()` | `packages/client-sdk/src/hash.ts:29` |
| CSC v2 §8 | OAuth2 token request | `CscApiClient.getToken()` | `packages/client-sdk/src/api.ts:44` |
| CSC v2 §11.4 | Credential info retrieval | `CscApiClient.getCredentialInfo()` | `packages/client-sdk/src/api.ts:95` |
| CSC v2 §11.4 | SCAL2 authorization | `CscApiClient.authorize()` | `packages/client-sdk/src/api.ts:58` |
| CSC v2 §11.7 | Hash signing | `CscApiClient.signHash()` | `packages/client-sdk/src/api.ts:76` |
| RFC 5652 (CMS) | SignedData ContentInfo assembly | `buildCmsSignedData()` | `packages/client-sdk/src/cms.ts:24` |
| RFC 5652 (CMS) | SignerInfo with [0] IMPLICIT re-tagged attrs | Re-tag 0x31 → 0xA0 | `packages/client-sdk/src/cms.ts:46-48` |
| RFC 3161 | TimeStampReq (SHA-256, nonce, certReq) | `buildTimeStampReq()` | `packages/client-sdk/src/timestamp.ts:39` |
| RFC 3161 | TimeStampResp parsing | `parseTimeStampResp()` | `packages/client-sdk/src/timestamp.ts:59` |
| RFC 5652 §11.4 | Timestamp as unsigned attribute (OID 1.2.840.113549.1.9.16.2.14) | `addTimestampToCms()` | `packages/client-sdk/src/cms.ts:84` |
| PAdES (ETSI 319 142) | CMS injection into PDF Contents field | `injectSignature()` | `packages/client-sdk/src/pdf.ts:89` |

## OID Reference

These OIDs appear throughout the codebase. Defined as constants in `packages/client-sdk/src/asn1-helpers.ts`.

| OID | Name | Used In |
|---|---|---|
| `1.2.840.113549.1.7.2` | id-signedData | CMS ContentInfo wrapper |
| `1.2.840.113549.1.7.1` | id-data | CMS encapContentInfo (detached) |
| `2.16.840.1.101.3.4.2.1` | id-sha256 | Hash algorithm in SignedAttrs, DigestInfo, TSA |
| `1.2.840.113549.1.1.1` | rsaEncryption | Key algorithm in credentials/info |
| `1.2.840.113549.1.1.11` | sha256WithRSAEncryption | Signing algorithm in info endpoint |
| `1.2.840.113549.1.9.3` | id-contentType | SignedAttributes: content type |
| `1.2.840.113549.1.9.4` | id-messageDigest | SignedAttributes: PDF hash |
| `1.2.840.113549.1.9.5` | id-signingTime | SignedAttributes: timestamp |
| `1.2.840.113549.1.9.16.2.14` | id-smime-aa-timeStampToken | Unsigned attribute: RFC 3161 timestamp |

## Audit Trail

Every API operation is logged in the `audit_log` table:

| Operation | Endpoint | What's Logged |
|---|---|---|
| `token_issued` | `/oauth2/token` | tenant_id, IP, user-agent |
| `credential_authorized` | `/csc/v2/credentials/authorize` | tenant_id, credential_id, hash values, IP, user-agent |
| `hash_signed` | `/csc/v2/signatures/signHash` | tenant_id, credential_id, hash values, IP, user-agent |
