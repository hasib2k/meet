'use client';

import { useRouter } from 'next/navigation';
import React, { Suspense, useState, useEffect } from 'react';
import { useSession, signOut, signIn } from 'next-auth/react';
import { getMeetingHistory, saveMeeting, removeMeeting, clearAllMeetings, formatTimeAgo, type MeetingRecord } from '@/lib/meetingHistory';

type TabId = 'meet' | 'calls' | 'groups' | 'chat' | 'profile';

function generateRoomCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const seg = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${seg(4)}-${seg(4)}`;
}

function HomeContent() {
  const router = useRouter();
  const { data: session } = useSession();
  const [roomCode, setRoomCode] = useState('');
  const [history, setHistory] = useState<MeetingRecord[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('meet');

  useEffect(() => {
    setHistory(getMeetingHistory());
  }, []);

  const handleNewMeeting = () => {
    const code = generateRoomCode();
    saveMeeting(code, 'host');
    router.push(`/rooms/${code}?role=host`);
  };

  const handleJoinMeeting = () => {
    if (roomCode.trim()) {
      saveMeeting(roomCode.trim(), 'listener');
      router.push(`/rooms/${roomCode.trim()}?role=listener`);
    }
  };

  const handleRejoin = (roomName: string, role: string) => {
    saveMeeting(roomName, role);
    router.push(`/rooms/${roomName}`);
  };

  const handleRemove = (roomName: string) => {
    removeMeeting(roomName);
    setHistory(getMeetingHistory());
  };

  const handleClearAll = () => {
    clearAllMeetings();
    setHistory([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && roomCode.trim()) {
      handleJoinMeeting();
    }
  };

  const userInitial = (session?.user?.name || '?').charAt(0).toUpperCase();

  return (
    <>
      {/* Top bar */}
      <div className="topbar">
        <div className="topbar-logo">
          {/* Mic icon for mobile */}
          <div className="topbar-mic-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#6f97ff">
              <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"/>
            </svg>
          </div>
          {/* Logo for desktop */}
          <svg className="topbar-logo-icon" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="40" height="40" rx="10" fill="#5b8dee" />
            <path d="M12 15C12 13.8954 12.8954 13 14 13H20C21.1046 13 22 13.8954 22 15V25C22 26.1046 21.1046 27 20 27H14C12.8954 27 12 26.1046 12 25V15Z" fill="white" />
            <path d="M24 17L28 14V26L24 23V17Z" fill="white" />
          </svg>
          <span>My<span style={{ color: '#6f97ff' }}>Talk</span></span>
        </div>
        {/* Desktop user section */}
        {session?.user && (
          <div className="topbar-user topbar-user-desktop">
            {session.user.image && (
              <img src={session.user.image} alt="" referrerPolicy="no-referrer" style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.15)' }} />
            )}
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem' }}>{session.user.name}</span>
            <button onClick={() => signOut()} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', padding: '0.375rem 0.75rem', borderRadius: '1.5rem', fontSize: '0.8rem', cursor: 'pointer' }}>
              Sign out
            </button>
          </div>
        )}
        {/* Mobile avatar */}
        <div className="topbar-user-mobile">
          {session?.user?.image ? (
            <img src={session.user.image} alt="" referrerPolicy="no-referrer" className="topbar-mobile-avatar" />
          ) : (
            <div className="topbar-mobile-initial">{userInitial}</div>
          )}
        </div>
      </div>

      {/* Main content */}
      <main className="home-main">
        {/* ===== MEET TAB ===== */}
        <div className={`home-container ${activeTab !== 'meet' ? 'mobile-tab-hidden' : ''}`}>
          <div className="home-left">
            <h1>
              Premium audio meetings.
              <br />
              Now free for <span>everyone</span>.
            </h1>
            <p>
              Connect, collaborate, and communicate with crystal-clear audio.
              Built for large meetings with up to 2,500 participants.
            </p>

            {/* Join with code section */}
            <div className="m-join-section">
              <div className="m-join-label">Join with a code</div>
              <div className="m-join-input-row">
                <div className="m-join-field">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7194" strokeWidth="2" strokeLinecap="round">
                    <rect x="2" y="6" width="20" height="12" rx="2"/>
                    <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>
                  </svg>
                  <input
                    type="text"
                    placeholder="abc-defg-hij"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="m-join-input"
                  />
                </div>
                <button
                  className="m-join-btn"
                  onClick={handleJoinMeeting}
                  disabled={!roomCode.trim()}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Desktop join (existing) */}
            <div className="home-actions">
              <div className="join-input-group">
                <input
                  type="text"
                  placeholder="Enter a meeting code"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button className="btn-join" onClick={handleJoinMeeting} disabled={!roomCode.trim()}>
                  Join
                </button>
              </div>
            </div>

            {/* Meeting History */}
            {history.length > 0 && (
              <div className="meeting-history">
                <div className="meeting-history-header">
                  <h3 className="meeting-history-title">Recent Meetings</h3>
                  <button className="meeting-history-clear" onClick={handleClearAll}>Clear</button>
                </div>
                <div className="meeting-history-list">
                  {history.map((m) => (
                    <div key={m.roomName} className="meeting-history-item">
                      <div className="meeting-history-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6f97ff" strokeWidth="2" strokeLinecap="round">
                          <path d="M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M21 20v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                      </div>
                      <div className="meeting-history-info" onClick={() => handleRejoin(m.roomName, m.role)}>
                        <span className="meeting-history-name">{m.roomName}</span>
                        <span className="meeting-history-meta">
                          {m.role === 'host' ? 'Hosted' : 'Joined'} · {formatTimeAgo(m.timestamp)}
                        </span>
                      </div>
                      <button className="meeting-history-rejoin" onClick={() => handleRejoin(m.roomName, m.role)}>
                        Rejoin
                      </button>
                      <button className="meeting-history-remove" onClick={() => handleRemove(m.roomName)} title="Remove">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right section - illustration (desktop only) */}
          <div className="home-right">
            <div className="illustration-card">
              <div className="illustration-grid">
                <div className="illustration-avatar"><svg viewBox="0 0 24 24" fill="white"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg></div>
                <div className="illustration-avatar"><svg viewBox="0 0 24 24" fill="white"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg></div>
                <div className="illustration-avatar"><svg viewBox="0 0 24 24" fill="white"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg></div>
                <div className="illustration-avatar"><svg viewBox="0 0 24 24" fill="white"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg></div>
              </div>
              <p className="illustration-text">Audio-only meetings for up to 2,500 participants</p>
            </div>
          </div>
        </div>

        {/* ===== CALLS TAB ===== */}
        <div className={`mobile-tab-content ${activeTab !== 'calls' ? 'mobile-tab-hidden' : ''}`}>
          <div className="mobile-tab-header"><h2>Calls</h2></div>
          <div className="mobile-empty-state">
            <div className="mobile-empty-icon calls">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#6f97ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>
              </svg>
            </div>
            <span className="mobile-empty-title">No recent calls</span>
            <span className="mobile-empty-sub">Group and direct calls will show up here</span>
          </div>
        </div>

        {/* ===== GROUPS TAB ===== */}
        <div className={`mobile-tab-content ${activeTab !== 'groups' ? 'mobile-tab-hidden' : ''}`}>
          <div className="mobile-tab-header"><h2>Groups</h2></div>
          <div className="mobile-empty-state">
            <div className="mobile-empty-icon groups">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M21 20v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>
              </svg>
            </div>
            <span className="mobile-empty-title">No groups yet</span>
            <span className="mobile-empty-sub">Create groups and start audio calls together</span>
          </div>
        </div>

        {/* ===== CHAT TAB ===== */}
        <div className={`mobile-tab-content ${activeTab !== 'chat' ? 'mobile-tab-hidden' : ''}`}>
          <div className="mobile-tab-header"><h2>Chats</h2></div>
          <div className="mobile-empty-state">
            <div className="mobile-empty-icon chat">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#f5b04a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/><path d="M8 8h8M8 12h5"/>
              </svg>
            </div>
            <span className="mobile-empty-title">No conversations</span>
            <span className="mobile-empty-sub">Message anyone on MyTalk</span>
          </div>
        </div>

        {/* ===== PROFILE TAB ===== */}
        <div className={`mobile-tab-content ${activeTab !== 'profile' ? 'mobile-tab-hidden' : ''}`}>
          <div className="mobile-tab-header"><h2>Profile</h2></div>
          <ProfileTabContent session={session} userInitial={userInitial} />
        </div>
      </main>

      {/* Footer (desktop only) */}
      <footer>Developed by Hasib Talukder &middot; Built with Next.js</footer>

      {/* Mobile Bottom Navigation */}
      <div className="mobile-nav-wrap">
      <nav className="mobile-bottom-nav">
        <button className={`bottom-nav-item ${activeTab === 'meet' ? 'active' : ''}`} onClick={() => setActiveTab('meet')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
          </svg>
          <span>Meet</span>
        </button>
        <button className={`bottom-nav-item ${activeTab === 'calls' ? 'active' : ''}`} onClick={() => setActiveTab('calls')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
          </svg>
          <span>Calls</span>
        </button>
        <button className={`bottom-nav-item ${activeTab === 'groups' ? 'active' : ''}`} onClick={() => setActiveTab('groups')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
          </svg>
          <span>Groups</span>
        </button>
        <button className={`bottom-nav-item ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
          </svg>
          <span>Chat</span>
        </button>
        <button className={`bottom-nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
          {session?.user?.image ? (
            <img src={session.user.image} alt="" referrerPolicy="no-referrer" className="bottom-nav-avatar" />
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          )}
          <span>Profile</span>
        </button>
      </nav>
      </div>
    </>
  );
}

/** Profile tab — logged-in vs guest */
function ProfileTabContent({ session, userInitial }: { session: any; userInitial: string }) {
  const [guestName, setGuestName] = useState(() => {
    try { return localStorage.getItem('guestName') || ''; } catch { return ''; }
  });
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(guestName);

  const isLoggedIn = !!session?.user;

  const saveGuestName = () => {
    const name = nameInput.trim();
    if (name) {
      setGuestName(name);
      try { localStorage.setItem('guestName', name); } catch {}
    }
    setEditingName(false);
  };

  // ===== Logged-in user =====
  if (isLoggedIn) {
    return (
      <>
        <div className="mobile-profile-section">
          <div className="mobile-profile-avatar">
            {session.user.image ? (
              <img src={session.user.image} alt="" referrerPolicy="no-referrer" />
            ) : (
              <div className="mobile-profile-avatar-placeholder">{userInitial}</div>
            )}
          </div>
          <div className="mobile-profile-name">{session.user.name || 'User'}</div>
          <div className="mobile-profile-email">{session.user.email || ''}</div>
        </div>
        <div className="mobile-profile-menu">
          <button className="mobile-profile-menu-item" data-danger="" onClick={() => signOut()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff8a8a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
            Sign Out
          </button>
        </div>
        <div className="mobile-profile-footer">MyTalk v1.0 &middot; Built with Next.js</div>
      </>
    );
  }

  // ===== Not logged in =====
  return (
    <>
      <div className="mobile-profile-section">
        <div className="mobile-profile-avatar">
          <div className="mobile-profile-avatar-placeholder" style={{ background: guestName ? 'linear-gradient(145deg,#f0ab3f,#de7a24)' : undefined }}>
            {guestName ? guestName.charAt(0).toUpperCase() : '?'}
          </div>
        </div>
        {!editingName ? (
          <>
            <div className="mobile-profile-name">{guestName || 'Guest'}</div>
            <div className="mobile-profile-email" style={{ color: '#7c83a8' }}>
              {guestName ? 'Guest user' : 'No account'}
            </div>
          </>
        ) : (
          <div className="profile-name-edit">
            <input
              className="profile-name-input"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveGuestName()}
              placeholder="Enter your name"
              autoFocus
              maxLength={30}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="profile-save-btn" onClick={saveGuestName}>Save</button>
              <button className="profile-cancel-btn" onClick={() => { setEditingName(false); setNameInput(guestName); }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      <div className="mobile-profile-menu">
        {/* Set / Edit guest name */}
        <button className="mobile-profile-menu-item" onClick={() => { setNameInput(guestName); setEditingName(true); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6f97ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/>
          </svg>
          {guestName ? 'Change Name' : 'Set Guest Name'}
        </button>

        {/* Divider */}
        <div className="profile-menu-divider" />

        {/* Sign in with Google */}
        <button className="mobile-profile-menu-item" onClick={() => signIn('google', { callbackUrl: window.location.href })}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </button>
      </div>

      <div className="mobile-profile-footer">MyTalk v1.0 &middot; Built with Next.js</div>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback="Loading">
      <HomeContent />
    </Suspense>
  );
}
