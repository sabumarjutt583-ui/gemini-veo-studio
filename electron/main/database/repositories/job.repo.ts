import type { Db } from "../database";
import { row, rows, nowIso } from "./sql";
import type { GenerationJob, JobStatus, NewJob } from "@shared/types";
import type { JobFilter } from "@shared/ipc";

/** Data access for the `generation_jobs` table. */
export class JobRepository {
  constructor(private readonly db: Db) {}

  list(filter: JobFilter = {}): GenerationJob[] {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter.status) {
      where.push("status = ?");
      params.push(filter.status);
    }
    if (filter.accountId) {
      where.push("account_id = ?");
      params.push(filter.accountId);
    }
    if (filter.search) {
      where.push("(prompt_text LIKE ? OR notes LIKE ?)");
      params.push(`%${filter.search}%`, `%${filter.search}%`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const limitSql = filter.limit ? "LIMIT ?" : "";
    const offsetSql = filter.offset ? "OFFSET ?" : "";
    const limitParams: unknown[] = [...params];
    if (filter.limit) limitParams.push(filter.limit);
    if (filter.offset) limitParams.push(filter.offset ?? 0);
    return rows<GenerationJob>(
      this.db,
      `SELECT * FROM generation_jobs ${whereSql}
        ORDER BY position ASC, id ASC ${limitSql} ${offsetSql}`,
      ...limitParams
    );
  }

  get(id: number): GenerationJob | null {
    return row<GenerationJob>(this.db, `SELECT * FROM generation_jobs WHERE id = ?`, id);
  }

  create(input: NewJob): GenerationJob {
    const ts = nowIso();
    const pos = this.maxPosition() + 1;
    const info = this.db
      .prepare(
        `INSERT INTO generation_jobs
           (prompt_id, prompt_text, account_id, status, notes, position,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.prompt_id ?? null,
        input.prompt_text,
        input.account_id ?? null,
        input.status ?? "pending",
        input.notes ?? null,
        pos,
        ts,
        ts
      );
    return this.get(info.lastInsertRowid as number) as GenerationJob;
  }

  update(id: number, input: Partial<NewJob>): GenerationJob | null {
    this.db
      .prepare(
        `UPDATE generation_jobs SET
           prompt_id = COALESCE(?, prompt_id),
           prompt_text = COALESCE(?, prompt_text),
           account_id = COALESCE(?, account_id),
           notes = COALESCE(?, notes),
           updated_at = ?
         WHERE id = ?`
      )
      .run(
        input.prompt_id !== undefined ? input.prompt_id : null,
        input.prompt_text ?? null,
        input.account_id !== undefined ? input.account_id : null,
        input.notes !== undefined ? input.notes : null,
        nowIso(),
        id
      );
    return this.get(id);
  }

  setStatus(id: number, status: JobStatus): GenerationJob | null {
    const ts = nowIso();
    const started = status === "generating" ? ts : null;
    const completed = status === "completed" ? ts : null;
    this.db
      .prepare(
        `UPDATE generation_jobs SET
           status = ?,
           started_at = COALESCE(started_at, ?),
           completed_at = COALESCE(completed_at, ?),
           updated_at = ?
         WHERE id = ?`
      )
      .run(status, started, completed, ts, id);
    return this.get(id);
  }

  delete(id: number): boolean {
    const r = this.db.prepare(`DELETE FROM generation_jobs WHERE id = ?`).run(id);
    return r.changes > 0;
  }

  /** Reorder: given an ordered list of ids, set position 0..n-1 in that order. */
  reorder(ids: number[]): void {
    const tx = this.db.transaction(() => {
      const stmt = this.db.prepare(
        `UPDATE generation_jobs SET position = ?, updated_at = ? WHERE id = ?`
      );
      ids.forEach((id, i) => stmt.run(i + 1, nowIso(), id));
    });
    tx();
  }

  maxPosition(): number {
    const r = this.db.prepare(`SELECT MAX(position) AS m FROM generation_jobs`).get() as
      | { m: number | null }
      | undefined;
    return r?.m ?? 0;
  }

  countByStatus(status: JobStatus): number {
    const r = this.db
      .prepare(`SELECT COUNT(*) AS c FROM generation_jobs WHERE status = ?`)
      .get(status) as { c: number };
    return r.c;
  }
}
