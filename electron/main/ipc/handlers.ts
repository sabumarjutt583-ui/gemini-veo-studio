import {
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
} from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { IPC, type IpcApi, type JobFilter } from "@shared/ipc";
import type { ApiResult } from "@shared/types";
import { guard } from "../services/result";
import type { App } from "../services/app";
import type {
  GenerationJob,
  NewAccount,
  NewCooldown,
  NewJob,
  NewPrompt,
  Settings,
  UpdateAccount,
  UsageStatus,
} from "@shared/types";
import type { Db } from "../database/database";

/**
 * Registers every IPC handler against the given App.
 *
 * Design rules:
 *  - Every handler resolves to an `ApiResult<T>` and NEVER throws to the
 *    renderer. The `guard()` helper wraps a throwing function and converts
 *    any error into `{ ok: false, error }`.
 *  - No handler runs arbitrary shell commands. The only external actions are
 *    launching the system browser, reading a user-selected file, and
 *    native-file-dialog flows.
 *  - Filesystem access is limited to paths the app itself produced (profile
 *    dirs, the video library, user-selected download folders).
 */
export function registerIpcHandlers(appx: App): void {
  const {
    accounts,
    browser,
    prompts,
    queue,
    cooldowns,
    videos,
    settings,
  } = appx;

  /**
   * Register a channel. The supplied function returns the raw value (or
   * `void`); we wrap it with `guard()` so any thrown error becomes
   * `{ ok:false, error }` and it never crosses the IPC boundary uncaught.
   *
   * `IpcApi[K]` is declared as `(...args) => ApiResult<T>`. We want to pass
   * `(...args) => T` instead, so we define an "unwrapped" mapped type that
   * strips the outer `ApiResult` and keeps the same argument list.
   */
  type Unwrapped<K extends keyof IpcApi> = IpcApi[K] extends (...args: infer A) => ApiResult<infer R>
    ? (...args: A) => R
    : never;

  function reg<K extends keyof IpcApi>(channel: K, fn: Unwrapped<K>): void {
    // The listener's first argument is the IpcMainInvokeEvent, not a payload —
    // the renderer's invoke args arrive after it. Spread must skip the event,
    // or every handler sees its parameters shifted by one (e.g. PROMPT_LIST
    // would receive the event object as its "query").
    ipcMain.handle(channel, (_event, ...args: unknown[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return guard(() => (fn as any)(...args));
    });
  }

  // ----- Accounts -----------------------------------------------------------
  reg(IPC.ACCOUNT_LIST, () => accounts.list());
  reg(IPC.ACCOUNT_CREATE, (input: NewAccount) => accounts.create(input));
  reg(IPC.ACCOUNT_GET, (id: number) => {
    const a = accounts.get(id);
    if (!a) throw new Error("Account not found");
    return a;
  });
  reg(IPC.ACCOUNT_UPDATE, (id: number, input: UpdateAccount) => {
    const a = accounts.update(id, input);
    if (!a) throw new Error("Account not found");
    return a;
  });
  reg(IPC.ACCOUNT_DELETE, (id: number) => {
    if (!accounts.delete(id)) throw new Error("Account not found");
  });
  reg(IPC.ACCOUNT_SET_USAGE, (id: number, usage: UsageStatus) => {
    const a = accounts.setUsage(id, usage);
    if (!a) throw new Error("Account not found");
    return a;
  });

  // ----- Prompts -------------------------------------------------------------
  reg(IPC.PROMPT_LIST, (q?: string) => prompts.list(q));
  reg(IPC.PROMPT_CREATE, (input: NewPrompt) => prompts.create(input));
  reg(IPC.PROMPT_UPDATE, (id: number, input: Partial<NewPrompt>) => {
    const p = prompts.update(id, input);
    if (!p) throw new Error("Prompt not found");
    return p;
  });
  reg(IPC.PROMPT_DELETE, (id: number) => {
    if (!prompts.delete(id)) throw new Error("Prompt not found");
  });
  reg(IPC.PROMPT_IMPORT_FILE, (filePath: string, format: "txt" | "csv") => {
    const result = prompts.importFile(filePath, format);
    if (!result.ok) throw new Error(result.error);
    return result.data;
  });

  // ----- Jobs / queue --------------------------------------------------------
  reg(IPC.JOB_LIST, (f?: JobFilter) => queue.list(f ?? {}));
  reg(IPC.JOB_GET, (id: number) => {
    const j = queue.get(id);
    if (!j) throw new Error("Task not found");
    return j;
  });
  reg(IPC.JOB_CREATE, (input: NewJob) => queue.create(input));
  reg(IPC.JOB_UPDATE, (id: number, input: Partial<NewJob>) => {
    const j = queue.update(id, input);
    if (!j) throw new Error("Task not found");
    return j;
  });
  reg(IPC.JOB_SET_STATUS, (id: number, status: GenerationJob["status"]) =>
    queue.setStatus(id, status),
  );
  reg(IPC.JOB_DELETE, (id: number) => {
    if (!queue.delete(id)) throw new Error("Task not found");
  });
  reg(IPC.JOB_REORDER, (ids: number[]) => queue.reorder(ids));

  // ----- Cooldowns -----------------------------------------------------------
  reg(IPC.COOLDOWN_LIST, (accountId?: number) => cooldowns.list(accountId));
  reg(IPC.COOLDOWN_CREATE, (input: NewCooldown) => cooldowns.create(input));
  reg(IPC.COOLDOWN_CLEAR, (id: number) => cooldowns.clear(id));
  reg(IPC.COOLDOWN_ACTIVE, (accountId?: number) =>
    accountId ? cooldowns.activeFor(accountId) : null,
  );

  // ----- Videos -------------------------------------------------------------
  reg(IPC.VIDEO_LIST, () => videos.list());
  reg(IPC.VIDEO_IMPORT, (filePath: string) => {
    const s = settings.load();
    return videos.importVideo(filePath, {
      organize: s.auto_organize_folders === "true",
    });
  });
  reg(IPC.VIDEO_RENAME, (id: number, newName: string) =>
    videos.renameVideo(id, newName),
  );
  reg(IPC.VIDEO_DELETE, (id: number, deleteFile?: boolean) => {
    if (!videos.deleteVideo(id, deleteFile)) throw new Error("Video not found");
  });
  reg(IPC.VIDEO_LINK_JOB, (videoId: number, jobId: number | null) =>
    videos.linkToJob(videoId, jobId),
  );

  // ----- Browser / clipboard -------------------------------------------------
  reg(IPC.BROWSER_OPEN_GEMINI, ({ accountId }: { accountId: number }) => {
    const r = browser.openGeminiForAccount(accountId);
    return { url: r.url };
  });
  reg(IPC.BROWSER_OPEN_PROFILE, (accountId: number) => ({
    path: browser.revealProfile(accountId),
  }));
  reg(IPC.CLIPBOARD_COPY, (text: string) => {
    clipboard.writeText(text);
  });

  // ----- App / settings / activity ------------------------------------------
  reg(IPC.APP_GET_STATS, () => {
    const accs = accounts.list();
    return {
      total_accounts: accs.length,
      connected_accounts: accs.filter((a) => a.login_status === "connected").length,
      ready_accounts: accs.filter(
        (a) => a.usage_status === "ready" || a.usage_status === "none",
      ).length,
      cooldown_accounts: accs.filter((a) => a.usage_status === "cooldown").length,
      total_prompts: prompts.list().length,
      completed_tasks: queue.list({ status: "completed" }).length,
      pending_tasks:
        queue.list({ status: "pending" }).length +
        queue.list({ status: "ready" }).length +
        queue.list({ status: "draft" }).length,
      failed_tasks: queue.list({ status: "failed" }).length,
      downloaded_videos: videos.list().length,
    };
  });
  reg(IPC.APP_GET_SETTINGS, () => settings.load());
  reg(IPC.APP_UPDATE_SETTINGS, (patch: Partial<Settings>) => settings.update(patch));
  reg(IPC.APP_ACTIVITY_LIST, (limit?: number, offset?: number) =>
    appx.repos.activity.list(limit, offset),
  );
  reg(IPC.APP_ACTIVITY_LOG, (
    action: string,
    entityType: string,
    entityId: string | null,
    description?: string | null,
  ) =>
    appx.repos.activity.log({
      action,
      entity_type: entityType,
      entity_id: entityId,
      description,
    }),
  );
  reg(IPC.APP_SELECT_DIR, (title?: string) => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    if (!win) return null;
    const r = dialog.showOpenDialogSync(win, {
      title: title ?? "Select folder",
      properties: ["openDirectory", "createDirectory"],
    });
    return r?.[0] ?? null;
  });
  reg(IPC.APP_PATH_FOR_ACCOUNT, (accountId: number) => {
    const a = accounts.get(accountId);
    if (!a) throw new Error("Account not found");
    return a.browser_profile_path;
  });
  reg(IPC.APP_TEST_CHROME, () => browser.testChrome());
  reg(IPC.APP_BACKUP_DB, (target?: string) => backupDatabase(appx.repos.db, target));

  // ----- Download monitoring ------------------------------------------------
  registerDownloadMonitor(appx);
}

