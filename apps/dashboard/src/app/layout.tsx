import React from 'react';
import './globals.css';
import AppShell from '../components/AppShell';

export const metadata = {
  title: 'AI Product Intelligence Platform',
  description: 'Enterprise AI Scraping and Multitenant Product Intelligence SaaS',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased selection:bg-sky-500 selection:text-white">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
