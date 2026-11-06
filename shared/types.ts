/**
 * Shared domain types for Gemini Veo Studio.
 *
 * These types are consumed by BOTH the Electron main process (services,
 * repositories, IPC handlers) and the React renderer (stores, pages).
 * They live in `shared/` so neither side imports from the other — a single
 * source of truth for the data model.
 */

/* ------------------------------------------------------------------ */
/* Accounts                                                            */
/* ------------------------------------------------------------------ */

export type AccountType = "pro" | "free" | "other";

/** Whether the Google sign-in state of the browser profile was ever observed. */
export type LoginStatus = "not_logged_in" | "connected" | "error";

/**
 * Usage/cooldown state for an account. This is USER-RECORDED — the app never
 * claims to read Google's private quota. `none` means "no known restriction".
 */
export type UsageStatus =
  | "none"
  | "ready"
  | "busy"
  | "cooldown"
  | "weekly_limit";

export interface Account {
  id: number;
  label: string;
  email: string | null;
  account_type: AccountType;
  /** Absolute path to the dedicated Chrome user-data directory for this account. */
  browser_profile_path: string;
  login_status: LoginStatus;
  usage_status: UsageStatus;
  created_at: string;
  updated_at: string;
}

export type NewAccount = Pick<Account, "label" | "account_type"> & {
  /** Optional — when omitted, the app provisions a fresh profile directory. */
  browser_profile_path?: string;
  email?: string | null;
  login_status?: LoginStatus;
  usage_status?: UsageStatus;
};

export type UpdateAccount = Partial<
  Pick<
    Account,
    | "label"
    | "email"
    | "account_type"
    | "browser_profile_path"
    | "login_status"
    | "usage_status"
  >
>;

/** Composite display status used by the UI (derives a single badge). */
export type AccountDisplayStatus =
  | "not_logged_in"
  | "connected"
  | "ready"
  | "busy"
  | "cooldown"
  | "weekly_limit"
  | "error";

/* ------------------------------------------------------------------ */
/* Prompts                                                             */
/* ------------------------------------------------------------------ */

export interface Prompt {
  id: number;
  title: string;
  prompt_text: string;
  category: string | null;
  created_at: string;
  updated_at: string;
}

export type NewPrompt = Pick<
  Prompt,
  "title" | "prompt_text"
> & {
  category?: string | null;
};

export type UpdatePrompt = Partial<
  Pick<Prompt, "title" | "prompt_text" | "category">
>;

/* ------------------------------------------------------------------ */
/* Generation jobs (queue)                                             */
/* ------------------------------------------------------------------ */

export type JobStatus =
  | "draft"
  | "pending"
  | "ready"
  | "opened_in_gemini"
  | "awaiting_user_submission"
  | "generating"
  | "completed"
  | "failed"
  | "paused"
  | "cooldown"
  | "deleted";

export interface GenerationJob {
  id: number;
  prompt_id: number | null;
  prompt_text: string;
  account_id: number | null;
  status: JobStatus;
  notes: string | null;
  position: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

export type NewJob = {
  /** Optional — jobs can be created without a saved prompt (free-typed text). */
  prompt_id?: number | null;
  prompt_text: string;
  account_id?: number | null;
  notes?: string | null;
  status?: JobStatus;
};

/**
 * Allowed status transitions. Enforced in the queue service so a task can
 * never jump to an illegal state (e.g. "failed" -> "generating"). This keeps
 * the queue machine predictable and auditable.
 */
export const JOB_STATUS_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  draft: ["pending", "ready", "deleted"],
  pending: ["ready", "paused", "cooldown", "deleted"],
  ready: ["opened_in_gemini", "paused", "cooldown", "deleted"],
  opened_in_gemini: ["awaiting_user_submission", "generating", "paused", "failed", "deleted"],
  awaiting_user_submission: ["generating", "paused", "failed", "cooldown", "deleted"],
  generating: ["completed", "failed", "paused", "cooldown", "deleted"],
  paused: ["pending", "ready", "cooldown", "deleted"],
  cooldown: ["ready", "paused", "deleted"],
  // Terminal / no forward transition (kept reachable for completeness).
  completed: ["deleted"],
  failed: ["pending", "ready", "paused", "cooldown", "deleted"],
  deleted: [],
} as const;

/* ------------------------------------------------------------------ */
/* Cooldowns                                                           */
/* ------------------------------------------------------------------ */

export type CooldownType = "five_hour" | "weekly" | "custom";
export type CooldownStatus = "active" | "cleared" | "expired";

export interface Cooldown {
  id: number;
  account_id: number;
  cooldown_type: CooldownType;
  /** ISO 8601 datetime the cooldown was recorded. */
  start_time: string;
  /** ISO 8601 datetime the account is expected to reset / become usable again. */
  reset_time: string | null;
  status: CooldownStatus;
  notes: string | null;
  created_at: string;
}

export type NewCooldown = {
  account_id: number;
  cooldown_type: CooldownType;
  start_time?: string;
  reset_time?: string | null;
  notes?: string | null;
};

/* ------------------------------------------------------------------ */
/* Videos                                                              */
/* ------------------------------------------------------------------ */

export interface Video {
  id: number;
  job_id: number | null;
  filename: string;
  file_path: string;
  thumbnail_path: string | null;
  file_size: number | null;
  /** Duration in seconds, when known. */
  duration: number | null;
  downloaded_at: string;
}

/* ------------------------------------------------------------------ */
/* Activity log                                                        */
/* ------------------------------------------------------------------ */

export interface ActivityLog {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string | null;
  description: string | null;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export interface Settings {
  app_name: string;
  theme: "dark" | "light";
  language: string;
  default_download_dir: string;
  open_on_startup: string;
  chrome_executable: string;
  video_output_dir: string;
  auto_organize_folders: string;
  generate_thumbnails: string;
  monitor_downloads: string;
  notify_task_complete: string;
  notify_cooldown: string;
  notify_errors: string;
  database_path: string;
}

/* ------------------------------------------------------------------ */
/* Cross-cutting                                                       */
/* ------------------------------------------------------------------ */

export interface DashboardStats {
  total_accounts: number;
  connected_accounts: number;
  ready_accounts: number;
  cooldown_accounts: number;
  total_prompts: number;
  completed_tasks: number;
  pending_tasks: number;
  failed_tasks: number;
  downloaded_videos: number;
}

/** Envelope for every IPC result. Errors come back as data, never thrown. */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Payload used to open Gemini in a specific account's browser profile. */
export interface OpenGeminiRequest {
  accountId: number;
}
