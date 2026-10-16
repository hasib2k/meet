'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { decodePassphrase } from '@/lib/client-utils';
import { DebugMode } from '@/lib/Debug';
import { KeyboardShortcuts } from '@/lib/KeyboardShortcuts';
import { RecordingIndicator } from '@/lib/RecordingIndicator';
import { SettingsMenu } from '@/lib/SettingsMenu';
import { ConnectionDetails } from '@/lib/types';
import {
  formatChatMessageLinks,
  LocalUserChoices,
  RoomContext,
  useParticipants,
} from '@livekit/components-react';
import { CustomVideoConference } from '@/lib/CustomVideoConference';
import {
  ExternalE2EEKeyProvider,
  RoomOptions,
  VideoCodec,
  Room,
  DeviceUnsupportedError,
  RoomConnectOptions,
  RoomEvent,
} from 'livekit-client';
import { useRouter } from 'next/navigation';
import { useSetupE2EE } from '@/lib/useSetupE2EE';
import { AudioOnlyPreJoin } from '@/lib/AudioOnlyPreJoin';
import { ParticipantsSidebar } from '@/lib/ParticipantsSidebar';
import { PinnedProvider, usePinned } from '@/lib/PinnedContext';
import { saveMeeting } from '@/lib/meetingHistory';
import { RaiseHandButton } from '@/lib/RaiseHandButton';
import { HostLeaveButton } from '@/lib/HostLeaveButton';

const CONN_DETAILS_ENDPOINT =
  process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? '/api/connection-details';
const SHOW_SETTINGS_MENU = process.env.NEXT_PUBLIC_SHOW_SETTINGS_MENU == 'true';

export function PageClientImpl(props: {
  roomName: string;
  serverUrl?: string;
  region?: string;
  hq: boolean;
  codec: VideoCodec;
  singlePeerConnection: boolean;
  role: string;
}) {
  const [preJoinChoices, setPreJoinChoices] = React.useState<LocalUserChoices | undefined>(
    undefined,
  );
  const [connectionDetails, setConnectionDetails] = React.useState<ConnectionDetails | undefined>(
    undefined,
  );
  const [roomExpired, setRoomExpired] = React.useState(false);

  React.useEffect(() => {
    if (props.serverUrl) {
      new Room().prepareConnection(props.serverUrl);
    }
  }, [props.serverUrl]);

  const handlePreJoinSubmit = React.useCallback(async (values: LocalUserChoices & { imageUrl?: string }) => {
    setPreJoinChoices(values);
    const url = new URL(CONN_DETAILS_ENDPOINT, window.location.origin);
    url.searchParams.append('roomName', props.roomName);
    url.searchParams.append('participantName', values.username);
    url.searchParams.append('role', props.role);
    if (values.imageUrl) {
      url.searchParams.append('imageUrl', values.imageUrl);
    }
    if (props.region) {
      url.searchParams.append('region', props.region);
    }
    const connectionDetailsResp = await fetch(url.toString());
    const connectionDetailsData = await connectionDetailsResp.json();
    if (connectionDetailsData.error === 'room_ended') {
      setRoomExpired(true);
      return;
    }
    if (connectionDetailsData.adminToken) {
      sessionStorage.setItem('adminToken', connectionDetailsData.adminToken);
    }
    setConnectionDetails(connectionDetailsData);
    saveMeeting(props.roomName, props.role);
  }, [props.roomName, props.region, props.role]);

  if (roomExpired) {
    return (
      <main data-lk-theme="default" style={{ height: '100%' }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: '1.25rem',
          padding: '2rem',
          textAlign: 'center',
        }}>
          <div style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'rgba(255,100,100,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="#ff6b6b">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
          </div>
          <h2 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 500, margin: 0 }}>
            Meeting Expired
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1rem', margin: 0, maxWidth: 400 }}>
            This meeting has ended and is no longer available. Please contact the admin for a new meeting room.
          </p>
          <button
            onClick={() => window.location.href = '/'}
            style={{
              marginTop: '0.5rem',
              padding: '0.75rem 2rem',
              background: 'linear-gradient(135deg, #5b8dee 0%, #4a7dd4 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '2rem',
              fontSize: '0.95rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Go to Home
          </button>
        </div>
      </main>
    );
  }

  return (
    <main data-lk-theme="default" style={{ height: '100%' }}>
      {connectionDetails === undefined || preJoinChoices === undefined ? (
        <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
          <AudioOnlyPreJoin
            onSubmit={handlePreJoinSubmit}
            role={props.role}
          />
        </div>
      ) : (
        <AudioConferenceComponent
          connectionDetails={connectionDetails}
          userChoices={preJoinChoices}
          options={{
            singlePeerConnection: props.singlePeerConnection,
          }}
          role={props.role}
        />
      )}
    </main>
  );
}

