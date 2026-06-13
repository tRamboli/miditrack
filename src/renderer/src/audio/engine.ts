export type TrackParams = {
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  loop: boolean;
};

const DEFAULT_PARAMS: TrackParams = { volume: 0.8, pan: 0, mute: false, solo: false, loop: false };

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

  // Per-track independent playback
  private ptSources = new Map<number, AudioBufferSourceNode>();
  private ptGains = new Map<number, GainNode>();
  private ptPans = new Map<number, StereoPannerNode>();
  private ptOffsets = new Map<number, number>();
  private ptStartTimes = new Map<number, number>();
  // Slots currently mid-fade-pause (source still alive, offset already recorded)
  private ptFading = new Set<number>();

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
    this.cleanupPtSource(slot);
    this.ptOffsets.delete(slot);
    this.buffers.delete(slot);
    this.params.delete(slot);
  }

  setParams(slot: number, patch: Partial<TrackParams>) {
    const cur = this.params.get(slot) ?? { ...DEFAULT_PARAMS };
    const next = { ...cur, ...patch };
    this.params.set(slot, next);
    this.recomputeAnySolo();

    const now = this.ctx.currentTime;
    for (const s of this.gains.keys()) {
      this.gains.get(s)!.gain.setTargetAtTime(this.effectiveGain(s), now, 0.01);
    }
    const pan = this.pans.get(slot);
    if (pan) pan.pan.setTargetAtTime(next.pan, now, 0.01);
    const src = this.sources.get(slot);
    if (src && patch.loop !== undefined) src.loop = patch.loop;

    // Mirror pan/volume changes to per-track playback too
    const ptGain = this.ptGains.get(slot);
    if (ptGain && patch.volume !== undefined) ptGain.gain.setTargetAtTime(patch.volume, now, 0.01);
    const ptPan = this.ptPans.get(slot);
    if (ptPan && patch.pan !== undefined) ptPan.pan.setTargetAtTime(patch.pan, now, 0.01);
    const ptSrc = this.ptSources.get(slot);
    if (ptSrc && patch.loop !== undefined) ptSrc.loop = patch.loop;
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

  // --- Per-track independent playback ---

  async playTrack(slot: number, onEnded: () => void): Promise<void> {
    const buffer = this.buffers.get(slot);
    if (!buffer) return;
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    // Stop any existing source (including mid-fade ones) without resetting offset
    this.cleanupPtSource(slot);

    const p = this.params.get(slot) ?? { ...DEFAULT_PARAMS };
    const offset = this.ptOffsets.get(slot) ?? 0;

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = p.loop;

    const gain = this.ctx.createGain();
    gain.gain.value = p.volume;

    const pan = this.ctx.createStereoPanner();
    pan.pan.value = p.pan;

    src.connect(gain).connect(pan).connect(this.master);
    src.start(this.ctx.currentTime, offset);

    this.ptSources.set(slot, src);
    this.ptGains.set(slot, gain);
    this.ptPans.set(slot, pan);
    this.ptStartTimes.set(slot, this.ctx.currentTime);

    src.onended = () => {
      if (this.ptSources.get(slot) !== src) return;
      const wasFading = this.ptFading.has(slot);
      this.cleanupPtSource(slot);
      if (!wasFading) {
        // Natural end — reset position to start
        this.ptOffsets.delete(slot);
        onEnded();
      }
      // If wasFading: offset was already recorded at pause time; UI already notified
    };
  }

  pauseTrack(slot: number, fadeSeconds: number): void {
    const src = this.ptSources.get(slot);
    if (!src) return;

    const buffer = this.buffers.get(slot);
    const p = this.params.get(slot) ?? { ...DEFAULT_PARAMS };
    const startTime = this.ptStartTimes.get(slot) ?? this.ctx.currentTime;
    const prevOffset = this.ptOffsets.get(slot) ?? 0;
    let newOffset = prevOffset + (this.ctx.currentTime - startTime);

    if (buffer && !p.loop) {
      newOffset = Math.min(newOffset, buffer.duration);
    } else if (buffer && p.loop && buffer.duration > 0) {
      newOffset = newOffset % buffer.duration;
    }

    this.ptOffsets.set(slot, newOffset);

    if (fadeSeconds <= 0) {
      this.cleanupPtSource(slot);
      return;
    }

    const gain = this.ptGains.get(slot);
    const now = this.ctx.currentTime;
    if (gain) {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + fadeSeconds);
    }

    // Mark as fading so onended knows not to reset offset or call UI callback
    this.ptFading.add(slot);
    try { src.stop(now + fadeSeconds); } catch { /* already scheduled to stop */ }
  }

  stopAllPerTrack(): void {
    for (const slot of [...this.ptSources.keys()]) {
      this.cleanupPtSource(slot);
    }
    this.ptOffsets.clear();
  }

  private cleanupPtSource(slot: number): void {
    const src = this.ptSources.get(slot);
    if (src) {
      src.onended = null;
      try { src.stop(); } catch { /* already stopped */ }
      src.disconnect();
      this.ptSources.delete(slot);
    }
    this.ptFading.delete(slot);
    this.ptGains.get(slot)?.disconnect();
    this.ptGains.delete(slot);
    this.ptPans.get(slot)?.disconnect();
    this.ptPans.delete(slot);
    this.ptStartTimes.delete(slot);
  }

  // --- Global playback ---

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
      src.loop = p.loop;
      src.connect(gain).connect(pan).connect(this.master);
      src.start(startAt);
      this.sources.set(slot, src);
      this.gains.set(slot, gain);
      this.pans.set(slot, pan);
      if (buffer.duration > longest) longest = buffer.duration;
    }
    this.playing = true;

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
    this.stopAllPerTrack();
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

  currentTime(): number {
    if (!this.playing) return 0;
    return Math.max(0, this.ctx.currentTime - this.startedAtCtxTime);
  }
}
