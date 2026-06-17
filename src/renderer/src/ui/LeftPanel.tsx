import { useRef, useEffect } from 'react';
import {
  MdChevronLeft, MdChevronRight, MdAdd, MdRemove,
  MdQueueMusic, MdSkipPrevious, MdSkipNext,
  MdRepeat, MdFastRewind, MdFastForward,
  MdStop, MdPlayArrow, MdFiberManualRecord,
  MdRestartAlt, MdDeleteSweep, MdPause,
} from 'react-icons/md';
import { Pad } from './Pad';
import type { TransportAction } from '../midi/types';
import type { Playlist } from '../types';

export type TransportFlash = Partial<Record<TransportAction, boolean>>;

type Props = {
  playing: boolean;
  cycle: boolean;
  midiDeviceName: string | null;
  flash?: TransportFlash;
  currentPageIndex: number;
  totalPages: number;
  onPlay: () => void;
  onStop: () => void;
  onToggleCycle: () => void;
  onTransport: (action: TransportAction) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onAddPage: () => void;
  onRemovePage: () => void;
  onResetPage: () => void;
  onResetAll: () => void;
  playlists: Playlist[];
  selectedPlaylistIdx: number;
  playlistTrackIdx: number;
  playlistPlaying: boolean;
  onSelectSong: (idx: number) => void;
};

export function LeftPanel({
  playing,
  cycle,
  midiDeviceName,
  flash,
  currentPageIndex,
  totalPages,
  onPlay,
  onStop,
  onToggleCycle,
  onTransport,
  onPrevPage,
  onNextPage,
  onAddPage,
  onRemovePage,
  onResetPage,
  onResetAll,
  playlists,
  selectedPlaylistIdx,
  playlistTrackIdx,
  playlistPlaying,
  onSelectSong
}: Props) {
  const pageLabel = String(currentPageIndex + 1).padStart(2, '0');
  const totalLabel = String(totalPages).padStart(2, '0');
  const canAdd = totalPages < 99;
  const canRemove = totalPages > 1;

  const selectedPlaylist = playlists[selectedPlaylistIdx] ?? null;

  const activeSongRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    activeSongRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [playlistTrackIdx]);

  return (
    <aside className="left-panel">
      <div className={`midi-status ${midiDeviceName ? 'is-connected' : ''}`}>
        <span className="midi-status__dot" />
        <span className="midi-status__text">{midiDeviceName ?? 'no MIDI device'}</span>
      </div>

      <div className="brand">
        <div className="brand__korg">KORG</div>
        <div className="brand__model">
          <span className="brand__model-nano">nano</span>
          <span className="brand__model-kontrol">KONTROL2</span>
        </div>
        <div className="brand__power" />
      </div>

      {/* Page navigation (repurposes TRACK buttons) */}
      <div className="left-panel__group">
        <div className="left-panel__label">TRACK</div>
        <div className="page-nav">
          <Pad
            label={<MdChevronLeft />}
            size="xs"
            flash={flash?.trackPrev}
            onClick={onPrevPage}
            title="Previous page"
          />
          <div className="page-indicator">
            <span className="page-indicator__num">{pageLabel}</span>
            <span className="page-indicator__sep">/</span>
            <span className="page-indicator__total">{totalLabel}</span>
          </div>
          <Pad
            label={<MdChevronRight />}
            size="xs"
            flash={flash?.trackNext}
            onClick={onNextPage}
            title="Next page"
          />
          {canAdd && (
            <Pad
              label={<MdAdd />}
              size="xs"
              variant="white"
              onClick={onAddPage}
              title="Add page"
            />
          )}
          {canRemove && (
            <Pad
              label={<MdRemove />}
              size="xs"
              variant="red"
              onClick={onRemovePage}
              title="Remove current page"
            />
          )}
        </div>
      </div>

      {/* Inline playlist window */}
      <div className="pl-inline">
        <div className="pl-inline__header">
          <Pad
            label={<MdSkipPrevious />}
            size="xs"
            flash={flash?.markerPrev}
            onClick={() => onTransport('markerPrev')}
            title="Prev Playlist"
          />
          <span className={`pl-inline__name ${playlistPlaying ? 'is-playing' : ''}`}>
            {selectedPlaylist?.name ?? (playlists.length === 0 ? 'No playlists' : '—')}
          </span>
          <Pad
            label={<MdSkipNext />}
            size="xs"
            flash={flash?.markerNext}
            onClick={() => onTransport('markerNext')}
            title="Next Playlist"
          />
          <Pad
            label={<MdQueueMusic />}
            size="xs"
            variant="yellow"
            flash={flash?.markerSet}
            onClick={() => onTransport('markerSet')}
            title="Manage Playlists"
          />
        </div>

        <div className="pl-inline__songs">
          {playlists.length === 0 && (
            <div className="pl-inline__empty">No playlists yet</div>
          )}
          {selectedPlaylist?.files.length === 0 && (
            <div className="pl-inline__empty">No audio files</div>
          )}
          {selectedPlaylist?.files.map((f, i) => {
            const isActive = i === playlistTrackIdx;
            return (
              <div
                key={f.path}
                ref={isActive ? activeSongRef : undefined}
                className={`pl-inline__song ${isActive ? 'is-playing' : ''}`}
                onClick={() => onSelectSong(i)}
              >
                <span className="pl-inline__song-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="pl-inline__song-name" title={f.name}>{f.name}</span>
              </div>
            );
          })}
        </div>

        <div className="pl-inline__song-nav">
          <Pad
            label={<MdFastRewind />}
            size="xs"
            variant="white"
            flash={flash?.rewind}
            onClick={() => onTransport('rewind')}
            title="Prev Song"
          />
          <Pad
            label={<MdFastForward />}
            size="xs"
            variant="white"
            flash={flash?.forward}
            onClick={() => onTransport('forward')}
            title="Next Song"
          />
        </div>
      </div>

      <div className="left-panel__transport">
        <Pad label={<MdRepeat />} size="md" variant="purple" active={cycle} flash={flash?.cycle} onClick={onToggleCycle} title="Cycle (loop playlist)" />
        <Pad label={<MdStop />} size="md" variant="red" flash={flash?.stop} onClick={onStop} title="Stop" />
        <Pad label={playing ? <MdPause /> : <MdPlayArrow />} size="md" variant={playing ? 'yellow' : 'green'} active={playing} flash={flash?.play} onClick={onPlay} title={playing ? 'Pause' : 'Play'} />
        <Pad label={<MdFiberManualRecord />} size="md" variant="red" flash={flash?.record} onClick={() => onTransport('record')} title="Record (not wired)" />
      </div>

      <div className="left-panel__group left-panel__group--reset">
        <div className="left-panel__label">RESET</div>
        <div className="pad-row">
          <Pad label={<MdRestartAlt />} size="xs" variant="red" onClick={onResetPage} title="Clear current page" />
          <Pad label={<MdDeleteSweep />} size="xs" variant="red" onClick={onResetAll} title="Remove all pages" />
        </div>
      </div>
    </aside>
  );
}
