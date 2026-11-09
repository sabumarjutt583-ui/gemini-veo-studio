import {
  app,
  BrowserWindow,
  shell,
  type Session,
  type WebPreferences,
} from "electron";
import path from "node:path";
import { isDev } from "./env";

/**
 * Create the single main application window.
 *
 * SECURITY (spec §13):
 *  - contextIsolation: true, nodeIntegration: false, sandbox: true — the
 *    renderer can never require Node builtins or reach the main process
 *    directly. All privileged work goes through the typed preload bridge
 *    (preload.ts) which exposes a narrow `window.api` surface.
 *  - The session denies all web requests to local/private hosts and
 *    disallows arbitrary permission requests (camera, geolocation, ...).
 *  - The renderer is served from a fixed file URL (prod) or the Vite dev
 *    server (dev) — never a remote URL, so no remote code is ever loaded.
 */
export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#0B1020",
    autoHideMenuBar: true,
    title: "Gemini Veo Studio",
    webPreferences: buildWebPreferences(),
  });

  // Dev: load the Vite dev server; Prod: load the built index.html.
  if (isDev) {
    void window.loadURL("http://localhost:5173");
    window.webContents.openDevTools({ mode: "detach" });
  } else {
    // main.js runs from <asar>/dist-electron/, so the renderer built by Vite
    // lives one level up at <asar>/dist/index.html.
    void window.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  // Any external link must open in the system browser, not this window.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) void shell.openExternal(url);
    return { action: "deny" };
  });

  // Lock navigation to the app's origin only.
  window.webContents.on("will-navigate", (e, url) => {
    const allowed = isDev
      ? url.startsWith("http://localhost:5173")
      : url.startsWith("file://");
    if (!allowed) e.preventDefault();
  });

  return window;
}

function buildWebPreferences(): WebPreferences {
  return {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    spellcheck: false,
    preload: path.join(__dirname, "preload.js"),
  };
}

/**
 * Harden the app's session so the renderer can never make privileged requests.
 * Called from main.ts after the app is ready.
 */
export function hardenSession(session: Session): void {
  // No camera, geolocation, push, or any other sensitive permission.
  session.setPermissionRequestHandler((_wc, _permission, cb) => {
    cb(false);
  });

  // Only the app's own assets, the official Gemini origin, and the local dev
  // server are permitted. Everything else is blocked.
  session.webRequest.onBeforeRequest((details, callback) => {
    const u = details.url;
    const allow =
      u.startsWith("file://") ||
      u.startsWith("http://localhost:5173") ||
      u.startsWith("https://gemini.google.com") ||
      u.startsWith("https://www.google.com") ||
      u.startsWith("data:") ||
      u.startsWith("blob:");
    callback({ cancel: !allow });
  });

  // Deny window.open escapes inside the window.
  app.on("web-contents-created", (_e, wc) => {
    wc.setWindowOpenHandler(() => ({ action: "deny" }));
  });
}
