import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { inMemoryDatabase } from "@main/database/database";
import { createRepositories } from "@main/database/repositories";
import { QueueService } from "@main/services/queue.service";
import { CooldownService, type CooldownNotification } from "@main/services/cooldown.service";
import { VideoService } from "@main/services/video.service";
import { AccountService } from "@main/services/account.service";
import type { Config } from "@main/services/config";
import { dirsFor } from "@shared/paths";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function makeConfig() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gvs-cfg-"));
  return {
    cfg: { dataDirs: dirsFor(root), chromeExecutable: null } as Config,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

describe("queue service (state machine)", () => {
  let repos = createRepositories(inMemoryDatabase());
  let queue: QueueService;

  beforeAll(() => {
    queue = new QueueService(repos);
  });

  it("creates a job and advances through legal transitions", () => {
    const job = queue.create({ prompt_text: "a cinematic shot", status: "pending" });
    expect(job.status).toBe("pending");
    queue.setStatus(job.id, "ready");
    queue.setStatus(job.id, "opened_in_gemini");
    queue.setStatus(job.id, "generating");
    queue.setStatus(job.id, "completed");
    expect(queue.get(job.id)?.status).toBe("completed");
  });

  it("rejects an illegal transition", () => {
    const job = queue.create({ prompt_text: "x", status: "completed" });
    expect(() => queue.setStatus(job.id, "generating")).toThrow(/Illegal transition/);
  });

  it("pauseQueue pauses only resumable tasks, resumeQueue restores them", () => {
    const a = queue.create({ prompt_text: "a", status: "pending" });
    const b = queue.create({ prompt_text: "b", status: "completed" });
    const paused = queue.pauseQueue();
    expect(paused).toBe(1);
    expect(queue.get(a.id)?.status).toBe("paused");
    expect(queue.get(b.id)?.status).toBe("completed"); // untouched
    const resumed = queue.resumeQueue();
    expect(resumed).toBe(1);
    expect(queue.get(a.id)?.status).toBe("pending");
  });

  it("retry only works from the failed state", () => {
    const job = queue.create({ prompt_text: "f", status: "pending" });
    // Legal chain to "failed": pending -> ready -> opened_in_gemini -> failed
    queue.setStatus(job.id, "ready");
    queue.setStatus(job.id, "opened_in_gemini");
    queue.setStatus(job.id, "failed");
    expect(() => queue.retry(queue.create({ prompt_text: "ok", status: "completed" }).id)).toThrow();
    queue.retry(job.id);
    expect(queue.get(job.id)?.status).toBe("pending");
  });

  it("reorders tasks by position", () => {
    const j1 = queue.create({ prompt_text: "1" });
    const j2 = queue.create({ prompt_text: "2" });
    queue.reorder([j2.id, j1.id]);
    // Reorder assigns positions 1..n in the given id order, so j2 gets the
    // smaller position and therefore sorts first when tied on nothing.
    expect(queue.get(j2.id)?.position).toBe(1);
    expect(queue.get(j1.id)?.position).toBe(2);
    const list = queue.list();
    expect(list.findIndex((j) => j.id === j2.id)).toBeLessThan(
      list.findIndex((j) => j.id === j1.id),
    );
  });
});

describe("cooldown service", () => {
  it("records a cooldown, flags the account, and computes remaining time", () => {
    const { cfg, cleanup } = makeConfig();
    const repos = createRepositories(inMemoryDatabase());
    const svc = new CooldownService(repos);
    const acct = new AccountService(repos, cfg).create({
      label: "C",
      account_type: "pro",
      browser_profile_path: path.join(cfg.dataDirs.root, "prof"),
    });
    const future = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
    const cd = svc.create({ account_id: acct.id, cooldown_type: "five_hour", reset_time: future });
    expect(cd.status).toBe("active");
    expect(repos.accounts.get(acct.id)?.usage_status).toBe("cooldown");
    expect(svc.secondsRemaining(acct.id)).toBeGreaterThan(0);
    // Clearing it and having no other active cooldown resets usage to ready.
    svc.clear(cd.id);
    expect(repos.accounts.get(acct.id)?.usage_status).toBe("ready");
    cleanup();
  });

  it("notifies when a cooldown expires", () => {
    const repos = createRepositories(inMemoryDatabase());
    // Object holder: TS can't track the closure assignment to a `let` that
    // starts as `null`, but a property keeps its declared type.
    const noted: { value: CooldownNotification | null } = { value: null };
    const svc = new CooldownService(repos, (n) => {
      noted.value = n;
    });
    const acct = repos.accounts.create({
      label: "Exp",
      account_type: "pro",
      browser_profile_path: "/tmp/exp",
    });
    svc.create({
      account_id: acct.id,
      cooldown_type: "five_hour",
      reset_time: new Date(Date.now() - 1000).toISOString(), // already past
    });
    const ids = svc.checkExpired();
    expect(ids.length).toBe(1);
    expect(noted.value?.accountId).toBe(acct.id);
  });
});

describe("video service (organization)", () => {
  it("organizes an imported file into year/month folders without clobbering", () => {
    const { cfg, cleanup } = makeConfig();
    const repos = createRepositories(inMemoryDatabase());
    const svc = new VideoService(repos, cfg.dataDirs.videosDir);

    // Simulate a downloaded file in a temp "download" dir.
    const dlDir = path.join(cfg.dataDirs.root, "downloads");
    fs.mkdirSync(dlDir, { recursive: true });
    const src = path.join(dlDir, "clip.mp4");
    fs.writeFileSync(src, "fake-video-bytes");

    const now = new Date();
    const imported = svc.importVideo(src, { organize: true });
    const expected = svc.organizedPath("clip.mp4", now);
    expect(imported.file_path).toBe(expected);
    expect(fs.existsSync(expected)).toBe(true);
    // The original was moved, not copied.
    expect(fs.existsSync(src)).toBe(false);
    cleanup();
  });

  it("deleteVideo with deleteFile removes the on-disk file", () => {
    const { cfg, cleanup } = makeConfig();
    const repos = createRepositories(inMemoryDatabase());
    const svc = new VideoService(repos, cfg.dataDirs.videosDir);
    const dlDir = path.join(cfg.dataDirs.root, "d2");
    fs.mkdirSync(dlDir, { recursive: true });
    const src = path.join(dlDir, "x.mp4");
    fs.writeFileSync(src, "bytes");
    const v = svc.importVideo(src, { organize: false });
    svc.deleteVideo(v.id, true);
    expect(fs.existsSync(v.file_path)).toBe(false);
    cleanup();
  });
});
