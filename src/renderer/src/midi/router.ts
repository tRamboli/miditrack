import { MidiEvent } from './devices';
import {
  BoolParam,
  ContinuousParam,
  MidiBinding,
  MidiPreset,
  TrackParam,
  TransportAction
} from './types';

export type Dispatch = {
  setContinuous: (slot: number, param: ContinuousParam, value01: number) => void;
  toggleBool: (slot: number, param: BoolParam) => void;
  transport: (action: TransportAction) => void;
};

const CONTINUOUS: ReadonlySet<TrackParam> = new Set<TrackParam>(['volume', 'pan']);

function bindingMatches(b: MidiBinding, e: MidiEvent): boolean {
  if (b.type === 'cc') {
    if (e.kind !== 'cc') return false;
    if (b.number !== e.controller) return false;
  } else {
    if (e.kind !== 'noteon' && e.kind !== 'noteoff') return false;
    if (b.number !== e.note) return false;
  }
  if (b.channel !== 'any' && b.channel !== e.channel) return false;
  return true;
}

function rawValue(e: MidiEvent): number {
  if (e.kind === 'cc') return e.value;
  if (e.kind === 'noteon') return e.velocity;
  return 0;
}

const CONTINUOUS_THRESHOLD = 4 / 127; // ignore jitter smaller than ~4 MIDI steps

export class MidiRouter {
  private preset: MidiPreset;
  private dispatch: Dispatch;
  private lastContinuous = new Map<string, number>();

  constructor(preset: MidiPreset, dispatch: Dispatch) {
    this.preset = preset;
    this.dispatch = dispatch;
  }

  setPreset(p: MidiPreset) { this.preset = p; }
  setDispatch(d: Dispatch) { this.dispatch = d; }

  route(e: MidiEvent) {
    for (let slot = 0; slot < this.preset.tracks.length; slot++) {
      const params = this.preset.tracks[slot];
      for (const k of Object.keys(params) as TrackParam[]) {
        const b = params[k];
        if (!b || !bindingMatches(b, e)) continue;
        this.applyTrack(slot, k, b, rawValue(e));
      }
    }
    for (const k of Object.keys(this.preset.transport) as TransportAction[]) {
      const b = this.preset.transport[k];
      if (!b || !bindingMatches(b, e)) continue;
      if (rawValue(e) < 64) continue; // press-only for transport
      this.dispatch.transport(k);
    }
  }

  private applyTrack(slot: number, param: TrackParam, b: MidiBinding, raw: number) {
    if (CONTINUOUS.has(param)) {
      const cont = param as ContinuousParam;
      let mapped = raw / 127;
      if (cont === 'pan') {
        // 64 is center; map [0..63] → [-1..0) and [64..127] → [0..1]
        mapped = raw <= 64 ? (raw - 64) / 64 : (raw - 64) / 63;
      }
      const key = `${slot}:${cont}`;
      const last = this.lastContinuous.get(key);
      if (last !== undefined && Math.abs(mapped - last) < CONTINUOUS_THRESHOLD) return;
      this.lastContinuous.set(key, mapped);
      this.dispatch.setContinuous(slot, cont, mapped);
      return;
    }
    // Bool param: only react on press; ignore release (CC < 64).
    if (raw < 64) return;
    if (b.mode === 'momentary') {
      // Momentary doesn't make sense for our mute/solo model — treat as toggle.
    }
    this.dispatch.toggleBool(slot, param as BoolParam);
  }
}
