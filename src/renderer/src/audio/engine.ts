export type TrackParams = {
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
};

const DEFAULT_PARAMS: TrackParams = { volume: 0.8, pan: 0, mute: false, solo: false };

export class AudioEngine {
  private ctx: AudioContext;
  private master: GainNode;
  private buffers = new Map<number, AudioBuffer>();
  private sources = new Map<number, AudioBufferSourceNode>();
  private gains = new Map<number, GainNode>();
  private pans = new Map<number, StereoPannerNode>();
  private params = new Map<number, TrackParams>();
  private playing = false;
  private startedAtCtxTime = 0;
  private anySolo = false;
  private onEnded?: () => void;

  constructor() {
    this.ctx = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' });
    this.master = this.ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(this.ctx.destination);
  }

  setOnEnded(cb: () => void) {
    this.onEnded = cb;
  }

  async loadFile(slot: number, file: File): Promise<{ duration: number }> {
    const ab = await file.arrayBuffer();
    const buffer = await this.ctx.decodeAudioData(ab);
    this.buffers.set(slot, buffer);
    if (!this.params.has(slot)) {
      this.params.set(slot, { ...DEFAULT_PARAMS });
    }
    return { duration: buffer.duration };
  }

  unload(slot: number) {
    this.buffers.delete(slot);
    this.params.delete(slot);
  }

  setParams(slot: number, patch: Partial<TrackParams>) {
    const cur = this.params.get(slot) ?? { ...DEFAULT_PARAMS };
    const next = { ...cur, ...patch };
    this.params.set(slot, next);
    this.recomputeAnySolo();

    const now = this.ctx.currentTime;
    // Recompute every effective gain because a solo toggle on one strip
    // changes the gain on every other strip.
    for (const s of this.gains.keys()) {
      const g = this.gains.get(s)!;
      g.gain.setTargetAtTime(this.effectiveGain(s), now, 0.01);
    }
    const pan = this.pans.get(slot);
    if (pan) pan.pan.setTargetAtTime(next.pan, now, 0.01);
  }

  private recomputeAnySolo() {
    this.anySolo = false;
    for (const p of this.params.values()) {
      if (p.solo) { this.anySolo = true; break; }
    }
  }

  private effectiveGain(slot: number): number {
    const p = this.params.get(slot);
    if (!p) return 0;
    if (p.mute) return 0;
    if (this.anySolo && !p.solo) return 0;
    return p.volume;
  }

  async play() {
    if (this.playing) return;
    if (this.buffers.size === 0) return;
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    const startAt = this.ctx.currentTime + 0.1;
    this.startedAtCtxTime = startAt;

    let longest = 0;
    for (const [slot, buffer] of this.buffers) {
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const gain = this.ctx.createGain();
      const pan = this.ctx.createStereoPanner();
      const p = this.params.get(slot) ?? { ...DEFAULT_PARAMS };
      gain.gain.value = this.effectiveGain(slot);
      pan.pan.value = p.pan;
      src.connect(gain).connect(pan).connect(this.master);
      src.start(startAt);
      this.sources.set(slot, src);
      this.gains.set(slot, gain);
      this.pans.set(slot, pan);
      if (buffer.duration > longest) longest = buffer.duration;
    }
    this.playing = true;

    // Use the longest source's onended as the "playback finished" signal.
    let longestSrc: AudioBufferSourceNode | undefined;
    let longestDur = 0;
    for (const [slot, src] of this.sources) {
      const dur = this.buffers.get(slot)?.duration ?? 0;
      if (dur > longestDur) { longestDur = dur; longestSrc = src; }
    }
    if (longestSrc) {
      longestSrc.onended = () => {
        if (this.playing) {
          this.stopInternal();
          this.onEnded?.();
        }
      };
    }
  }

  stop() {
    if (!this.playing) return;
    this.stopInternal();
  }

  private stopInternal() {
    for (const src of this.sources.values()) {
      try { src.stop(); } catch { /* already stopped */ }
      src.disconnect();
    }
    for (const g of this.gains.values()) g.disconnect();
    for (const p of this.pans.values()) p.disconnect();
    this.sources.clear();
    this.gains.clear();
    this.pans.clear();
    this.playing = false;
  }

  isPlaying() { return this.playing; }

  // Current playback position (seconds). Returns 0 when stopped.
  currentTime(): number {
    if (!this.playing) return 0;
    return Math.max(0, this.ctx.currentTime - this.startedAtCtxTime);
  }
}