// ---------------------------------------------------------------------------
// Download folder monitoring (chokidar). Starts a watcher on the configured
// default_download_dir; new video files trigger a notification. Skipped when
// no download dir is configured yet. The watcher is module-level state so it
// is only created once per app lifetime.
// ---------------------------------------------------------------------------
import chokidar from "chokidar";
import type { App as AppType } from "../services/app";

const watchState: { watcher: chokidar.FSWatcher | null } = { watcher: null };

function registerDownloadMonitor(appx: AppType): void {
  const dir = appx.settings.load().default_download_dir;
  if (!dir || !fs.existsSync(dir)) return; // Nothing to watch yet.
  if (watchState.watcher) return; // Already running.
  watchState.watcher = chokidar.watch(dir, { ignoreInitial: true, depth: 1 });
  watchState.watcher.on("add", (p: string) => {
    const ext = path.extname(p).toLowerCase();
    if ([".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v"].includes(ext)) {
      appx.notifications.show("New video detected", `Downloaded: ${path.basename(p)}`);
    }
  });
}

export function stopDownloadMonitor(): void {
  watchState.watcher?.close();
  watchState.watcher = null;
}

/**
 * Best-effort in-app backup: `VACUUM INTO` writes a consistent snapshot to the
 * destination file. The caller may override the target path.
 */
function backupDatabase(db: Db, target?: string): string {
  const dest =
    target ??
    path.join(
      process.env.GVS_DATA_DIR ?? path.join(os.tmpdir(), "gvs-test-data"),
      "backups",
      `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.db`,
    );
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  db.prepare(`VACUUM INTO ?`).run(dest);
  return dest;
}
