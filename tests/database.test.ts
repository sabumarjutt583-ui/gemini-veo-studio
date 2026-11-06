import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { inMemoryDatabase, openDatabase } from "@main/database/database";
import { createRepositories } from "@main/database/repositories";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

// In-memory DB tests: verifies schema + FK enforcement + basic CRUD.
describe("database (in-memory)", () => {
  const db = inMemoryDatabase();
  const repos = createRepositories(db);

  it("applies the schema", () => {
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table'`)
      .all()
      .map((r) => (r as { name: string }).name);
    for (const t of [
      "accounts",
      "prompts",
      "generation_jobs",
      "cooldowns",
      "videos",
      "activity_logs",
      "settings",
      "_migrations",
    ]) {
      expect(tables).toContain(t);
    }
  });

  it("enforces foreign keys", () => {
    expect(() =>
      db.prepare(
        `INSERT INTO generation_jobs (prompt_text, prompt_id) VALUES (?, 999)`,
      ).run("hi"),
    ).toThrow(); // ON DELETE SET NULL but the FK constraint is still enforced
  });

  it("creates and lists accounts", () => {
    const a = repos.accounts.create({
      label: "Test",
      account_type: "pro",
      browser_profile_path: "/tmp/x",
    });
    expect(repos.accounts.list()).toHaveLength(1);
    expect(a.label).toBe("Test");
  });

  it("persists settings round-trip", () => {
    const s = repos.settings.load();
    const next = repos.settings.update({ ...s, theme: "light" });
    expect(next.theme).toBe("light");
    expect(repos.settings.load().theme).toBe("light");
  });
});

describe("database (file-backed)", () => {
  let dir: string;
  let db: ReturnType<typeof openDatabase>;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "gvs-test-"));
    db = openDatabase(path.join(dir, "test.db"));
  });

  afterAll(() => {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("creates the db file on disk", () => {
    expect(fs.existsSync(path.join(dir, "test.db"))).toBe(true);
  });

  it("stores a prompt and retrieves it", () => {
    const repos = createRepositories(db);
    const p = repos.prompts.create({ title: "T", prompt_text: "P" });
    expect(repos.prompts.get(p.id)?.prompt_text).toBe("P");
  });
});
