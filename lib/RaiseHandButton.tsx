'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRoomContext, useParticipants } from '@livekit/components-react';

export function RaiseHandButton() {
  const room = useRoomContext();
  const participants = useParticipants();
  const [isRaised, setIsRaised] = useState(false);
  const [loading, setLoading] = useState(false);
  const [controlBar, setControlBar] = useState<Element | null>(null);

  // Find control bar to portal into
  useEffect(() => {
    const findBar = () => {
      const bar = document.querySelector('.lk-control-bar');
      if (bar) setControlBar(bar);
    };
    findBar();
    const interval = setInterval(findBar, 500);
    return () => clearInterval(interval);
  }, []);

  // Sync local state from metadata
  useEffect(() => {
    const local = room.localParticipant;
    try {
      const meta = JSON.parse(local.metadata || '{}');
      setIsRaised(!!meta.isHandRaised);
    } catch {}
  }, [room.localParticipant.metadata]);

  const toggleHand = useCallback(async () => {
    if (loading) return;
    const newState = !isRaised;
    setLoading(true);
    setIsRaised(newState); // Optimistic update
    try {
      await fetch('/api/raise-hand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: room.name,
          identity: room.localParticipant.identity,
          raised: newState,
        }),
      });
    } catch {
      setIsRaised(!newState); // Revert on error
    } finally {
      setLoading(false);
    }
  }, [isRaised, loading, room]);

  // Count raised hands (for host notification)
  const raisedCount = participants.filter((p) => {
    try {
      const meta = JSON.parse(p.metadata || '{}');
      return meta.isHandRaised;
    } catch {
      return false;
    }
  }).length;

  const button = (
    <button
      className={`lk-button lk-raise-hand-toggle ${isRaised ? 'hand-raised' : ''}`}
      onClick={toggleHand}
      disabled={loading}
      title={isRaised ? 'Lower hand' : 'Raise hand'}
      aria-pressed={isRaised}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21 7c0-1.38-1.12-2.5-2.5-2.5-.17 0-.34.02-.5.05V4c0-1.38-1.12-2.5-2.5-2.5-.23 0-.46.03-.67.09C14.46.66 13.56 0 12.5 0c-1.23 0-2.25.89-2.46 2.06C9.87 2.02 9.69 2 9.5 2 8.12 2 7 3.12 7 4.5v5.89c-.34-.31-.76-.54-1.22-.66L5.01 9.52c-.83-.23-1.7.09-2.19.83-.38.57-.4 1.31-.15 1.95l3.37 8.44C6.88 22.65 8.78 24 10.95 24h5.3c2.8 0 5.13-2.07 5.53-4.85L23 11.5c0-1.38-1.12-2.5-2.5-2.5-.23 0-.46.03-.67.09.11-.31.17-.64.17-1V7zM5.66 11.42l.74.21c.29.08.52.28.66.55l.08.15V4.5C7.14 3.67 7.81 3 8.64 3H9.5c.83 0 1.5.67 1.5 1.5v0c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v2.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v1c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5l-1.22 7.65C21.48 16.91 19.57 19 17.25 19h-5.3c-1.3 0-2.44-.81-2.9-2.04L5.68 8.52c-.08-.2-.06-.42.05-.59.15-.22.47-.32.73-.25l-.8 3.74z" />
      </svg>
      {raisedCount > 0 && !isRaised && (
        <span className="lk-raise-hand-badge">{raisedCount}</span>
      )}
    </button>
  );

  return controlBar ? createPortal(button, controlBar) : button;
}
