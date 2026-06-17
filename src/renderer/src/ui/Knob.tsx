import { useCallback, useRef } from 'react';

type Props = {
  value: number; // -1..1 (bipolar) or 0..1 (unipolar)
  flash?: boolean;
  onChange: (v: number) => void;
  title?: string;
  unipolar?: boolean;
  accent?: 'orange';
};

export function Knob({ value, flash, onChange, title, unipolar, accent }: Props) {
  const dragY = useRef<number | null>(null);
  const startVal = useRef(0);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragY.current = e.clientY;
      startVal.current = value;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [value]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (dragY.current == null) return;
      const dy = dragY.current - e.clientY;
      const sensitivity = e.shiftKey ? 400 : 120;
      const [lo, hi] = unipolar ? [0, 1] : [-1, 1];
      const next = Math.max(lo, Math.min(hi, startVal.current + dy / sensitivity));
      onChange(next);
    },
    [onChange, unipolar]
  );

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragY.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  }, []);

  const onDoubleClick = useCallback(
    () => onChange(unipolar ? 1 : 0),
    [onChange, unipolar]
  );

  const rotation = unipolar ? (value * 2 - 1) * 135 : value * 135;

  return (
    <div
      className={`knob${flash ? ' is-flash' : ''}${accent ? ` knob--${accent}` : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      title={title}
    >
      <div className="knob__ring" />
      <div className="knob__cap" style={{ transform: `rotate(${rotation}deg)` }}>
        <div className="knob__notch" />
      </div>
    </div>
  );
}
