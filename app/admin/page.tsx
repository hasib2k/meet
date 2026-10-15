'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { generateRoomId } from '@/lib/client-utils';

interface Participant {
  identity: string;
  name: string;
  sid: string;
  role: string;
  isSpeaking: boolean;
  joinedAt: number;
  canPublish: boolean;
}

interface RoomInfo {
  name: string;
  sid: string;
  numParticipants: number;
  creationTime: number;
  participants: Participant[];
}

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [isAuthed, setIsAuthed] = useState(false);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');

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
    } catch (err) {
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
      setError('');
      const data = await res.json();
      setRooms(data.rooms || []);
    } else {
      setError('Wrong password');
    }
  };

  const doAction = async (action: string, roomName: string, identity?: string) => {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${password}`,
        },
        body: JSON.stringify({ action, roomName, identity }),
      });
      const data = await res.json();
      setActionMsg(data.message || 'Done');
      setTimeout(() => setActionMsg(''), 3000);
      fetchRooms();
    } catch {
      setActionMsg('Action failed');
    }
  };

  // Auto-refresh every 5 seconds when authed
  useEffect(() => {
    if (!isAuthed) return;
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, [isAuthed, fetchRooms]);

  const createMeetingLink = () => {
    const roomId = generateRoomId();
    const origin = window.location.origin;
    const hostLink = `${origin}/rooms/${roomId}?role=host`;
    const listenerLink = `${origin}/rooms/${roomId}`;
    navigator.clipboard.writeText(listenerLink);
    setActionMsg(`Meeting created! Listener link copied. Room: ${roomId}`);
    setTimeout(() => setActionMsg(''), 5000);

    // Also show in a prompt for visibility
    alert(
      `Meeting Created!\n\nRoom: ${roomId}\n\nHost link (for you):\n${hostLink}\n\nListener link (share this):\n${listenerLink}\n\nListener link copied to clipboard!`,
    );
  };

  if (!isAuthed) {
    return (
      <div style={pageStyles.page}>
        <div style={pageStyles.loginCard}>
          <div style={pageStyles.loginIcon}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
            </svg>
          </div>
          <h1 style={pageStyles.loginTitle}>Admin Panel</h1>
          <form onSubmit={handleLogin} style={pageStyles.loginForm}>
            <input
              type="password"
              placeholder="Enter admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={pageStyles.input}
              autoFocus
            />
            <button type="submit" style={pageStyles.btnPrimary}>
              Login
            </button>
          </form>
          {error && <p style={pageStyles.error}>{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyles.adminPage}>
      {/* Admin header */}
      <div style={pageStyles.adminHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="10" fill="#5b8dee" />
            <path
              d="M12 15C12 13.8954 12.8954 13 14 13H20C21.1046 13 22 13.8954 22 15V25C22 26.1046 21.1046 27 20 27H14C12.8954 27 12 26.1046 12 25V15Z"
              fill="white"
            />
            <path d="M24 17L28 14V26L24 23V17Z" fill="white" />
          </svg>
          <span style={{ fontSize: '1.25rem', fontWeight: 500, color: '#fff' }}>
            MyTalk Admin
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {actionMsg && (
            <span style={pageStyles.actionMsg}>{actionMsg}</span>
          )}
          <button onClick={createMeetingLink} style={pageStyles.btnPrimary}>
            + New Meeting
          </button>
          <button
            onClick={() => {
              setIsAuthed(false);
              setPassword('');
            }}
            style={pageStyles.btnSecondary}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={pageStyles.adminContent}>
        {loading && rooms.length === 0 && (
          <p style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>Loading...</p>
        )}

        {!loading && rooms.length === 0 && (
          <div style={pageStyles.emptyState}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="rgba(255,255,255,0.15)">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
            <h2 style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>No active meetings</h2>
            <p style={{ color: 'rgba(255,255,255,0.3)' }}>
              Click &quot;+ New Meeting&quot; to create one
            </p>
          </div>
        )}

        {rooms.map((room) => (
          <div key={room.sid} style={pageStyles.roomCard}>
            <div style={pageStyles.roomHeader}>
              <div>
                <h3 style={pageStyles.roomName}>{room.name}</h3>
                <span style={pageStyles.roomMeta}>
                  {room.numParticipants} participant{room.numParticipants !== 1 ? 's' : ''} &middot;
                  Started {new Date(room.creationTime * 1000).toLocaleTimeString()}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => {
                    const link = `${window.location.origin}/rooms/${room.name}`;
                    navigator.clipboard.writeText(link);
                    setActionMsg('Join link copied!');
                    setTimeout(() => setActionMsg(''), 2000);
                  }}
                  style={pageStyles.btnSmall}
                >
                  Copy Link
                </button>
                <button
                  onClick={() => {
                    if (confirm(`End meeting "${room.name}"?`)) {
                      doAction('end_room', room.name);
                    }
                  }}
                  style={{ ...pageStyles.btnSmall, ...pageStyles.btnDanger }}
                >
                  End Meeting
                </button>
              </div>
            </div>

            {/* Participants table */}
            {room.participants.length > 0 && (
              <div style={pageStyles.participantsTable}>
                <div style={pageStyles.tableHeader}>
                  <span style={{ flex: 2 }}>Name</span>
                  <span style={{ flex: 1 }}>Role</span>
                  <span style={{ flex: 1 }}>Status</span>
                  <span style={{ flex: 2, textAlign: 'right' }}>Actions</span>
                </div>
                {room.participants.map((p) => (
                  <div key={p.sid} style={pageStyles.tableRow}>
                    <span style={{ flex: 2, color: '#fff' }}>
                      {p.name || p.identity}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        ...getRoleBadgeStyle(p.role),
                      }}
                    >
                      {p.role}
                    </span>
                    <span style={{ flex: 1, color: 'rgba(255,255,255,0.5)' }}>
                      {p.canPublish ? '🎙 Can speak' : '🔇 Listening'}
                    </span>
                    <span
                      style={{
                        flex: 2,
                        display: 'flex',
                        gap: '0.375rem',
                        justifyContent: 'flex-end',
                      }}
                    >
                      {!p.canPublish ? (
                        <button
                          onClick={() => doAction('grant_speak', room.name, p.identity)}
                          style={{ ...pageStyles.btnTiny, background: '#2d7a4f' }}
                        >
                          Grant Speak
                        </button>
                      ) : (
                        <button
                          onClick={() => doAction('revoke_speak', room.name, p.identity)}
                          style={{ ...pageStyles.btnTiny, background: '#6b5b1e' }}
                        >
                          Mute
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${p.name || p.identity}?`)) {
                            doAction('remove_participant', room.name, p.identity);
                          }
                        }}
                        style={{ ...pageStyles.btnTiny, background: '#7a2d2d' }}
                      >
                        Remove
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function getRoleBadgeStyle(role: string): React.CSSProperties {
  const colors: Record<string, string> = {
    host: '#5b8dee',
    moderator: '#e8a85d',
    listener: 'rgba(255,255,255,0.4)',
  };
  return {
    color: colors[role] || colors.listener,
    fontWeight: role === 'listener' ? 400 : 600,
    textTransform: 'capitalize',
  };
}

