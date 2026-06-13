import { useState } from 'react';
import { Track } from '../types';
import { Knob } from './Knob';
import { Fader } from './Fader';
import { Pad } from './Pad';

export type StripFlash = {
  knob?: boolean;
  fader?: boolean;
  s?: boolean;
  m?: boolean;
  r?: boolean;
};

type Props = {
  track: Track;
  trackPlaying?: boolean;
  loading?: boolean;
  error?: string;
  flash?: StripFlash;
  onChange: (patch: Partial<Track>) => void;
  onTogglePlay: () => void;
  onDropFiles: (files: File[]) => void;
};

export function Strip({ track, trackPlaying, loading, error, flash, onChange, onTogglePlay, onDropFiles }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const hasFile = !!track.filePath;

  return (
    <div
      className={`strip ${dragOver ? 'is-dragover' : ''} ${hasFile ? '' : 'is-empty'} ${error ? 'is-error' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        onDropFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <div className={`strip__screen${trackPlaying ? ' is-playing' : ''}`} title={error || track.name || `Slot ${track.slot + 1}`}>
        <div className="strip__screen-num">{(track.slot + 1).toString().padStart(2, '0')}</div>
        <div className="strip__screen-name">
          {loading ? 'decoding…' : error ? 'error' : track.name || 'empty'}
        </div>
      </div>

      <div className="strip__knob">
        <Knob
          value={track.pan}
          flash={flash?.knob}
          onChange={(v) => onChange({ pan: v })}
          title={`Pan ${track.pan.toFixed(2)}`}
        />
      </div>

      <div className="strip__body">
        <div className="strip__sm-col">
          <Pad
            label={<img src="./loop.png" alt="loop" style={{ width: 18, height: 18, filter: 'invert(1)', opacity: 0.7 }} />}
            active={track.loop}
            flash={flash?.s}
            size="sm"
            variant="purple"
            onClick={() => onChange({ loop: !track.loop })}
            title="Loop"
          />
          <Pad
            label="M"
            active={track.mute}
            flash={flash?.m}
            size="sm"
            onClick={() => onChange({ mute: !track.mute })}
            title="Mute"
          />
          <Pad
            label={trackPlaying ? '⏸' : '▶'}
            active={trackPlaying}
            flash={flash?.r}
            size="sm"
            variant={trackPlaying ? 'yellow' : 'green'}
            onClick={onTogglePlay}
            title={trackPlaying ? 'Pause track' : 'Play track'}
          />
        </div>
        <div className="strip__fader-col">
          <Fader
            value={track.volume}
            flash={flash?.fader}
            onChange={(v) => onChange({ volume: v })}
          />
        </div>
      </div>

      <div className="strip__db">
        {track.volume === 0 ? '-∞' : `${(20 * Math.log10(track.volume)).toFixed(1)} dB`}
      </div>
    </div>
  );
}
