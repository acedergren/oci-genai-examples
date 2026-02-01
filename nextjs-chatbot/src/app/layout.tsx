import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OCI GenAI Chatbot - Next.js Demo',
  description: 'Demo of OCI GenAI Provider with Vercel AI SDK',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-surface-ground text-text-primary min-h-screen">{children}</body>
    </html>
  );
}
