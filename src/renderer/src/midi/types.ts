export type MidiBinding = {
  type: 'cc' | 'note';
  channel: number | 'any'; // 0..15
  number: number;
  mode: 'absolute' | 'toggle' | 'momentary';
};

export type TransportAction =
  | 'play' | 'stop' | 'record'
  | 'rewind' | 'forward' | 'cycle'
  | 'markerSet' | 'markerPrev' | 'markerNext'
  | 'trackPrev' | 'trackNext';

export type ContinuousParam = 'volume' | 'pan';
export type BoolParam = 'mute' | 'solo' | 'loop' | 'arm' | 'stop';
export type TrackParam = ContinuousParam | BoolParam;

export type MidiPreset = {
  id: string;
  name: string;
  controllerMatch?: RegExp;
  transport: Partial<Record<TransportAction, MidiBinding>>;
  tracks: Array<Partial<Record<TrackParam, MidiBinding>>>;
};
