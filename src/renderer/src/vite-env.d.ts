/// <reference types="vite/client" />

interface Window {
  miditrack: {
    platform: string;
    version: string;
    onOpenSettings: (cb: () => void) => () => void;
    selectDirectory: () => Promise<string | null>;
    selectAudioFile: () => Promise<string | null>;
    readAudioFiles: (dirPath: string) => Promise<{ name: string; path: string }[]>;
    readFile: (filePath: string) => Promise<ArrayBuffer>;
    getPathForFile: (file: File) => string;
  };
}
