/**
 * Electron main process entry.
 *
 * Startup order:
 *  1. Acquire the single-instance lock (second launch focuses the first).
 *  2. Resolve the data directories (userData on Windows -> %APPDATA%).
 *  3. Open the SQLite database (WAL + foreign keys + schema applied).
 *  4. Build the service container.
 *  5. Register all IPC handlers and harden the renderer session.
 *  6. Create the window on app 'ready'.
 *  7. Run a periodic cooldown-expiry check to surface "cooldown ended" alerts.
 *
 * All heavy initialization happens in the main process; the renderer only
 * ever talks to it through the typed preload bridge.
 */
import { app, BrowserWindow, session } from "electron";
import fs from "node:fs";
import path from "node:path";
import { openDatabase, closeDatabase, type Db } from "./database/database";
import { createRepositories, type Repositories } from "./database/repositories";
import { buildApp, type App } from "./services/app";
import { Config as AppConfig, CHROME_CANDIDATES } from "./services/config";
import { registerIpcHandlers, stopDownloadMonitor } from "./ipc/handlers";
import { createMainWindow, hardenSession } from "./window";
import { resolveDataDir } from "@shared/paths";

let db: Db | null = null;
let repos: Repositories | null = null;
let appInstance: App | null = null;
let cooldownTimer: NodeJS.Timeout | null = null;

// -------------------------------------------------------------------------
// Single-instance: a second launch should focus the existing window, not open
// a new copy.
// -------------------------------------------------------------------------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    // 2. Data directories.
    const dataDirs = resolveDataDir(app.getPath("userData"));

    // 3. Open the database.
    db = openDatabase(dataDirs.databasePath);
    repos = createRepositories(db);

    // 4. Build the service container (auto-detect chrome, keep it null-safe).
    const chrome = detectChrome(repos.settings.load());
    const cfg: AppConfig = { dataDirs, chromeExecutable: chrome };
    appInstance = buildApp(repos, cfg);

    // 5. IPC + session hardening.
    registerIpcHandlers(appInstance);
    hardenSession(session.defaultSession);

    // 6. Window.
    const win = createMainWindow();

    // 7. Periodic cooldown-expiry notifications.
    cooldownTimer = setInterval(() => {
      if (!appInstance) return;
      const ids = appInstance.cooldowns.checkExpired();
      for (const id of ids) {
        const cd = appInstance.repos.cooldowns.get(id);
        if (cd) {
          const account = appInstance.repos.accounts.get(cd.account_id);
          appInstance.notifications.cooldownEnded({
            cooldownId: cd.id,
            accountId: cd.account_id,
            accountLabel: account?.label ?? `account ${cd.account_id}`,
            resetTime: cd.reset_time,
            note: "Cooldown ended — verify before further use.",
          });
        }
      }
    }, 30_000); // every 30 seconds

    win.on("closed", () => {
      BrowserWindow.getAllWindows().length === 0 && app.quit();
    });
  });
}

app.on("will-quit", () => {
  if (cooldownTimer) clearInterval(cooldownTimer);
  stopDownloadMonitor();
  if (db) {
    try {
      closeDatabase(db);
    } catch {
      /* already closed */
    }
    db = null;
  }
});

app.on("window-all-closed", () => {
  // On Windows we always quit; macOS would keep the app alive.
  app.quit();
});

/**
 * Find a usable chrome/chromium/edge executable, or null.
 * @param settings The loaded settings (may already contain a configured path).
 */
function detectChrome(settings: import("@shared/types").Settings | null): string | null {
  // Use settings value if configured, else the first standard candidate found.
  if (settings?.chrome_executable && fs.existsSync(settings.chrome_executable)) {
    return settings.chrome_executable;
  }
  for (const c of CHROME_CANDIDATES) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}
