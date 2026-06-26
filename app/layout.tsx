import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'launchcheck',
  description: 'Pre-launch QA scanner — security, SEO, performance, accessibility',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#f8f9fa', color: '#1a1a1a' }}>{children}</body>
    </html>
  );
}
