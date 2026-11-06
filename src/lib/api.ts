/**
 * Renderer-side typed API. Built on top of the preload bridge
 * (`window.api.invoke(channel, ...args)`).
 *
 * Every method returns a Promise that RESOLVES to the unwrapped data and
 * REJECTS with a friendly Error (message = the ApiResult error string), so
 * pages can simply `await api.accountList()` inside a try/catch.
 *
 * This is the single boundary between React and the Electron main process.
 */
import { IPC, type IpcApi, type JobFilter } from "@shared/ipc";
import type {
  Account,
  ActivityLog,
  ApiResult,
  Cooldown,
  DashboardStats,
  GenerationJob,
  NewAccount,
  NewCooldown,
  NewJob,
  NewPrompt,
  OpenGeminiRequest,
  Prompt,
  Settings,
  UpdateAccount,
  UpdatePrompt,
  UsageStatus,
  Video,
} from "@shared/types";

const raw = window.api;

type Unwrap<T> = T extends { ok: true; data: infer D } ? D : never;

async function invoke<T extends ApiResult<unknown>>(
  channel: string,
  ...args: unknown[]
): Promise<Unwrap<T>> {
  const result = (await raw.invoke(channel, ...args)) as T;
  if (!result.ok) throw new Error(result.error);
  return (result as { ok: true; data: Unwrap<T> }).data;
}

/**
 * The fully-typed API surface for pages. Each method maps 1:1 to an IPC
 * channel and resolves to the unwrapped data (rejects with a friendly Error).
 */
