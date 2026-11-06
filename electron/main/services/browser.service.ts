import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import type { Repositories } from "../database/repositories";
import { CHROME_CANDIDATES, type Config } from "./config";

export const GEMINI_URL = "https://gemini.google.com/";

/**
 * Browser integration: launches the system Chrome (or a configured executable)
 * with a specific account's persistent user-data directory pointed at the
 * official Gemini site.
 *
 * SECURITY NOTE: This is a plain `spawn` of the browser with only the
 * `--user-data-dir` and URL arguments. No process runs with elevated
 * privileges, no credentials are read, and nothing here communicates with a
 * private Google endpoint. The user does all sign-in manually inside the
 * browser.
 */
export class BrowserService {
  constructor(private readonly repos: Repositories, private readonly cfg: Config) {}

  /** Resolve the chrome executable to use: configured, else first candidate found. */
  resolveChrome(): string | null {
    if (this.cfg.chromeExecutable && fs.existsSync(this.cfg.chromeExecutable)) {
      return this.cfg.chromeExecutable;
    }
    for (const candidate of CHROME_CANDIDATES) {
      if (candidate && fs.existsSync(candidate)) return candidate;
    }
    return null;
  }

  /** Report whether a usable browser executable exists (for Settings). */
  testChrome(): { found: boolean; path?: string } {
    const p = this.resolveChrome();
    return p ? { found: true, path: p } : { found: false };
  }

  /**
   * Open the official Gemini site in the account's dedicated browser profile.
   * Returns the resolved profile path so the UI can display it.
   */
  openGeminiForAccount(accountId: number): { url: string; profilePath: string } {
    const account = this.repos.accounts.get(accountId);
    if (!account) throw new Error(`Account ${accountId} not found`);
    this.ensureProfileDir(account.browser_profile_path);
    const chrome = this.resolveChrome();
    if (!chrome) {
      throw new Error(
        "No Chrome/Chromium/Edge executable found. Install Google Chrome or set the browser path in Settings."
      );
    }
    const args = [
      `--user-data-dir=${account.browser_profile_path}`,
      `--profile-directory=${path.basename(account.browser_profile_path)}`,
      GEMINI_URL,
    ];
    // Detached: the app must survive if the user closes the browser tab.
    spawn(chrome, args, { detached: true, stdio: "ignore", windowsHide: false }).unref();
    this.repos.activity.log({
      action: "browser.opened",
      entity_type: "account",
      entity_id: String(account.id),
      description: `Opened Gemini in profile "${account.label}"`,
    });
    return { url: GEMINI_URL, profilePath: account.browser_profile_path };
  }

  /**
   * Open the account's browser profile directory in the system file manager
   * (useful for the user to inspect / verify the profile exists).
   */
  revealProfile(accountId: number): string {
    const account = this.repos.accounts.get(accountId);
    if (!account) throw new Error(`Account ${accountId} not found`);
    this.ensureProfileDir(account.browser_profile_path);
    return account.browser_profile_path;
  }

  private ensureProfileDir(dir: string): void {
    fs.mkdirSync(dir, { recursive: true });
  }
}
