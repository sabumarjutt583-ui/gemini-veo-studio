import type { Db } from "../database";
import { row, rows, nowIso } from "./sql";
import type { Prompt, NewPrompt, UpdatePrompt } from "@shared/types";

/** Data access for the `prompts` table. */
export class PromptRepository {
  constructor(private readonly db: Db) {}

  list(query?: string): Prompt[] {
    const q = (query ?? "").trim();
    if (q) {
      return rows<Prompt>(
        this.db,
        `SELECT * FROM prompts
          WHERE title LIKE ? OR prompt_text LIKE ? OR category LIKE ?
          ORDER BY updated_at DESC, id DESC`,
        `%${q}%`,
        `%${q}%`,
        `%${q}%`
      );
    }
    return rows<Prompt>(
      this.db,
      `SELECT * FROM prompts ORDER BY updated_at DESC, id DESC`
    );
  }

  get(id: number): Prompt | null {
    return row<Prompt>(this.db, `SELECT * FROM prompts WHERE id = ?`, id);
  }

  create(input: NewPrompt): Prompt {
    const ts = nowIso();
    const info = this.db
      .prepare(
        `INSERT INTO prompts (title, prompt_text, category, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(input.title, input.prompt_text, input.category ?? null, ts, ts);
    return this.get(info.lastInsertRowid as number) as Prompt;
  }

  /** Bulk insert; returns the created prompts. */
  createMany(inputs: NewPrompt[]): Prompt[] {
    const ts = nowIso();
    const insert = this.db.prepare(
      `INSERT INTO prompts (title, prompt_text, category, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    );
    const out: Prompt[] = [];
    const tx = this.db.transaction(() => {
      for (const i of inputs) {
        const info = insert.run(i.title, i.prompt_text, i.category ?? null, ts, ts);
        const p = this.get(info.lastInsertRowid as number);
        if (p) out.push(p);
      }
    });
    tx();
    return out;
  }

  update(id: number, input: UpdatePrompt): Prompt | null {
    this.db
      .prepare(
        `UPDATE prompts SET
           title = COALESCE(?, title),
           prompt_text = COALESCE(?, prompt_text),
           category = COALESCE(?, category),
           updated_at = ?
         WHERE id = ?`
      )
      .run(
        input.title ?? null,
        input.prompt_text ?? null,
        input.category !== undefined ? input.category : null,
        nowIso(),
        id
      );
    return this.get(id);
  }

  delete(id: number): boolean {
    const r = this.db.prepare(`DELETE FROM prompts WHERE id = ?`).run(id);
    return r.changes > 0;
  }
}
