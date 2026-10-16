'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParticipants, useRoomContext } from '@livekit/components-react';
import { usePinned } from './PinnedContext';

export function ParticipantsSidebar() {
  const [open, setOpen] = useState(false);
  const room = useRoomContext();
  const participants = useParticipants();
  const [actionMsg, setActionMsg] = useState('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { pinnedIds, togglePin, isPinned } = usePinned();

  // Current user role
  let localRole = 'listener';
  try {
    const meta = JSON.parse(room.localParticipant.metadata || '{}');
    localRole = meta.role || 'listener';
  } catch {}
  const isHost = localRole === 'host';

  const otherParticipants = participants
    .filter((p) => p.identity !== room.localParticipant.identity)
    .map((p) => {
      let role = 'listener';
      let imageUrl = '';
      let isHandRaised = false;
      try {
        const meta = JSON.parse(p.metadata || '{}');
        role = meta.role || 'listener';
        imageUrl = meta.imageUrl || '';
        isHandRaised = !!meta.isHandRaised;
      } catch {}
      return {
        identity: p.identity,
        name: p.name || p.identity,
        role,
        imageUrl,
        canPublish: p.permissions?.canPublish ?? false,
        isSpeaking: p.isSpeaking,
        isPinned: isPinned(p.identity),
        isHandRaised,
      };
    });

  // Filter by search query
  const filteredParticipants = searchQuery.trim()
    ? otherParticipants.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : otherParticipants;

  // Sort: hand raised first, then pinned, then speaking, then rest
  const sortedParticipants = [...filteredParticipants].sort((a, b) => {
    if (a.isHandRaised !== b.isHandRaised) return a.isHandRaised ? -1 : 1;
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    if (a.isSpeaking !== b.isSpeaking) return a.isSpeaking ? -1 : 1;
    return 0;
  });

  const lowerHand = async (identity: string) => {
    try {
      await fetch('/api/raise-hand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: room.name, identity, raised: false }),
      });
    } catch {}
  };

  const doAction = async (action: string, identity: string) => {
    setLoadingAction(identity);
    try {
      const adminToken = sessionStorage.getItem('adminToken') || '';
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ action, roomName: room.name, identity }),
      });
      const data = await res.json();
      setActionMsg(data.message || 'Done');
      setTimeout(() => setActionMsg(''), 2500);
    } catch {
      setActionMsg('Action failed');
      setTimeout(() => setActionMsg(''), 2500);
    } finally {
      setLoadingAction(null);
    }
  };

  // Get local user image
  let localImageUrl = '';
  try {
    const meta = JSON.parse(room.localParticipant.metadata || '{}');
    localImageUrl = meta.imageUrl || '';
  } catch {}

  // Find the control bar to portal the button into it
  const [controlBar, setControlBar] = useState<Element | null>(null);
  useEffect(() => {
    const findBar = () => {
      const bar = document.querySelector('.lk-control-bar');
      if (bar) setControlBar(bar);
    };
    findBar();
    const interval = setInterval(findBar, 500);
    return () => clearInterval(interval);
  }, []);

  const toggleButton = (
    <button
      className="lk-button lk-participants-toggle"
      aria-pressed={open}
      onClick={() => setOpen(!open)}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '0.375rem' }}>
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
      </svg>
      Participants ({participants.length})
    </button>
  );

  const selfView = (
    <div className="lk-self-view">
      <div className="lk-self-view-avatar">
        {localImageUrl ? (
          <img src={localImageUrl} alt="" referrerPolicy="no-referrer" style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '50%' }} />
        ) : (
          <span style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 600 }}>
            {((room.localParticipant.name || room.localParticipant.identity || '?').charAt(0)).toUpperCase()}
          </span>
        )}
      </div>
      <span className="lk-self-view-label">You</span>
    </div>
  );

  return (
    <>
      {/* Self-view thumbnail - bottom right like Google Meet */}
      {selfView}

      {/* Portal button into the control bar */}
      {controlBar ? createPortal(toggleButton, controlBar) : toggleButton}

      {/* Backdrop overlay */}
      {open && (
        <div className="lk-participants-backdrop" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar panel */}
      {open && (
        <div className="lk-participants-panel">
          <div className="lk-chat-header">
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
              Participants ({participants.length})
            </h3>
            <button className="lk-close-button lk-button" onClick={() => setOpen(false)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </div>

          {/* Search bar */}
          <div style={{ padding: '0.5rem 0.75rem' }}>
            <input
              type="text"
              placeholder="Search participants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                background: '#1e1e32',
                border: 'none',
                borderRadius: '1.5rem',
                color: '#e8eaed',
                fontSize: '0.8rem',
                outline: 'none',
                boxShadow: 'inset 2px 2px 5px #151528, inset -2px -2px 5px #27273c',
              }}
            />
          </div>

          <div className="lk-participants-list">
            {/* Copy link for host */}
            {isHost && (
              <button
                className="lk-button"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/rooms/${room.name}`).then(() => {
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 2000);
                  });
                }}
                style={{
                  fontSize: '0.8rem',
                  padding: '0.5rem',
                  margin: '0 0.75rem 0.5rem',
                  background: '#1e1e32',
                  color: linkCopied ? '#5bc88d' : '#5b8dee',
                  border: 'none',
                  borderRadius: '0.75rem',
                  boxShadow: linkCopied
                    ? 'inset 2px 2px 5px #151528, inset -2px -2px 5px #27273c'
                    : '3px 3px 8px #151528, -3px -3px 8px #27273c',
                  width: 'calc(100% - 1.5rem)',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                }}
              >
                {linkCopied ? 'Link Copied!' : 'Copy Meeting Link'}
              </button>
            )}

            {actionMsg && (
              <p style={{ color: '#5bc88d', fontSize: '0.85rem', margin: '0.25rem 1rem', textAlign: 'center' }}>
                {actionMsg}
              </p>
            )}

            {/* You (host always at top) */}
            <div className="lk-participant-row">
              <Avatar imageUrl={localImageUrl} name={room.localParticipant.name || room.localParticipant.identity} isSpeaking={room.localParticipant.isSpeaking} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {room.localParticipant.name || room.localParticipant.identity}
                </div>
                <div style={{ fontSize: '0.75rem', color: getRoleColor(localRole), marginTop: '0.125rem' }}>
                  {localRole === 'host' ? 'Host' : localRole === 'moderator' ? 'Moderator' : 'Listener'} (You)
                </div>
              </div>
            </div>

            {/* Others - sorted by pinned then speaking */}
            {sortedParticipants.map((p) => (
              <div key={p.identity} className={`lk-participant-row ${p.isSpeaking ? 'is-speaking' : ''}`}>
                <Avatar imageUrl={p.imageUrl} name={p.name} isSpeaking={p.isSpeaking} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {p.name}
                    {p.isHandRaised && (
                      <span style={{ fontSize: '0.85rem', flexShrink: 0 }} title="Hand raised">&#9995;</span>
                    )}
                    {p.isPinned && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="#5b8dee" style={{ flexShrink: 0 }}>
                        <path d="M14 4v5c0 1.12.37 2.16 1 3H9c.65-.86 1-1.9 1-3V4h4zm3-2H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3V4h1c.55 0 1-.45 1-1s-.45-1-1-1z" />
                      </svg>
                    )}
                    {p.isSpeaking && (
                      <span style={{ fontSize: '0.65rem', color: '#5bc88d', fontWeight: 600 }}>SPEAKING</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: getRoleColor(p.role), marginTop: '0.125rem' }}>
                    {p.canPublish ? '🎙 Can speak' : '🔇 Listener'}
                    {p.role === 'moderator' && ' (Moderator)'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0, alignItems: 'center' }}>
                  {/* Lower hand button - host only */}
                  {isHost && p.isHandRaised && (
                    <button
                      className="lk-button"
                      onClick={() => lowerHand(p.identity)}
                      title="Lower hand"
                      style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem', background: '#1e1e32', color: '#e8a85d', border: 'none', borderRadius: '0.5rem', boxShadow: '2px 2px 5px #151528, -2px -2px 5px #27273c' }}
                    >
                      Lower
                    </button>
                  )}
                  {/* Pin button - host only */}
                  {isHost && (
                    <button
                      className="lk-button"
                      onClick={() => togglePin(p.identity)}
                      title={p.isPinned ? 'Unpin' : 'Pin'}
                      style={{
                        fontSize: '0.7rem',
                        padding: '0.2rem 0.35rem',
                        background: '#1e1e32',
                        color: p.isPinned ? '#5b8dee' : 'rgba(255,255,255,0.4)',
                        border: 'none',
                        borderRadius: '0.5rem',
                        boxShadow: p.isPinned
                          ? 'inset 2px 2px 4px #151528, inset -2px -2px 4px #27273c'
                          : '2px 2px 5px #151528, -2px -2px 5px #27273c',
                        minWidth: 'auto',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14 4v5c0 1.12.37 2.16 1 3H9c.65-.86 1-1.9 1-3V4h4zm3-2H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3V4h1c.55 0 1-.45 1-1s-.45-1-1-1z" />
                      </svg>
                    </button>
                  )}
                  {/* Host action buttons */}
                  {isHost && (
                    <>
                      {!p.canPublish ? (
                        <button
                          className="lk-button"
                          onClick={() => doAction('grant_speak', p.identity)}
                          disabled={loadingAction === p.identity}
                          style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem', background: '#1e1e32', color: '#5bc88d', border: 'none', borderRadius: '0.5rem', boxShadow: '2px 2px 5px #151528, -2px -2px 5px #27273c' }}
                        >
                          Grant Speak
                        </button>
                      ) : (
                        <button
                          className="lk-button"
                          onClick={() => doAction('revoke_speak', p.identity)}
                          disabled={loadingAction === p.identity}
                          style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem', background: '#1e1e32', color: '#e8a85d', border: 'none', borderRadius: '0.5rem', boxShadow: '2px 2px 5px #151528, -2px -2px 5px #27273c' }}
                        >
                          Mute
                        </button>
                      )}
                      {p.role !== 'host' && (
                        <button
                          className="lk-button"
                          onClick={() => { if (confirm(`Make ${p.name} a Host?`)) doAction('make_host', p.identity); }}
                          disabled={loadingAction === p.identity}
                          style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem', background: '#1e1e32', color: '#5b8dee', border: 'none', borderRadius: '0.5rem', boxShadow: '2px 2px 5px #151528, -2px -2px 5px #27273c' }}
                        >
                          Make Host
                        </button>
                      )}
                      <button
                        className="lk-button"
                        onClick={() => { if (confirm(`Remove ${p.name}?`)) doAction('remove_participant', p.identity); }}
                        disabled={loadingAction === p.identity}
                        style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem', background: '#1e1e32', color: '#ff6b6b', border: 'none', borderRadius: '0.5rem', boxShadow: '2px 2px 5px #151528, -2px -2px 5px #27273c' }}
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}

            {sortedParticipants.length === 0 && (
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
                No other participants yet
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Avatar({ imageUrl, name, isSpeaking }: { imageUrl?: string; name: string; isSpeaking?: boolean }) {
  const initial = (name || '?').charAt(0).toUpperCase();
  return (
    <div style={{
      width: '32px', height: '32px', borderRadius: '50%',
      background: imageUrl ? 'transparent' : 'linear-gradient(135deg, #5b8dee, #4a7dd4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, overflow: 'hidden',
      boxShadow: isSpeaking
        ? 'inset 2px 2px 4px #151528, inset -2px -2px 4px #27273c, 0 0 0 2px #5bc88d'
        : 'inset 2px 2px 4px #151528, inset -2px -2px 4px #27273c',
      boxSizing: 'border-box',
      border: 'none',
    }}>
      {imageUrl ? (
        <img src={imageUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
      ) : (
        <span style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 600 }}>{initial}</span>
      )}
    </div>
  );
}

function getRoleColor(role: string): string {
  if (role === 'host') return '#5b8dee';
  if (role === 'moderator') return '#e8a85d';
  return 'rgba(255,255,255,0.5)';
}
