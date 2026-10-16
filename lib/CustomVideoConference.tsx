'use client';

/**
 * Custom VideoConference component — identical to LiveKit's default VideoConference
 * but uses CustomGridLayout with lowered minWidth thresholds so mobile devices
 * can display 8 tiles per page instead of just 1.
 */

import type { WidgetState } from '@livekit/components-react';
import { RoomEvent, Track } from 'livekit-client';
import * as React from 'react';
import {
  CarouselLayout,
  ConnectionStateToast,
  FocusLayout,
  FocusLayoutContainer,
  LayoutContextProvider,
  ParticipantTile,
  RoomAudioRenderer,
  ControlBar,
  useCreateLayoutContext,
  usePinnedTracks,
  useTracks,
  isTrackReference,
  useRoomContext,
  useMaybeLayoutContext,
} from '@livekit/components-react';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { CustomGridLayout } from './CustomGridLayout';
import { CustomChat } from './CustomChat';

export interface CustomVideoConferenceProps extends React.HTMLAttributes<HTMLDivElement> {
  SettingsComponent?: React.ComponentType;
}

export function CustomVideoConference({
  SettingsComponent,
  ...props
}: CustomVideoConferenceProps) {
  const [widgetState, setWidgetState] = React.useState<WidgetState>({
    showChat: false,
    unreadMessages: 0,
    showSettings: false,
  });
  const lastAutoFocusedScreenShareTrack = React.useRef<TrackReferenceOrPlaceholder | null>(null);

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { updateOnlyOn: [RoomEvent.ActiveSpeakersChanged], onlySubscribed: false },
  );

  const widgetUpdate = (state: WidgetState) => {
    setWidgetState(state);
  };

  const layoutContext = useCreateLayoutContext();

  const screenShareTracks = tracks
    .filter(isTrackReference)
    .filter((track) => track.publication.source === Track.Source.ScreenShare);

  const focusTrack = usePinnedTracks(layoutContext)?.[0];
  const carouselTracks = tracks.filter(
    (track) => !(focusTrack && track.participant?.identity === focusTrack.participant?.identity && track.source === focusTrack.source),
  );

  React.useEffect(() => {
    if (
      screenShareTracks.some((track) => track.publication.isSubscribed) &&
      lastAutoFocusedScreenShareTrack.current === null
    ) {
      layoutContext.pin.dispatch?.({ msg: 'set_pin', trackReference: screenShareTracks[0] });
      lastAutoFocusedScreenShareTrack.current = screenShareTracks[0];
    } else if (
      lastAutoFocusedScreenShareTrack.current &&
      !screenShareTracks.some(
        (track) =>
          track.publication.trackSid ===
          lastAutoFocusedScreenShareTrack.current?.publication?.trackSid,
      )
    ) {
      layoutContext.pin.dispatch?.({ msg: 'clear_pin' });
      lastAutoFocusedScreenShareTrack.current = null;
    }
  }, [
    screenShareTracks
      .map((ref) => `${ref.publication.trackSid}_${ref.publication.isSubscribed}`)
      .join(),
    focusTrack,
    tracks,
  ]);

  return (
    <div className="lk-video-conference" {...props}>
      <LayoutContextProvider
        value={layoutContext}
        onWidgetChange={widgetUpdate}
      >
        <MeetingTitleBar />
        <div className="lk-video-conference-inner">
          {!focusTrack ? (
            <div className="lk-grid-layout-wrapper">
              <CustomGridLayout tracks={tracks}>
                <ParticipantTile />
              </CustomGridLayout>
            </div>
          ) : (
            <div className="lk-focus-layout-wrapper">
              <FocusLayoutContainer>
                <CarouselLayout tracks={carouselTracks}>
                  <ParticipantTile />
                </CarouselLayout>
                {focusTrack && <FocusLayout trackRef={focusTrack} />}
              </FocusLayoutContainer>
            </div>
          )}
          <ControlBar variation="minimal" controls={{ chat: true, settings: false, camera: false, screenShare: false, leave: false }} />
        </div>
        <CustomChat style={{ display: widgetState.showChat ? 'flex' : 'none' }} />
        {SettingsComponent && (
          <div
            className="lk-settings-menu-modal"
            style={{ display: widgetState.showSettings ? 'block' : 'none' }}
          >
            <SettingsComponent />
          </div>
        )}
      </LayoutContextProvider>
      <RoomAudioRenderer />
      <ConnectionStateToast />
    </div>
  );
}

/** Displays the meeting title from room metadata */
function MeetingTitleBar() {
  const room = useRoomContext();
  const layoutContext = useMaybeLayoutContext();
  const [title, setTitle] = React.useState('');

  React.useEffect(() => {
    const parseTitle = (metadata?: string) => {
      try {
        const meta = JSON.parse((metadata ?? room.metadata) || '{}');
        setTitle(meta.title || '');
      } catch {
        setTitle('');
      }
    };

    // Parse on mount (may already be connected)
    parseTitle();

    // Listen for metadata changes
    room.on(RoomEvent.RoomMetadataChanged, parseTitle);

    // Also parse when room connects (metadata arrives after connect)
    const onConnected = () => parseTitle();
    room.on(RoomEvent.Connected, onConnected);

    // Poll briefly for metadata arrival (backup for race conditions)
    const interval = setInterval(() => {
      if (room.metadata) {
        parseTitle();
        clearInterval(interval);
      }
    }, 500);
    const timeout = setTimeout(() => clearInterval(interval), 10000);

    return () => {
      room.off(RoomEvent.RoomMetadataChanged, parseTitle);
      room.off(RoomEvent.Connected, onConnected);
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [room]);

  const roomCode = room.name || '';
  const titleRef = React.useRef<HTMLDivElement>(null);
  const displayTitle = title || 'Meeting';

  // Check overflow and apply marquee
  React.useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    // Reset any previous marquee
    const existingSpan = el.querySelector('.marquee-scroll');
    if (existingSpan) {
      el.textContent = displayTitle;
    }
    // Check overflow after a frame
    requestAnimationFrame(() => {
      if (el.scrollWidth > el.clientWidth + 2) {
        el.textContent = '';
        const span = document.createElement('span');
        span.className = 'marquee-scroll';
        span.textContent = displayTitle + '\u00A0\u00A0\u00A0\u2022\u00A0\u00A0\u00A0' + displayTitle + '\u00A0\u00A0\u00A0\u2022\u00A0\u00A0\u00A0';
        el.appendChild(span);
      }
    });
  }, [displayTitle]);

  return (
    <div className="meeting-title-bar">
      <div className="meeting-title-left">
        <div className="meeting-title-text" ref={titleRef}>{displayTitle}</div>
        <div className="meeting-title-meta">
          <div className="meeting-live-dot" />
          Live · {roomCode}
        </div>
      </div>
      <button
        className="meeting-settings-btn"
        aria-label="Settings"
        onClick={() => {
          layoutContext?.widget.dispatch?.({ msg: 'toggle_settings' });
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a9b0d0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"></path></svg>
      </button>
    </div>
  );
}
