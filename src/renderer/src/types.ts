export type Track = {
  id: string;
  slot: number;
  name: string;
  filePath: string;
  volume: number; // 0..1
  pan: number;    // -1..1
  mute: boolean;
  solo: boolean;
};

export const TRACK_COUNT = 8;

export function emptyTrack(slot: number): Track {
  return {
    id: `slot-${slot}`,
    slot,
    name: '',
    filePath: '',
    volume: 0.8,
    pan: 0,
    mute: false,
    solo: false
  };
}