function AudioConferenceComponent(props: {
  userChoices: LocalUserChoices;
  connectionDetails: ConnectionDetails;
  options: {
    singlePeerConnection: boolean;
  };
  role: string;
}) {
  const keyProvider = new ExternalE2EEKeyProvider();
  const { worker, e2eePassphrase } = useSetupE2EE();
  const e2eeEnabled = !!(e2eePassphrase && worker);

  const [e2eeSetupComplete, setE2eeSetupComplete] = React.useState(false);

  const roomOptions = React.useMemo((): RoomOptions => {
    return {
      videoCaptureDefaults: undefined,
      publishDefaults: {
        dtx: false,
        red: !e2eeEnabled,
      },
      audioCaptureDefaults: {
        deviceId: props.userChoices.audioDeviceId ?? undefined,
      },
      adaptiveStream: false,
      dynacast: false,
      e2ee: keyProvider && worker && e2eeEnabled ? { keyProvider, worker } : undefined,
      singlePeerConnection: props.options.singlePeerConnection,
    };
  }, [props.userChoices]);

  const room = React.useMemo(() => new Room(roomOptions), []);

  React.useEffect(() => {
    if (e2eeEnabled) {
      keyProvider
        .setKey(decodePassphrase(e2eePassphrase))
        .then(() => {
          room.setE2EEEnabled(true).catch((e) => {
            if (e instanceof DeviceUnsupportedError) {
              alert(
                `You're trying to join an encrypted meeting, but your browser does not support it.`,
              );
              console.error(e);
            } else {
              throw e;
            }
          });
        })
        .then(() => setE2eeSetupComplete(true));
    } else {
      setE2eeSetupComplete(true);
    }
  }, [e2eeEnabled, room, e2eePassphrase]);

  const connectOptions = React.useMemo((): RoomConnectOptions => {
    return {
      autoSubscribe: true,
    };
  }, []);

  React.useEffect(() => {
    room.on(RoomEvent.Disconnected, handleOnLeave);
    room.on(RoomEvent.EncryptionError, handleEncryptionError);
    room.on(RoomEvent.MediaDevicesError, handleError);

    if (e2eeSetupComplete) {
      room
        .connect(
          props.connectionDetails.serverUrl,
          props.connectionDetails.participantToken,
          connectOptions,
        )
        .catch((error) => {
          handleError(error);
        });

      const canSpeak = props.role === 'host' || props.role === 'moderator';
      if (canSpeak && props.userChoices.audioEnabled) {
        room.localParticipant.setMicrophoneEnabled(true).catch((error) => {
          handleError(error);
        });
      }
      room.localParticipant.setCameraEnabled(false).catch(() => {});
    }
    return () => {
      room.off(RoomEvent.Disconnected, handleOnLeave);
      room.off(RoomEvent.EncryptionError, handleEncryptionError);
      room.off(RoomEvent.MediaDevicesError, handleError);
    };
  }, [e2eeSetupComplete, room, props.connectionDetails, props.userChoices, props.role]);

  const router = useRouter();
  const handleOnLeave = React.useCallback(() => router.push('/'), [router]);
  const handleError = React.useCallback((error: Error) => {
    console.error(error);
    alert(`Error: ${error.message}`);
  }, []);
  const handleEncryptionError = React.useCallback((error: Error) => {
    console.error(error);
    alert(`Encryption error: ${error.message}`);
  }, []);

  return (
    <div className="lk-room-container">
      <RoomContext.Provider value={room}>
        <PinnedProvider>
          <KeyboardShortcuts />
          <CustomVideoConference
            chatMessageFormatter={formatChatMessageLinks}
            SettingsComponent={SettingsMenu}
          />
          <RaiseHandButton />
          <HostLeaveButton />
          <AdminTokenWatcher />
          <ParticipantsSidebar />
          <ParticipantProfileImages />
          <KeepAlive />
          <DebugMode />
          <RecordingIndicator />
        </PinnedProvider>
      </RoomContext.Provider>
    </div>
  );
}

