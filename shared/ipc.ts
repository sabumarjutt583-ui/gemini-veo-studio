/**
 * The IPC contract — every channel the renderer may invoke, with a typed
 * request/response shape. The main process registers handlers keyed by these
 * strings; the preload exposes a typed `window.api` built from them. Keeping
 * the channel list in one shared module guarantees the two sides never drift.
 *
 * All responses are an `ApiResult<T>` (see shared/types): errors are returned
 * as data, not thrown, so the renderer can show them in its own UI.
 */
import type {
  Account,
  ActivityLog,
  ApiResult,
  Cooldown,
  DashboardStats,
  GenerationJob,
  NewAccount,
  NewJob,
  NewPrompt,
  OpenGeminiRequest,
  Prompt,
  Settings,
  UpdateAccount,
  UpdatePrompt,
  UsageStatus,
  Video,
} from "./types";

export const IPC = {
  // Accounts
  ACCOUNT_LIST: "account:list",
  ACCOUNT_CREATE: "account:create",
  ACCOUNT_GET: "account:get",
  ACCOUNT_UPDATE: "account:update",
  ACCOUNT_DELETE: "account:delete",
  ACCOUNT_SET_USAGE: "account:set-usage",

  // Prompts
  PROMPT_LIST: "prompt:list",
  PROMPT_CREATE: "prompt:create",
  PROMPT_UPDATE: "prompt:update",
  PROMPT_DELETE: "prompt:delete",
  PROMPT_IMPORT_FILE: "prompt:import-file",

  // Jobs / queue
  JOB_LIST: "job:list",
  JOB_CREATE: "job:create",
  JOB_UPDATE: "job:update",
  JOB_SET_STATUS: "job:set-status",
  JOB_DELETE: "job:delete",
  JOB_REORDER: "job:reorder",
  JOB_GET: "job:get",

  // Cooldowns
  COOLDOWN_LIST: "cooldown:list",
  COOLDOWN_CREATE: "cooldown:create",
  COOLDOWN_CLEAR: "cooldown:clear",
  COOLDOWN_ACTIVE: "cooldown:active",

  // Videos
  VIDEO_LIST: "video:list",
  VIDEO_IMPORT: "video:import",
  VIDEO_RENAME: "video:rename",
  VIDEO_DELETE: "video:delete",
  VIDEO_LINK_JOB: "video:link-job",

  // Browser integration
  BROWSER_OPEN_GEMINI: "browser:open-gemini",
  BROWSER_OPEN_PROFILE: "browser:open-profile",
  CLIPBOARD_COPY: "clipboard:copy",

  // App / settings / misc
  APP_GET_STATS: "app:stats",
  APP_GET_SETTINGS: "app:get-settings",
  APP_UPDATE_SETTINGS: "app:update-settings",
  APP_ACTIVITY_LIST: "app:activity-list",
  APP_ACTIVITY_LOG: "app:activity-log",
  APP_SELECT_DIR: "app:select-dir",
  APP_PATH_FOR_ACCOUNT: "app:path-for-account",
  APP_TEST_CHROME: "app:test-chrome",
  APP_BACKUP_DB: "app:backup-db",
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];

/** Typed request/response shapes, one record per channel. */
export interface IpcApi {
  // Accounts
  [IPC.ACCOUNT_LIST](): ApiResult<Account[]>;
  [IPC.ACCOUNT_CREATE](input: NewAccount): ApiResult<Account>;
  [IPC.ACCOUNT_GET](id: number): ApiResult<Account>;
  [IPC.ACCOUNT_UPDATE](id: number, input: UpdateAccount): ApiResult<Account>;
  [IPC.ACCOUNT_DELETE](id: number): ApiResult<void>;
  [IPC.ACCOUNT_SET_USAGE](id: number, usage: UsageStatus): ApiResult<Account>;

