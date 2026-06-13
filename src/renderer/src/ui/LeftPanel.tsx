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
  onResetPage: () => void;
  onResetAll: () => void;
  selectedPlaylist: Playlist | null;
  playlistCount: number;
  playlistPlaying: boolean;
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
  onResetPage,
  onResetAll,
  selectedPlaylist,
  playlistCount,
  playlistPlaying
}: Props) {
  const pageLabel = String(currentPageIndex + 1).padStart(2, '0');
  const totalLabel = String(totalPages).padStart(2, '0');
  const canPrev = currentPageIndex > 0;
  const canNext = currentPageIndex < totalPages - 1;
  const canAdd = totalPages < 99;

  return (
    <aside className="left-panel">
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
            label="<"
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
            label=">"
            size="xs"
            flash={flash?.trackNext}
            onClick={onNextPage}
            title="Next page"
          />
          {canAdd && (
            <Pad
              label="+"
              size="xs"
              variant="white"
              onClick={onAddPage}
              title="Add page"
            />
          )}
        </div>
      </div>

      <div className="left-panel__row">
        <div className="left-panel__group left-panel__group--marker">
          <div className="left-panel__label">PLAYLIST</div>
          <div className="pad-row">
            <Pad label="☰" size="xs" variant="yellow" flash={flash?.markerSet} onClick={() => onTransport('markerSet')} title="Open Playlists" />
            <Pad label="◀" size="xs" flash={flash?.markerPrev} onClick={() => onTransport('markerPrev')} title="Prev Playlist" />
            <Pad label="▶" size="xs" flash={flash?.markerNext} onClick={() => onTransport('markerNext')} title="Next Playlist" />
          </div>
          {playlistCount > 0 && (
            <div className={`playlist-name ${playlistPlaying ? 'is-playing' : ''}`}>
              {selectedPlaylist?.name ?? '—'}
            </div>
          )}
        </div>
      </div>

      <div className="left-panel__cycle">
        <Pad
          label="CYCLE"
          size="sm"
          active={cycle}
          flash={flash?.cycle}
          onClick={onToggleCycle}
          title="Cycle (loop)"
        />
      </div>

      <div className="left-panel__transport">
        <Pad label="⏮" size="md" variant="white" flash={flash?.rewind} onClick={() => onTransport('rewind')} title="Rewind" />
        <Pad label="⏭" size="md" variant="white" flash={flash?.forward} onClick={() => onTransport('forward')} title="Fast forward" />
        <Pad label={<span style={{fontSize: '36px'}}>■</span>} size="md" variant="red" flash={flash?.stop} onClick={onStop} title="Stop" />
        <Pad label="▶" size="md" variant="green" active={playing} flash={flash?.play} onClick={onPlay} title="Play" />
        <Pad label={<span style={{fontSize: '36px'}}>●</span>} size="md" variant="red" flash={flash?.record} onClick={() => onTransport('record')} title="Record (not wired)" />
      </div>

      <div className="left-panel__group left-panel__group--reset">
        <div className="left-panel__label">RESET</div>
        <div className="pad-row">
          <Pad label="PAGE" size="xs" variant="red" onClick={onResetPage} title="Clear current page" />
          <Pad label="ALL" size="xs" variant="red" onClick={onResetAll} title="Remove all pages" />
        </div>
      </div>

      <div className={`midi-status ${midiDeviceName ? 'is-connected' : ''}`}>
        <span className="midi-status__dot" />
        <span className="midi-status__text">{midiDeviceName ?? 'no MIDI device'}</span>
      </div>
    </aside>
  );
}
