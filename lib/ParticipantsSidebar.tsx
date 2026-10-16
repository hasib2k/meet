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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Current user role
  let localRole = 'listener';
  let localImageUrl = '';
  let localBio = '';
  try {
    const meta = JSON.parse(room.localParticipant.metadata || '{}');
    localRole = meta.role || 'listener';
    localImageUrl = meta.imageUrl || '';
    localBio = meta.bio || '';
  } catch {}
  const isHost = localRole === 'host';

  const otherParticipants = participants
    .filter((p) => p.identity !== room.localParticipant.identity)
    .map((p) => {
      let role = 'listener';
      let imageUrl = '';
      let isHandRaised = false;
      let bio = '';
      try {
        const meta = JSON.parse(p.metadata || '{}');
        role = meta.role || 'listener';
        imageUrl = meta.imageUrl || '';
        isHandRaised = !!meta.isHandRaised;
        bio = meta.bio || '';
      } catch {}
      return {
        identity: p.identity,
        name: p.name || p.identity,
        role,
        imageUrl,
        bio,
        canPublish: p.permissions?.canPublish ?? false,
        isSpeaking: p.isSpeaking,
        isPinned: isPinned(p.identity),
        isHandRaised,
      };
    });

  const filteredParticipants = searchQuery.trim()
    ? otherParticipants.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : otherParticipants;

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
    setLoadingAction(identity || action);
    setOpenMenuId(null);
    try {
      const adminToken = sessionStorage.getItem('adminToken') || '';
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ action, roomName: room.name, identity }),
      });
      if (!res.ok) {
        const text = await res.text();
        setActionMsg(`Failed: ${text || res.statusText}`);
        setTimeout(() => setActionMsg(''), 3000);
        return;
      }
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

  // Find control bar for portal
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

  // Close menu on outside click
  useEffect(() => {
    if (!openMenuId) return;
    const handleClick = () => setOpenMenuId(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [openMenuId]);

  // Toggle button (portaled into control bar)
  const toggleButton = (
    <button
      className="lk-button lk-participants-toggle"
      aria-pressed={open}
      onClick={() => setOpen(!open)}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"></path><circle cx="10" cy="7" r="4"></circle><path d="M21 20v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"></path></svg>
      <span className="lk-participant-count">{participants.length}</span>
    </button>
  );

  const localName = room.localParticipant.name || room.localParticipant.identity || '?';

  return (
    <>
      {/* Portal button into the control bar */}
      {controlBar ? createPortal(toggleButton, controlBar) : toggleButton}

      {/* Full-screen participants panel */}
      {open && (
        <div className="participants-panel-neo">
          {/* Header: title + count + close */}
          <div className="pp-header">
            <div className="pp-header-left">
              <div className="pp-title">Participants</div>
              <div className="pp-count-badge">{participants.length}</div>
            </div>
            <button className="pp-close-btn" onClick={() => setOpen(false)} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a9b0d0" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18"></path></svg>
            </button>
          </div>

          {/* Search */}
          <div className="pp-search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7194" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path></svg>
            <input
              type="text"
              placeholder="Search participants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pp-search-input"
            />
          </div>

          {/* Action buttons (host only) */}
          {isHost && (
            <div className="pp-actions">
              <button
                className="pp-action-btn pp-action-full"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/rooms/${room.name}`).then(() => {
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 2000);
                  });
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6f97ff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"></path><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"></path></svg>
                {linkCopied ? 'Link Copied!' : 'Copy Meeting Link'}
              </button>
              <button className="pp-action-btn pp-unmute" onClick={() => doAction('unmute_all', '')} disabled={loadingAction === 'unmute_all'}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.2" strokeLinecap="round"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z"></path><path d="M19 11a7 7 0 0 1-14 0M12 18v3"></path></svg>
                Unmute All
              </button>
              <button className="pp-action-btn pp-mute" onClick={() => doAction('mute_all', '')} disabled={loadingAction === 'mute_all'}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f5b04a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l22 22M9 9v2a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.9-.6"></path><path d="M17 16.9A7 7 0 0 1 5 11M12 18v3"></path></svg>
                Mute All
              </button>
            </div>
          )}

          {actionMsg && (
            <p style={{ color: actionMsg.startsWith('Failed') ? '#ff8a8a' : '#4ade80', fontSize: '13px', margin: '0', textAlign: 'center' }}>
              {actionMsg}
            </p>
          )}

          {/* Section label */}
          <div className="pp-section-label">In this meeting</div>

          {/* Participants list */}
          <div className="pp-list">
            {/* Local user (You) */}
            <div className="pp-participant-card">
              <div className="pp-avatar-wrap">
                <div className="pp-avatar" style={{ background: localImageUrl ? 'transparent' : '#6f97ff' }}>
                  {localImageUrl ? (
                    <img src={localImageUrl} alt="" referrerPolicy="no-referrer" className="pp-avatar-img" />
                  ) : (
                    <span>{localName.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="pp-mic-badge">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z"></path><path d="M19 11a7 7 0 0 1-14 0"></path></svg>
                </div>
              </div>
              <div className="pp-info">
                <div className="pp-name">{localName}</div>
                <div className="pp-meta">
                  <span className="pp-role-badge" style={{ color: getRoleColor(localRole) }}>
                    {localRole === 'host' ? 'Host (You)' : localRole === 'moderator' ? 'Moderator (You)' : 'Listener (You)'}
                  </span>
                  {localBio && <span className="pp-bio">{localBio}</span>}
                </div>
              </div>
            </div>

            {/* Other participants */}
            {sortedParticipants.map((p) => (
              <div key={p.identity} className="pp-participant-card">
                <div className="pp-avatar-wrap">
                  <div className="pp-avatar" style={{ background: p.imageUrl ? 'transparent' : getAvatarColor(p.name) }}>
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" referrerPolicy="no-referrer" className="pp-avatar-img" />
                    ) : (
                      <span>{(p.name || '?').charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="pp-mic-badge">
                    {p.canPublish ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z"></path><path d="M19 11a7 7 0 0 1-14 0"></path></svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ff8a8a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l22 22M9 9v2a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.9-.6"></path><path d="M17 16.9A7 7 0 0 1 5 11"></path></svg>
                    )}
                  </div>
                </div>
                <div className="pp-info">
                  <div className="pp-name">
                    {p.name}
                    {p.isPinned && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="#6f97ff" style={{ flexShrink: 0 }}><path d="M16 3l5 5-3 1-4 4 1 5-2 2-4-4-5 5-1-1 5-5-4-4 2-2 5 1 4-4Z"></path></svg>
                    )}
                  </div>
                  <div className="pp-meta">
                    <span className="pp-role-badge" style={{ color: getRoleColor(p.role) }}>
                      {p.canPublish ? 'Can speak' : 'Listener'}
                      {p.role === 'host' && ' (Host)'}
                      {p.role === 'moderator' && ' (Moderator)'}
                    </span>
                    {p.bio && <span className="pp-bio">{p.bio}</span>}
                  </div>
                </div>
                {/* 3-dot menu for host */}
                {isHost && (
                  <ParticipantMenu
                    isOpen={openMenuId === p.identity}
                    onToggle={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === p.identity ? null : p.identity);
                    }}
                    participant={p}
                    loading={loadingAction === p.identity}
                    onPin={() => { togglePin(p.identity); setOpenMenuId(null); }}
                    onLowerHand={() => { lowerHand(p.identity); setOpenMenuId(null); }}
                    onAction={(action) => {
                      if (action === 'make_host') {
                        if (confirm(`Make ${p.name} a Host?`)) doAction(action, p.identity);
                        else setOpenMenuId(null);
                      } else if (action === 'remove_participant') {
                        if (confirm(`Remove ${p.name}?`)) doAction(action, p.identity);
                        else setOpenMenuId(null);
                      } else {
                        doAction(action, p.identity);
                      }
                    }}
                  />
                )}
              </div>
            ))}

            {sortedParticipants.length === 0 && searchQuery && (
              <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: '#7c83a8' }}>
                No participants match your search.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** Participant 3-dot menu */
function ParticipantMenu({
  isOpen, onToggle, participant, loading, onPin, onLowerHand, onAction,
}: {
  isOpen: boolean;
  onToggle: (e: React.MouseEvent) => void;
  participant: { identity: string; name: string; role: string; canPublish: boolean; isPinned: boolean; isHandRaised: boolean };
  loading: boolean;
  onPin: () => void;
  onLowerHand: () => void;
  onAction: (action: string) => void;
}) {
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button className="pp-menu-btn" onClick={onToggle} disabled={loading} aria-label="More">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#a9b0d0"><circle cx="12" cy="5" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="12" cy="19" r="1.8"></circle></svg>
      </button>

      {isOpen && (
        <div className="pp-dropdown" onClick={(e) => e.stopPropagation()}>
          <button className="pp-dropdown-item" onClick={onPin}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6f97ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3Z"></path></svg>
            {participant.isPinned ? 'Unpin' : 'Pin'}
          </button>
          {participant.isHandRaised && (
            <button className="pp-dropdown-item" style={{ color: '#f5b04a' }} onClick={onLowerHand}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f5b04a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8a8 8 0 0 0 16 0v-2a2 2 0 0 0-4 0"></path></svg>
              Lower Hand
            </button>
          )}
          {!participant.canPublish ? (
            <button className="pp-dropdown-item" style={{ color: '#4ade80' }} onClick={() => onAction('grant_speak')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z"></path><path d="M19 11a7 7 0 0 1-14 0M12 18v3"></path></svg>
              Grant Speak
            </button>
          ) : (
            <button className="pp-dropdown-item" style={{ color: '#f5b04a' }} onClick={() => onAction('revoke_speak')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f5b04a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l22 22M9 9v2a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.9-.6"></path><path d="M17 16.9A7 7 0 0 1 5 11M12 18v3"></path></svg>
              Mute
            </button>
          )}
          <button className="pp-dropdown-item" style={{ color: '#6f97ff' }} onClick={() => onAction('make_host')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6f97ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="10" r="3"></circle><path d="M6.2 18.6a7 7 0 0 1 11.6 0"></path></svg>
            Make Host
          </button>
          <div className="pp-dropdown-divider"></div>
          <button className="pp-dropdown-item" style={{ color: '#ff8a8a', fontWeight: 600 }} onClick={() => onAction('remove_participant')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff8a8a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M17 11h6"></path></svg>
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

function getRoleColor(role: string): string {
  if (role === 'host') return '#6f97ff';
  if (role === 'moderator') return '#f5b04a';
  return '#4ade80';
}

function getAvatarColor(name: string): string {
  const colors = ['#6f97ff', '#f5b04a', '#4ade80', '#ff8a8a', '#a78bfa', '#f472b6', '#38bdf8', '#fb923c'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
