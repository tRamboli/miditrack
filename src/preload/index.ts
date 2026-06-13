import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('miditrack', {
  platform: process.platform,
  version: '0.1.0'
});
