export { SealClient } from './seal';
export type { SealClientConfig, SealStep, SealOptions, SealResult } from './types';

export { preparePdf, injectSignature } from './pdf';
export type { PreparedPdf } from './pdf';
export { computeHash } from './hash';
export type { HashResult } from './hash';
export { CscApiClient } from './api';
export type { TokenResponse, AuthorizeResponse, SignHashResponse, CredentialInfoResponse } from './api';
export { buildCmsSignedData, addTimestampToCms } from './cms';
export { getTimestamp, DEFAULT_TSA_URL } from './timestamp';

export const SDK_VERSION = '0.1.0';
