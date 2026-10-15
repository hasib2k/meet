'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import React, { Suspense } from 'react';

function LoginContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoWrap}>
          <svg width="48" height="48" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="10" fill="#5b8dee" />
            <path
              d="M12 15C12 13.8954 12.8954 13 14 13H20C21.1046 13 22 13.8954 22 15V25C22 26.1046 21.1046 27 20 27H14C12.8954 27 12 26.1046 12 25V15Z"
              fill="white"
            />
            <path d="M24 17L28 14V26L24 23V17Z" fill="white" />
          </svg>
        </div>

        <h1 style={styles.title}>Sign in to MyTalk</h1>
        <p style={styles.subtitle}>
          Sign in with your Google account to join or create meetings
        </p>

        <button
          onClick={() => signIn('google', { callbackUrl })}
          style={styles.googleBtn}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        <p style={styles.footer}>
          Audio-only meetings for up to 2,500 participants
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e', color: 'rgba(255,255,255,0.5)' }}>Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.25rem',
    padding: '3rem 2.5rem',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '1rem',
    width: '100%',
    maxWidth: '400px',
  },
  logoWrap: {
    marginBottom: '0.5rem',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 500,
    color: '#fff',
    margin: 0,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: '0.9rem',
    color: 'rgba(255, 255, 255, 0.5)',
    margin: 0,
    textAlign: 'center',
    lineHeight: 1.5,
  },
  googleBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    width: '100%',
    padding: '0.875rem 1.5rem',
    background: '#fff',
    color: '#333',
    border: 'none',
    borderRadius: '2rem',
    fontSize: '0.95rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'box-shadow 0.2s',
    marginTop: '0.5rem',
  },
  footer: {
    fontSize: '0.8rem',
    color: 'rgba(255, 255, 255, 0.3)',
    margin: 0,
    textAlign: 'center',
    marginTop: '0.5rem',
  },
};
