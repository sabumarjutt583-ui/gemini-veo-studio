import type { Db } from "../database";
import { row, rows, nowIso } from "./sql";
import type { Cooldown, NewCooldown } from "@shared/types";

/** Data access for the `cooldowns` table. */
export class CooldownRepository {
  constructor(private readonly db: Db) {}

  list(accountId?: number): Cooldown[] {
    if (accountId) {
      return rows<Cooldown>(
        this.db,
        `SELECT * FROM cooldowns WHERE account_id = ? ORDER BY created_at DESC, id DESC`,
        accountId
      );
    }
    return rows<Cooldown>(
      this.db,
      `SELECT * FROM cooldowns ORDER BY created_at DESC, id DESC`
    );
  }

  /** Most recent ACTIVE cooldown for an account, or null. */
  activeFor(accountId: number): Cooldown | null {
    return row<Cooldown>(
      this.db,
      `SELECT * FROM cooldowns WHERE account_id = ? AND status = 'active'
        ORDER BY created_at DESC, id DESC LIMIT 1`,
      accountId
    );
  }

  get(id: number): Cooldown | null {
    return row<Cooldown>(this.db, `SELECT * FROM cooldowns WHERE id = ?`, id);
  }

  create(input: NewCooldown): Cooldown {
    const ts = nowIso();
    const info = this.db
      .prepare(
        `INSERT INTO cooldowns
           (account_id, cooldown_type, start_time, reset_time, status, notes, created_at)
         VALUES (?, ?, ?, ?, 'active', ?, ?)`
      )
      .run(
        input.account_id,
        input.cooldown_type,
        input.start_time ?? ts,
        input.reset_time ?? null,
        input.notes ?? null,
        ts
      );
    return this.get(info.lastInsertRowid as number) as Cooldown;
  }

  clear(id: number): Cooldown | null {
    this.db
      .prepare(`UPDATE cooldowns SET status = 'cleared' WHERE id = ?`)
      .run(id);
    return this.get(id);
  }

  delete(id: number): boolean {
    const r = this.db.prepare(`DELETE FROM cooldowns WHERE id = ?`).run(id);
    return r.changes > 0;
  }
}
