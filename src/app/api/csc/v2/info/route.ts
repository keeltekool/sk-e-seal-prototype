// CSC v2 Spec §11.1 — info
// Returns service metadata: capabilities, supported algorithms, auth types.
// This endpoint does NOT require authentication per CSC spec.
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({
    specs: '2.0.0.2',
    name: 'Remote Qualified E-Seal',
    logo: '/logo.png',
    region: 'EE',
    lang: 'en',
    description: 'CSC v2 compliant remote e-sealing service prototype',
    authType: ['oauth2'],
    oauth2: 'https://eseal.example.com/oauth2/token',
    methods: ['credentials/list', 'credentials/info', 'credentials/authorize', 'signatures/signHash'],
    signAlgorithms: {
      algos: ['1.2.840.113549.1.1.11'], // sha256WithRSAEncryption OID
      algoParams: ['NULL'],
    },
    hashAlgorithms: {
      algos: ['2.16.840.1.101.3.4.2.1'], // SHA-256 OID
      algoParams: ['NULL'],
    },
  });
}
