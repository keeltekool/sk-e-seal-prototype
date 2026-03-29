import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Qualified E-Seal by SK ID',
  description: 'CSC v2 compliant remote e-sealing service prototype by SK ID Solutions',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
