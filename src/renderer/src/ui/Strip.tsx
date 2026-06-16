import { useCallback, useState } from 'react';
import { MdLoop, MdVolumeOff, MdPlayArrow, MdPause } from 'react-icons/md';
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

const SCALE_MARKS = Array.from({ length: 51 }, (_, i) => i * 2); // 0,2,4...100

function tickType(v: number): 'major' | 'mid' | 'minor' {
  if (v % 10 === 0) return 'major';
  if (v % 5 === 0) return 'mid';
  return 'minor';
}

export function Strip({ track, trackPlaying, loading, error, flash, onChange, onTogglePlay, onDropFiles }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const hasFile = !!track.filePath;

  const handleScaleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = 1 - (e.clientY - rect.top) / rect.height;
    const snapped = Math.round(Math.max(0, Math.min(1, ratio)) * 50) * 2;
    onChange({ volume: snapped / 100 });
  }, [onChange]);

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
            label={<MdLoop />}
            active={track.loop}
            flash={flash?.s}
            size="sm"
            variant="purple"
            onClick={() => onChange({ loop: !track.loop })}
            title="Loop"
          />
          <Pad
            label={<MdVolumeOff />}
            active={track.mute}
            flash={flash?.m}
            size="sm"
            onClick={() => onChange({ mute: !track.mute })}
            title="Mute"
          />
          <Pad
            label={trackPlaying ? <MdPause /> : <MdPlayArrow />}
            active={trackPlaying}
            flash={flash?.r}
            size="sm"
            variant={trackPlaying ? 'yellow' : 'green'}
            onClick={onTogglePlay}
            title={trackPlaying ? 'Pause track' : 'Play track'}
          />
        </div>
        <div className="strip__fader-col">
          <div className="fader-scale" onClick={handleScaleClick}>
            {SCALE_MARKS.map(v => {
              const type = tickType(v);
              const isBold = v === 0 || v === 50 || v === 100;
              return (
                <div
                  key={v}
                  className={`fader-scale__tick fader-scale__tick--${type}`}
                  style={{ top: `${100 - v}%` }}
                >
                  {type === 'major' && (
                    <span className={isBold ? 'fader-scale__label--bold' : ''}>{v}</span>
                  )}
                  <div className="fader-scale__line" />
                </div>
              );
            })}
          </div>
          <Fader
            value={track.volume}
            flash={flash?.fader}
            onChange={(v) => onChange({ volume: v })}
          />
        </div>
      </div>

      <div className="strip__vol">
        {Math.round(track.volume * 100)}
      </div>
    </div>
  );
}
