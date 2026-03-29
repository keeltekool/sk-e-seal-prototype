-- Tenants: organizations that use the e-seal service
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  client_id TEXT UNIQUE NOT NULL,
  client_secret_hash TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Credentials: e-seal certificates + private keys per tenant
CREATE TABLE IF NOT EXISTS credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  credential_id TEXT UNIQUE NOT NULL,
  certificate_pem TEXT NOT NULL,
  certificate_chain_pem TEXT,
  private_key_pem_encrypted TEXT NOT NULL,
  key_algorithm TEXT NOT NULL DEFAULT 'RSA',
  key_length INTEGER NOT NULL DEFAULT 2048,
  hash_algorithm TEXT NOT NULL DEFAULT 'SHA-256',
  scal TEXT NOT NULL DEFAULT 'SCAL2',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log: every signing operation recorded
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  credential_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  hash_values TEXT[],
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SAD tokens: track issued Signature Activation Data for single-use enforcement
CREATE TABLE IF NOT EXISTS sad_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  credential_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  hash_values TEXT[] NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credentials_tenant ON credentials(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sad_tokens_hash ON sad_tokens(token_hash);
