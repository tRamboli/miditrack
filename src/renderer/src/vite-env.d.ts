/// <reference types="vite/client" />

interface Window {
  miditrack: {
    platform: string;
    version: string;
    onOpenSettings: (cb: () => void) => () => void;
  };
}
