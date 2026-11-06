import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import type {
  Account,
  GenerationJob,
  JobStatus,
  UsageStatus,
} from "@shared/types";

/** Format an ISO timestamp for the UI (e.g. "Nov 4, 2026, 2:30 PM"). */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.endsWith("Z") || iso.includes("T") ? iso : iso + "Z");
  if (isNaN(d.getTime())) return "—";
  return format(d, "MMM d, yyyy • h:mm a");
}

/** Relative time, e.g. "3 minutes ago". */
export function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.endsWith("Z") || iso.includes("T") ? iso : iso + "Z");
  if (isNaN(d.getTime())) return "—";
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

/** File size in human units. */
export function fmtBytes(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Duration in seconds -> "m:ss". */
export function fmtDuration(sec: number | null | undefined): string {
  if (sec == null) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

/** Seconds remaining -> "H:MM:SS". */
export function fmtCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return "00:00:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, "0")}:${m
    .toString()
    .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/** Map an account's combined login+usage state to a single display badge. */
export function accountDisplayStatus(a: Account): {
  label: string;
  tone: "neutral" | "success" | "warning" | "error" | "info";
} {
  if (a.login_status === "error")
    return { label: "Error", tone: "error" };
  if (a.usage_status === "cooldown")
    return { label: "Cooldown", tone: "warning" };
  if (a.usage_status === "weekly_limit")
    return { label: "Weekly limit", tone: "error" };
  if (a.usage_status === "busy")
    return { label: "Busy", tone: "info" };
  if (a.login_status === "not_logged_in")
    return { label: "Not logged in", tone: "neutral" };
  if (a.usage_status === "ready")
    return { label: "Ready", tone: "success" };
  if (a.login_status === "connected")
    return { label: "Connected", tone: "success" };
  return { label: "Unknown", tone: "neutral" };
}

export const JOB_STATUS_META: Record<
  JobStatus,
  { label: string; tone: "neutral" | "success" | "warning" | "error" | "info" | "accent" }
> = {
  draft: { label: "Draft", tone: "neutral" },
  pending: { label: "Pending", tone: "info" },
  ready: { label: "Ready", tone: "accent" },
  opened_in_gemini: { label: "Opened in Gemini", tone: "info" },
  awaiting_user_submission: { label: "Awaiting submission", tone: "warning" },
  generating: { label: "Generating", tone: "accent" },
  completed: { label: "Completed", tone: "success" },
  failed: { label: "Failed", tone: "error" },
  paused: { label: "Paused", tone: "neutral" },
  cooldown: { label: "Cooldown", tone: "warning" },
  deleted: { label: "Deleted", tone: "neutral" },
};

export function jobStatusLabel(s: JobStatus): string {
  return JOB_STATUS_META[s]?.label ?? s;
}

export const USAGE_LABEL: Record<UsageStatus, string> = {
  none: "No known limit",
  ready: "Ready",
  busy: "Busy",
  cooldown: "On cooldown",
  weekly_limit: "Weekly limit",
};

/** Short preview of a job's prompt text. */
export function preview(text: string, n = 90): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
}
