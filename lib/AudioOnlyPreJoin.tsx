'use client';

import React, { useState, useCallback } from 'react';
import { LocalUserChoices } from '@livekit/components-react';

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '1.5rem',
  padding: '2.5rem',
  background: 'rgba(255, 255, 255, 0.04)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '1rem',
  width: '100%',
  maxWidth: '400px',
};

const iconStyle: React.CSSProperties = {
  width: '64px',
  height: '64px',
  borderRadius: '50%',
  background: 'linear-gradient(135deg, #5b8dee, #4a7dd4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.875rem 1rem',
  backgroundColor: 'rgba(255, 255, 255, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  borderRadius: '0.5rem',
  color: '#fff',
  fontSize: '0.95rem',
  outline: 'none',
};

const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.875rem',
  backgroundColor: '#5b8dee',
  color: '#fff',
  border: 'none',
  borderRadius: '2rem',
  fontSize: '1rem',
  fontWeight: 500,
  cursor: 'pointer',
};

export function AudioOnlyPreJoin(props: {
  onSubmit: (choices: LocalUserChoices) => void;
  role?: string;
}) {
  const [username, setUsername] = useState('');

  const handleSubmit = useCallback(() => {
    if (!username.trim()) return;
    props.onSubmit({
      username: username.trim(),
      videoEnabled: false,
      audioEnabled: true,
      videoDeviceId: '',
      audioDeviceId: '',
    });
  }, [username, props.onSubmit]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  const roleLabel = props.role === 'host' ? 'Host' : props.role === 'moderator' ? 'Moderator' : 'Listener';
  const roleColor = props.role === 'host' ? '#5b8dee' : props.role === 'moderator' ? '#e8a85d' : 'rgba(255,255,255,0.4)';

  return (
    <div style={containerStyle}>
      <div style={iconStyle}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
        </svg>
      </div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 500, color: '#fff', margin: 0, textAlign: 'center' }}>
        Ready to join?
      </h2>
      <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.5)', margin: 0, textAlign: 'center' }}>
        Audio-only meeting &middot; Joining as{' '}
        <span style={{ color: roleColor, fontWeight: 600 }}>{roleLabel}</span>
      </p>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <input
          style={inputStyle}
          type="text"
          placeholder="Enter your name"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <button
          style={{
            ...buttonStyle,
            opacity: username.trim() ? 1 : 0.5,
            cursor: username.trim() ? 'pointer' : 'not-allowed',
          }}
          onClick={handleSubmit}
          disabled={!username.trim()}
        >
          Join Meeting
        </button>
      </div>
      {props.role === 'listener' && (
        <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', margin: 0, textAlign: 'center' }}>
          You will join as a listener. The host can grant you speaking permission.
        </p>
      )}
    </div>
  );
}
