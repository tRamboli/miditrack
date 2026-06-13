import { MidiPreset } from '../types';

// Korg nanoKONTROL2 factory CC map (Control Surface mode, default Scene).
// Channel is set to 'any' so it works regardless of the controller's MIDI channel setting.
export const NANOKONTROL2_PRESET: MidiPreset = {
  id: 'nanokontrol2-default',
  name: 'Korg nanoKONTROL2 (default)',
  controllerMatch: /nanoKONTROL2/i,
  transport: {
    play:       { type: 'cc', channel: 'any', number: 41, mode: 'momentary' },
    stop:       { type: 'cc', channel: 'any', number: 42, mode: 'momentary' },
    record:     { type: 'cc', channel: 'any', number: 45, mode: 'momentary' },
    rewind:     { type: 'cc', channel: 'any', number: 43, mode: 'momentary' },
    forward:    { type: 'cc', channel: 'any', number: 44, mode: 'momentary' },
    cycle:      { type: 'cc', channel: 'any', number: 46, mode: 'toggle' },
    markerSet:  { type: 'cc', channel: 'any', number: 60, mode: 'momentary' },
    markerPrev: { type: 'cc', channel: 'any', number: 61, mode: 'momentary' },
    markerNext: { type: 'cc', channel: 'any', number: 62, mode: 'momentary' },
    trackPrev:  { type: 'cc', channel: 'any', number: 58, mode: 'momentary' },
    trackNext:  { type: 'cc', channel: 'any', number: 59, mode: 'momentary' }
  },
  tracks: Array.from({ length: 8 }, (_, i) => ({
    volume: { type: 'cc' as const, channel: 'any' as const, number: i,         mode: 'absolute' as const },
    pan:    { type: 'cc' as const, channel: 'any' as const, number: 16 + i,    mode: 'absolute' as const },
    loop:   { type: 'cc' as const, channel: 'any' as const, number: 32 + i,    mode: 'toggle'   as const },
    mute:   { type: 'cc' as const, channel: 'any' as const, number: 48 + i,    mode: 'toggle'   as const },
    arm:    { type: 'cc' as const, channel: 'any' as const, number: 64 + i,    mode: 'toggle'   as const }
  }))
};
