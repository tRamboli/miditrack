import { useCallback, useEffect, useRef, useState } from 'react';
import { TRACK_COUNT, Track, Page, MAX_PAGES, newPage, audioSlot, AppSettings, DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, Playlist, PLAYLISTS_STORAGE_KEY, PAGES_STORAGE_KEY, CURRENT_PAGE_STORAGE_KEY } from './types';
import { Device } from './ui/Device';
import { Settings } from './ui/Settings';
import { PlaylistPanel } from './ui/PlaylistPanel';
import { AudioEngine } from './audio/engine';
import { MidiHost } from './midi/devices';
import { MidiRouter } from './midi/router';
import { NANOKONTROL2_PRESET } from './midi/presets/nanokontrol2';
import type { BoolParam, ContinuousParam, TransportAction } from './midi/types';
import type { StripFlash } from './ui/Strip';
import type { TransportFlash } from './ui/LeftPanel';

const AUDIO_EXT = ['.wav', '.mp3', '.m4a', '.flac', '.ogg', '.aac', '.aiff'];
const FLASH_MS = 140;

function isAudioFile(name: string): boolean {
  const lower = name.toLowerCase();
  return AUDIO_EXT.some((ext) => lower.endsWith(ext));
}

function basename(dirPath: string): string {
  return dirPath.split(/[/\\]/).filter(Boolean).pop() ?? dirPath;
}

type StripCtrl = keyof StripFlash;

