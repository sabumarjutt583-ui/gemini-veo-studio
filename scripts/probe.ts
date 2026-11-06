/**
 * End-to-end IPC probe. Boots the REAL handler registration against an
 * in-memory SQLite DB, opens a hidden window using the real preload bridge,
 * and invokes the exact channel that used to throw at startup.
 *
 * Run: `npm run build:probe` then `npx electron dist-electron/probe.js`
 * Exits 0 when every check passes, 1 otherwise.
 */
import os from "node:os";
import { app, BrowserWindow, ipcMain } from "electron";
import { inMemoryDatabase } from "../electron/main/database/database";
import { createRepositories } from "../electron/main/database/repositories";
import { buildApp } from "../electron/main/services/app";
import { registerIpcHandlers } from "../electron/main/ipc/handlers";
import { dirsFor } from "../shared/paths";
import { IPC } from "../shared/ipc";

async function main() {
  const cfg = { dataDirs: dirsFor(os.tmpdir()), chromeExecutable: null };
  const db = inMemoryDatabase();
  const repos = createRepositories(db);
  const appx = buildApp(repos, cfg);
  registerIpcHandlers(appx);

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: require("node:path").join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  await win.loadURL("about:blank");

  // window.api is exposed into the main world by the preload's
  // exposeInMainWorld, so executeJavaScript can drive a real invoke.
  const invoke = (channel: string, ...args: unknown[]) =>
    win.webContents.executeJavaScript(
      `window.api.invoke(${JSON.stringify(channel)}, ${args
        .map((a) => JSON.stringify(a))
        .join(", ")})`
    );

  type R = { ok: boolean; data?: unknown; error?: string };
  const failures: string[] = [];
  const check = (name: string, r: R) => {
    if (!r || r.ok === false) {
      failures.push(`${name}: ${r ? r.error : "no response"}`);
    }
  };

  // The two historically-failing patterns from the startup toasts.
  check("prompt:list (no query)", (await invoke(IPC.PROMPT_LIST)) as R);
  check("prompt:list (search)", (await invoke(IPC.PROMPT_LIST, "ocean")) as R);
  check("app:stats", (await invoke(IPC.APP_GET_STATS)) as R);
  check("job:list", (await invoke(IPC.JOB_LIST)) as R);

  // A write path to confirm params arrive at the right position now.
  await invoke(IPC.JOB_CREATE, { prompt_text: "probe" });
  check("job:get (after create)", (await invoke(IPC.JOB_GET, 1)) as R);

  if (failures.length) {
    console.log("PROBE FAIL:\n" + failures.join("\n"));
  } else {
    console.log("PROBE OK: all handlers respond through the real ipcRenderer bridge.");
  }

  db.close();
  app.exit(failures.length ? 1 : 0);
}

app.whenReady().then(main, (e) => {
  console.error("app ready failed", e);
  app.exit(2);
});
