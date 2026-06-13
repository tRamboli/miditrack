import { useState } from 'react';
import { AppSettings } from '../types';

type Props = {
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
  onClose: () => void;
};

export function Settings({ settings, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(settings);

  function handleSave() {
    onSave(draft);
    onClose();
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <span className="settings-title">Settings</span>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>

        <div className="settings-body">
          <div className="settings-row">
            <label className="settings-label" htmlFor="fade-out">
              Track fade-out duration
            </label>
            <div className="settings-control">
              <input
                id="fade-out"
                type="number"
                className="settings-input"
                min={0}
                max={60}
                step={0.5}
                value={draft.fadeOutDuration}
                onChange={(e) =>
                  setDraft({ ...draft, fadeOutDuration: Math.max(0, Number(e.target.value)) })
                }
              />
              <span className="settings-unit">s</span>
            </div>
          </div>
          <p className="settings-hint">
            Seconds to fade audio when pausing a track. Set to 0 for instant stop.
          </p>
        </div>

        <div className="settings-footer">
          <button className="settings-btn settings-btn--cancel" onClick={onClose}>Cancel</button>
          <button className="settings-btn settings-btn--save" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
