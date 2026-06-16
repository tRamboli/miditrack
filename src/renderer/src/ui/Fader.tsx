import { useCallback, useRef } from 'react';

type Props = {
  value: number; // 0..1
  flash?: boolean;
  onChange: (v: number) => void;
};

export function Fader({ value, flash, onChange }: Props) {
  const railRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updateFromY = useCallback(
    (clientY: number) => {
      const rail = railRef.current;
      if (!rail) return;
      const rect = rail.getBoundingClientRect();
      const ratio = 1 - (clientY - rect.top) / rect.height;
      onChange(Math.max(0, Math.min(1, ratio)));
    },
    [onChange]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragging.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      updateFromY(e.clientY);
    },
    [updateFromY]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      updateFromY(e.clientY);
    },
    [updateFromY]
  );

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  }, []);

  const onDoubleClick = useCallback(() => onChange(0.5), [onChange]);

  const capTopPercent = (1 - value) * 100;

  return (
    <div
      ref={railRef}
      className={`fader ${flash ? 'is-flash' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      <div className="fader__rail">
        <div className="fader__rail-line" />
      </div>
      <div className="fader__cap" style={{ top: `calc(${capTopPercent}% - 24px)` }}>
        <div className="fader__cap-light" />
      </div>
    </div>
  );
}
