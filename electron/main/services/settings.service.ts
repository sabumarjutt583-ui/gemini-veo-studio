import fs from "node:fs";
import path from "node:path";
import type { Repositories } from "../database/repositories";
import type { Settings } from "@shared/types";
import type { Config } from "./config";

/**
 * Settings access. The SettingsRepository is the persistence layer; this
 * service adds validation against the known keys and small helpers (e.g.
 * the effective chrome executable path).
 */
export class SettingsService {
  constructor(private readonly repos: Repositories, private readonly cfg: Config) {}

  load(): Settings {
    return this.repos.settings.load();
  }

  update(patch: Partial<Settings>): Settings {
    const cleaned = sanitizeSettings(patch);
    const next = this.repos.settings.update(cleaned);
    this.repos.activity.log({
      action: "settings.updated",
      entity_type: "setting",
      entity_id: Object.keys(cleaned).join(","),
      description: `Updated ${Object.keys(cleaned).length} setting(s)`,
    });
    return next;
  }

  /** The chrome executable to use: settings value if it exists, else auto-detect. */
  effectiveChromePath(): string | null {
    const s = this.load();
    if (s.chrome_executable && fs.existsSync(s.chrome_executable)) {
      return s.chrome_executable;
    }
    return null; // browser service will auto-detect via CHROME_CANDIDATES
  }
}

/** Whitelist known keys so no arbitrary data is stored as a setting. */
const KNOWN_KEYS = new Set<keyof Settings>([
  "app_name",
  "theme",
  "language",
  "default_download_dir",
  "open_on_startup",
  "chrome_executable",
  "video_output_dir",
  "auto_organize_folders",
  "generate_thumbnails",
  "monitor_downloads",
  "notify_task_complete",
  "notify_cooldown",
  "notify_errors",
  "database_path",
]);

export function sanitizeSettings(patch: Partial<Settings>): Partial<Settings> {
  const out: Partial<Settings> = {};
  for (const key of KNOWN_KEYS) {
    if (patch[key] !== undefined) {
      (out as Record<string, string>)[key] = String(patch[key]);
    }
  }
  return out;
}

/**
 * Ensure the video output directory (or any other user-chosen directory)
 * exists, creating it recursively. Returns the resolved absolute path.
 */
export function ensureDir(dir: string): string {
  if (!dir) return dir;
  fs.mkdirSync(dir, { recursive: true });
  return path.resolve(dir);
}
