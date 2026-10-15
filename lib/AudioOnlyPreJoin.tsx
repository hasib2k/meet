'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { LocalUserChoices } from '@livekit/components-react';
import { useSession } from 'next-auth/react';

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

export function AudioOnlyPreJoin(props: {
  onSubmit: (choices: LocalUserChoices) => void;
  role?: string;
}) {
  const { data: session } = useSession();
  const userName = session?.user?.name || '';
  const userImage = session?.user?.image || '';

  const handleSubmit = useCallback(() => {
    if (!userName) return;
    props.onSubmit({
      username: userName,
      videoEnabled: false,
      audioEnabled: true,
      videoDeviceId: '',
      audioDeviceId: '',
      imageUrl: userImage,
    } as any);
  }, [userName, userImage, props.onSubmit]);

  const roleLabel = props.role === 'host' ? 'Host' : props.role === 'moderator' ? 'Moderator' : 'Listener';
  const roleColor = props.role === 'host' ? '#5b8dee' : props.role === 'moderator' ? '#e8a85d' : 'rgba(255,255,255,0.4)';

  return (
    <div style={containerStyle}>
      <div style={iconStyle}>
        {userImage ? (
          <img src={userImage} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        )}
      </div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 500, color: '#fff', margin: 0, textAlign: 'center' }}>
        {userName ? `Hi, ${userName}!` : 'Ready to join?'}
      </h2>
      <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.5)', margin: 0, textAlign: 'center' }}>
        Audio-only meeting &middot; Joining as{' '}
        <span style={{ color: roleColor, fontWeight: 600 }}>{roleLabel}</span>
      </p>
      <button
        style={buttonStyle}
        onClick={handleSubmit}
      >
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
