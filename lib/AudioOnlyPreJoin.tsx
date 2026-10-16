'use client';

import React, { useState, useCallback } from 'react';
import { LocalUserChoices } from '@livekit/components-react';
import { useSession, signIn } from 'next-auth/react';

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '1.5rem',
  padding: '2.5rem',
  background: '#1e1e32',
  border: 'none',
  borderRadius: '1.5rem',
  width: '100%',
  maxWidth: '400px',
  boxShadow: '8px 8px 20px #151528, -8px -8px 20px #27273c',
};

const iconStyle: React.CSSProperties = {
  width: '64px',
  height: '64px',
  borderRadius: '50%',
  background: 'linear-gradient(135deg, #5b8dee, #4a7dd4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  boxShadow: '4px 4px 10px #151528, -4px -4px 10px #27273c',
};

const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.875rem',
  background: 'linear-gradient(145deg, #6394f5, #5280d6)',
  color: '#fff',
  border: 'none',
  borderRadius: '2rem',
  fontSize: '1rem',
  fontWeight: 500,
  cursor: 'pointer',
  boxShadow: '4px 4px 12px #151528, -2px -2px 8px #27273c',
};

const googleBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.75rem',
  width: '100%',
  padding: '0.875rem 1.5rem',
  background: 'linear-gradient(145deg, #222238, #1b1b2e)',
  color: '#e8eaed',
  border: 'none',
  borderRadius: '2rem',
  fontSize: '0.95rem',
  fontWeight: 500,
  cursor: 'pointer',
  boxShadow: '4px 4px 12px #151528, -4px -4px 12px #27273c',
  transition: 'all 0.2s',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.875rem 1rem',
  background: '#1e1e32',
  border: 'none',
  borderRadius: '2rem',
  color: '#e8eaed',
  fontSize: '0.95rem',
  outline: 'none',
  boxShadow: 'inset 3px 3px 6px #151528, inset -3px -3px 6px #27273c',
  textAlign: 'center',
};

const dividerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  width: '100%',
  color: 'rgba(255,255,255,0.3)',
  fontSize: '0.8rem',
};

const dividerLineStyle: React.CSSProperties = {
  flex: 1,
  height: '1px',
  background: 'rgba(255,255,255,0.1)',
};

export function AudioOnlyPreJoin(props: {
  onSubmit: (choices: LocalUserChoices & { imageUrl?: string }) => void;
  role?: string;
}) {
  const { data: session, status } = useSession();
  const [guestName, setGuestName] = useState('');
  const [mode, setMode] = useState<'choose' | 'google' | 'guest'>('choose');

  const isLoggedIn = status === 'authenticated' && session?.user;
  const userName = session?.user?.name || '';
  const userImage = session?.user?.image || '';

  // If already logged in with Google, go directly to Google mode
  React.useEffect(() => {
    if (isLoggedIn && mode === 'choose') {
      setMode('google');
    }
  }, [isLoggedIn, mode]);

  const handleGoogleJoin = useCallback(() => {
    if (!userName) return;
    props.onSubmit({
      username: userName,
      videoEnabled: false,
      audioEnabled: true,
      videoDeviceId: '',
      audioDeviceId: '',
      imageUrl: userImage,
    });
  }, [userName, userImage, props.onSubmit]);

  const handleGuestJoin = useCallback(() => {
    const name = guestName.trim();
    if (!name) return;
    props.onSubmit({
      username: name,
      videoEnabled: false,
      audioEnabled: true,
      videoDeviceId: '',
      audioDeviceId: '',
    });
  }, [guestName, props.onSubmit]);

  const roleLabel = props.role === 'host' ? 'Host' : props.role === 'moderator' ? 'Moderator' : 'Listener';
  const roleColor = props.role === 'host' ? '#5b8dee' : props.role === 'moderator' ? '#e8a85d' : 'rgba(255,255,255,0.4)';

  // === Google mode: user is logged in, show join button ===
  if (mode === 'google' && isLoggedIn) {
    return (
      <div style={containerStyle}>
        <div style={iconStyle}>
          {userImage ? (
            <img src={userImage} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <MicIcon />
          )}
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 500, color: '#fff', margin: 0, textAlign: 'center' }}>
          Hi, {userName}!
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.5)', margin: 0, textAlign: 'center' }}>
          Audio-only meeting &middot; Joining as{' '}
          <span style={{ color: roleColor, fontWeight: 600 }}>{roleLabel}</span>
        </p>
        <button style={buttonStyle} onClick={handleGoogleJoin}>
          Join Meeting
        </button>
        {props.role === 'listener' && (
          <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', margin: 0, textAlign: 'center' }}>
            You will join as a listener. The host can grant you speaking permission.
          </p>
        )}
      </div>
    );
  }

  // === Guest mode: enter name and join ===
  if (mode === 'guest') {
    return (
      <div style={containerStyle}>
        <div style={iconStyle}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 500, color: '#fff', margin: 0, textAlign: 'center' }}>
          Join as Guest
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.5)', margin: 0, textAlign: 'center' }}>
          Joining as{' '}
          <span style={{ color: roleColor, fontWeight: 600 }}>{roleLabel}</span>
        </p>
        <input
          type="text"
          placeholder="Enter your name"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleGuestJoin()}
          style={inputStyle}
          maxLength={50}
          autoFocus
        />
        <button
          style={{
            ...buttonStyle,
            opacity: guestName.trim() ? 1 : 0.5,
            cursor: guestName.trim() ? 'pointer' : 'not-allowed',
          }}
          onClick={handleGuestJoin}
          disabled={!guestName.trim()}
        >
          Join Meeting
        </button>
        <button
          onClick={() => setMode('choose')}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.4)',
            fontSize: '0.8rem',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          ← Back
        </button>
      </div>
    );
  }

  // === Choose mode: show both options ===
  return (
    <div style={containerStyle}>
      <div style={iconStyle}>
        <MicIcon />
      </div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 500, color: '#fff', margin: 0, textAlign: 'center' }}>
        Join Meeting
      </h2>
      <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.5)', margin: 0, textAlign: 'center' }}>
        Audio-only meeting &middot; Joining as{' '}
        <span style={{ color: roleColor, fontWeight: 600 }}>{roleLabel}</span>
      </p>

      {/* Option 1: Continue with Google */}
      <button
        style={googleBtnStyle}
        onClick={() => {
          if (isLoggedIn) {
            setMode('google');
          } else {
            signIn('google', { callbackUrl: window.location.href });
          }
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        <span>Continue with Google</span>
      </button>

      {/* Divider */}
      <div style={dividerStyle}>
        <div style={dividerLineStyle} />
        <span>or</span>
        <div style={dividerLineStyle} />
      </div>

      {/* Option 2: Guest */}
      <button
        style={{
          ...googleBtnStyle,
          background: 'linear-gradient(145deg, #1e1e32, #1a1a2e)',
        }}
        onClick={() => setMode('guest')}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(255,255,255,0.6)">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
        </svg>
        <span>Enter your name &amp; join</span>
      </button>

      {props.role === 'listener' && (
        <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', margin: 0, textAlign: 'center' }}>
          You will join as a listener. The host can grant you speaking permission.
        </p>
      )}
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
    </svg>
  );
}
