import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CscApiClient } from '../src/api';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('CscApiClient', () => {
  const config = {
    baseUrl: 'http://localhost:3000',
    clientId: 'demo-tenant-001',
    clientSecret: 'test-secret',
    pin: '12345',
    credentialId: 'cred-001',
  };

  let client: CscApiClient;

  beforeEach(() => {
    client = new CscApiClient(config);
    mockFetch.mockReset();
  });

  describe('getToken', () => {
    it('should request an access token with client_credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      });

      const result = await client.getToken();

      expect(result.access_token).toBe('test-token');
      expect(result.token_type).toBe('Bearer');

      const [url, options] = mockFetch.mock.calls[0]!;
      expect(url).toBe('http://localhost:3000/oauth2/token');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe(
        'application/x-www-form-urlencoded',
      );

      const body = new URLSearchParams(options.body);
      expect(body.get('grant_type')).toBe('client_credentials');
      expect(body.get('client_id')).toBe('demo-tenant-001');
      expect(body.get('client_secret')).toBe('test-secret');
    });

    it('should throw on error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(client.getToken()).rejects.toThrow(
        'OAuth2 token request failed (401)',
      );
    });
  });

  describe('authorize', () => {
    it('should send PIN and hash for SCAL2 authorization', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          SAD: 'sad-token-123',
          expiresIn: 300,
        }),
      });

      const hashBase64 = Buffer.from('test-hash').toString('base64');
      const result = await client.authorize('access-token', hashBase64);

      expect(result.SAD).toBe('sad-token-123');

      const [url, options] = mockFetch.mock.calls[0]!;
      expect(url).toBe(
        'http://localhost:3000/csc/v2/credentials/authorize',
      );
      expect(options.headers['Authorization']).toBe('Bearer access-token');

      const body = JSON.parse(options.body);
      expect(body.credentialID).toBe('cred-001');
      expect(body.PIN).toBe('12345');
      expect(body.hash).toEqual([hashBase64]);
      expect(body.hashAlgo).toBe('SHA-256');
    });
  });

  describe('signHash', () => {
    it('should send hash with SAD for signing', async () => {
      const signatureBase64 = Buffer.from('fake-signature').toString('base64');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          signatures: [signatureBase64],
        }),
      });

      const hashBase64 = Buffer.from('test-hash').toString('base64');
      const result = await client.signHash(
        'access-token',
        'sad-token',
        hashBase64,
      );

      expect(result.signatures).toHaveLength(1);
      expect(result.signatures[0]).toBe(signatureBase64);

      const [url, options] = mockFetch.mock.calls[0]!;
      expect(url).toBe(
        'http://localhost:3000/csc/v2/signatures/signHash',
      );

      const body = JSON.parse(options.body);
      expect(body.SAD).toBe('sad-token');
      expect(body.signAlgo).toBe('rsaEncryption');
    });

    it('should throw on signing error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => '{"error":"invalid_sad"}',
      });

      await expect(
        client.signHash('token', 'bad-sad', 'hash'),
      ).rejects.toThrow('signHash failed (400)');
    });
  });

  describe('getCredentialInfo', () => {
    it('should fetch credential info with certificate chain', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          credentialID: 'cred-001',
          key: { status: 'enabled', algo: ['rsaEncryption'], len: 2048 },
          cert: { certificates: ['base64cert'] },
          SCAL: 'SCAL2',
          authMode: 'explicit',
        }),
      });

      const result = await client.getCredentialInfo('access-token');

      expect(result.credentialID).toBe('cred-001');
      expect(result.SCAL).toBe('SCAL2');
      expect(result.cert.certificates).toHaveLength(1);
    });
  });
});
