export type PlaylistFile = {
  name: string;
  path: string;
};

export type Playlist = {
  id: string;
  name: string;      // directory name shown in UI
  dirPath: string;
  files: PlaylistFile[];
};

export const PLAYLISTS_STORAGE_KEY = 'miditrack-playlists';

export type AppSettings = {
  fadeOutDuration: number; // seconds; 0 = instant
};

export const DEFAULT_SETTINGS: AppSettings = {
  fadeOutDuration: 6
};

export const SETTINGS_STORAGE_KEY = 'miditrack-settings';

export type Track = {
  id: string;
  slot: number;
  name: string;
  filePath: string;
  volume: number; // 0..1
  pan: number;    // -1..1
  mute: boolean;
  solo: boolean;
  loop: boolean;
};

export type Page = {
  id: string;
  tracks: Track[];
};

export const TRACK_COUNT = 8;
export const MAX_PAGES = 99;

export function emptyTrack(pageId: string, slot: number): Track {
  return {
    id: `${pageId}-slot-${slot}`,
    slot,
    name: '',
    filePath: '',
    volume: 0.8,
    pan: 0,
    mute: false,
    solo: false,
    loop: false
  };
}

export function newPage(index: number): Page {
  const id = `page-${index}-${Date.now()}`;
  return {
    id,
    tracks: Array.from({ length: TRACK_COUNT }, (_, s) => emptyTrack(id, s))
  };
}

// Global audio slot key: unique across all pages
export function audioSlot(pageIndex: number, slot: number): number {
  return pageIndex * TRACK_COUNT + slot;
}
