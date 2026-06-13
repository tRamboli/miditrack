import { useCallback, useEffect, useRef, useState } from 'react';
import { TRACK_COUNT, Track, Page, MAX_PAGES, newPage, audioSlot, AppSettings, DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from './types';
import { Device } from './ui/Device';
import { Settings } from './ui/Settings';
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

type StripCtrl = keyof StripFlash;

export function App() {
  const [pages, setPages] = useState<Page[]>(() => [newPage(0)]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [cycle, setCycle] = useState(false);
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

  const [playingTracks, setPlayingTracks] = useState<Set<number>>(new Set());
  const playingTracksRef = useRef(playingTracks);
  useEffect(() => { playingTracksRef.current = playingTracks; }, [playingTracks]);
  const [stripFlash, setStripFlash] = useState<Record<number, StripFlash>>({});
  const [transportFlash, setTransportFlash] = useState<TransportFlash>({});

  const engineRef = useRef<AudioEngine | null>(null);
  if (!engineRef.current) engineRef.current = new AudioEngine();

  // Stable refs so async/MIDI callbacks always see latest values
  const pagesRef = useRef(pages);
  useEffect(() => { pagesRef.current = pages; }, [pages]);
  const currentPageIndexRef = useRef(currentPageIndex);
  useEffect(() => { currentPageIndexRef.current = currentPageIndex; }, [currentPageIndex]);

  const currentTracks = pages[currentPageIndex]?.tracks ?? [];

  // Loading/error keys are "{pageIndex}-{slot}"
  const loadKey = (pi: number, slot: number) => `${pi}-${slot}`;

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

  const onPlay = useCallback(async () => {
    await engineRef.current!.play();
    setPlaying(true);
  }, []);

  const onStop = useCallback(() => {
    engineRef.current!.stop();
    setPlaying(false);
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
      void engine.playTrack(aSlot, () => {
        setPlayingTracks((s) => { const n = new Set(s); n.delete(aSlot); return n; });
      });
      setPlayingTracks((prev) => { const n = new Set(prev); n.add(aSlot); return n; });
    }
  }, []);

  const onToggleCycle = useCallback(() => setCycle((c) => !c), []);

  const onTransport = useCallback((action: TransportAction) => {
    if (action === 'cycle') setCycle((c) => !c);
  }, []);

  const onPlayRef = useRef(onPlay);
  const onStopRef = useRef(onStop);
  const onToggleTrackPlayRef = useRef(onToggleTrackPlay);
  useEffect(() => { onPlayRef.current = onPlay; }, [onPlay]);
  useEffect(() => { onStopRef.current = onStop; }, [onStop]);
  useEffect(() => { onToggleTrackPlayRef.current = onToggleTrackPlay; }, [onToggleTrackPlay]);

  useEffect(() => {
    engineRef.current!.setOnEnded(() => setPlaying(false));
  }, []);

  // Listen for native File > Settings menu item
  useEffect(() => {
    const off = window.miditrack.onOpenSettings(() => setSettingsOpen(true));
    return off;
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
        const pi = currentPageIndexRef.current;
        updateTrackRef.current(slot, { [param]: v } as Partial<Track>, pi);
        flashStrip(slot, param === 'volume' ? 'fader' : 'knob');
      },
      toggleBool: (slot, param: BoolParam) => {
        if (param === 'arm') { onToggleTrackPlayRef.current(slot); flashStrip(slot, 'r'); return; }
        const pi = currentPageIndexRef.current;
        const cur = pagesRef.current[pi]?.tracks.find((t) => t.slot === slot);
        if (!cur) return;
        updateTrackRef.current(slot, { [param]: !cur[param as keyof Track] } as Partial<Track>, pi);
        flashStrip(slot, param === 'mute' ? 'm' : 's');
      },
      transport: (action: TransportAction) => {
        if (action === 'play') void onPlayRef.current();
        else if (action === 'stop') onStopRef.current();
        else if (action === 'cycle') setCycle((c) => !c);
        else if (action === 'trackPrev') setCurrentPageIndex((i) => Math.max(0, i - 1));
        else if (action === 'trackNext') setCurrentPageIndex((i) => Math.min(pagesRef.current.length - 1, i + 1));
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
    setLoading((l) => ({ ...l, [key]: true }));
    setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
    try {
      const aSlot = audioSlot(pageIndex, slot);
      await engine.loadFile(aSlot, file);
      setPages((prev) => {
        const next = [...prev];
        const page = next[pageIndex];
        if (!page) return prev;
        next[pageIndex] = {
          ...page,
          tracks: page.tracks.map((t) =>
            t.slot === slot
              ? { ...t, name: file.name, filePath: (file as unknown as { path?: string }).path ?? file.name }
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

      <Device
        tracks={currentTracks}
        playing={playing}
        cycle={cycle}
        midiDeviceName={midiDeviceName}
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
        onDropOnStrip={onDropOnStrip}
        onPrevPage={onPrevPage}
        onNextPage={onNextPage}
        onAddPage={onAddPage}
        onResetPage={onResetPage}
        onResetAll={onResetAll}
      />

      {allEmpty && (
        <div className="drop-hint">drop audio files anywhere on the device</div>
      )}
    </div>
  );
}
