'use client';

import React from 'react';
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
  VideoConference,
  useParticipants,
} from '@livekit/components-react';
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
    if (connectionDetailsData.adminToken) {
      sessionStorage.setItem('adminToken', connectionDetailsData.adminToken);
    }
    setConnectionDetails(connectionDetailsData);
  }, [props.roomName, props.region, props.role]);

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
          <VideoConference
            chatMessageFormatter={formatChatMessageLinks}
            SettingsComponent={SHOW_SETTINGS_MENU ? SettingsMenu : undefined}
          />
          <ParticipantsSidebar />
          <ParticipantProfileImages />
          <DebugMode />
          <RecordingIndicator />
        </PinnedProvider>
      </RoomContext.Provider>
    </div>
  );
}

/** Replaces default placeholder avatars with Google profile images and reorders tiles */
function ParticipantProfileImages() {
  const participants = useParticipants();
  const { pinnedIds } = usePinned();
  const room = React.useContext(RoomContext);
  const localName = room?.localParticipant?.name || room?.localParticipant?.identity || '';

  // Build maps of participant name -> imageUrl and name -> identity
  const imageMap = React.useMemo(() => {
    const map = new Map<string, string>();
    participants.forEach((p) => {
      try {
        const meta = JSON.parse(p.metadata || '{}');
        if (meta.imageUrl) {
          map.set(p.name || p.identity, meta.imageUrl);
        }
      } catch {}
    });
    return map;
  }, [participants]);

  // Build a map of name -> sort priority (lower = first)
  const sortMap = React.useMemo(() => {
    const map = new Map<string, number>();
    participants.forEach((p) => {
      const name = p.name || p.identity;
      const pinned = pinnedIds.has(p.identity);
      const speaking = p.isSpeaking;
      // Pinned: 0, Speaking: 1, Others: 2
      let priority = 2;
      if (pinned) priority = 0;
      else if (speaking) priority = 1;
      map.set(name, priority);
    });
    return map;
  }, [participants, pinnedIds]);

  React.useEffect(() => {
    const injectAndReorder = () => {
      // 0. Hide local participant tile (shown as "You" thumbnail instead)
      const allTiles = document.querySelectorAll('.lk-participant-tile');
      allTiles.forEach((tile) => {
        const nameEl = tile.querySelector('.lk-participant-name');
        const name = nameEl?.textContent?.trim() || '';
        if (name === localName) {
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

      // 2. Reorder tiles: pinned first, then speaking, then rest
      const gridLayout = document.querySelector('.lk-grid-layout');
      if (!gridLayout) return;
      const tiles = Array.from(gridLayout.querySelectorAll(':scope > .lk-participant-tile'));
      if (tiles.length < 2) return;

      const sorted = [...tiles].sort((a, b) => {
        const nameA = a.querySelector('.lk-participant-name')?.textContent?.trim() || '';
        const nameB = b.querySelector('.lk-participant-name')?.textContent?.trim() || '';
        const priA = sortMap.get(nameA) ?? 2;
        const priB = sortMap.get(nameB) ?? 2;
        return priA - priB;
      });

      // Only reorder if order actually changed
      const currentOrder = tiles.map((t) => t.querySelector('.lk-participant-name')?.textContent?.trim());
      const newOrder = sorted.map((t) => t.querySelector('.lk-participant-name')?.textContent?.trim());
      if (JSON.stringify(currentOrder) !== JSON.stringify(newOrder)) {
        sorted.forEach((tile) => gridLayout.appendChild(tile));
      }
    };

    injectAndReorder();
    const interval = setInterval(injectAndReorder, 1000);
    return () => clearInterval(interval);
  }, [imageMap, sortMap, localName]);

  return null;
}
