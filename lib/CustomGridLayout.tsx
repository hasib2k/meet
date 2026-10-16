'use client';

import * as React from 'react';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-react';
import {
  useGridLayout,
  useSwipe,
  TrackLoop,
} from '@livekit/components-react';
import { usePinned } from './PinnedContext';

/**
 * Custom grid layouts with lowered minWidth thresholds so mobile devices
 * can display multiple tiles per page instead of being limited to 1x1.
 *
 * Default LiveKit thresholds: 2x2 at 560px, 4x4 at 960px
 * Custom thresholds: 2x2 at 200px, 2x4 at 300px (mobile gets 8 tiles)
 */
const CUSTOM_GRID_LAYOUTS = [
  { columns: 1, rows: 1 },
  { columns: 1, rows: 2, orientation: 'portrait' as const },
  { columns: 2, rows: 1, orientation: 'landscape' as const },
  { columns: 2, rows: 2, minWidth: 200 },
  { columns: 2, rows: 4, minWidth: 300 },
  { columns: 3, rows: 3, minWidth: 700 },
  { columns: 4, rows: 4, minWidth: 960 },
];

export interface CustomGridLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  tracks: TrackReferenceOrPlaceholder[];
}

/**
 * Drop-in replacement for LiveKit's GridLayout that uses custom grid layout
 * thresholds to show more tiles on mobile screens.
 * Uses manual pagination to preserve pinned-first sort order.
 */
export function CustomGridLayout({ tracks, children, ...props }: CustomGridLayoutProps) {
  const gridEl = React.createRef<HTMLDivElement>();
  const { pinnedIds } = usePinned();
  const [currentPage, setCurrentPage] = React.useState(1);

  // Build keys that change when speaking/pin state changes, so sort re-runs
  const speakingKey = tracks
    .map((t) => `${t.participant?.identity}:${t.participant?.isSpeaking ? '1' : '0'}`)
    .join(',');
  const pinnedKey = Array.from(pinnedIds).sort().join(',');

  // Sort tracks: pinned first, then speaking, then rest
  const sortedTracks = React.useMemo(() => {
    return [...tracks].sort((a, b) => {
      const aPinned = pinnedIds.has(a.participant?.identity ?? '') ? 0 : 1;
      const bPinned = pinnedIds.has(b.participant?.identity ?? '') ? 0 : 1;
      if (aPinned !== bPinned) return aPinned - bPinned;

      const aSpeaking = a.participant?.isSpeaking ? 0 : 1;
      const bSpeaking = b.participant?.isSpeaking ? 0 : 1;
      return aSpeaking - bSpeaking;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks, pinnedKey, speakingKey]);

  const { layout } = useGridLayout(gridEl, sortedTracks.length, {
    gridLayouts: CUSTOM_GRID_LAYOUTS,
  });

  // Manual pagination that preserves sort order
  const maxTiles = layout.maxTiles;
  const totalPageCount = Math.max(1, Math.ceil(sortedTracks.length / maxTiles));

  // Clamp current page when tracks change
  React.useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPageCount));
  }, [totalPageCount]);

  const startIdx = (currentPage - 1) * maxTiles;
  const pageTracks = sortedTracks.slice(startIdx, startIdx + maxTiles);

  const nextPage = React.useCallback(() => {
    setCurrentPage((prev) => (prev < totalPageCount ? prev + 1 : 1));
  }, [totalPageCount]);

  const prevPage = React.useCallback(() => {
    setCurrentPage((prev) => (prev > 1 ? prev - 1 : totalPageCount));
  }, [totalPageCount]);

  useSwipe(gridEl, {
    onLeftSwipe: nextPage,
    onRightSwipe: prevPage,
  });

  return (
    <div
      ref={gridEl}
      data-lk-pagination={totalPageCount > 1}
      {...props}
      className={`lk-grid-layout ${props.className || ''}`}
    >
      <TrackLoop tracks={pageTracks}>{children}</TrackLoop>
      {totalPageCount > 1 && (
        <>
          <PaginationIndicator
            totalPageCount={totalPageCount}
            currentPage={currentPage}
          />
          <PaginationControl
            pagesContainer={gridEl}
            totalPageCount={totalPageCount}
            currentPage={currentPage}
            nextPage={nextPage}
            prevPage={prevPage}
          />
        </>
      )}
    </div>
  );
}

/** Inline PaginationIndicator (not exported from LiveKit) */
function PaginationIndicator({ totalPageCount, currentPage }: { totalPageCount: number; currentPage: number }) {
  return (
    <div className="lk-pagination-indicator">
      {Array.from({ length: totalPageCount }, (_, i) => (
        <span key={i} data-lk-active={i + 1 === currentPage ? true : undefined} />
      ))}
    </div>
  );
}

/** Inline PaginationControl (not exported from LiveKit) */
function PaginationControl({
  totalPageCount,
  nextPage,
  prevPage,
  currentPage,
  pagesContainer,
}: {
  totalPageCount: number;
  nextPage: () => void;
  prevPage: () => void;
  currentPage: number;
  pagesContainer: React.RefObject<HTMLElement>;
}) {
  const [interactive, setInteractive] = React.useState(false);

  React.useEffect(() => {
    const el = pagesContainer.current;
    if (!el) return;
    let timeout: ReturnType<typeof setTimeout>;
    const show = () => {
      setInteractive(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setInteractive(false), 2000);
    };
    el.addEventListener('mouseover', show);
    el.addEventListener('touchstart', show);
    return () => {
      el.removeEventListener('mouseover', show);
      el.removeEventListener('touchstart', show);
      clearTimeout(timeout);
    };
  }, [pagesContainer]);

  return (
    <div className="lk-pagination-control" data-lk-user-interaction={interactive}>
      <button className="lk-button" onClick={prevPage}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M10 12l-4-4 4-4" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      </button>
      <span className="lk-pagination-count">{`${currentPage} of ${totalPageCount}`}</span>
      <button className="lk-button" onClick={nextPage}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      </button>
    </div>
  );
}
