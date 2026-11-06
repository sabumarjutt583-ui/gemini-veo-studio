-- 001_initial: core schema.
-- All tables with sane defaults, foreign keys, and indexes for the query
-- patterns the app actually performs.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  email TEXT,
  account_type TEXT NOT NULL DEFAULT 'other' CHECK (account_type IN ('pro','free','other')),
  browser_profile_path TEXT NOT NULL,
  login_status TEXT NOT NULL DEFAULT 'not_logged_in'
    CHECK (login_status IN ('not_logged_in','connected','error')),
  usage_status TEXT NOT NULL DEFAULT 'none'
    CHECK (usage_status IN ('none','ready','busy','cooldown','weekly_limit')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  category TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_prompts_category ON prompts(category);

CREATE TABLE IF NOT EXISTS generation_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prompt_id INTEGER,
  prompt_text TEXT NOT NULL,
  account_id INTEGER,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending','ready','opened_in_gemini',
                     'awaiting_user_submission','generating','completed',
                     'failed','paused','cooldown')),
  notes TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE SET NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_account ON generation_jobs(account_id);
CREATE INDEX IF NOT EXISTS idx_jobs_position ON generation_jobs(position);

CREATE TABLE IF NOT EXISTS cooldowns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  cooldown_type TEXT NOT NULL DEFAULT 'five_hour'
    CHECK (cooldown_type IN ('five_hour','weekly','custom')),
  start_time TEXT NOT NULL,
  reset_time TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','cleared','expired')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_cooldowns_account ON cooldowns(account_id, status);

CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  thumbnail_path TEXT,
  file_size INTEGER,
  duration REAL,
  downloaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (job_id) REFERENCES generation_jobs(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_videos_job ON videos(job_id);

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Schema versioning.
CREATE TABLE IF NOT EXISTS _migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
