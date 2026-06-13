import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('miditrack', {
  platform: process.platform,
  version: '0.1.0',
  onOpenSettings: (cb: () => void) => {
    ipcRenderer.on('open-settings', cb);
    return () => ipcRenderer.off('open-settings', cb);
  }
});