/** Watches for host promotion and fetches adminToken automatically */
function AdminTokenWatcher() {
  const room = React.useContext(RoomContext);

  React.useEffect(() => {
    if (!room) return;

    const checkHostPromotion = () => {
      try {
        const meta = JSON.parse(room.localParticipant.metadata || '{}');
        if (meta.role === 'host' && !sessionStorage.getItem('adminToken')) {
          // Promoted to host but no adminToken — fetch one
          fetch(`/api/admin-token?roomName=${encodeURIComponent(room.name)}&identity=${encodeURIComponent(room.localParticipant.identity)}`)
            .then((res) => res.ok ? res.json() : null)
            .then((data) => {
              if (data?.adminToken) {
                sessionStorage.setItem('adminToken', data.adminToken);
              }
            })
            .catch(() => {});
        }
      } catch {}
    };

    // Check on metadata change
    room.localParticipant.on('participantMetadataChanged', checkHostPromotion);
    // Also check immediately (in case already promoted)
    checkHostPromotion();

    return () => {
      room.localParticipant.off('participantMetadataChanged', checkHostPromotion);
    };
  }, [room]);

  return null;
}

/** Replaces default placeholder avatars with Google profile images + 3-dot menu on tiles */
function ParticipantProfileImages() {
  const participants = useParticipants();
  const room = React.useContext(RoomContext);
  const localName = room?.localParticipant?.name || room?.localParticipant?.identity || '';
  const { pinnedIds, togglePin, isPinned } = usePinned();

  // Tile 3-dot menu state
  const [tileMenuId, setTileMenuId] = React.useState<string | null>(null);
  const [tileMenuPos, setTileMenuPos] = React.useState({ x: 0, y: 0 });

  // Check if local user is host
  let localRole = 'listener';
  try { localRole = JSON.parse(room?.localParticipant?.metadata || '{}').role || 'listener'; } catch {}
  const isHost = localRole === 'host';

  // Build maps of participant name -> imageUrl and name -> handRaised
  const { imageMap, handRaisedMap } = React.useMemo(() => {
    const imgMap = new Map<string, string>();
    const handMap = new Map<string, boolean>();
    participants.forEach((p) => {
      try {
        const meta = JSON.parse(p.metadata || '{}');
        const name = p.name || p.identity;
        if (meta.imageUrl) imgMap.set(name, meta.imageUrl);
        if (meta.isHandRaised) handMap.set(name, true);
      } catch {}
    });
    return { imageMap: imgMap, handRaisedMap: handMap };
  }, [participants]);

  // Build participant info map for tile menus
  const participantInfoMap = React.useMemo(() => {
    const map = new Map<string, { identity: string; name: string; role: string; canPublish: boolean; isHandRaised: boolean }>();
    participants.forEach((p) => {
      let role = 'listener';
      let isHandRaised = false;
      try {
        const meta = JSON.parse(p.metadata || '{}');
        role = meta.role || 'listener';
        isHandRaised = !!meta.isHandRaised;
      } catch {}
      const name = p.name || p.identity;
      map.set(name, {
        identity: p.identity,
        name,
        role,
        canPublish: p.permissions?.canPublish ?? false,
        isHandRaised,
      });
    });
    return map;
  }, [participants]);

  // Close tile menu on outside click
  React.useEffect(() => {
    if (!tileMenuId) return;
    const close = () => setTileMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [tileMenuId]);

  // Admin action for tile menu
  const doTileAction = React.useCallback(async (action: string, identity: string) => {
    setTileMenuId(null);
    const adminToken = sessionStorage.getItem('adminToken') || '';
    try {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ action, roomName: room!.name, identity }),
      });
    } catch {}
  }, [room]);

  const lowerHandFromTile = React.useCallback(async (identity: string) => {
    setTileMenuId(null);
    try {
      await fetch('/api/raise-hand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: room!.name, identity, raised: false }),
      });
    } catch {}
  }, [room]);

  // Stable ref for the setTileMenuId/Pos so DOM handlers don't go stale
  const menuHandlerRef = React.useRef({ setTileMenuId, setTileMenuPos, participantInfoMap });
  menuHandlerRef.current = { setTileMenuId, setTileMenuPos, participantInfoMap };

  React.useEffect(() => {
    const injectAndReorder = () => {
      // 0. Hide local participant tile (shown as floating "You" thumbnail instead)
      const allTiles = document.querySelectorAll('.lk-participant-tile');
      const hasOthers = participants.length > 1;
      allTiles.forEach((tile) => {
        const nameEl = tile.querySelector('.lk-participant-name');
        const name = nameEl?.textContent?.trim() || '';
        if (hasOthers && name === localName) {
          (tile as HTMLElement).style.display = 'none';
        } else {
          (tile as HTMLElement).style.display = '';
        }
      });

      // 1. Inject profile images
      const placeholders = document.querySelectorAll('.lk-participant-placeholder');
      placeholders.forEach((placeholder) => {
        if (placeholder.querySelector('.profile-img-overlay')) return;
        const tile = placeholder.closest('.lk-participant-tile');
        if (!tile) return;
        const nameEl = tile.querySelector('.lk-participant-name');
        if (!nameEl) return;
        const name = nameEl.textContent?.trim() || '';
        const imageUrl = imageMap.get(name);
        if (!imageUrl) return;
        const el = placeholder as HTMLElement;
        el.innerHTML = '';
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = '';
        img.className = 'profile-img-overlay';
        img.referrerPolicy = 'no-referrer';
        img.style.cssText = 'width:200px;height:200px;object-fit:cover;border-radius:50%;';
        el.style.cssText = 'display:flex;align-items:center;justify-content:center;';
        el.appendChild(img);
      });

      // 2. Inject/remove hand raised indicators on tiles
      allTiles.forEach((tile) => {
        const nameEl = tile.querySelector('.lk-participant-name');
        const name = nameEl?.textContent?.trim() || '';
        const existing = tile.querySelector('.hand-raised-indicator');
        if (handRaisedMap.has(name)) {
          if (!existing) {
            const span = document.createElement('span');
            span.className = 'hand-raised-indicator';
            span.textContent = '\u270B';
            (tile as HTMLElement).style.position = 'relative';
            tile.appendChild(span);
          }
        } else if (existing) {
          existing.remove();
        }
      });

      // 3. Inject 3-dot buttons on tiles (host only, not on own tile)
      if (isHost) {
        allTiles.forEach((tile) => {
          const nameEl = tile.querySelector('.lk-participant-name');
          const name = nameEl?.textContent?.trim() || '';
          if (name === localName) return;

          let dotBtn = tile.querySelector('.tile-three-dot-btn') as HTMLButtonElement;
          if (!dotBtn) {
            dotBtn = document.createElement('button');
            dotBtn.className = 'tile-three-dot-btn';
            dotBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';
            (tile as HTMLElement).style.position = 'relative';
            tile.appendChild(dotBtn);
          }

          dotBtn.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            const { participantInfoMap: infoMap, setTileMenuId: setId, setTileMenuPos: setPos } = menuHandlerRef.current;
            const info = infoMap.get(name);
            if (info) {
              const rect = dotBtn.getBoundingClientRect();
              setPos({ x: rect.left, y: rect.bottom + 4 });
              setId((prev: string | null) => prev === info.identity ? null : info.identity);
            }
          };
        });
      }
    };

    injectAndReorder();
    const interval = setInterval(injectAndReorder, 1000);
    return () => clearInterval(interval);
  }, [imageMap, handRaisedMap, localName, participants.length, isHost]);

  // Floating "You" thumbnail
  const localImageUrl = imageMap.get(localName);
  const hasOthers = participants.length > 1;

  // Find the participant info for the open tile menu
  const menuParticipant = React.useMemo(() => {
    if (!tileMenuId) return null;
    for (const info of participantInfoMap.values()) {
      if (info.identity === tileMenuId) {
        return { ...info, isPinned: isPinned(info.identity) };
      }
    }
    return null;
  }, [tileMenuId, participantInfoMap, pinnedIds]);

  return (
    <>
      {/* Floating "You" thumbnail */}
      {hasOthers && (
        <div className="you-thumbnail">
          {localImageUrl ? (
            <img
              src={localImageUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="you-thumbnail-img"
            />
          ) : (
            <div className="you-thumbnail-placeholder">
              {localName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="you-thumbnail-label">You</span>
        </div>
      )}

      {/* Tile 3-dot dropdown menu (portal) */}
      {tileMenuId && menuParticipant && createPortal(
        <div
          className="tile-menu-dropdown"
          style={{ position: 'fixed', left: tileMenuPos.x, top: tileMenuPos.y, zIndex: 200 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Pin / Unpin */}
          <button className="tile-menu-item" onClick={() => { togglePin(menuParticipant.identity); setTileMenuId(null); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill={menuParticipant.isPinned ? '#5b8dee' : 'currentColor'}>
              <path d="M14 4v5c0 1.12.37 2.16 1 3H9c.65-.86 1-1.9 1-3V4h4zm3-2H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3V4h1c.55 0 1-.45 1-1s-.45-1-1-1z" />
            </svg>
            {menuParticipant.isPinned ? 'Unpin' : 'Pin'}
          </button>

          {/* Lower Hand */}
          {menuParticipant.isHandRaised && (
            <button className="tile-menu-item" style={{ color: '#e8a85d' }} onClick={() => lowerHandFromTile(menuParticipant.identity)}>
              <span style={{ fontSize: '0.8rem' }}>✋</span>
              Lower Hand
            </button>
          )}

          {/* Grant Speak / Mute */}
          {!menuParticipant.canPublish ? (
            <button className="tile-menu-item" style={{ color: '#5bc88d' }} onClick={() => doTileAction('grant_speak', menuParticipant.identity)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
              Grant Speak
            </button>
          ) : (
            <button className="tile-menu-item" style={{ color: '#e8a85d' }} onClick={() => doTileAction('revoke_speak', menuParticipant.identity)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
              </svg>
              Mute
            </button>
          )}

          {/* Make Host */}
          {menuParticipant.role !== 'host' && (
            <button className="tile-menu-item" style={{ color: '#5b8dee' }} onClick={() => {
              if (confirm(`Make ${menuParticipant.name} a Host?`)) doTileAction('make_host', menuParticipant.identity);
              else setTileMenuId(null);
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
              </svg>
              Make Host
            </button>
          )}

          <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '0.25rem 0' }} />

          {/* Remove */}
          <button className="tile-menu-item" style={{ color: '#ff6b6b' }} onClick={() => {
            if (confirm(`Remove ${menuParticipant.name}?`)) doTileAction('remove_participant', menuParticipant.identity);
            else setTileMenuId(null);
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15 3H9V1h6v2zm-1 11V8h-4v6H7l5 5 5-5h-3zm5-9h-1V3c0-.55-.45-1-1-1H7c-.55 0-1 .45-1 1v2H5c-.55 0-1 .45-1 1s.45 1 1 1h14c.55 0 1-.45 1-1s-.45-1-1-1z" />
            </svg>
            Remove
          </button>
        </div>,
        document.body
      )}
    </>
  );
}

/**
 * Keeps WebRTC audio alive when screen is off / locked.
 * Uses Screen Wake Lock API + silent audio oscillator as fallback
 * to prevent the browser from suspending the tab.
 */
function KeepAlive() {
  React.useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;
    let audioCtx: AudioContext | null = null;

    // 1. Screen Wake Lock API — prevents screen from turning off
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as Navigator & { wakeLock: { request: (type: string) => Promise<WakeLockSentinel> } }).wakeLock.request('screen');
        }
      } catch {}
    };

    requestWakeLock();

    // Re-acquire wake lock when page becomes visible again
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // 2. Silent audio oscillator — keeps audio pipeline alive on mobile
    try {
      audioCtx = new AudioContext();
      const oscillator = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      gain.gain.value = 0.001; // near-silent
      oscillator.connect(gain);
      gain.connect(audioCtx.destination);
      oscillator.start();
    } catch {}

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      wakeLock?.release().catch(() => {});
      audioCtx?.close().catch(() => {});
    };
  }, []);

  return null;
}

interface WakeLockSentinel {
  release: () => Promise<void>;
  addEventListener: (type: string, listener: () => void) => void;
}