export function App() {
  const [pages, setPages] = useState<Page[]>(() => {
    try {
      const raw = localStorage.getItem(PAGES_STORAGE_KEY);
      const parsed: Page[] = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : [newPage(0)];
    } catch { return [newPage(0)]; }
  });
  const [currentPageIndex, setCurrentPageIndex] = useState(() => {
    try {
      const raw = localStorage.getItem(CURRENT_PAGE_STORAGE_KEY);
      return raw ? Math.max(0, parseInt(raw, 10) || 0) : 0;
    } catch { return 0; }
  });
  const [playing, setPlaying] = useState(false);
  const [cycle, setCycle] = useState(false);
  const cycleRef = useRef(cycle);
  useEffect(() => { cycleRef.current = cycle; }, [cycle]);
  const [playlistVolume, setPlaylistVolume] = useState(1);
  const playlistVolumeRef = useRef(playlistVolume);
  useEffect(() => { playlistVolumeRef.current = playlistVolume; }, [playlistVolume]);

  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [midiDeviceName, setMidiDeviceName] = useState<string | null>(null);

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
    } catch { return DEFAULT_SETTINGS; }
  });
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  const [settingsOpen, setSettingsOpen] = useState(false);

  const saveSettings = useCallback((s: AppSettings) => {
    setSettings(s);
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(s));
  }, []);

  // Playlists
  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    try {
      const raw = localStorage.getItem(PLAYLISTS_STORAGE_KEY);
      const parsed: Playlist[] = raw ? JSON.parse(raw) : [];
      return parsed.map((pl) => ({ ...pl, name: basename(pl.dirPath) }));
    } catch { return []; }
  });
  const playlistsRef = useRef(playlists);
  useEffect(() => {
    playlistsRef.current = playlists;
    localStorage.setItem(PLAYLISTS_STORAGE_KEY, JSON.stringify(playlists));
  }, [playlists]);

  const [selectedPlaylistIdx, setSelectedPlaylistIdx] = useState(0);
  const selectedPlaylistIdxRef = useRef(selectedPlaylistIdx);
  useEffect(() => { selectedPlaylistIdxRef.current = selectedPlaylistIdx; }, [selectedPlaylistIdx]);

  const [playlistTrackIdx, setPlaylistTrackIdx] = useState(-1);
  const playlistTrackIdxRef = useRef(playlistTrackIdx);
  useEffect(() => { playlistTrackIdxRef.current = playlistTrackIdx; }, [playlistTrackIdx]);

  const [playlistPlaying, setPlaylistPlaying] = useState(false);
  const playlistPlayingRef = useRef(playlistPlaying);
  useEffect(() => { playlistPlayingRef.current = playlistPlaying; }, [playlistPlaying]);
  const [playlistPaused, setPlaylistPaused] = useState(false);
  const playlistPausedRef = useRef(playlistPaused);
  useEffect(() => { playlistPausedRef.current = playlistPaused; }, [playlistPaused]);
  const playingRef = useRef(playing);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  const [playlistPanelOpen, setPlaylistPanelOpen] = useState(false);
  const plGenRef = useRef(0); // incremented on every navigation to cancel stale in-flight loads

  const [playingTracks, setPlayingTracks] = useState<Set<number>>(new Set());
  const playingTracksRef = useRef(playingTracks);
  useEffect(() => { playingTracksRef.current = playingTracks; }, [playingTracks]);
  const [stripFlash, setStripFlash] = useState<Record<number, StripFlash>>({});
  const [transportFlash, setTransportFlash] = useState<TransportFlash>({});

  const engineRef = useRef<AudioEngine | null>(null);
  if (!engineRef.current) engineRef.current = new AudioEngine();

  // Stable refs so async/MIDI callbacks always see latest values
  const pagesRef = useRef(pages);
  useEffect(() => {
    pagesRef.current = pages;
    localStorage.setItem(PAGES_STORAGE_KEY, JSON.stringify(pages));
  }, [pages]);
  const currentPageIndexRef = useRef(currentPageIndex);
  useEffect(() => {
    currentPageIndexRef.current = currentPageIndex;
    localStorage.setItem(CURRENT_PAGE_STORAGE_KEY, String(currentPageIndex));
  }, [currentPageIndex]);

  const currentTracks = pages[currentPageIndex]?.tracks ?? [];

  // Loading/error keys are "{pageIndex}-{slot}"
  const loadKey = (pi: number, slot: number) => `${pi}-${slot}`;

  // Restore audio buffers for tracks loaded from persisted pages, once on mount.
  useEffect(() => {
    const engine = engineRef.current!;
    pagesRef.current.forEach((page, pi) => {
      page.tracks.forEach((t) => {
        if (!t.filePath) return;
        const aSlot = audioSlot(pi, t.slot);
        const key = loadKey(pi, t.slot);
        void (async () => {
          try {
            const ab = await window.miditrack.readFile(t.filePath);
            await engine.loadArrayBuffer(aSlot, ab);
            engine.setParams(aSlot, { volume: t.volume, pan: t.pan, mute: t.mute, solo: t.solo, loop: t.loop });
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'reload failed';
            setErrors((e) => ({ ...e, [key]: msg }));
          }
        })();
      });
    });
  }, []);

  const flashStrip = useCallback((slot: number, ctrl: StripCtrl) => {
    setStripFlash((prev) => ({ ...prev, [slot]: { ...(prev[slot] || {}), [ctrl]: true } }));
    window.setTimeout(() => {
      setStripFlash((prev) => {
        const cur = prev[slot];
        if (!cur) return prev;
        const next = { ...cur };
        delete next[ctrl];
        return { ...prev, [slot]: next };
      });
    }, FLASH_MS);
  }, []);

  const flashTransport = useCallback((action: TransportAction) => {
    setTransportFlash((prev) => ({ ...prev, [action]: true }));
    window.setTimeout(() => {
      setTransportFlash((prev) => { const n = { ...prev }; delete n[action]; return n; });
    }, FLASH_MS);
  }, []);

  // Update a track on a specific page (defaults to current page)
  const updateTrack = useCallback((slot: number, patch: Partial<Track>, pageIndex?: number) => {
    const pi = pageIndex ?? currentPageIndexRef.current;
    const engine = engineRef.current!;

    setPages((prev) => {
      const next = [...prev];
      const page = next[pi];
      if (!page) return prev;
      next[pi] = {
        ...page,
        tracks: page.tracks.map((t) => (t.slot === slot ? { ...t, ...patch } : t))
      };
      return next;
    });

    const audioPatch: Parameters<typeof engine.setParams>[1] = {};
    if (patch.volume !== undefined) audioPatch.volume = patch.volume;
    if (patch.pan !== undefined) audioPatch.pan = patch.pan;
    if (patch.mute !== undefined) audioPatch.mute = patch.mute;
    if (patch.solo !== undefined) audioPatch.solo = patch.solo;
    if (patch.loop !== undefined) audioPatch.loop = patch.loop;
    if (Object.keys(audioPatch).length > 0) {
      engine.setParams(audioSlot(pi, slot), audioPatch);
    }
  }, []);

  const updateTrackRef = useRef(updateTrack);
  useEffect(() => { updateTrackRef.current = updateTrack; }, [updateTrack]);

  // Sequential playlist playback — called recursively via ref
  const playPlaylistFrom = useCallback(async (playlistIdx: number, trackIdx: number) => {
    const gen = ++plGenRef.current;
    const playlist = playlistsRef.current[playlistIdx];
    const file = playlist?.files[trackIdx];
    if (!file) {
      if (cycleRef.current && playlist && playlist.files.length > 0) {
        void playPlaylistFromRef.current(playlistIdx, 0);
      } else {
        setPlaylistPlaying(false);
        setPlaylistPaused(false);
        setPlaylistTrackIdx(-1);
      }
      return;
    }
    setPlaylistTrackIdx(trackIdx);
    setPlaylistPlaying(true);
    setPlaylistPaused(false);
    try {
      const ab = await window.miditrack.readFile(file.path);
      if (gen !== plGenRef.current) return;
      await engineRef.current!.playlistPlay(ab, () => {
        void playPlaylistFromRef.current(playlistIdx, trackIdx + 1);
      });
    } catch {
      if (gen !== plGenRef.current) return;
      void playPlaylistFromRef.current(playlistIdx, trackIdx + 1);
    }
  }, []);
  const playPlaylistFromRef = useRef(playPlaylistFrom);
  useEffect(() => { playPlaylistFromRef.current = playPlaylistFrom; }, [playPlaylistFrom]);

  const onPlay = useCallback(async () => {
    if (playingRef.current || playingTracksRef.current.size > 0) return;
    if (playlistsRef.current.length > 0) {
      if (playlistPlayingRef.current) {
        // Currently playing → pause, remembering position
        engineRef.current!.playlistPause();
        setPlaylistPlaying(false);
        setPlaylistPaused(true);
      } else if (playlistPausedRef.current) {
        // Paused → resume from remembered position
        setPlaylistPlaying(true);
        setPlaylistPaused(false);
        await engineRef.current!.playlistResume();
      } else {
        await playPlaylistFromRef.current(selectedPlaylistIdxRef.current, 0);
      }
    } else {
      await engineRef.current!.play();
      setPlaying(true);
    }
  }, []);

  const onStop = useCallback(() => {
    engineRef.current!.playlistStop();
    engineRef.current!.stop();
    setPlaying(false);
    setPlaylistPlaying(false);
    setPlaylistPaused(false);
    setPlaylistTrackIdx(-1);
    setPlayingTracks(new Set());
  }, []);

  const onToggleTrackPlay = useCallback((slot: number) => {
    const engine = engineRef.current!;
    const pi = currentPageIndexRef.current;
    const aSlot = audioSlot(pi, slot);
    if (playingTracksRef.current.has(aSlot)) {
      engine.pauseTrack(aSlot, settingsRef.current.fadeOutDuration);
      setPlayingTracks((prev) => { const n = new Set(prev); n.delete(aSlot); return n; });
    } else {
      if (playingRef.current || playlistPlayingRef.current || playlistPausedRef.current) return;
      void engine.playTrack(aSlot, () => {
        setPlayingTracks((s) => { const n = new Set(s); n.delete(aSlot); return n; });
      });
      setPlayingTracks((prev) => { const n = new Set(prev); n.add(aSlot); return n; });
    }
  }, []);

  const onStopTrack = useCallback((slot: number) => {
    const engine = engineRef.current!;
    const aSlot = audioSlot(currentPageIndexRef.current, slot);
    engine.stopTrack(aSlot, settingsRef.current.fadeOutDuration);
    setPlayingTracks((prev) => { const n = new Set(prev); n.delete(aSlot); return n; });
  }, []);

  const onToggleCycle = useCallback(() => setCycle((c) => !c), []);

  const onTransport = useCallback((action: TransportAction) => {
    if (action === 'stop') {
      ++plGenRef.current;
      engineRef.current!.playlistStop();
      engineRef.current!.stop();
      setPlaying(false);
      setPlaylistPlaying(false);
      setPlaylistPaused(false);
      setPlaylistTrackIdx(-1);
      setPlayingTracks(new Set());
    }
    if (action === 'cycle') setCycle((c) => !c);
    if (action === 'trackPrev') setCurrentPageIndex((i) => Math.max(0, i - 1));
    if (action === 'trackNext') setCurrentPageIndex((i) => Math.min(pagesRef.current.length - 1, i + 1));
    if (action === 'markerSet') setPlaylistPanelOpen(true);
    if (action === 'markerPrev') {
      const next = Math.max(0, selectedPlaylistIdxRef.current - 1);
      setSelectedPlaylistIdx(next);
      ++plGenRef.current;
      engineRef.current!.playlistStop();
      setPlaylistPlaying(false);
      setPlaylistPaused(false);
      setPlaylistTrackIdx(-1);
    }
    if (action === 'markerNext') {
      const next = Math.min(playlistsRef.current.length - 1, selectedPlaylistIdxRef.current + 1);
      setSelectedPlaylistIdx(next);
      ++plGenRef.current;
      engineRef.current!.playlistStop();
      setPlaylistPlaying(false);
      setPlaylistPaused(false);
      setPlaylistTrackIdx(-1);
    }
    if (action === 'rewind') {
      if (playingRef.current || playingTracksRef.current.size > 0) return;
      const playlistIdx = selectedPlaylistIdxRef.current;
      const playlist = playlistsRef.current[playlistIdx];
      if (!playlist || playlist.files.length === 0) return;
      const cur = playlistTrackIdxRef.current;
      let nextIdx: number;
      if (cur <= 0) {
        if (!cycleRef.current) return;
        nextIdx = playlist.files.length - 1;
      } else {
        nextIdx = cur - 1;
      }
      engineRef.current!.playlistStop();
      void playPlaylistFromRef.current(playlistIdx, nextIdx);
    }
    if (action === 'forward') {
      if (playingRef.current || playingTracksRef.current.size > 0) return;
      const playlistIdx = selectedPlaylistIdxRef.current;
      const playlist = playlistsRef.current[playlistIdx];
      if (!playlist || playlist.files.length === 0) return;
      const cur = playlistTrackIdxRef.current;
      let nextIdx: number;
      if (cur === -1) {
        nextIdx = 0;
      } else if (cur >= playlist.files.length - 1) {
        if (!cycleRef.current) return;
        nextIdx = 0;
      } else {
        nextIdx = cur + 1;
      }
      engineRef.current!.playlistStop();
      void playPlaylistFromRef.current(playlistIdx, nextIdx);
    }
  }, []);

  const onPlayRef = useRef(onPlay);
  const onToggleTrackPlayRef = useRef(onToggleTrackPlay);
  const onStopTrackRef = useRef(onStopTrack);
  const onTransportRef = useRef(onTransport);
  useEffect(() => { onPlayRef.current = onPlay; }, [onPlay]);
  useEffect(() => { onToggleTrackPlayRef.current = onToggleTrackPlay; }, [onToggleTrackPlay]);
  useEffect(() => { onStopTrackRef.current = onStopTrack; }, [onStopTrack]);
  useEffect(() => { onTransportRef.current = onTransport; }, [onTransport]);

  useEffect(() => {
    engineRef.current!.setOnEnded(() => setPlaying(false));
  }, []);

  // Listen for native File > Settings menu item
  useEffect(() => {
    const off = window.miditrack.onOpenSettings(() => setSettingsOpen(true));
    return off;
  }, []);

  // Playlist management
  const onAddPlaylist = useCallback(async () => {
    const dirPath = await window.miditrack.selectDirectory();
    if (!dirPath) return;
    const files = await window.miditrack.readAudioFiles(dirPath);
    const name = basename(dirPath);
    const playlist: Playlist = { id: `pl-${Date.now()}`, name, dirPath, files };
    setPlaylists(prev => [...prev, playlist]);
    setSelectedPlaylistIdx(prev => prev); // keep current
  }, []);

  const onRemovePlaylist = useCallback((idx: number) => {
    setPlaylists(prev => {
      const next = prev.filter((_, i) => i !== idx);
      return next;
    });
    setSelectedPlaylistIdx(prev => Math.max(0, prev >= idx ? prev - 1 : prev));
    ++plGenRef.current;
    engineRef.current!.playlistStop();
    setPlaylistPlaying(false);
    setPlaylistPaused(false);
    setPlaylistTrackIdx(-1);
  }, []);

  const onSelectPlaylist = useCallback((idx: number) => {
    setSelectedPlaylistIdx(idx);
    ++plGenRef.current;
    engineRef.current!.playlistStop();
    setPlaylistPlaying(false);
    setPlaylistPaused(false);
    setPlaylistTrackIdx(-1);
  }, []);

  const onSelectSong = useCallback((idx: number) => {
    engineRef.current!.playlistStop();
    void playPlaylistFromRef.current(selectedPlaylistIdxRef.current, idx);
  }, []);

  // Page navigation
  const onPrevPage = useCallback(() => {
    setCurrentPageIndex((i) => Math.max(0, i - 1));
  }, []);

  const onNextPage = useCallback(() => {
    setCurrentPageIndex((i) => Math.min(pagesRef.current.length - 1, i + 1));
  }, []);

  const onAddPage = useCallback(() => {
    setPages((prev) => {
      if (prev.length >= MAX_PAGES) return prev;
      const next = [...prev, newPage(prev.length)];
      setCurrentPageIndex(next.length - 1);
      return next;
    });
  }, []);

  const onRemovePage = useCallback(() => {
    const pi = currentPageIndexRef.current;
    const engine = engineRef.current!;
    engine.stop();
    setPlaying(false);
    setPlayingTracks((prev) => {
      const n = new Set(prev);
      for (let s = 0; s < TRACK_COUNT; s++) n.delete(audioSlot(pi, s));
      return n;
    });
    for (let s = 0; s < TRACK_COUNT; s++) engine.unload(audioSlot(pi, s));
    setLoading((l) => {
      const n = { ...l };
      for (let s = 0; s < TRACK_COUNT; s++) delete n[loadKey(pi, s)];
      return n;
    });
    setErrors((e) => {
      const n = { ...e };
      for (let s = 0; s < TRACK_COUNT; s++) delete n[loadKey(pi, s)];
      return n;
    });
    setPages((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== pi);
      setCurrentPageIndex(Math.min(pi, next.length - 1));
      return next;
    });
  }, []);

  const onResetPage = useCallback(() => {
    const pi = currentPageIndexRef.current;
    const engine = engineRef.current!;
    engineRef.current!.stop();
    setPlaying(false);
    setPlayingTracks((prev) => {
      const n = new Set(prev);
      for (let s = 0; s < TRACK_COUNT; s++) n.delete(audioSlot(pi, s));
      return n;
    });
    setPages((prev) => {
      const next = [...prev];
      const page = next[pi];
      if (!page) return prev;
      const fresh = newPage(pi);
      next[pi] = { ...fresh, id: page.id };
      return next;
    });
    for (let s = 0; s < TRACK_COUNT; s++) {
      engine.unload(audioSlot(pi, s));
    }
    setLoading((l) => {
      const n = { ...l };
      for (let s = 0; s < TRACK_COUNT; s++) delete n[loadKey(pi, s)];
      return n;
    });
    setErrors((e) => {
      const n = { ...e };
      for (let s = 0; s < TRACK_COUNT; s++) delete n[loadKey(pi, s)];
      return n;
    });
  }, []);

  const onResetAll = useCallback(() => {
    const engine = engineRef.current!;
    engine.stop();
    setPlaying(false);
    setPlayingTracks(new Set());
    const allPages = pagesRef.current;
    for (let pi = 0; pi < allPages.length; pi++) {
      for (let s = 0; s < TRACK_COUNT; s++) {
        engine.unload(audioSlot(pi, s));
      }
    }
    setPages([newPage(0)]);
    setCurrentPageIndex(0);
    setLoading({});
    setErrors({});
  }, []);

  // MIDI setup (once on mount)
  useEffect(() => {
    const host = new MidiHost();
    const router = new MidiRouter(NANOKONTROL2_PRESET, {
      setContinuous: (slot, param: ContinuousParam, v) => {
        if (slot === 0 && param === 'pan') {
          // Knob 1 controls playlist volume: pan -1..1 → volume 0..1
          onPlaylistVolumeChange((v + 1) / 2);
          flashStrip(slot, 'knob');
          return;
        }
        const pi = currentPageIndexRef.current;
        updateTrackRef.current(slot, { [param]: v } as Partial<Track>, pi);
        flashStrip(slot, param === 'volume' ? 'fader' : 'knob');
      },
      toggleBool: (slot, param: BoolParam) => {
        if (param === 'arm') { onToggleTrackPlayRef.current(slot); flashStrip(slot, 'r'); return; }
        if (param === 'stop') { onStopTrackRef.current(slot); flashStrip(slot, 'm'); return; }
        const pi = currentPageIndexRef.current;
        const cur = pagesRef.current[pi]?.tracks.find((t) => t.slot === slot);
        if (!cur) return;
        updateTrackRef.current(slot, { [param]: !cur[param as keyof Track] } as Partial<Track>, pi);
        flashStrip(slot, param === 'mute' ? 'm' : 's');
      },
      transport: (action: TransportAction) => {
        if (action === 'play') void onPlayRef.current();
        else onTransportRef.current(action);
        flashTransport(action);
      }
    });

    let offEvent: (() => void) | undefined;
    let offDevices: (() => void) | undefined;

    void host.init().then((res) => {
      if (!res.ok) return;
      offEvent = host.onEvent((e) => router.route(e));
      offDevices = host.onDevices((devices) => {
        const match = devices.find((d) => NANOKONTROL2_PRESET.controllerMatch?.test(d.name) ?? false);
        setMidiDeviceName(match ? match.name : devices[0]?.name ?? null);
      });
    });

    return () => { offEvent?.(); offDevices?.(); };
  }, [flashStrip, flashTransport]);

  const loadIntoSlot = useCallback(async (pageIndex: number, slot: number, file: File) => {
    const engine = engineRef.current!;
    const key = loadKey(pageIndex, slot);
    const aSlot = audioSlot(pageIndex, slot);
    if (playingTracksRef.current.has(aSlot)) {
      engine.pauseTrack(aSlot, 0);
      setPlayingTracks((prev) => { const n = new Set(prev); n.delete(aSlot); return n; });
    }
    setLoading((l) => ({ ...l, [key]: true }));
    setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
    try {
      await engine.loadFile(aSlot, file);
      const filePath = window.miditrack.getPathForFile(file);
      setPages((prev) => {
        const next = [...prev];
        const page = next[pageIndex];
        if (!page) return prev;
        next[pageIndex] = {
          ...page,
          tracks: page.tracks.map((t) =>
            t.slot === slot
              ? { ...t, name: file.name, filePath }
              : t
          )
        };
        return next;
      });
      // push current params to engine
      const t = pagesRef.current[pageIndex]?.tracks.find((x) => x.slot === slot);
      if (t) engine.setParams(aSlot, { volume: t.volume, pan: t.pan, mute: t.mute, solo: t.solo, loop: t.loop });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'decode failed';
      setErrors((e) => ({ ...e, [key]: msg }));
    } finally {
      setLoading((l) => { const n = { ...l }; delete n[key]; return n; });
    }
  }, []);

  const loadFilesToSlots = useCallback((files: File[], startSlot?: number) => {
    const audio = files.filter((f) => isAudioFile(f.name));
    if (audio.length === 0) return;

    const pi = currentPageIndexRef.current;

    if (startSlot !== undefined) {
      void loadIntoSlot(pi, startSlot, audio[0]);
      return;
    }

    const occupied = new Set(
      pagesRef.current[pi]?.tracks.filter((t) => t.filePath).map((t) => t.slot) ?? []
    );
    let cursor = 0;
    for (const f of audio) {
      while (cursor < TRACK_COUNT && occupied.has(cursor)) cursor++;
      if (cursor >= TRACK_COUNT) break;
      occupied.add(cursor);
      void loadIntoSlot(pi, cursor, f);
      cursor++;
    }
  }, [loadIntoSlot]);

  const onDropAnywhere = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    loadFilesToSlots(Array.from(e.dataTransfer.files));
  }, [loadFilesToSlots]);

  const onDropOnStrip = useCallback((slot: number, files: File[]) => {
    loadFilesToSlots(files, slot);
  }, [loadFilesToSlots]);

  const onSelectFileForSlot = useCallback(async (slot: number) => {
    const filePath = await window.miditrack.selectAudioFile();
    if (!filePath) return;
    const ab = await window.miditrack.readFile(filePath);
    const name = filePath.split('/').pop() ?? filePath.split('\\').pop() ?? filePath;
    const file = new File([ab], name);
    await loadIntoSlot(currentPageIndexRef.current, slot, file);
  }, [loadIntoSlot]);

  const onClearFileForSlot = useCallback((slot: number) => {
    const pi = currentPageIndexRef.current;
    const engine = engineRef.current!;
    const aSlot = audioSlot(pi, slot);
    if (playingTracksRef.current.has(aSlot)) {
      engine.pauseTrack(aSlot, 0);
      setPlayingTracks((prev) => { const n = new Set(prev); n.delete(aSlot); return n; });
    }
    engine.unload(aSlot);
    setPages((prev) => {
      const next = [...prev];
      const page = next[pi];
      if (!page) return prev;
      next[pi] = {
        ...page,
        tracks: page.tracks.map((t) =>
          t.slot === slot ? { ...t, name: '', filePath: '' } : t
        )
      };
      return next;
    });
    const key = loadKey(pi, slot);
    setLoading((l) => { const n = { ...l }; delete n[key]; return n; });
    setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  }, []);

  const onPlaylistVolumeChange = useCallback((v: number) => {
    setPlaylistVolume(v);
    engineRef.current!.setPlaylistVolume(v);
  }, []);

  const allEmpty = currentTracks.every((t) => !t.filePath);

  return (
    <div
      className="app"
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDrop={onDropAnywhere}
    >
      <div className="app__title">
        <img src="./icon.png" alt="" className="app__title-icon" />
        <span>MidiTracks</span>
        <button className="app__gear-btn" onClick={() => setSettingsOpen(true)} title="Settings">⚙</button>
      </div>

      {settingsOpen && (
        <Settings
          settings={settings}
          onSave={saveSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {playlistPanelOpen && (
        <PlaylistPanel
          playlists={playlists}
          selectedIndex={selectedPlaylistIdx}
          playingIndex={playlistTrackIdx}
          isPlaying={playlistPlaying}
          onSelectPlaylist={onSelectPlaylist}
          onAddPlaylist={onAddPlaylist}
          onRemovePlaylist={onRemovePlaylist}
          onClose={() => setPlaylistPanelOpen(false)}
        />
      )}

      <Device
        tracks={currentTracks}
        playing={playing || playlistPlaying}
        cycle={cycle}
        midiDeviceName={midiDeviceName}
        playlists={playlists}
        selectedPlaylistIdx={selectedPlaylistIdx}
        playlistTrackIdx={playlistTrackIdx}
        playlistPlaying={playlistPlaying}
        onSelectSong={onSelectSong}
        loading={Object.fromEntries(
          Object.entries(loading)
            .filter(([k]) => k.startsWith(`${currentPageIndex}-`))
            .map(([k, v]) => [Number(k.split('-')[1]), v])
        )}
        errors={Object.fromEntries(
          Object.entries(errors)
            .filter(([k]) => k.startsWith(`${currentPageIndex}-`))
            .map(([k, v]) => [Number(k.split('-')[1]), v])
        )}
        stripFlash={stripFlash}
        transportFlash={transportFlash}
        currentPageIndex={currentPageIndex}
        totalPages={pages.length}
        onPlay={onPlay}
        onStop={onStop}
        onToggleCycle={onToggleCycle}
        onTransport={onTransport}
        playingTracks={playingTracks}
        onUpdateTrack={updateTrack}
        onToggleTrackPlay={onToggleTrackPlay}
        onStopTrack={onStopTrack}
        onDropOnStrip={onDropOnStrip}
        onSelectFileForSlot={onSelectFileForSlot}
        onClearFileForSlot={onClearFileForSlot}
        playlistVolume={playlistVolume}
        onPlaylistVolumeChange={onPlaylistVolumeChange}
        onPrevPage={onPrevPage}
        onNextPage={onNextPage}
        onAddPage={onAddPage}
        onRemovePage={onRemovePage}
        onResetPage={onResetPage}
        onResetAll={onResetAll}
      />

      {allEmpty && (
        <div className="drop-hint">drop audio files anywhere on the device</div>
      )}
    </div>
  );
}
