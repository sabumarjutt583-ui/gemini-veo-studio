import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Repositories } from "../database/repositories";
import type { Video } from "@shared/types";
import type { NewVideo } from "../database/repositories/video.repo";

/**
 * Video library. Tracks generated videos on disk and organizes them under the
 * data root as <videosDir>/<year>/<Month>/<file> when the user opts into
 * auto-organization. The app NEVER deletes or moves an original downloaded
 * file without explicit user confirmation (exposed via `moveVideo` / `deleteVideo`
 * which the UI gates behind a confirm dialog).
 *
 * Thumbnail generation is attempted lazily via @ffmpeg-installer when present;
 * if the binary is unavailable the app still records the video with
 * thumbnail_path = null and the UI falls back to a placeholder.
 */
export class VideoService {
  constructor(private readonly repos: Repositories, private readonly videoRoot: string) {}

  list(): Video[] {
    return this.repos.videos.list();
  }

  get(id: number): Video | null {
    return this.repos.videos.get(id);
  }

  /**
   * Record a video that already exists on disk (e.g. detected in the download
   * folder, or manually imported). Optionally moves it into the organized
   * library folder and links it to a job.
   */
  importVideo(
    filePath: string,
    opts: { jobId?: number | null; organize?: boolean; fileSize?: number } = {}
  ): Video {
    const filename = path.basename(filePath);
    let target = filePath;

    if (opts.organize) {
      target = this.organizedPath(filename, new Date());
      fs.mkdirSync(path.dirname(target), { recursive: true });
      // Move the file into the organized location only if it is not already
      // there (idempotent, and never overwrites an existing target).
      if (path.resolve(target) !== path.resolve(filePath)) {
        if (fs.existsSync(target)) {
          target = this.dedupe(target);
        }
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.renameSync(filePath, target);
      }
    }

    const video = this.repos.videos.create({
      job_id: opts.jobId ?? null,
      filename: path.basename(target),
      file_path: target,
      file_size: opts.fileSize ?? this.statSize(target),
    } satisfies NewVideo);

    this.repos.activity.log({
      action: "video.imported",
      entity_type: "video",
      entity_id: String(video.id),
      description: `Imported video "${video.filename}"`,
    });
    return video;
  }

  /** Record a video that lives in the configured download folder (no move). */
  detectInDownloadFolder(downloadDir: string): Video[] {
    if (!downloadDir || !fs.existsSync(downloadDir)) return [];
    const videoExts = new Set([".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v"]);
    const found: Video[] = [];
    let entries: string[] = [];
    try {
      entries = fs.readdirSync(downloadDir);
    } catch {
      return [];
    }
    for (const name of entries) {
      const full = path.join(downloadDir, name);
      if (!fs.statSync(full).isFile()) continue;
      const ext = path.extname(name).toLowerCase();
      if (!videoExts.has(ext)) continue;
      // Skip files already in the library to avoid duplicates.
      if (this.repos.videos.list().some((v) => v.file_path === full)) continue;
      found.push(
        this.repos.videos.create({
          job_id: null,
          filename: name,
          file_path: full,
          file_size: this.statSize(full),
        } satisfies NewVideo)
      );
      this.repos.activity.log({
        action: "video.detected",
        entity_type: "video",
        entity_id: "0",
        description: `Detected downloaded video "${name}"`,
      });
    }
    return found;
  }

  renameVideo(id: number, newName: string): Video {
    const video = this.repos.videos.get(id);
    if (!video) throw new Error(`Video ${id} not found`);
    const dir = path.dirname(video.file_path);
    const target = path.join(dir, newName);
    if (newName !== video.filename) {
      if (fs.existsSync(target)) throw new Error(`Target name already exists: ${newName}`);
      fs.renameSync(video.file_path, target);
    }
    const updated = this.repos.videos.rename(id, newName);
    if (!updated) throw new Error(`Video ${id} not found`);
    this.repos.activity.log({
      action: "video.renamed",
      entity_type: "video",
      entity_id: String(id),
      description: `Renamed video to "${newName}"`,
    });
    return updated;
  }

  /**
   * Delete a video record. By default this only removes the DB row (the file
   * stays on disk). Pass `deleteFile` to also remove the on-disk file — the
   * caller (UI) must confirm this.
   */
  deleteVideo(id: number, deleteFile = false): boolean {
    const video = this.repos.videos.get(id);
    const removed = this.repos.videos.delete(id);
    if (removed && deleteFile && video?.file_path) {
      try {
        if (fs.existsSync(video.file_path)) fs.unlinkSync(video.file_path);
      } catch {
        /* leave the file; the DB row is already gone. */
      }
    }
    if (removed) {
      this.repos.activity.log({
        action: "video.deleted",
        entity_type: "video",
        entity_id: String(id),
        description: deleteFile ? "Deleted video and file" : "Deleted video record",
      });
    }
    return removed;
  }

  linkToJob(videoId: number, jobId: number | null): Video {
    const v = this.repos.videos.linkJob(videoId, jobId);
    if (!v) throw new Error(`Video ${videoId} not found`);
    this.repos.activity.log({
      action: "video.linked",
      entity_type: "video",
      entity_id: String(videoId),
      description: jobId ? `Linked video to task #${jobId}` : "Unlinked video from task",
    });
    return v;
  }

  /** Compute the organized destination for a video file. */
  organizedPath(filename: string, date = new Date()): string {
    const year = String(date.getFullYear());
    const month = date.toLocaleString("en", { month: "long" });
    return path.join(this.videoRoot, year, month, filename);
  }

  private dedupe(candidate: string): string {
    const ext = path.extname(candidate);
    const base = candidate.slice(0, -ext.length);
    let n = 2;
    let c = `${base}-${n}${ext}`;
    while (fs.existsSync(c)) {
      n += 1;
      c = `${base}-${n}${ext}`;
    }
    return c;
  }

  private statSize(p: string): number | null {
    try {
      return fs.statSync(p).size;
    } catch {
      return null;
    }
  }
}

export function defaultVideoRoot(dataRoot: string): string {
  return path.join(dataRoot, "Videos");
}

export function tempDirForVideoTests(): string {
  return path.join(os.tmpdir(), "gvs-video-tests-" + Date.now());
}
