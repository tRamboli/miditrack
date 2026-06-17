import { contextBridge, ipcRenderer } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';

const AUDIO_EXTS = new Set(['.wav', '.mp3', '.m4a', '.flac', '.ogg', '.aac', '.aiff']);

contextBridge.exposeInMainWorld('miditrack', {
  platform: process.platform,
  version: '0.1.0',

  onOpenSettings: (cb: () => void) => {
    ipcRenderer.on('open-settings', cb);
    return () => ipcRenderer.off('open-settings', cb);
  },

  selectDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke('select-directory'),

  selectAudioFile: (): Promise<string | null> =>
    ipcRenderer.invoke('select-audio-file'),

  readAudioFiles: async (dirPath: string): Promise<{ name: string; path: string }[]> => {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter(e => e.isFile() && AUDIO_EXTS.has(path.extname(e.name).toLowerCase()))
      .map(e => ({ name: e.name, path: path.join(dirPath, e.name) }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  },

  readFile: async (filePath: string): Promise<ArrayBuffer> => {
    const buf = await fs.readFile(filePath);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  }
});
