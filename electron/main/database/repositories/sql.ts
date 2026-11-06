/**
 * Small shared helpers for repositories: ISO timestamps and a typed row
 * helper. Keeping `created_at`/`updated_at` as ISO 8601 strings (written from
 * JS) means every value in the database is in a single, unambiguous format
 * that date-fns and the UI can parse directly.
 */
import type { Db } from "../database";

/** ISO 8601 UTC timestamp, e.g. 2026-11-03T17:44:00.000Z. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Run a SELECT and return all rows cast to `T`. */
export function rows<T>(db: Db, sql: string, ...params: unknown[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}

/** Run a SELECT that returns a single row (or null). */
export function row<T>(db: Db, sql: string, ...params: unknown[]): T | null {
  return (db.prepare(sql).get(...params) as T | undefined) ?? null;
}

/** Run a SELECT returning a single scalar. */
export function scalar<T>(db: Db, sql: string, ...params: unknown[]): T | null {
  const r = db.prepare(sql).get(...params) as Record<string, unknown> | undefined;
  if (!r) return null;
  const firstValue = Object.values(r)[0];
  return (firstValue ?? null) as T;
}
