import type { Db } from "../database";
import { row, rows, nowIso } from "./sql";
import type { ActivityLog } from "@shared/types";

export interface LogInput {
  action: string;
  entity_type: string;
  entity_id?: string | null;
  description?: string | null;
}

/** Data access for the `activity_logs` table. */
export class ActivityRepository {
  constructor(private readonly db: Db) {}

  log(input: LogInput): ActivityLog {
    const ts = nowIso();
    const info = this.db
      .prepare(
        `INSERT INTO activity_logs (action, entity_type, entity_id, description, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        input.action,
        input.entity_type,
        input.entity_id ?? null,
        input.description ?? null,
        ts
      );
    return this.get(info.lastInsertRowid as number) as ActivityLog;
  }

  list(limit = 200, offset = 0): ActivityLog[] {
    return rows<ActivityLog>(
      this.db,
      `SELECT * FROM activity_logs ORDER BY id DESC LIMIT ? OFFSET ?`,
      limit,
      offset
    );
  }

  get(id: number): ActivityLog | null {
    return row<ActivityLog>(this.db, `SELECT * FROM activity_logs WHERE id = ?`, id);
  }
}
