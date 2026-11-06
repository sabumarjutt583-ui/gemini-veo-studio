import fs from "node:fs";
import path from "node:path";
import type { Repositories } from "../database/repositories";
import type { Account, NewAccount, UpdateAccount, UsageStatus } from "@shared/types";
import type { Config } from "./config";

/**
 * Account management. Owns the account record and its dedicated browser profile
 * directory. The app NEVER touches Google credentials: it only knows the path
 * to the profile where the user signs in manually.
 */
export class AccountService {
  constructor(private readonly repos: Repositories, private readonly cfg: Config) {}

  list(): Account[] {
    return this.repos.accounts.list();
  }

  get(id: number): Account | null {
    return this.repos.accounts.get(id);
  }

  /**
   * Create an account and provision its browser profile directory. The profile
   * path is allocated under <data>/browser-profiles/<slug>-<id> unless a
   * custom path is supplied.
   */
  create(input: NewAccount): Account {
    const idPrefix = this.nextProfileSlug(input.label);
    const profilePath =
      input.browser_profile_path || this.provisionProfileDir(idPrefix, input.label);
    const account = this.repos.accounts.create({
      ...input,
      browser_profile_path: profilePath,
    });
    this.repos.activity.log({
      action: "account.created",
      entity_type: "account",
      entity_id: String(account.id),
      description: `Created account "${account.label}"`,
    });
    return account;
  }

  update(id: number, input: UpdateAccount): Account | null {
    const account = this.repos.accounts.update(id, input);
    if (account) {
      this.repos.activity.log({
        action: "account.updated",
        entity_type: "account",
        entity_id: String(id),
        description: `Updated account "${account.label}"`,
      });
    }
    return account;
  }

  setUsage(id: number, usage: UsageStatus): Account | null {
    const account = this.repos.accounts.setUsage(id, usage);
    if (account) {
      this.repos.activity.log({
        action: "account.usage",
        entity_type: "account",
        entity_id: String(id),
        description: `Set usage to ${usage}`,
      });
    }
    return account;
  }

  /**
   * Delete an account. The browser profile directory is NOT removed here —
   * that is a destructive action requiring explicit user confirmation through
   * a dedicated call. The database row (and any linked jobs via ON DELETE
   * SET NULL) are removed.
   */
  delete(id: number): boolean {
    const existed = this.repos.accounts.get(id);
    const deleted = this.repos.accounts.delete(id);
    if (deleted) {
      this.repos.activity.log({
        action: "account.deleted",
        entity_type: "account",
        entity_id: String(id),
        description: existed ? `Deleted account "${existed.label}"` : "Deleted account",
      });
    }
    return deleted;
  }

  /** Remove a profile directory from disk (used by the "delete account" flow
   *  after the user confirms the on-disk cleanup). Never called implicitly. */
  deleteProfileDir(account: Account): void {
    if (!account.browser_profile_path) return;
    try {
      fs.rmSync(account.browser_profile_path, { recursive: true, force: true });
    } catch {
      // Leave the directory if it can't be removed; report to the UI.
    }
  }

  /** Ensure the account's browser profile directory exists on disk. */
  ensureProfileDir(account: Account): string {
    const dir = account.browser_profile_path;
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  /** Allocate a fresh, unique profile directory under the data root. */
  private provisionProfileDir(slug: string, label: string): string {
    const base = path.join(this.cfg.dataDirs.profilesDir, `${slug}`);
    // De-dupe: append -2, -3… until a free name is found.
    let candidate = base;
    let n = 2;
    while (fs.existsSync(candidate)) {
      candidate = path.join(this.cfg.dataDirs.profilesDir, `${slug}-${n}`);
      n += 1;
    }
    fs.mkdirSync(candidate, { recursive: true });
    return candidate;
  }

  /** A filesystem-safe slug derived from the label, used for the profile name. */
  private nextProfileSlug(label: string): string {
    const slug = label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return slug || `account-${Date.now().toString(36)}`;
  }
}
