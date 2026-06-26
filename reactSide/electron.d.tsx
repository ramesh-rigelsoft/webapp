export {};

declare global {
  interface Window {
    electronAPI: {
      openGSTPortal: (gst: string) => void;
      minimize?: () => void;
      maximize?: () => void;
      close?: () => void;
    };
  }
}