import fs from "node:fs";
import type { Repositories } from "../database/repositories";
import type { NewPrompt, Prompt } from "@shared/types";
import { ok, fail, type ApiResult } from "./result";

/**
 * Prompt management: create, list, edit, delete, and bulk import.
 *
 * Import parsing is pure (separated into `parseTxtPrompts` / `parseCsvPrompts`)
 * so it can be unit-tested without any filesystem or database.
 */
export class PromptService {
  constructor(private readonly repos: Repositories) {}

  list(query?: string): Prompt[] {
    return this.repos.prompts.list(query);
  }

  get(id: number): Prompt | null {
    return this.repos.prompts.get(id);
  }

  create(input: NewPrompt): Prompt {
    const prompt = this.repos.prompts.create(input);
    this.repos.activity.log({
      action: "prompt.created",
      entity_type: "prompt",
      entity_id: String(prompt.id),
      description: `Saved prompt "${prompt.title}"`,
    });
    return prompt;
  }

  update(id: number, input: Partial<NewPrompt>): Prompt | null {
    const p = this.repos.prompts.update(id, input);
    if (p) {
      this.repos.activity.log({
        action: "prompt.updated",
        entity_type: "prompt",
        entity_id: String(id),
        description: `Updated prompt "${p.title}"`,
      });
    }
    return p;
  }

  delete(id: number): boolean {
    const existed = this.repos.prompts.get(id);
    const deleted = this.repos.prompts.delete(id);
    if (deleted) {
      this.repos.activity.log({
        action: "prompt.deleted",
        entity_type: "prompt",
        entity_id: String(id),
        description: existed ? `Deleted prompt "${existed.title}"` : "Deleted prompt",
      });
    }
    return deleted;
  }

  /** Import a file on disk into the prompt library. */
  importFile(filePath: string, format: "txt" | "csv"): ApiResult<Prompt[]> {
    return guard(() => {
      const raw = fs.readFileSync(filePath, "utf8");
      const texts = format === "csv" ? parseCsvPrompts(raw) : parseTxtPrompts(raw);
      const created = this.repos.prompts.createMany(
        texts.map((t) => ({
          title: titleFromText(t),
          prompt_text: t,
          category: "imported",
        }))
      );
      this.repos.activity.log({
        action: "prompt.imported",
        entity_type: "prompt",
        entity_id: String(created.length),
        description: `Imported ${created.length} prompt(s) from ${filePath}`,
      });
      return created;
    });
  }
}

function guard<T>(fn: () => T): ApiResult<T> {
  try {
    return ok(fn());
  } catch (e) {
    return fail(e);
  }
}

/** Short display title: first ~50 chars of the prompt text. */
export function titleFromText(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= 50) return t || "Untitled";
  return t.slice(0, 50) + "…";
}

/**
 * Parse a TXT file containing one or more prompts.
 * Recognizes:
 *  - "Prompt N: <text>" (the example format from the spec).
 *  - One prompt per non-empty line (fallback).
 *  - Blank-line separated blocks.
 */
export function parseTxtPrompts(raw: string): string[] {
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];

  // Case 1: lines that begin with a "Prompt N:" marker.
  const markerRe = /^prompt\s*\d+[:.\-)]\s*/i;
  const marked = lines.map((l) => l.trim()).filter((l) => l.length > 0);
  if (marked.some((l) => markerRe.test(l))) {
    for (const line of marked) {
      const stripped = line.replace(markerRe, "").trim();
      if (stripped) out.push(stripped);
    }
    if (out.length) return out;
  }

  // Case 2: blank-line separated blocks.
  const blocks = raw
    .split(/\n\s*\n/)
    .map((b) => b.trim().replace(/\s+/g, " "))
    .filter((b) => b.length > 0);
  if (blocks.length > 1) return blocks;

  // Case 3: one prompt per non-empty line.
  const perLine = lines.map((l) => l.trim()).filter((l) => l.length > 0);
  return perLine;
}

/**
 * Parse a CSV file. Supports two shapes:
 *  - `title,prompt_text` columns.
 *  - a single column of prompt text (one prompt per row).
 * The `prompt_text` column is used preferentially when present.
 */
export function parseCsvPrompts(raw: string): string[] {
  const records = parseCsvRecords(raw);
  if (!records.length) return [];
  const header = records[0].map((h) => h.trim().toLowerCase());
  const hasPromptCol =
    header.includes("prompt_text") ||
    header.includes("prompt") ||
    header.includes("text");

  let dataRows = records;
  let textCol = 0;
  if (hasPromptCol) {
    textCol = header.findIndex((h) =>
      ["prompt_text", "prompt", "text"].includes(h)
    );
    dataRows = records.slice(1); // skip header
  }

  const out: string[] = [];
  for (const row of dataRows) {
    const text = (row[textCol] ?? "").trim();
    if (text) out.push(text);
  }
  return out;
}

/** Minimal RFC-4180-ish CSV line splitter (handles quoted fields). */
function parseCsvRecords(raw: string): string[][] {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (inQuotes) {
      if (c === '"') {
        if (raw[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      record.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && raw[i + 1] === "\n") i++;
      record.push(field);
      field = "";
      if (record.some((f) => f.trim() !== "")) records.push(record);
      record = [];
    } else field += c;
  }
  if (field !== "" || record.length) {
    record.push(field);
    if (record.some((f) => f.trim() !== "")) records.push(record);
  }
  return records;
}
