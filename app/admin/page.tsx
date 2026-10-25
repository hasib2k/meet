'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { generateRoomId } from '@/lib/client-utils';

interface Participant {
  identity: string;
  name: string;
  sid: string;
  role: string;
  bio?: string;
  imageUrl?: string;
  isSpeaking: boolean;
  joinedAt: number;
  canPublish: boolean;
}

interface RoomInfo {
  name: string;
  sid: string;
  numParticipants: number;
  creationTime: number;
  metadata?: string;
  participants: Participant[];
}

/* ---------- helpers ---------- */

const AVATAR_GRADIENTS = [
  'linear-gradient(145deg,#f0ab3f,#de7a24)',
  'linear-gradient(145deg,#7aa0ff,#5a83ee)',
  'linear-gradient(145deg,#5dc995,#3f9e70)',
  'linear-gradient(145deg,#c77dff,#9d4edd)',
  'linear-gradient(145deg,#ff8fa3,#e0607a)',
  'linear-gradient(145deg,#4dd0e1,#26a0b3)',
];

function avatarGradient(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

function initials(name: string): string {
  const parts = (name || '?').trim().split(/\s+/);
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase();
}

function roleDisplay(role: string): string {
  if (role === 'host') return 'Host';
  if (role === 'moderator') return 'Speaker';
  return 'Listener';
}

function roleColor(role: string): string {
  if (role === 'host') return '#6f97ff';
  if (role === 'moderator') return '#4ade80';
  return '#9aa1c2';
}

// SVG path sets
const MIC = (
  <>
    <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" />
    <path d="M19 11a7 7 0 0 1-14 0M12 18v3" />
  </>
);
const HEAD = (
  <>
    <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
    <path d="M21 15a2 2 0 0 1-2 2h-1v-5h3ZM3 15a2 2 0 0 0 2 2h1v-5H3Z" />
  </>
);

function statusInfo(p: Participant): { text: string; color: string; icon: React.ReactNode } {
  if (!p.canPublish) return { text: 'Listening', color: '#9aa1c2', icon: HEAD };
  if (p.isSpeaking) return { text: 'Speaking', color: '#4ade80', icon: MIC };
  return { text: 'Can speak', color: '#f5b04a', icon: MIC };
}

/* ---------- component ---------- */

export default function AdminPage() {
  const [password, setPassword] = useState(() => {
    if (typeof window !== 'undefined') return sessionStorage.getItem('adminPwd') || '';
    return '';
  });
  const [isAuthed, setIsAuthed] = useState(() => {
    if (typeof window !== 'undefined') return !!sessionStorage.getItem('adminPwd');
    return false;
  });
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  }, []);

  const fetchRooms = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin', {
        headers: { Authorization: `Bearer ${password}` },
      });
      if (res.status === 401) {
        setIsAuthed(false);
        setError('Invalid password');
        return;
      }
      const data = await res.json();
      setRooms(data.rooms || []);
      setError('');
    } catch {
      setError('Failed to fetch rooms');
    } finally {
      setLoading(false);
    }
  }, [password]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin', {
      headers: { Authorization: `Bearer ${password}` },
    });
    if (res.ok) {
      setIsAuthed(true);
      sessionStorage.setItem('adminPwd', password);
      setError('');
      const data = await res.json();
      setRooms(data.rooms || []);
    } else {
      setError('Wrong password');
    }
  };

  const doAction = async (action: string, roomName: string, identity?: string, msg?: string) => {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` },
        body: JSON.stringify({ action, roomName, identity }),
      });
      const data = await res.json();
      flash(msg || data.message || 'Done');
      fetchRooms();
    } catch {
      flash('Action failed');
    }
  };

  useEffect(() => {
    if (!isAuthed) return;
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, [isAuthed, fetchRooms]);

  const createMeetingLink = async () => {
    const roomId = generateRoomId();
    const origin = window.location.origin;
    const listenerLink = `${origin}/rooms/${roomId}`;
    try {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` },
        body: JSON.stringify({ action: 'create_room', roomName: roomId, meetingTitle: meetingTitle.trim() }),
      });
    } catch (err) {
      console.error('Failed to create room:', err);
    }
    try { navigator.clipboard.writeText(listenerLink); } catch {}
    setShowCreateModal(false);
    setMeetingTitle('');
    flash(`Meeting ${roomId} created · link copied`);
    fetchRooms();
  };

  const logout = () => {
    setIsAuthed(false);
    setPassword('');
    sessionStorage.removeItem('adminPwd');
  };

  /* ---------- login screen ---------- */
  if (!isAuthed) {
    return (
      <div style={S.page}>
        {/* soft ambient glow */}
        <div style={S.glow} />

        <div style={S.loginCard}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={S.loginBrandIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#6f97ff">
                <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
              </svg>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.01em' }}>
              My<span style={{ color: '#6f97ff' }}>Talk</span>
            </div>
            <div style={S.adminBadge}>Admin</div>
          </div>

          {/* Welcome */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em' }}>Welcome back</div>
            <div style={{ fontSize: 14, color: '#9aa1c2', lineHeight: 1.5 }}>
              Sign in to manage active meetings, control participants, and moderate your rooms.
            </div>
          </div>

          {/* Feature highlights */}
          <div style={S.featureRow}>
            {[
              { c: '#6f97ff', label: 'Live rooms', path: 'M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z M19 11a7 7 0 0 1-14 0M12 18v3' },
              { c: '#4ade80', label: 'Moderate', path: 'M20 6 9 17l-5-5' },
              { c: '#f5b04a', label: 'Controls', path: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6' },
            ].map((f) => (
              <div key={f.label} style={S.featureChip}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={f.c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={f.path} />
                </svg>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#c4c9e4' }}>{f.label}</span>
              </div>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} style={S.loginForm}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#9aa1c2' }}>Admin password</label>
            <div style={S.inputWrap}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6c7498" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={S.inputBare}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="adm-btn"
                style={S.eyeBtn}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9aa1c2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9aa1c2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>

            {error && (
              <div style={S.errorBox}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff8a8a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
                </svg>
                {error}
              </div>
            )}

            <button type="submit" className="adm-btn" style={{ ...S.btnPrimary, height: 50, marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
              </svg>
              Sign in to dashboard
            </button>
          </form>

          {/* Footer */}
          <div style={S.loginFooter}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6c7498" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Protected area · Authorized access only
          </div>
        </div>
      </div>
    );
  }

  /* ---------- dashboard ---------- */
  return (
    <div style={S.shell}>
      {/* Header */}
      <header style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={S.logoBox}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#6f97ff">
              <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
            </svg>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-.01em' }}>
              My<span style={{ color: '#6f97ff' }}>Talk</span>
            </div>
            <div style={S.adminBadge}>Admin</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="adm-btn" onClick={() => setShowCreateModal(true)} style={S.btnPrimaryHeader}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New Meeting
          </button>
          <button className="adm-btn" onClick={logout} style={S.btnGhost}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff8a8a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            Logout
          </button>
        </div>
      </header>

      {/* Main */}
      <main style={S.main}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-.02em' }}>Active meetings</div>
          <div style={S.countBadge}>{rooms.length}</div>
        </div>

        {rooms.map((room) => {
          let roomTitle = '';
          try {
            roomTitle = JSON.parse(room.metadata || '{}').title || '';
          } catch {}
          const heading = roomTitle || room.name;
          const meta =
            (roomTitle ? room.name + ' · ' : '') +
            `${room.numParticipants} participant${room.numParticipants !== 1 ? 's' : ''} · Started ${new Date(
              room.creationTime * 1000,
            ).toLocaleTimeString()}`;

          return (
            <section key={room.sid} style={S.card}>
              {/* card header */}
              <div style={S.cardHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
                  <div style={S.statusDotBox}>
                    <div style={S.statusDot} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '.02em' }}>{heading}</div>
                    <div style={{ fontSize: 13, color: '#7c83a8', whiteSpace: 'nowrap' }}>{meta}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <button className="adm-btn" onClick={() => doAction('unmute_all', room.name)} style={S.pill('#4ade80')}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.2" strokeLinecap="round">
                      <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" />
                      <path d="M19 11a7 7 0 0 1-14 0M12 18v3" />
                    </svg>
                    Unmute All
                  </button>
                  <button className="adm-btn" onClick={() => doAction('mute_all', room.name)} style={S.pill('#f5b04a')}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f5b04a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 1l22 22M9 9v2a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.9-.6" />
                      <path d="M17 16.9A7 7 0 0 1 5 11M12 18v3" />
                    </svg>
                    Mute All
                  </button>
                  <button
                    className="adm-btn"
                    onClick={() => {
                      try { navigator.clipboard.writeText(`${window.location.origin}/rooms/${room.name}`); } catch {}
                      flash('Link copied');
                    }}
                    style={S.pill('#6f97ff')}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6f97ff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
                      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
                    </svg>
                    Copy Link
                  </button>
                  <button
                    className="adm-btn"
                    onClick={() => { if (confirm(`End meeting "${heading}"?`)) doAction('end_room', room.name, undefined, `Meeting ${room.name} ended`); }}
                    style={S.pillDanger}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="#fff">
                      <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85a1 1 0 0 1-1.41-.01L.29 13.08a1 1 0 0 1 0-1.41C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67a1 1 0 0 1 0 1.41l-2.48 2.48a1 1 0 0 1-1.41.01c-.79-.73-1.68-1.36-2.66-1.85a1 1 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9Z" />
                    </svg>
                    End Meeting
                  </button>
                </div>
              </div>

              {/* participants table */}
              <div style={S.tableWrap}>
                <div style={{ minWidth: 760, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={S.tableHead}>
                    <div>Name</div>
                    <div>Role</div>
                    <div>Status</div>
                    <div style={{ textAlign: 'right' }}>Actions</div>
                  </div>

                  {room.participants.map((p) => {
                    const st = statusInfo(p);
                    return (
                      <div key={p.sid} style={S.row}>
                        {/* name */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt=""
                              referrerPolicy="no-referrer"
                              style={{ ...S.avatar, objectFit: 'cover' }}
                            />
                          ) : (
                            <div style={{ ...S.avatar, background: avatarGradient(p.identity || p.name) }}>
                              {initials(p.name || p.identity)}
                            </div>
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                            <div style={S.ellipsis}>{p.name || p.identity}</div>
                            <div style={{ ...S.ellipsis, fontSize: 12, color: '#7c83a8', fontWeight: 400 }}>
                              {p.bio || '—'}
                            </div>
                          </div>
                        </div>
                        {/* role */}
                        <div>
                          <span style={{ ...S.roleBadge, color: roleColor(p.role) }}>{roleDisplay(p.role)}</span>
                        </div>
                        {/* status */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: st.color, whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'flex' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={st.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              {st.icon}
                            </svg>
                          </span>
                          {st.text}
                        </div>
                        {/* actions */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                          {!p.canPublish ? (
                            <button className="adm-btn" onClick={() => doAction('grant_speak', room.name, p.identity, `${p.name || p.identity} can speak`)} style={S.rowBtn('#4ade80', 84)}>
                              Grant Speak
                            </button>
                          ) : (
                            <button className="adm-btn" onClick={() => doAction('revoke_speak', room.name, p.identity, `${p.name || p.identity} muted`)} style={S.rowBtn('#f5b04a', 84)}>
                              Mute
                            </button>
                          )}
                          {p.role !== 'host' && (
                            <button
                              className="adm-btn"
                              onClick={() => { if (confirm(`Make ${p.name || p.identity} a host?`)) doAction('make_host', room.name, p.identity, `${p.name || p.identity} is now host`); }}
                              style={S.rowBtn('#6f97ff')}
                            >
                              Make Host
                            </button>
                          )}
                          <button
                            className="adm-btn"
                            onClick={() => { if (confirm(`Remove ${p.name || p.identity}?`)) doAction('remove_participant', room.name, p.identity, `${p.name || p.identity} removed`); }}
                            style={S.rowBtn('#ff8a8a')}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {room.participants.length === 0 && (
                    <div style={{ padding: 24, textAlign: 'center', fontSize: 14, color: '#7c83a8' }}>
                      No participants yet. Share the link to invite people.
                    </div>
                  )}
                </div>
              </div>
            </section>
          );
        })}

        {!loading && rooms.length === 0 && (
          <div style={S.emptyState}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>No active meetings</div>
            <div style={{ fontSize: 14, color: '#9aa1c2' }}>Start a new meeting to see it here.</div>
          </div>
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div style={S.toast}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }} />
          {toast}
        </div>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <div style={S.modalOverlay} onClick={() => { setShowCreateModal(false); setMeetingTitle(''); }}>
          <div style={S.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Create new meeting</div>
            <div>
              <label style={{ color: '#9aa1c2', fontSize: 13, marginBottom: 8, display: 'block' }}>
                Meeting title (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Weekly Team Standup"
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                style={S.input}
                autoFocus
                maxLength={100}
              />
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="adm-btn" onClick={() => { setShowCreateModal(false); setMeetingTitle(''); }} style={S.btnGhost}>
                Cancel
              </button>
              <button className="adm-btn" onClick={createMeetingLink} style={S.btnPrimary}>
                Create Meeting
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- styles (neumorphic, matching the design) ---------- */

const FONT = "'Plus Jakarta Sans', 'Google Sans', 'Segoe UI', Roboto, Arial, sans-serif";

const S = {
  // login
  page: {
    position: 'relative',
    minHeight: '100vh',
    background: 'radial-gradient(1200px 600px at 50% -10%, #242a44 0%, #1e2238 55%)',
    color: '#e6e9f5',
    fontFamily: FONT,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    overflow: 'hidden',
  } as React.CSSProperties,
  glow: {
    position: 'absolute',
    top: '-20%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 520,
    height: 520,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(111,151,255,0.18), transparent 60%)',
    filter: 'blur(20px)',
    pointerEvents: 'none',
  } as React.CSSProperties,
  loginCard: {
    position: 'relative',
    width: '100%',
    maxWidth: 420,
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
    padding: 36,
    borderRadius: 28,
    background: '#1e2238',
    boxShadow: '12px 12px 28px #13162a',
    boxSizing: 'border-box',
  } as React.CSSProperties,
  loginBrandIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    background: '#1e2238',
    boxShadow: 'inset 3px 3px 7px #14172a, inset -3px -3px 7px #282d48',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,
  featureRow: { display: 'flex', gap: 10, flexWrap: 'wrap' } as React.CSSProperties,
  featureChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    height: 34,
    padding: '0 12px',
    borderRadius: 11,
    background: '#1e2238',
    boxShadow: '4px 4px 9px #14172a',
  } as React.CSSProperties,
  loginForm: { width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 2 } as React.CSSProperties,
  inputWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    height: 52,
    padding: '0 10px 0 16px',
    borderRadius: 14,
    background: '#1e2238',
    boxShadow: 'inset 4px 4px 9px #14172a, inset -4px -4px 9px #282d48',
  } as React.CSSProperties,
  inputBare: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: '#e6e9f5',
    fontSize: 15,
    fontFamily: FONT,
  } as React.CSSProperties,
  eyeBtn: {
    flexShrink: 0,
    width: 36,
    height: 36,
    borderRadius: 10,
    border: 'none',
    cursor: 'pointer',
    background: '#1e2238',
    boxShadow: '3px 3px 7px #14172a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: '#ff8a8a',
    fontSize: 13,
    fontWeight: 600,
    padding: '10px 14px',
    borderRadius: 12,
    boxShadow: 'inset 2px 2px 5px #14172a, inset -2px -2px 5px #282d48',
  } as React.CSSProperties,
  loginFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    fontSize: 12,
    color: '#6c7498',
    marginTop: 2,
  } as React.CSSProperties,
  input: {
    width: '100%',
    boxSizing: 'border-box',
    height: 48,
    padding: '0 16px',
    borderRadius: 14,
    border: 'none',
    outline: 'none',
    background: '#1e2238',
    boxShadow: 'inset 4px 4px 9px #14172a, inset -4px -4px 9px #282d48',
    color: '#e6e9f5',
    fontSize: 15,
    fontFamily: FONT,
  } as React.CSSProperties,
  error: { color: '#ff8a8a', margin: 0, fontSize: 14 } as React.CSSProperties,

  // shell
  shell: {
    minHeight: '100vh',
    background: '#1e2238',
    color: '#e6e9f5',
    fontFamily: FONT,
    display: 'flex',
    flexDirection: 'column',
  } as React.CSSProperties,
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '24px 40px',
    flexWrap: 'wrap',
  } as React.CSSProperties,
  logoBox: {
    width: 46,
    height: 46,
    borderRadius: 15,
    background: '#1e2238',
    boxShadow: '5px 5px 10px #14172a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,
  adminBadge: {
    height: 26,
    padding: '0 10px',
    borderRadius: 8,
    boxShadow: 'inset 2px 2px 5px #14172a, inset -2px -2px 5px #282d48',
    display: 'flex',
    alignItems: 'center',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    color: '#9aa1c2',
  } as React.CSSProperties,
  btnPrimaryHeader: {
    border: 'none',
    cursor: 'pointer',
    fontFamily: FONT,
    height: 48,
    padding: '0 22px',
    borderRadius: 16,
    background: 'linear-gradient(145deg,#7aa0ff,#5a83ee)',
    boxShadow: '5px 5px 12px #13162a',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
  btnGhost: {
    border: 'none',
    cursor: 'pointer',
    fontFamily: FONT,
    height: 48,
    padding: '0 20px',
    borderRadius: 16,
    background: '#1e2238',
    boxShadow: '5px 5px 10px #14172a',
    color: '#e6e9f5',
    fontSize: 14,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
  btnPrimary: {
    border: 'none',
    cursor: 'pointer',
    fontFamily: FONT,
    height: 48,
    padding: '0 22px',
    borderRadius: 14,
    background: 'linear-gradient(145deg,#7aa0ff,#5a83ee)',
    boxShadow: '5px 5px 12px #13162a',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
  } as React.CSSProperties,

  // main
  main: {
    flex: 1,
    padding: '8px 40px 48px',
    display: 'flex',
    flexDirection: 'column',
    gap: 28,
    maxWidth: 1400,
    width: '100%',
    boxSizing: 'border-box',
    margin: '0 auto',
  } as React.CSSProperties,
  countBadge: {
    minWidth: 30,
    height: 26,
    padding: '0 9px',
    boxSizing: 'border-box',
    borderRadius: 9,
    boxShadow: 'inset 2px 2px 5px #14172a, inset -2px -2px 5px #282d48',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    color: '#6f97ff',
  } as React.CSSProperties,

  // card
  card: {
    borderRadius: 30,
    background: '#1e2238',
    boxShadow: '10px 10px 24px #13162a',
    padding: 28,
    display: 'flex',
    flexDirection: 'column',
    gap: 22,
  } as React.CSSProperties,
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
    flexWrap: 'wrap',
  } as React.CSSProperties,
  statusDotBox: {
    width: 52,
    height: 52,
    flexShrink: 0,
    borderRadius: 17,
    boxShadow: 'inset 4px 4px 9px #14172a, inset -4px -4px 9px #282d48',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#4ade80',
    boxShadow: '0 0 0 5px rgba(74,222,128,.15)',
  } as React.CSSProperties,
  pill: (color: string): React.CSSProperties => ({
    border: 'none',
    cursor: 'pointer',
    fontFamily: FONT,
    height: 44,
    padding: '0 16px',
    borderRadius: 14,
    background: '#1e2238',
    boxShadow: '4px 4px 9px #14172a',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color,
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  }),
  pillDanger: {
    border: 'none',
    cursor: 'pointer',
    fontFamily: FONT,
    height: 44,
    padding: '0 18px',
    borderRadius: 14,
    background: 'linear-gradient(145deg,#f06a6a,#d94848)',
    boxShadow: '4px 4px 10px #13162a',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  } as React.CSSProperties,

  // table
  tableWrap: {
    borderRadius: 22,
    boxShadow: 'inset 5px 5px 12px #14172a, inset -5px -5px 12px #282d48',
    padding: 10,
    overflowX: 'auto',
  } as React.CSSProperties,
  tableHead: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0,2.2fr) minmax(0,1fr) minmax(0,1.2fr) minmax(300px,auto)',
    gap: 16,
    padding: '10px 16px 4px',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '.1em',
    textTransform: 'uppercase',
    color: '#7c83a8',
  } as React.CSSProperties,
  row: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0,2.2fr) minmax(0,1fr) minmax(0,1.2fr) minmax(300px,auto)',
    gap: 16,
    alignItems: 'center',
    padding: '12px 16px',
    borderRadius: 16,
    background: '#1e2238',
    boxShadow: '4px 4px 9px #14172a',
  } as React.CSSProperties,
  avatar: {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: '50%',
    boxShadow: '3px 3px 7px #13162a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    color: '#fff',
  } as React.CSSProperties,
  ellipsis: {
    fontSize: 15,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as React.CSSProperties,
  roleBadge: {
    height: 26,
    padding: '0 10px',
    borderRadius: 8,
    boxShadow: 'inset 2px 2px 5px #14172a, inset -2px -2px 5px #282d48',
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
  rowBtn: (color: string, minWidth?: number): React.CSSProperties => ({
    border: 'none',
    cursor: 'pointer',
    fontFamily: FONT,
    height: 36,
    minWidth,
    padding: '0 14px',
    borderRadius: 12,
    background: '#1e2238',
    boxShadow: '3px 3px 7px #14172a',
    color,
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  }),

  // empty
  emptyState: {
    padding: '64px 24px',
    borderRadius: 30,
    boxShadow: 'inset 6px 6px 14px #14172a, inset -6px -6px 14px #282d48',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    textAlign: 'center',
  } as React.CSSProperties,

  // toast
  toast: {
    position: 'fixed',
    zIndex: 50,
    right: 40,
    bottom: 40,
    padding: '16px 20px',
    borderRadius: 16,
    background: '#262b46',
    boxShadow: '8px 8px 18px #10121f',
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  } as React.CSSProperties,

  // modal
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(8,10,20,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 24,
  } as React.CSSProperties,
  modalCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 24,
    background: '#1e2238',
    boxShadow: '10px 10px 24px #13162a',
    padding: 28,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  } as React.CSSProperties,
};
