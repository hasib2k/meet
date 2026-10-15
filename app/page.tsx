'use client';

import { useRouter } from 'next/navigation';
import React, { Suspense, useState } from 'react';
import { generateRoomId } from '@/lib/client-utils';

function HomeContent() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');

  const handleJoinMeeting = () => {
    if (roomCode.trim()) {
      router.push(`/rooms/${roomCode.trim()}`);
    }
  };

  const handleNewMeeting = () => {
    router.push(`/rooms/${generateRoomId()}`);
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
              <button className="btn-primary" onClick={handleNewMeeting}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
                New Meeting
              </button>
              <span className="divider-text">or</span>
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
        Powered by LiveKit &middot; Built with Next.js
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