  // Prompts
  [IPC.PROMPT_LIST](query?: string): ApiResult<Prompt[]>;
  [IPC.PROMPT_CREATE](input: NewPrompt): ApiResult<Prompt>;
  [IPC.PROMPT_UPDATE](id: number, input: UpdatePrompt): ApiResult<Prompt>;
  [IPC.PROMPT_DELETE](id: number): ApiResult<void>;
  [IPC.PROMPT_IMPORT_FILE](path: string, format: "txt" | "csv"): ApiResult<Prompt[]>;

  // Jobs
  [IPC.JOB_LIST](filter?: JobFilter): ApiResult<GenerationJob[]>;
  [IPC.JOB_GET](id: number): ApiResult<GenerationJob>;
  [IPC.JOB_CREATE](input: NewJob): ApiResult<GenerationJob>;
  [IPC.JOB_UPDATE](id: number, input: Partial<NewJob>): ApiResult<GenerationJob>;
  [IPC.JOB_SET_STATUS](id: number, status: GenerationJob["status"]): ApiResult<GenerationJob>;
  [IPC.JOB_DELETE](id: number): ApiResult<void>;
  [IPC.JOB_REORDER](ids: number[]): ApiResult<void>;

  // Cooldowns
  [IPC.COOLDOWN_LIST](accountId?: number): ApiResult<Cooldown[]>;
  [IPC.COOLDOWN_CREATE](input: import("./types").NewCooldown): ApiResult<Cooldown>;
  [IPC.COOLDOWN_CLEAR](id: number): ApiResult<Cooldown>;
  [IPC.COOLDOWN_ACTIVE](accountId?: number): ApiResult<Cooldown | null>;

  // Videos
  [IPC.VIDEO_LIST](): ApiResult<Video[]>;
  [IPC.VIDEO_IMPORT](path: string): ApiResult<Video>;
  [IPC.VIDEO_RENAME](id: number, newName: string): ApiResult<Video>;
  [IPC.VIDEO_DELETE](id: number, deleteFile?: boolean): ApiResult<void>;
  [IPC.VIDEO_LINK_JOB](videoId: number, jobId: number | null): ApiResult<Video>;

  // Browser / clipboard
  [IPC.BROWSER_OPEN_GEMINI](req: OpenGeminiRequest): ApiResult<{ url: string }>;
  [IPC.BROWSER_OPEN_PROFILE](accountId: number): ApiResult<{ path: string }>;
  [IPC.CLIPBOARD_COPY](text: string): ApiResult<void>;

  // App / settings / activity
  [IPC.APP_GET_STATS](): ApiResult<DashboardStats>;
  [IPC.APP_GET_SETTINGS](): ApiResult<Settings>;
  [IPC.APP_UPDATE_SETTINGS](patch: Partial<Settings>): ApiResult<Settings>;
  [IPC.APP_ACTIVITY_LIST](limit?: number, offset?: number): ApiResult<ActivityLog[]>;
  [IPC.APP_ACTIVITY_LOG](action: string, entityType: string, entityId: string | null, description?: string | null): ApiResult<ActivityLog>;
  [IPC.APP_SELECT_DIR](title?: string): ApiResult<string | null>;
  [IPC.APP_PATH_FOR_ACCOUNT](accountId: number): ApiResult<string>;
  [IPC.APP_TEST_CHROME](): ApiResult<{ found: boolean; path?: string }>;
  [IPC.APP_BACKUP_DB](target?: string): ApiResult<string>;
}

export interface JobFilter {
  status?: GenerationJob["status"];
  accountId?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * The minimal surface the preload exposes on `window.api`: a channel-gated
 * `invoke` plus an event `on`. The renderer builds a fully-typed API on top
 * of this (src/lib/api.ts), so channel names live in exactly one place (the
 * IPC map above) and the preload stays tiny and auditable.
 */
export interface PreloadBridge {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  on(channel: string, listener: (payload: unknown) => void): () => void;
}
