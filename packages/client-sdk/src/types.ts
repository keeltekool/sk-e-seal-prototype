/** Configuration for connecting to the CSC v2 API server */
export interface SealClientConfig {
  /** Base URL of the CSC v2 API (e.g., "http://localhost:3000") */
  baseUrl: string;
  /** OAuth2 client_id */
  clientId: string;
  /** OAuth2 client_secret */
  clientSecret: string;
  /** SCAL2 PIN for credential authorization */
  pin: string;
  /** Credential ID to use for sealing */
  credentialId: string;
  /** Optional: TSA URL for RFC 3161 timestamps. Defaults to FreeTSA. */
  tsaUrl?: string;
}

/** A step in the sealing process, emitted via onStep callback */
export interface SealStep {
  /** Step identifier */
  name:
    | 'placeholder_created'
    | 'hash_computed'
    | 'token_obtained'
    | 'credential_authorized'
    | 'hash_signed'
    | 'cms_built'
    | 'timestamp_added'
    | 'pdf_sealed';
  /** Human-readable description */
  description: string;
  /** Duration of this step in milliseconds */
  durationMs: number;
  /** Step-specific data for display/debugging */
  data: Record<string, unknown>;
}

/** Options for the seal operation */
export interface SealOptions {
  /** Callback fired after each step completes */
  onStep?: (step: SealStep) => void;
}

/** Result of a successful seal operation */
export interface SealResult {
  /** The sealed PDF as a Uint8Array */
  sealedPdf: Uint8Array;
  /** All steps that were executed */
  steps: SealStep[];
  /** Total duration in milliseconds */
  totalDurationMs: number;
}
