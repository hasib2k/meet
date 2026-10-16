import '../styles/globals.css';
import '@livekit/components-styles';
import '@livekit/components-styles/prefabs';
import type { Metadata, Viewport } from 'next';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/lib/AuthProvider';
import { RegisterSW } from '@/lib/RegisterSW';

export const metadata: Metadata = {
  title: {
    default: 'MyTalk | Audio Conference for Everyone',
    template: '%s',
  },
  description:
    'MyTalk is a premium audio conferencing platform built for large meetings with up to 2,500 participants.',
  manifest: '/manifest.json',
  icons: {
    icon: {
      rel: 'icon',
      url: '/favicon.ico',
    },
    apple: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MyTalk',
  },
};

export const viewport: Viewport = {
  themeColor: '#1a1a2e',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body data-lk-theme="default">
        <AuthProvider>
          <RegisterSW />
          <Toaster />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
