import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ThalAI Connect',
  description: 'AI-powered blood donation matching system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="antialiased min-h-screen selection:bg-red-glow selection:text-red">
        {children}
      </body>
    </html>
  );
}
