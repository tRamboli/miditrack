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
  loading?: boolean;
  error?: string;
  flash?: StripFlash;
  onChange: (patch: Partial<Track>) => void;
  onDropFiles: (files: File[]) => void;
};

export function Strip({ track, loading, error, flash, onChange, onDropFiles }: Props) {
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
      <div className="strip__screen" title={error || track.name || `Slot ${track.slot + 1}`}>
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
            label="S"
            active={track.solo}
            flash={flash?.s}
            size="sm"
            onClick={() => onChange({ solo: !track.solo })}
            title="Solo"
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
            label="R"
            flash={flash?.r}
            size="sm"
            title="Record / Arm (not wired)"
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
