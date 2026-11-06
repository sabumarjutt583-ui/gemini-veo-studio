import type { Db } from "../database";
import { nowIso } from "./sql";
import type { Settings } from "@shared/types";

/**
 * Data access for the `settings` table (key/value store).
 *
 * Values are stored as JSON strings (the single source of truth for the full
 * `Settings` object) AND exposed as individual keys. `load`/`save` keep the
 * canonical JSON blob so the app can read/replace the whole object atomically
 * without N round-trips.
 */
export const SETTINGS_KEY = "app_settings";

const DEFAULTS: Settings = {
  app_name: "Gemini Veo Studio",
  theme: "dark",
  language: "en",
  default_download_dir: "",
  open_on_startup: "false",
  chrome_executable: "",
  video_output_dir: "",
  auto_organize_folders: "true",
  generate_thumbnails: "true",
  monitor_downloads: "true",
  notify_task_complete: "true",
  notify_cooldown: "true",
  notify_errors: "true",
  database_path: "",
};

export class SettingsRepository {
  constructor(private readonly db: Db) {}

  load(): Settings {
    const r = this.db
      .prepare(`SELECT setting_value FROM settings WHERE setting_key = ?`)
      .get(SETTINGS_KEY) as { setting_value: string } | undefined;
    if (!r) return { ...DEFAULTS };
    try {
      const parsed = JSON.parse(r.setting_value) as Partial<Settings>;
      return { ...DEFAULTS, ...parsed };
    } catch {
      // Corrupt value: fall back to defaults but keep the row so it isn't lost.
      return { ...DEFAULTS };
    }
  }

  save(settings: Settings): Settings {
    const ts = nowIso();
    const value = JSON.stringify(settings);
    this.db
      .prepare(
        `INSERT INTO settings (setting_key, setting_value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(setting_key) DO UPDATE SET
           setting_value = excluded.setting_value,
           updated_at = excluded.updated_at`
      )
      .run(SETTINGS_KEY, value, ts);
    return settings;
  }

  update(patch: Partial<Settings>): Settings {
    const current = this.load();
    const next: Settings = { ...current, ...patch };
    return this.save(next);
  }
}
