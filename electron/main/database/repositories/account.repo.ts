import type { Db } from "../database";
import { row, rows, nowIso } from "./sql";
import type {
  Account,
  NewAccount,
  UpdateAccount,
  UsageStatus,
} from "@shared/types";

/** Data access for the `accounts` table. */
export class AccountRepository {
  constructor(private readonly db: Db) {}

  list(): Account[] {
    return rows<Account>(
      this.db,
      `SELECT * FROM accounts ORDER BY id`
    );
  }

  get(id: number): Account | null {
    return row<Account>(this.db, `SELECT * FROM accounts WHERE id = ?`, id);
  }

  create(input: NewAccount): Account {
    const ts = nowIso();
    const info = this.db
      .prepare(
        `INSERT INTO accounts
           (label, email, account_type, browser_profile_path, login_status, usage_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.label,
        input.email ?? null,
        input.account_type,
        input.browser_profile_path,
        input.login_status ?? "not_logged_in",
        input.usage_status ?? "none",
        ts,
        ts
      );
    return this.get(info.lastInsertRowid as number) as Account;
  }

  update(id: number, input: UpdateAccount): Account | null {
    const current = this.get(id);
    if (!current) return null;
    const next: UpdateAccount & { _ts: string } = { ...input, _ts: nowIso() };
    this.db
      .prepare(
        `UPDATE accounts SET
           label = COALESCE(?, label),
           email = COALESCE(?, email),
           account_type = COALESCE(?, account_type),
           browser_profile_path = COALESCE(?, browser_profile_path),
           login_status = COALESCE(?, login_status),
           usage_status = COALESCE(?, usage_status),
           updated_at = ?
         WHERE id = ?`
      )
      .run(
        input.label ?? null,
        input.email !== undefined ? input.email : null,
        input.account_type ?? null,
        input.browser_profile_path ?? null,
        input.login_status ?? null,
        input.usage_status ?? null,
        next._ts,
        id
      );
    return this.get(id);
  }

  setUsage(id: number, usage: UsageStatus): Account | null {
    return this.update(id, { usage_status: usage });
  }

  delete(id: number): boolean {
    const r = this.db.prepare(`DELETE FROM accounts WHERE id = ?`).run(id);
    return r.changes > 0;
  }
}
