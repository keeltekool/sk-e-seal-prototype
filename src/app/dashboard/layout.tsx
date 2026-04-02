import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Developer Portal — Qualified E-Seal',
  description: 'Get API credentials, manage seal certificates, and test the full CSC v2 integration flow.',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
