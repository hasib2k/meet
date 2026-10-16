'use client';

import { useRouter } from 'next/navigation';
import React, { Suspense, useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { getMeetingHistory, saveMeeting, removeMeeting, formatTimeAgo, type MeetingRecord } from '@/lib/meetingHistory';

function HomeContent() {
  const router = useRouter();
  const { data: session } = useSession();
  const [roomCode, setRoomCode] = useState('');
  const [history, setHistory] = useState<MeetingRecord[]>([]);

  useEffect(() => {
    setHistory(getMeetingHistory());
  }, []);

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && roomCode.trim()) {
      handleJoinMeeting();
    }
  };

  return (
    <>
      {/* Top bar */}
      <div className="topbar">
        <div className="topbar-logo">
          <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="40" height="40" rx="10" fill="#5b8dee" />
            <path
              d="M12 15C12 13.8954 12.8954 13 14 13H20C21.1046 13 22 13.8954 22 15V25C22 26.1046 21.1046 27 20 27H14C12.8954 27 12 26.1046 12 25V15Z"
              fill="white"
            />
            <path d="M24 17L28 14V26L24 23V17Z" fill="white" />
          </svg>
          <span>MyTalk</span>
        </div>
        {session?.user && (
          <div className="topbar-user">
            {session.user.image && (
              <img
                src={session.user.image}
                alt=""
                referrerPolicy="no-referrer"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.15)',
                }}
              />
            )}
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem' }}>
              {session.user.name}
            </span>
            <button
              onClick={() => signOut()}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.6)',
                padding: '0.375rem 0.75rem',
                borderRadius: '1.5rem',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>

      {/* Main content */}
      <main className="home-main">
        <div className="home-container">
          {/* Left section */}
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
            <div className="home-actions">
              <div className="join-input-group">
                <input
                  type="text"
                  placeholder="Enter a meeting code"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button
                  className="btn-join"
                  onClick={handleJoinMeeting}
                  disabled={!roomCode.trim()}
                >
                  Join
                </button>
              </div>
            </div>

            {/* Meeting History */}
            {history.length > 0 && (
              <div className="meeting-history">
                <h3 className="meeting-history-title">Recent Meetings</h3>
                <div className="meeting-history-list">
                  {history.map((m) => (
                    <div key={m.roomName} className="meeting-history-item">
                      <div className="meeting-history-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                      </div>
                      <div className="meeting-history-info" onClick={() => handleRejoin(m.roomName, m.role)}>
                        <span className="meeting-history-name">{m.roomName}</span>
                        <span className="meeting-history-meta">
                          {m.role === 'host' ? 'Hosted' : 'Joined'} · {formatTimeAgo(m.timestamp)}
                        </span>
                      </div>
                      <button
                        className="meeting-history-remove"
                        onClick={() => handleRemove(m.roomName)}
                        title="Remove"
                      >
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

          {/* Right section - illustration */}
          <div className="home-right">
            <div className="illustration-card">
              <div className="illustration-grid">
                <div className="illustration-avatar">
                  <svg viewBox="0 0 24 24" fill="white">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
                <div className="illustration-avatar">
                  <svg viewBox="0 0 24 24" fill="white">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
                <div className="illustration-avatar">
                  <svg viewBox="0 0 24 24" fill="white">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
                <div className="illustration-avatar">
                  <svg viewBox="0 0 24 24" fill="white">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
              </div>
              <p className="illustration-text">
                Audio-only meetings for up to 2,500 participants
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer>
        Developed by Hasib Talukder &middot; Built with Next.js
      </footer>
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
