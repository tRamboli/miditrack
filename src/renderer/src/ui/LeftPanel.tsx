import { Pad } from './Pad';
import type { TransportAction } from '../midi/types';

export type TransportFlash = Partial<Record<TransportAction, boolean>>;

type Props = {
  playing: boolean;
  cycle: boolean;
  midiDeviceName: string | null;
  flash?: TransportFlash;
  onPlay: () => void;
  onStop: () => void;
  onToggleCycle: () => void;
  onTransport: (action: TransportAction) => void;
};

export function LeftPanel({
  playing,
  cycle,
  midiDeviceName,
  flash,
  onPlay,
  onStop,
  onToggleCycle,
  onTransport
}: Props) {
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

      <div className="left-panel__row">
        <div className="left-panel__group">
          <div className="left-panel__label">TRACK</div>
          <div className="pad-row">
            <Pad label="◀" size="xs" flash={flash?.trackPrev} onClick={() => onTransport('trackPrev')} title="Track Prev" />
            <Pad label="▶" size="xs" flash={flash?.trackNext} onClick={() => onTransport('trackNext')} title="Track Next" />
          </div>
        </div>
        <div className="left-panel__group left-panel__group--marker">
          <div className="left-panel__label">MARKER</div>
          <div className="pad-row">
            <Pad label="SET" size="xs" flash={flash?.markerSet} onClick={() => onTransport('markerSet')} title="Set Marker" />
            <Pad label="◀" size="xs" flash={flash?.markerPrev} onClick={() => onTransport('markerPrev')} title="Prev Marker" />
            <Pad label="▶" size="xs" flash={flash?.markerNext} onClick={() => onTransport('markerNext')} title="Next Marker" />
          </div>
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
        <Pad label="⏮" size="sm" flash={flash?.rewind} onClick={() => onTransport('rewind')} title="Rewind" />
        <Pad label="⏭" size="sm" flash={flash?.forward} onClick={() => onTransport('forward')} title="Fast forward" />
        <Pad label="■" size="sm" flash={flash?.stop} onClick={onStop} title="Stop" />
        <Pad label="▶" size="sm" active={playing} flash={flash?.play} onClick={onPlay} title="Play" />
        <Pad label="●" size="sm" flash={flash?.record} onClick={() => onTransport('record')} title="Record (not wired)" />
      </div>

      <div className={`midi-status ${midiDeviceName ? 'is-connected' : ''}`}>
        <span className="midi-status__dot" />
        <span className="midi-status__text">{midiDeviceName ?? 'no MIDI device'}</span>
      </div>
    </aside>
  );
}
