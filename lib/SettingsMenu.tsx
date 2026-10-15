'use client';
import * as React from 'react';
import { Track } from 'livekit-client';
import {
  useMaybeLayoutContext,
  MediaDeviceMenu,
  TrackToggle,
  useRoomContext,
  useIsRecording,
  useParticipants,
} from '@livekit/components-react';
import styles from '../styles/SettingsMenu.module.css';
import { MicrophoneSettings } from './MicrophoneSettings';

export interface SettingsMenuProps extends React.HTMLAttributes<HTMLDivElement> {}

export function SettingsMenu(props: SettingsMenuProps) {
  const layoutContext = useMaybeLayoutContext();
  const room = useRoomContext();
  const recordingEndpoint = process.env.NEXT_PUBLIC_LK_RECORD_ENDPOINT;
  const participants = useParticipants();

  // Check if current user is host
  let localRole = 'listener';
  try {
    const meta = JSON.parse(room.localParticipant.metadata || '{}');
    localRole = meta.role || 'listener';
  } catch {}
  const isHost = localRole === 'host';

  const settings = React.useMemo(() => {
    return {
      media: { microphone: true, label: 'Media Devices', speaker: true },
      participants: { label: 'Participants' },
      ...(recordingEndpoint ? { recording: { label: 'Recording' } } : {}),
    };
  }, [isHost, recordingEndpoint]);

  const tabs = React.useMemo(
    () => Object.keys(settings).filter((t) => t !== undefined) as Array<keyof typeof settings>,
    [settings],
  );
  const [activeTab, setActiveTab] = React.useState(tabs[0]);

  const isRecording = useIsRecording();
  const [initialRecStatus, setInitialRecStatus] = React.useState(isRecording);
  const [processingRecRequest, setProcessingRecRequest] = React.useState(false);
  const [actionMsg, setActionMsg] = React.useState('');
  const [loadingAction, setLoadingAction] = React.useState<string | null>(null);
  const [linkCopied, setLinkCopied] = React.useState(false);

  React.useEffect(() => {
    if (initialRecStatus !== isRecording) {
      setProcessingRecRequest(false);
    }
  }, [isRecording, initialRecStatus]);

  const toggleRoomRecording = async () => {
    if (!recordingEndpoint) {
      throw TypeError('No recording endpoint specified');
    }
    if (room.isE2EEEnabled) {
      throw Error('Recording of encrypted meetings is currently not supported');
    }
    setProcessingRecRequest(true);
    setInitialRecStatus(isRecording);
    let response: Response;
    if (isRecording) {
      response = await fetch(recordingEndpoint + `/stop?roomName=${room.name}`);
    } else {
      response = await fetch(recordingEndpoint + `/start?roomName=${room.name}`);
    }
    if (!response.ok) {
      console.error('Error handling recording request:', response.status, response.statusText);
      setProcessingRecRequest(false);
    }
  };

  const doParticipantAction = async (action: string, identity: string) => {
    setLoadingAction(identity);
    try {
      const adminToken = sessionStorage.getItem('adminToken') || '';
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
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

  // Build participant list for host controls
  const otherParticipants = participants
    .filter((p) => p.identity !== room.localParticipant.identity)
    .map((p) => {
      let role = 'listener';
      let imageUrl = '';
      try {
        const meta = JSON.parse(p.metadata || '{}');
        role = meta.role || 'listener';
        imageUrl = meta.imageUrl || '';
      } catch {}
      return {
        identity: p.identity,
        name: p.name || p.identity,
        role,
        imageUrl,
        canPublish: p.permissions?.canPublish ?? false,
      };
    });

  return (
    <div className="settings-menu" style={{ width: '100%', position: 'relative' }} {...props}>
      <div className={styles.tabs}>
        {tabs.map(
          (tab) =>
            settings[tab] && (
              <button
                className={`${styles.tab} lk-button`}
                key={tab}
                onClick={() => setActiveTab(tab)}
                aria-pressed={tab === activeTab}
              >
                {/* @ts-ignore */}
                {settings[tab].label}
              </button>
            ),
        )}
      </div>
      <div className="tab-content">
        {activeTab === 'media' && (
          <>
            <h3>Microphone</h3>
            <section>
              <MicrophoneSettings />
            </section>
            <h3>Speaker & Headphones</h3>
            <section className="lk-button-group">
              <span className="lk-button">Audio Output</span>
              <div className="lk-button-group-menu">
                <MediaDeviceMenu kind="audiooutput"></MediaDeviceMenu>
              </div>
            </section>
          </>
        )}

        {activeTab === 'participants' && (
          <>
            <h3>Participants ({participants.length})</h3>
            {isHost && (
              <button
                className="lk-button"
                onClick={() => {
                  const meetingUrl = `${window.location.origin}/rooms/${room.name}`;
                  navigator.clipboard.writeText(meetingUrl).then(() => {
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 2000);
                  });
                }}
                style={{
                  fontSize: '0.8rem',
                  padding: '0.4rem 0.75rem',
                  marginBottom: '0.5rem',
                  background: linkCopied ? 'rgba(91,200,141,0.15)' : 'rgba(91,141,238,0.15)',
                  color: linkCopied ? '#5bc88d' : '#5b8dee',
                  border: `1px solid ${linkCopied ? 'rgba(91,200,141,0.25)' : 'rgba(91,141,238,0.25)'}`,
                  width: '100%',
                }}
              >
                {linkCopied ? 'Link Copied!' : 'Copy Meeting Link'}
              </button>
            )}
            {actionMsg && (
              <p style={{ color: '#5bc88d', fontSize: '0.85rem', margin: '0.25rem 0' }}>
                {actionMsg}
              </p>
            )}

            {/* You */}
            <section style={pStyles.row}>
              <ParticipantAvatar metadata={room.localParticipant.metadata} name={room.localParticipant.name || room.localParticipant.identity} />
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 500 }}>
                  {room.localParticipant.name || room.localParticipant.identity}
                </span>
                <span style={pStyles.hostBadge}> — {localRole === 'host' ? 'Host' : localRole === 'moderator' ? 'Moderator' : 'Listener'} (You)</span>
              </div>
            </section>

            {/* Other participants */}
            {otherParticipants.length === 0 && (
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
                No other participants yet
              </p>
            )}
            {otherParticipants.map((p) => (
              <section key={p.identity} style={pStyles.row}>
                <ParticipantAvatar imageUrl={p.imageUrl} name={p.name} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: getRoleColor(p.role), marginTop: '0.125rem' }}>
                    {p.canPublish ? '🎙 Can speak' : '🔇 Listener'}
                    {p.role === 'moderator' && ' (Moderator)'}
                  </div>
                </div>
                {isHost && (
                  <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                    {!p.canPublish ? (
                      <button
                        className="lk-button"
                        onClick={() => doParticipantAction('grant_speak', p.identity)}
                        disabled={loadingAction === p.identity}
                        style={pStyles.grantBtn}
                      >
                        Grant Speak
                      </button>
                    ) : (
                      <button
                        className="lk-button"
                        onClick={() => doParticipantAction('revoke_speak', p.identity)}
                        disabled={loadingAction === p.identity}
                        style={pStyles.muteBtn}
                      >
                        Mute
                      </button>
                    )}
                    <button
                      className="lk-button"
                      onClick={() => {
                        if (confirm(`Remove ${p.name}?`)) {
                          doParticipantAction('remove_participant', p.identity);
                        }
                      }}
                      disabled={loadingAction === p.identity}
                      style={pStyles.removeBtn}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </section>
            ))}
          </>
        )}

        {activeTab === 'recording' && (
          <>
            <h3>Record Meeting</h3>
            <section>
              <p>
                {isRecording
                  ? 'Meeting is currently being recorded'
                  : 'No active recordings for this meeting'}
              </p>
              <button disabled={processingRecRequest} onClick={() => toggleRoomRecording()}>
                {isRecording ? 'Stop' : 'Start'} Recording
              </button>
            </section>
          </>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
        <button
          className={`lk-button`}
          onClick={() => layoutContext?.widget.dispatch?.({ msg: 'toggle_settings' })}
        >
          Close
        </button>
      </div>
    </div>
  );
}

function ParticipantAvatar(props: { metadata?: string | null; imageUrl?: string; name: string }) {
  let imgUrl = props.imageUrl || '';
  if (!imgUrl && props.metadata) {
    try {
      const meta = JSON.parse(props.metadata);
      imgUrl = meta.imageUrl || '';
    } catch {}
  }
  const initial = (props.name || '?').charAt(0).toUpperCase();

  return (
    <div style={pStyles.avatar}>
      {imgUrl ? (
        <img src={imgUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
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

const pStyles: Record<string, React.CSSProperties> = {
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #5b8dee, #4a7dd4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  hostBadge: {
    color: '#5b8dee',
    fontSize: '0.8rem',
    fontWeight: 600,
  },
  grantBtn: {
    fontSize: '0.75rem',
    padding: '0.25rem 0.5rem',
    background: 'rgba(91,200,141,0.15)',
    color: '#5bc88d',
    border: '1px solid rgba(91,200,141,0.25)',
  },
  muteBtn: {
    fontSize: '0.75rem',
    padding: '0.25rem 0.5rem',
    background: 'rgba(232,168,93,0.15)',
    color: '#e8a85d',
    border: '1px solid rgba(232,168,93,0.25)',
  },
  removeBtn: {
    fontSize: '0.75rem',
    padding: '0.25rem 0.5rem',
    background: 'rgba(220,50,50,0.1)',
    color: '#ff6b6b',
    border: '1px solid rgba(220,50,50,0.2)',
  },
};