const pageStyles: Record<string, React.CSSProperties> = {
  page: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  },
  loginCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.25rem',
    padding: '2.5rem',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '1rem',
    width: '100%',
    maxWidth: '380px',
  },
  loginIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #5b8dee, #4a7dd4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginTitle: {
    fontSize: '1.5rem',
    fontWeight: 500,
    color: '#fff',
    margin: 0,
  },
  loginForm: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  input: {
    width: '100%',
    padding: '0.875rem 1rem',
    backgroundColor: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '0.5rem',
    color: '#fff',
    fontSize: '0.95rem',
    outline: 'none',
  },
  btnPrimary: {
    padding: '0.75rem 1.25rem',
    backgroundColor: '#5b8dee',
    color: '#fff',
    border: 'none',
    borderRadius: '2rem',
    fontSize: '0.9rem',
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  btnSecondary: {
    padding: '0.75rem 1.25rem',
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.7)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '2rem',
    fontSize: '0.9rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  btnSmall: {
    padding: '0.375rem 0.75rem',
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.7)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '0.375rem',
    fontSize: '0.8rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  btnDanger: {
    backgroundColor: 'rgba(220,50,50,0.15)',
    color: '#ff6b6b',
    borderColor: 'rgba(220,50,50,0.2)',
  },
  btnTiny: {
    padding: '0.25rem 0.5rem',
    color: '#fff',
    border: 'none',
    borderRadius: '0.25rem',
    fontSize: '0.75rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  error: {
    color: '#ff6b6b',
    margin: 0,
    fontSize: '0.875rem',
  },
  actionMsg: {
    color: '#5bc88d',
    fontSize: '0.85rem',
  },
  adminPage: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: '#1a1a2e',
  },
  adminHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 1.5rem',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    flexWrap: 'wrap',
    gap: '0.75rem',
  },
  adminContent: {
    flex: 1,
    overflow: 'auto',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
  },
  roomCard: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '0.75rem',
    overflow: 'hidden',
  },
  roomHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 1.25rem',
    flexWrap: 'wrap',
    gap: '0.75rem',
  },
  roomName: {
    color: '#fff',
    fontSize: '1.1rem',
    fontWeight: 500,
    margin: 0,
  },
  roomMeta: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: '0.8rem',
  },
  participantsTable: {
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  tableHeader: {
    display: 'flex',
    padding: '0.5rem 1.25rem',
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  tableRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.625rem 1.25rem',
    fontSize: '0.875rem',
    borderBottom: '1px solid rgba(255,255,255,0.03)',
  },
};