const typed = {
  // Accounts
  accountList: (): Promise<Account[]> =>
    invoke<ApiResult<Account[]>>(IPC.ACCOUNT_LIST),
  accountCreate: (i: NewAccount): Promise<Account> =>
    invoke<ApiResult<Account>>(IPC.ACCOUNT_CREATE, i),
  accountGet: (id: number): Promise<Account> =>
    invoke<ApiResult<Account>>(IPC.ACCOUNT_GET, id),
  accountUpdate: (id: number, i: UpdateAccount): Promise<Account> =>
    invoke<ApiResult<Account>>(IPC.ACCOUNT_UPDATE, id, i),
  accountDelete: (id: number): Promise<void> =>
    invoke<ApiResult<void>>(IPC.ACCOUNT_DELETE, id),
  accountSetUsage: (id: number, u: UsageStatus): Promise<Account> =>
    invoke<ApiResult<Account>>(IPC.ACCOUNT_SET_USAGE, id, u),

  // Prompts
  promptList: (q?: string): Promise<Prompt[]> =>
    invoke<ApiResult<Prompt[]>>(IPC.PROMPT_LIST, q),
  promptCreate: (i: NewPrompt): Promise<Prompt> =>
    invoke<ApiResult<Prompt>>(IPC.PROMPT_CREATE, i),
  promptUpdate: (id: number, i: UpdatePrompt): Promise<Prompt> =>
    invoke<ApiResult<Prompt>>(IPC.PROMPT_UPDATE, id, i),
  promptDelete: (id: number): Promise<void> =>
    invoke<ApiResult<void>>(IPC.PROMPT_DELETE, id),
  promptImportFile: (p: string, f: "txt" | "csv"): Promise<Prompt[]> =>
    invoke<ApiResult<Prompt[]>>(IPC.PROMPT_IMPORT_FILE, p, f),

  // Jobs / queue
  jobList: (f?: JobFilter): Promise<GenerationJob[]> =>
    invoke<ApiResult<GenerationJob[]>>(IPC.JOB_LIST, f),
  jobGet: (id: number): Promise<GenerationJob> =>
    invoke<ApiResult<GenerationJob>>(IPC.JOB_GET, id),
  jobCreate: (i: NewJob): Promise<GenerationJob> =>
    invoke<ApiResult<GenerationJob>>(IPC.JOB_CREATE, i),
  jobUpdate: (id: number, i: Partial<NewJob>): Promise<GenerationJob> =>
    invoke<ApiResult<GenerationJob>>(IPC.JOB_UPDATE, id, i),
  jobSetStatus: (id: number, s: GenerationJob["status"]): Promise<GenerationJob> =>
    invoke<ApiResult<GenerationJob>>(IPC.JOB_SET_STATUS, id, s),
  jobDelete: (id: number): Promise<void> =>
    invoke<ApiResult<void>>(IPC.JOB_DELETE, id),
  jobReorder: (ids: number[]): Promise<void> =>
    invoke<ApiResult<void>>(IPC.JOB_REORDER, ids),

  // Cooldowns
  cooldownList: (a?: number): Promise<Cooldown[]> =>
    invoke<ApiResult<Cooldown[]>>(IPC.COOLDOWN_LIST, a),
  cooldownCreate: (i: NewCooldown): Promise<Cooldown> =>
    invoke<ApiResult<Cooldown>>(IPC.COOLDOWN_CREATE, i),
  cooldownClear: (id: number): Promise<Cooldown> =>
    invoke<ApiResult<Cooldown>>(IPC.COOLDOWN_CLEAR, id),
  cooldownActive: (a?: number): Promise<Cooldown | null> =>
    invoke<ApiResult<Cooldown | null>>(IPC.COOLDOWN_ACTIVE, a),

  // Videos
  videoList: (): Promise<Video[]> =>
    invoke<ApiResult<Video[]>>(IPC.VIDEO_LIST),
  videoImport: (p: string): Promise<Video> =>
    invoke<ApiResult<Video>>(IPC.VIDEO_IMPORT, p),
  videoRename: (id: number, n: string): Promise<Video> =>
    invoke<ApiResult<Video>>(IPC.VIDEO_RENAME, id, n),
  videoDelete: (id: number, df?: boolean): Promise<void> =>
    invoke<ApiResult<void>>(IPC.VIDEO_DELETE, id, df),
  videoLinkJob: (vid: number, jid: number | null): Promise<Video> =>
    invoke<ApiResult<Video>>(IPC.VIDEO_LINK_JOB, vid, jid),

  // Browser / clipboard
  openGemini: (r: number | OpenGeminiRequest): Promise<{ url: string }> =>
    invoke<ApiResult<{ url: string }>>(
      IPC.BROWSER_OPEN_GEMINI,
      typeof r === "number" ? { accountId: r } : r,
    ),
  openProfile: (id: number): Promise<{ path: string }> =>
    invoke<ApiResult<{ path: string }>>(IPC.BROWSER_OPEN_PROFILE, id),
  copyPrompt: (text: string): Promise<void> =>
    invoke<ApiResult<void>>(IPC.CLIPBOARD_COPY, text),

  // App / settings / activity
  getStats: (): Promise<DashboardStats> =>
    invoke<ApiResult<DashboardStats>>(IPC.APP_GET_STATS),
  getSettings: (): Promise<Settings> =>
    invoke<ApiResult<Settings>>(IPC.APP_GET_SETTINGS),
  updateSettings: (p: Partial<Settings>): Promise<Settings> =>
    invoke<ApiResult<Settings>>(IPC.APP_UPDATE_SETTINGS, p),
  activityList: (limit?: number, offset?: number): Promise<ActivityLog[]> =>
    invoke<ApiResult<ActivityLog[]>>(IPC.APP_ACTIVITY_LIST, limit, offset),
  activityLog: (
    action: string,
    entityType: string,
    entityId: string | null,
    description?: string | null,
  ): Promise<ActivityLog> =>
    invoke<ApiResult<ActivityLog>>(IPC.APP_ACTIVITY_LOG, action, entityType, entityId, description),
  selectDir: (title?: string): Promise<string | null> =>
    invoke<ApiResult<string | null>>(IPC.APP_SELECT_DIR, title),
  pathForAccount: (id: number): Promise<string> =>
    invoke<ApiResult<string>>(IPC.APP_PATH_FOR_ACCOUNT, id),
  testChrome: (): Promise<{ found: boolean; path?: string }> =>
    invoke<ApiResult<{ found: boolean; path?: string }>>(IPC.APP_TEST_CHROME),
  backupDb: (target?: string): Promise<string> =>
    invoke<ApiResult<string>>(IPC.APP_BACKUP_DB, target),
};

export type TypedApi = typeof typed;

export const apiExports = typed;

/**
 * `api` is the exported surface: the fully-typed methods plus two event
 * subscriptions backed by the preload `on` primitive.
 */
export const api: TypedApi & {
  onActivity(cb: (log: ActivityLog) => void): () => void;
  onCooldownEnded(cb: (n: unknown) => void): () => void;
} = {
  ...typed,
  onActivity: (cb: (log: ActivityLog) => void) =>
    raw.on("app:activity", (p) => cb(p as ActivityLog)),
  onCooldownEnded: (cb: (n: unknown) => void) =>
    raw.on("cooldown:ended", cb),
};
