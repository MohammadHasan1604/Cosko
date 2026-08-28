import React from 'react';
import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { Toaster } from 'sonner';
import { AppProvider } from '@/context/AppContext';
import '../styles/tailwind.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-plus-jakarta-sans',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'COSKO — Multi-Store Retail & POS Management Platform',
  description: 'COSKO is a production-grade multi-store business management platform for retail POS billing, inventory cataloging, procurement, CRM, and accounting.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:4028'),
  openGraph: {
    title: 'COSKO — Multi-Store Retail & POS Management Platform',
    description: 'Enterprise POS, multi-store inventory cataloging, purchasing, CRM, and financial accounting system.',
    url: 'http://localhost:4028',
    siteName: 'COSKO',
    locale: 'en_IN',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
  },
  icons: {
    icon: [{ url: '/favicon.ico', type: 'image/x-icon' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={plusJakartaSans.variable}>
      <body suppressHydrationWarning className={plusJakartaSans.className}>
        <AppProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                fontFamily: 'var(--font-plus-jakarta-sans)',
                fontSize: '14px',
              },
              duration: 3000,
            }}
          />
        </AppProvider>
      </body>
    </html>
  );
}