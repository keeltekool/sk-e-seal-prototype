import type { SealClientConfig } from './types';

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface AuthorizeResponse {
  SAD: string;
  expiresIn: number;
}

export interface SignHashResponse {
  signatures: string[];
}

export interface CredentialInfoResponse {
  credentialID: string;
  key: { status: string; algo: string[]; len: number };
  cert: { certificates: string[] };
  SCAL: string;
  authMode: string;
}

async function assertOk(res: Response, context: string): Promise<void> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${context} failed (${res.status}): ${body}`);
  }
}

/**
 * Typed HTTP client for CSC v2 API endpoints.
 * Uses native fetch — no external HTTP library needed.
 */
export class CscApiClient {
  private config: SealClientConfig;

  constructor(config: SealClientConfig) {
    this.config = config;
  }

  async getToken(): Promise<TokenResponse> {
    const res = await fetch(`${this.config.baseUrl}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });
    await assertOk(res, 'OAuth2 token request');
    return res.json() as Promise<TokenResponse>;
  }

  async authorize(accessToken: string, hashBase64: string): Promise<AuthorizeResponse> {
    const res = await fetch(`${this.config.baseUrl}/csc/v2/credentials/authorize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        credentialID: this.config.credentialId,
        PIN: this.config.pin,
        hash: [hashBase64],
        hashAlgo: 'SHA-256',
      }),
    });
    await assertOk(res, 'Credential authorization');
    return res.json() as Promise<AuthorizeResponse>;
  }

  async signHash(accessToken: string, sad: string, hashBase64: string): Promise<SignHashResponse> {
    const res = await fetch(`${this.config.baseUrl}/csc/v2/signatures/signHash`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        credentialID: this.config.credentialId,
        SAD: sad,
        hash: [hashBase64],
        hashAlgo: 'SHA-256',
        signAlgo: 'rsaEncryption',
      }),
    });
    await assertOk(res, 'signHash');
    return res.json() as Promise<SignHashResponse>;
  }

  async getCredentialInfo(accessToken: string): Promise<CredentialInfoResponse> {
    const res = await fetch(`${this.config.baseUrl}/csc/v2/credentials/info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ credentialID: this.config.credentialId }),
    });
    await assertOk(res, 'credentials/info');
    return res.json() as Promise<CredentialInfoResponse>;
  }
}
