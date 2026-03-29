// Certificate and key management for the e-seal service.
// Uses node-forge for X.509 certificate generation and key encryption.
// Designed so a real SK certificate (.p12) can replace the self-signed cert
// with zero code changes — just update the credential row in the database.
import forge from 'node-forge';
import crypto from 'crypto';

function getEncryptionKey(): string {
  const key = process.env.CREDENTIAL_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!key) throw new Error('CREDENTIAL_ENCRYPTION_KEY or JWT_SECRET must be set');
  return key;
}

/**
 * Generate an RSA 2048 keypair and self-signed X.509 certificate.
 * The certificate is configured as an e-seal certificate per eIDAS:
 * - Key usage: digitalSignature, nonRepudiation
 * - Subject contains organization name (the tenant)
 */
export function generateTestCertificate(orgName: string): {
  certificatePem: string;
  privateKeyPem: string;
} {
  const keys = forge.pki.rsa.generateKeyPair(2048);

  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = crypto.randomBytes(16).toString('hex');

  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notAfter.getFullYear() + 1);

  const attrs = [
    { name: 'commonName', value: `${orgName} E-Seal` },
    { name: 'organizationName', value: orgName },
    { name: 'countryName', value: 'EE' },
    { shortName: 'ST', value: 'Harjumaa' },
    { name: 'localityName', value: 'Tallinn' },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs); // Self-signed

  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    {
      name: 'keyUsage',
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: false,
      dataEncipherment: false,
    },
    {
      name: 'subjectKeyIdentifier',
    },
  ]);

  cert.sign(keys.privateKey, forge.md.sha256.create());

  return {
    certificatePem: forge.pki.certificateToPem(cert),
    privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey),
  };
}

/**
 * Encrypt a private key PEM string using AES-256-GCM.
 * Used for at-rest encryption of credential private keys in the database.
 */
export function encryptPrivateKey(privateKeyPem: string): string {
  const key = crypto.createHash('sha256').update(getEncryptionKey()).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(privateKeyPem, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext (all base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt a private key PEM string from AES-256-GCM.
 */
export function decryptPrivateKey(encryptedData: string): string {
  const key = crypto.createHash('sha256').update(getEncryptionKey()).digest();
  const [ivB64, authTagB64, ciphertext] = encryptedData.split(':');

  const iv = Buffer.from(ivB64!, 'base64');
  const authTag = Buffer.from(authTagB64!, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext!, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
