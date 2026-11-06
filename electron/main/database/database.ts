/**
 * Database bootstrap. Wraps better-sqlite3 with:
 *  - WAL journal mode (concurrent reads while the UI is active).
 *  - Foreign keys ON (referential integrity enforced in SQLite).
 *  - The embedded schema applied idempotently (CREATE ... IF NOT EXISTS).
 *
 * The module exposes a small `Db` type alias so repositories can be unit-tested
 * against a fresh in-memory database, and so a single instance can be injected
 * into the services.
 *
 * NOTE on module interop: better-sqlite3 is CommonJS (`module.exports` is the
 * `Database` constructor). A named import (`import { Database }`) is undefined
 * under both esbuild's CJS bundle and vitest's ESM interop. We use a default
 * import — `module.exports` itself is the constructor — which works in every
 * consumer of this module.
 */
import BetterSqlite3 from "better-sqlite3";
import { SCHEMA_SQL } from "./schema";

/** A live SQLite handle (better-sqlite3 instance). */
export type Db = InstanceType<typeof BetterSqlite3>;

/**
 * Open (or create) the SQLite database at `file` and apply the schema.
 * Passing ":memory:" opens an ephemeral database — used by unit tests.
 */
export function openDatabase(file: string): Db {
  const db = new BetterSqlite3(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  return db;
}

/** Convenience for tests: an in-memory db with the schema applied. */
export function inMemoryDatabase(): Db {
  // In-memory DBs are ephemeral; skip WAL so tests close cleanly without
  // stray -wal/-shm files.
  const db = new BetterSqlite3(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  return db;
}

/** Close a database (WAL checkpoint + close). Idempotent-ish guard. */
export function closeDatabase(db: Db): void {
  try {
    db.pragma("wal_checkpoint(TRUNCATE)");
  } catch {
    /* checkpoint may fail if the db was already closed — ignore. */
  }
  db.close();
}
