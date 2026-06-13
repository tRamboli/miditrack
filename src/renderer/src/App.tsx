import { useCallback, useEffect, useRef, useState } from 'react';
import { TRACK_COUNT, Track, emptyTrack } from './types';
import { Device } from './ui/Device';
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
  const [tracks, setTracks] = useState<Track[]>(() =>
    Array.from({ length: TRACK_COUNT }, (_, i) => emptyTrack(i))
  );
  const [playing, setPlaying] = useState(false);
  const [cycle, setCycle] = useState(false);
  const [loading, setLoading] = useState<Record<number, boolean>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [midiDeviceName, setMidiDeviceName] = useState<string | null>(null);

  // Flash state for MIDI activity illumination
  const [stripFlash, setStripFlash] = useState<Record<number, StripFlash>>({});
  const [transportFlash, setTransportFlash] = useState<TransportFlash>({});

  const engineRef = useRef<AudioEngine | null>(null);
  if (!engineRef.current) engineRef.current = new AudioEngine();

  const tracksRef = useRef(tracks);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);

  const flashStrip = useCallback((slot: number, ctrl: StripCtrl) => {
    setStripFlash((prev) => ({ ...prev, [slot]: { ...(prev[slot] || {}), [ctrl]: true } }));
    window.setTimeout(() => {
      setStripFlash((prev) => {
        const cur = prev[slot];
        if (!cur) return prev;
        const nextSlot = { ...cur };
        delete nextSlot[ctrl];
        return { ...prev, [slot]: nextSlot };
      });
    }, FLASH_MS);
  }, []);

  const flashTransport = useCallback((action: TransportAction) => {
    setTransportFlash((prev) => ({ ...prev, [action]: true }));
    window.setTimeout(() => {
      setTransportFlash((prev) => {
        const next = { ...prev };
        delete next[action];
        return next;
      });
    }, FLASH_MS);
  }, []);

  const updateTrack = useCallback((slot: number, patch: Partial<Track>) => {
    const engine = engineRef.current!;
    setTracks((prev) => prev.map((t) => (t.slot === slot ? { ...t, ...patch } : t)));

    const audioPatch: Parameters<typeof engine.setParams>[1] = {};
    if (patch.volume !== undefined) audioPatch.volume = patch.volume;
    if (patch.pan !== undefined) audioPatch.pan = patch.pan;
    if (patch.mute !== undefined) audioPatch.mute = patch.mute;
    if (patch.solo !== undefined) audioPatch.solo = patch.solo;
    if (Object.keys(audioPatch).length > 0) engine.setParams(slot, audioPatch);
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
  }, []);

  const onToggleCycle = useCallback(() => setCycle((c) => !c), []);

  const onTransport = useCallback((action: TransportAction) => {
    if (action === 'cycle') setCycle((c) => !c);
    // Other transport actions are not wired yet
  }, []);

  const onPlayRef = useRef(onPlay);
  const onStopRef = useRef(onStop);
  useEffect(() => { onPlayRef.current = onPlay; }, [onPlay]);
  useEffect(() => { onStopRef.current = onStop; }, [onStop]);

  useEffect(() => {
    const engine = engineRef.current!;
    engine.setOnEnded(() => setPlaying(false));
  }, []);

  // MIDI setup
  useEffect(() => {
    const host = new MidiHost();
    const router = new MidiRouter(NANOKONTROL2_PRESET, {
      setContinuous: (slot, param: ContinuousParam, v) => {
        updateTrackRef.current(slot, { [param]: v } as Partial<Track>);
        flashStrip(slot, param === 'volume' ? 'fader' : 'knob');
      },
      toggleBool: (slot, param: BoolParam) => {
        if (param === 'arm') {
          flashStrip(slot, 'r');
          return;
        }
        const cur = tracksRef.current.find((t) => t.slot === slot);
        if (!cur) return;
        updateTrackRef.current(slot, { [param]: !cur[param] } as Partial<Track>);
        flashStrip(slot, param === 'mute' ? 'm' : 's');
      },
      transport: (action: TransportAction) => {
        if (action === 'play') void onPlayRef.current();
        else if (action === 'stop') onStopRef.current();
        else if (action === 'cycle') setCycle((c) => !c);
        flashTransport(action);
      }
    });

    let offEvent: (() => void) | undefined;
    let offDevices: (() => void) | undefined;

    void host.init().then((res) => {
      if (!res.ok) {
        setMidiDeviceName(null);
        return;
      }
      offEvent = host.onEvent((e) => router.route(e));
      offDevices = host.onDevices((devices) => {
        const match = devices.find(
          (d) => NANOKONTROL2_PRESET.controllerMatch?.test(d.name) ?? false
        );
        setMidiDeviceName(match ? match.name : devices[0]?.name ?? null);
      });
    });

    return () => {
      offEvent?.();
      offDevices?.();
    };
  }, [flashStrip, flashTransport]);

  const loadIntoSlot = useCallback(async (slot: number, file: File) => {
    const engine = engineRef.current!;
    setLoading((l) => ({ ...l, [slot]: true }));
    setErrors((e) => {
      const next = { ...e }; delete next[slot]; return next;
    });
    try {
      await engine.loadFile(slot, file);
      setTracks((prev) =>
        prev.map((t) =>
          t.slot === slot
            ? { ...t, name: file.name, filePath: (file as unknown as { path?: string }).path ?? file.name }
            : t
        )
      );
      const t = tracksRef.current.find((x) => x.slot === slot);
      if (t) {
        engine.setParams(slot, {
          volume: t.volume, pan: t.pan, mute: t.mute, solo: t.solo
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'decode failed';
      setErrors((e) => ({ ...e, [slot]: msg }));
    } finally {
      setLoading((l) => {
        const next = { ...l }; delete next[slot]; return next;
      });
    }
  }, []);

  const loadFilesToSlots = useCallback((files: File[], startSlot?: number) => {
    const audio = files.filter((f) => isAudioFile(f.name));
    if (audio.length === 0) return;

    if (startSlot !== undefined) {
      void loadIntoSlot(startSlot, audio[0]);
      return;
    }

    const occupied = new Set(tracksRef.current.filter((t) => t.filePath).map((t) => t.slot));
    let cursor = 0;
    for (const f of audio) {
      while (cursor < TRACK_COUNT && occupied.has(cursor)) cursor++;
      if (cursor >= TRACK_COUNT) break;
      const slot = cursor;
      occupied.add(slot);
      cursor++;
      void loadIntoSlot(slot, f);
    }
  }, [loadIntoSlot]);

  const onDropAnywhere = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      loadFilesToSlots(files);
    },
    [loadFilesToSlots]
  );

  const onDropOnStrip = useCallback(
    (slot: number, files: File[]) => loadFilesToSlots(files, slot),
    [loadFilesToSlots]
  );

  const allEmpty = tracks.every((t) => !t.filePath);

  return (
    <div
      className="app"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={onDropAnywhere}
    >
      <div className="app__title">
        <img src="./icon.png" alt="" className="app__title-icon" />
        <span>MidiTracks</span>
      </div>

      <Device
        tracks={tracks}
        playing={playing}
        cycle={cycle}
        midiDeviceName={midiDeviceName}
        loading={loading}
        errors={errors}
        stripFlash={stripFlash}
        transportFlash={transportFlash}
        onPlay={onPlay}
        onStop={onStop}
        onToggleCycle={onToggleCycle}
        onTransport={onTransport}
        onUpdateTrack={updateTrack}
        onDropOnStrip={onDropOnStrip}
      />

      {allEmpty && (
        <div className="drop-hint">
          drop audio files anywhere on the device
        </div>
      )}
    </div>
  );
}
