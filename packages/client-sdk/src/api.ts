import type { SealClientConfig } from './types';

/** Response from POST /oauth2/token */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/** Response from POST /csc/v2/credentials/authorize */
export interface AuthorizeResponse {
  SAD: string;
  expiresIn: number;
}

/** Response from POST /csc/v2/signatures/signHash */
export interface SignHashResponse {
  signatures: string[];
}

/** Response from POST /csc/v2/credentials/info */
export interface CredentialInfoResponse {
  credentialID: string;
  key: {
    status: string;
    algo: string[];
    len: number;
  };
  cert: {
    certificates: string[];
  };
  SCAL: string;
  authMode: string;
}

/**
 * Typed HTTP client for CSC v2 API endpoints.
 *
 * Calls three endpoints in sequence during sealing:
 * 1. POST /oauth2/token → access token (client_credentials grant)
 * 2. POST /csc/v2/credentials/authorize → SAD token (SCAL2 PIN auth)
 * 3. POST /csc/v2/signatures/signHash → raw RSA signature
 *
 * Uses native fetch — no external HTTP library needed.
 */
export class CscApiClient {
  private config: SealClientConfig;

  constructor(config: SealClientConfig) {
    this.config = config;
  }

  /** POST /oauth2/token — client_credentials → access token */
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

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OAuth2 token request failed (${res.status}): ${body}`);
    }

    return res.json() as Promise<TokenResponse>;
  }

  /** POST /csc/v2/credentials/authorize — PIN → SAD token */
  async authorize(
    accessToken: string,
    hashBase64: string,
  ): Promise<AuthorizeResponse> {
    const res = await fetch(
      `${this.config.baseUrl}/csc/v2/credentials/authorize`,
      {
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
      },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Credential authorization failed (${res.status}): ${body}`,
      );
    }

    return res.json() as Promise<AuthorizeResponse>;
  }

  /** POST /csc/v2/signatures/signHash — hash → raw RSA signature */
  async signHash(
    accessToken: string,
    sad: string,
    hashBase64: string,
  ): Promise<SignHashResponse> {
    const res = await fetch(
      `${this.config.baseUrl}/csc/v2/signatures/signHash`,
      {
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
      },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`signHash failed (${res.status}): ${body}`);
    }

    return res.json() as Promise<SignHashResponse>;
  }

  /** POST /csc/v2/credentials/info — get certificate chain and key info */
  async getCredentialInfo(
    accessToken: string,
  ): Promise<CredentialInfoResponse> {
    const res = await fetch(
      `${this.config.baseUrl}/csc/v2/credentials/info`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          credentialID: this.config.credentialId,
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`credentials/info failed (${res.status}): ${body}`);
    }

    return res.json() as Promise<CredentialInfoResponse>;
  }
}
