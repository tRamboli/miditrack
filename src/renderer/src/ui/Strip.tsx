import { useCallback, useEffect, useRef, useState } from 'react';
import { MdLoop, MdAdd, MdPlayArrow, MdPause, MdStop, MdClose } from 'react-icons/md';
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
  onStopTrack: () => void;
  onDropFiles: (files: File[]) => void;
  onSelectFile: () => void;
  onClearFile: () => void;
  playlistVolume?: number;
  onPlaylistVolumeChange?: (v: number) => void;
};

function scaleStep(h: number): number {
  if (h >= 240) return 2;
  if (h >= 140) return 5;
  if (h >= 90) return 10;
  if (h >= 60) return 20;
  return 50;
}

function tickType(v: number, step: number): 'major' | 'mid' | 'minor' {
  if (step >= 10) return 'major';
  if (step === 5) return v % 10 === 0 ? 'major' : 'mid';
  if (v % 10 === 0) return 'major';
  if (v % 5 === 0) return 'mid';
  return 'minor';
}

export function Strip({ track, trackPlaying, loading, error, flash, onChange, onTogglePlay, onStopTrack, onDropFiles, onSelectFile, onClearFile, playlistVolume, onPlaylistVolumeChange }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const hasFile = !!track.filePath;

  const scaleRef = useRef<HTMLDivElement>(null);
  const [scaleHeight, setScaleHeight] = useState(300);

  useEffect(() => {
    const el = scaleRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScaleHeight(entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const step = scaleStep(scaleHeight);
  const scaleMarks = Array.from({ length: Math.floor(100 / step) + 1 }, (_, i) => i * step);

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
        {hasFile ? (
          <button
            className="strip__screen-clear"
            title="Remove audio file"
            onClick={(e) => { e.stopPropagation(); onClearFile(); }}
          >
            <MdClose />
          </button>
        ) : (
          <button
            className="strip__screen-clear is-add"
            title="Add song"
            onClick={(e) => { e.stopPropagation(); onSelectFile(); }}
          >
            <MdAdd />
          </button>
        )}
      </div>

      <div className="strip__knob">
        {onPlaylistVolumeChange !== undefined ? (
          <>
            <Knob
              value={playlistVolume ?? 1}
              flash={flash?.knob}
              onChange={onPlaylistVolumeChange}
              title={`Playlist volume ${Math.round((playlistVolume ?? 1) * 100)}`}
              unipolar
              accent="orange"
            />
            <div className="strip__knob-label">{Math.round((playlistVolume ?? 1) * 100)}</div>
          </>
        ) : (
          <Knob
            value={track.pan}
            flash={flash?.knob}
            onChange={(v) => onChange({ pan: v })}
            title={`Pan ${track.pan.toFixed(2)}`}
          />
        )}
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
            label={<MdStop />}
            flash={flash?.m}
            size="sm"
            variant="red"
            onClick={onStopTrack}
            title="Stop (fade out, return to start)"
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
          <div className="fader-scale" ref={scaleRef} onClick={handleScaleClick}>
            {scaleMarks.map(v => {
              const type = tickType(v, step);
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
