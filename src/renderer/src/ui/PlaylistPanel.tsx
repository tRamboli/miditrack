import { Playlist } from '../types';

type Props = {
  playlists: Playlist[];
  selectedIndex: number;
  playingIndex: number;   // file index within selected playlist (-1 = none)
  isPlaying: boolean;
  onSelectPlaylist: (idx: number) => void;
  onAddPlaylist: () => void;
  onRemovePlaylist: (idx: number) => void;
  onClose: () => void;
};

export function PlaylistPanel({
  playlists,
  selectedIndex,
  playingIndex,
  isPlaying,
  onSelectPlaylist,
  onAddPlaylist,
  onRemovePlaylist,
  onClose
}: Props) {
  const selected = playlists[selectedIndex] ?? null;

  return (
    <div className="pl-overlay" onClick={onClose}>
      <div className="pl-modal" onClick={e => e.stopPropagation()}>

        <div className="pl-header">
          <span className="pl-title">PLAYLISTS</span>
          <button className="pl-add-btn" onClick={onAddPlaylist} title="Add playlist from folder">+ Add Folder</button>
          <button className="pl-close" onClick={onClose}>✕</button>
        </div>

        <div className="pl-body">
          {/* Left: playlist list */}
          <div className="pl-list">
            {playlists.length === 0 && (
              <div className="pl-empty">No playlists yet.<br />Click + Add Folder.</div>
            )}
            {playlists.map((pl, i) => (
              <div
                key={pl.id}
                className={`pl-list-item ${i === selectedIndex ? 'is-selected' : ''}`}
                onClick={() => onSelectPlaylist(i)}
              >
                <span className="pl-list-name" title={pl.dirPath}>{pl.name}</span>
                <span className="pl-list-count">{pl.files.length}</span>
                <button
                  className="pl-list-remove"
                  onClick={e => { e.stopPropagation(); onRemovePlaylist(i); }}
                  title="Remove playlist"
                >✕</button>
              </div>
            ))}
          </div>

          {/* Right: file list */}
          <div className="pl-files">
            {!selected && <div className="pl-empty">Select a playlist.</div>}
            {selected?.files.length === 0 && (
              <div className="pl-empty">No audio files in this folder.</div>
            )}
            {selected?.files.map((f, i) => {
              const active = isPlaying && i === playingIndex && selectedIndex === selectedIndex;
              return (
                <div key={f.path} className={`pl-file ${active ? 'is-playing' : ''}`}>
                  <span className="pl-file-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="pl-file-name" title={f.path}>{f.name}</span>
                  {active && <span className="pl-file-indicator">▶</span>}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
