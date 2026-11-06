import type { PreloadBridge } from "@shared/ipc";

declare global {
  interface Window {
    api: PreloadBridge;
  }
}

export {};
