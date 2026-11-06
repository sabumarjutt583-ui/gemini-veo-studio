import type { Db } from "../database";
import { row, rows, nowIso } from "./sql";
import type { Video } from "@shared/types";

export interface NewVideo {
  job_id: number | null;
  filename: string;
  file_path: string;
  thumbnail_path?: string | null;
  file_size?: number | null;
  duration?: number | null;
}

/** Data access for the `videos` table. */
export class VideoRepository {
  constructor(private readonly db: Db) {}

  list(): Video[] {
    return rows<Video>(this.db, `SELECT * FROM videos ORDER BY downloaded_at DESC, id DESC`);
  }

  listByJob(jobId: number): Video[] {
    return rows<Video>(
      this.db,
      `SELECT * FROM videos WHERE job_id = ? ORDER BY downloaded_at DESC`,
      jobId
    );
  }

  get(id: number): Video | null {
    return row<Video>(this.db, `SELECT * FROM videos WHERE id = ?`, id);
  }

  create(input: NewVideo): Video {
    const ts = nowIso();
    const info = this.db
      .prepare(
        `INSERT INTO videos
           (job_id, filename, file_path, thumbnail_path, file_size, duration, downloaded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.job_id ?? null,
        input.filename,
        input.file_path,
        input.thumbnail_path ?? null,
        input.file_size ?? null,
        input.duration ?? null,
        ts
      );
    return this.get(info.lastInsertRowid as number) as Video;
  }

  rename(id: number, newName: string): Video | null {
    this.db
      .prepare(`UPDATE videos SET filename = ? WHERE id = ?`)
      .run(newName, id);
    return this.get(id);
  }

  linkJob(videoId: number, jobId: number | null): Video | null {
    this.db
      .prepare(`UPDATE videos SET job_id = ? WHERE id = ?`)
      .run(jobId, videoId);
    return this.get(videoId);
  }

  delete(id: number): boolean {
    const r = this.db.prepare(`DELETE FROM videos WHERE id = ?`).run(id);
    return r.changes > 0;
  }
}
