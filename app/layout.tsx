import '../styles/globals.css';
import '@livekit/components-styles';
import '@livekit/components-styles/prefabs';
import type { Metadata, Viewport } from 'next';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/lib/AuthProvider';

export const metadata: Metadata = {
  title: {
    default: 'MyTalk | Audio Conference for Everyone',
    template: '%s',
  },
  description:
    'MyTalk is a premium audio conferencing platform built for large meetings with up to 2,500 participants.',
  icons: {
    icon: {
      rel: 'icon',
      url: '/favicon.ico',
    },
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
          <Toaster />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
