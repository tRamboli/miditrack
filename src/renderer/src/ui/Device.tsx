import { Track, Playlist, audioSlot } from '../types';
import { LeftPanel, TransportFlash } from './LeftPanel';
import { Strip, StripFlash } from './Strip';
import type { TransportAction } from '../midi/types';

type Props = {
  tracks: Track[];
  playing: boolean;
  cycle: boolean;
  midiDeviceName: string | null;
  loading: Record<number, boolean>;
  errors: Record<number, string>;
  stripFlash: Record<number, StripFlash | undefined>;
  transportFlash: TransportFlash;
  currentPageIndex: number;
  totalPages: number;
  onPlay: () => void;
  onStop: () => void;
  onToggleCycle: () => void;
  onTransport: (action: TransportAction) => void;
  playingTracks: Set<number>;
  onUpdateTrack: (slot: number, patch: Partial<Track>) => void;
  onToggleTrackPlay: (slot: number) => void;
  onDropOnStrip: (slot: number, files: File[]) => void;
  onSelectFileForSlot: (slot: number) => void;
  onClearFileForSlot: (slot: number) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onAddPage: () => void;
  onRemovePage: () => void;
  onResetPage: () => void;
  onResetAll: () => void;
  playlists: Playlist[];
  selectedPlaylistIdx: number;
  playlistPlaying: boolean;
};

export function Device(props: Props) {
  return (
    <div className="device">
      <LeftPanel
        playing={props.playing}
        cycle={props.cycle}
        midiDeviceName={props.midiDeviceName}
        flash={props.transportFlash}
        currentPageIndex={props.currentPageIndex}
        totalPages={props.totalPages}
        onPlay={props.onPlay}
        onStop={props.onStop}
        onToggleCycle={props.onToggleCycle}
        onTransport={props.onTransport}
        onPrevPage={props.onPrevPage}
        onNextPage={props.onNextPage}
        onAddPage={props.onAddPage}
        onRemovePage={props.onRemovePage}
        onResetPage={props.onResetPage}
        onResetAll={props.onResetAll}
        selectedPlaylist={props.playlists[props.selectedPlaylistIdx] ?? null}
        playlistCount={props.playlists.length}
        playlistPlaying={props.playlistPlaying}
      />
      <div className="strips-area">
        <div className="page-title">PAGE {String(props.currentPageIndex + 1).padStart(2, '0')}</div>
        <div className="strips">
          {props.tracks.map((t) => (
            <Strip
              key={t.id}
              track={t}
              loading={!!props.loading[t.slot]}
              error={props.errors[t.slot]}
              flash={props.stripFlash[t.slot]}
              trackPlaying={props.playingTracks.has(audioSlot(props.currentPageIndex, t.slot))}
              onChange={(patch) => props.onUpdateTrack(t.slot, patch)}
              onTogglePlay={() => props.onToggleTrackPlay(t.slot)}
              onDropFiles={(files) => props.onDropOnStrip(t.slot, files)}
              onSelectFile={() => props.onSelectFileForSlot(t.slot)}
              onClearFile={() => props.onClearFileForSlot(t.slot)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
