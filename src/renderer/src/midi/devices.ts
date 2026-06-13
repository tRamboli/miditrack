export type MidiEvent =
  | { kind: 'cc'; channel: number; controller: number; value: number }
  | { kind: 'noteon'; channel: number; note: number; velocity: number }
  | { kind: 'noteoff'; channel: number; note: number; velocity: number };

export type DeviceInfo = { id: string; name: string; manufacturer: string };

type EventListener = (e: MidiEvent, deviceId: string) => void;
type DevicesListener = (devices: DeviceInfo[]) => void;

export class MidiHost {
  private access?: MIDIAccess;
  private eventListeners = new Set<EventListener>();
  private deviceListeners = new Set<DevicesListener>();

  async init(): Promise<{ ok: boolean; reason?: string }> {
    if (!('requestMIDIAccess' in navigator)) {
      return { ok: false, reason: 'WebMIDI not supported in this runtime' };
    }
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
    } catch (err) {
      return { ok: false, reason: (err as Error).message || 'MIDI access denied' };
    }
    this.bindAllInputs();
    this.access.onstatechange = () => {
      this.bindAllInputs();
      this.notifyDevices();
    };
    this.notifyDevices();
    return { ok: true };
  }

  private bindAllInputs() {
    if (!this.access) return;
    for (const input of this.access.inputs.values()) {
      input.onmidimessage = (msg) => this.handle(input.id, msg as MIDIMessageEvent);
    }
  }

  private handle(deviceId: string, msg: MIDIMessageEvent) {
    if (!msg.data || msg.data.length < 2) return;
    const status = msg.data[0];
    const d1 = msg.data[1];
    const d2 = msg.data.length > 2 ? msg.data[2] : 0;
    const cmd = status & 0xf0;
    const ch = status & 0x0f;

    let ev: MidiEvent | undefined;
    if (cmd === 0xb0) ev = { kind: 'cc', channel: ch, controller: d1, value: d2 };
    else if (cmd === 0x90 && d2 > 0) ev = { kind: 'noteon', channel: ch, note: d1, velocity: d2 };
    else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) ev = { kind: 'noteoff', channel: ch, note: d1, velocity: d2 };

    if (!ev) return;
    for (const l of this.eventListeners) l(ev, deviceId);
  }

  onEvent(cb: EventListener): () => void {
    this.eventListeners.add(cb);
    return () => this.eventListeners.delete(cb);
  }

  onDevices(cb: DevicesListener): () => void {
    this.deviceListeners.add(cb);
    cb(this.currentDevices());
    return () => this.deviceListeners.delete(cb);
  }

  currentDevices(): DeviceInfo[] {
    const devices: DeviceInfo[] = [];
    if (!this.access) return devices;
    for (const input of this.access.inputs.values()) {
      devices.push({
        id: input.id,
        name: input.name || 'Unknown',
        manufacturer: input.manufacturer || ''
      });
    }
    return devices;
  }

  private notifyDevices() {
    const devices = this.currentDevices();
    for (const l of this.deviceListeners) l(devices);
  }
}
