import { Track } from '../types';
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
  onPlay: () => void;
  onStop: () => void;
  onToggleCycle: () => void;
  onTransport: (action: TransportAction) => void;
  onUpdateTrack: (slot: number, patch: Partial<Track>) => void;
  onDropOnStrip: (slot: number, files: File[]) => void;
};

export function Device(props: Props) {
  return (
    <div className="device">
      <LeftPanel
        playing={props.playing}
        cycle={props.cycle}
        midiDeviceName={props.midiDeviceName}
        flash={props.transportFlash}
        onPlay={props.onPlay}
        onStop={props.onStop}
        onToggleCycle={props.onToggleCycle}
        onTransport={props.onTransport}
      />
      <div className="strips">
        {props.tracks.map((t) => (
          <Strip
            key={t.id}
            track={t}
            loading={!!props.loading[t.slot]}
            error={props.errors[t.slot]}
            flash={props.stripFlash[t.slot]}
            onChange={(patch) => props.onUpdateTrack(t.slot, patch)}
            onDropFiles={(files) => props.onDropOnStrip(t.slot, files)}
          />
        ))}
      </div>
    </div>
  );
}
