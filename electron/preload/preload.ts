/**
 * Preload bridge. Runs with contextIsolation, so it is the ONLY code that
 * touches ipcRenderer. It exposes exactly two primitives to the page:
 *
 *   window.api.invoke(channel, ...args)  -> Promise<ApiResult<T>>
 *   window.api.on(channel, listener)     -> unsubscribe function
 *
 * A strict allow-list of channel names guarantees the renderer can only talk
 * to the handlers the app registered — no arbitrary channel can be probed.
 * The renderer wraps this surface with fully typed helpers (src/lib/api.ts),
 * so pages never deal with raw channel strings.
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import { IPC, type IpcChannel } from "@shared/ipc";

/** Every channel the main process registers a handler for. */
const ALLOWED_INVOKES = new Set<string>([...Object.values(IPC)]);

/** Event channels the main process may push to the renderer. */
const ALLOWED_EVENTS = new Set<string>(["app:activity", "cooldown:ended"]);

contextBridge.exposeInMainWorld("api", {
  invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    if (!ALLOWED_INVOKES.has(channel)) {
      return Promise.resolve({ ok: false, error: `Unknown IPC channel: ${channel}` });
    }
    return ipcRenderer.invoke(channel as IpcChannel, ...args) as Promise<unknown>;
  },
  on(channel: string, listener: (payload: unknown) => void): () => void {
    if (!ALLOWED_EVENTS.has(channel)) return () => {};
    const wrapped = (_e: IpcRendererEvent, payload: unknown) => listener(payload);
    ipcRenderer.on(channel, wrapped);
    return () => {
      ipcRenderer.removeListener(channel, wrapped);
    };
  },
});
