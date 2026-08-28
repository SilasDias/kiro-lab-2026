// TasKiro persistence layer (bun:sqlite).
//
// Provides the database schema (User / Project / Task / Notification / Session),
// referential integrity via foreign keys, CHECK constraints enforcing the
// prototype's domain rules, round-trippable date storage, and a single
// transactional write helper that rolls back on failure.
//
// Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.7, 17.9

import { Database } from 'bun:sqlite';

// --- Domain enumerations (mirror the pure logic module) ---
export type Priority = 'low' | 'medium' | 'high';
export type Status = 'todo' | 'doing' | 'done';

// --- Row shapes as stored in SQLite ---
// `done`/`read` are stored as INTEGER 0/1; helpers in later layers map to booleans.
export interface UserRow {
  id: string;
  display_name: string;
  email: string;
  password_hash: string;
}

export interface ProjectRow {
  id: string;
  name: string;
  color: string;
  user_id: string;
}

export interface TaskRow {
  id: string;
  title: string;
  description: string;
  due: string | null; // 'YYYY-MM-DD' or null
  priority: Priority;
  project_id: string | null;
  status: Status;
  done: number; // 0 | 1
  user_id: string;
}

export interface NotificationRow {
  id: string;
  text: string;
  time: string; // ISO-8601 timestamp
  read: number; // 0 | 1
  user_id: string;
}

export interface SessionRow {
  jti: string;
  user_id: string;
  expires_at: number; // epoch seconds
}

// Default on-disk database path. Use ":memory:" for tests.
export const DEFAULT_DB_PATH = 'taskiro.db';

/**
 * The schema DDL. Foreign keys plus CHECK constraints enforce the prototype's
 * domain rules at the storage layer so invalid writes are rejected (R17.5, R17.7).
 *
 * Date columns are plain TEXT for round-trippable storage (R17.2, R17.4):
 * task `due` is 'YYYY-MM-DD' (or NULL) and notification `time` is an ISO-8601
 * timestamp. The value read back equals the value written.
 */
const SCHEMA = /* sql */ `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY NOT NULL,
  display_name  TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 100),
  email         TEXT NOT NULL UNIQUE CHECK (email LIKE '%_@_%.__%' OR email LIKE '%_@_%'),
  password_hash TEXT NOT NULL CHECK (length(password_hash) >= 1)
);

CREATE TABLE IF NOT EXISTS projects (
  id      TEXT PRIMARY KEY NOT NULL,
  name    TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  color   TEXT NOT NULL CHECK (length(color) >= 1),
  user_id TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT PRIMARY KEY NOT NULL,
  title       TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) BETWEEN 0 AND 2000),
  due         TEXT CHECK (due IS NULL OR due GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  priority    TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
  project_id  TEXT,
  status      TEXT NOT NULL CHECK (status IN ('todo', 'doing', 'done')),
  done        INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
  user_id     TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id),
  FOREIGN KEY (project_id) REFERENCES projects (id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id      TEXT PRIMARY KEY NOT NULL,
  text    TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 1000),
  time    TEXT NOT NULL CHECK (length(time) >= 1),
  read    INTEGER NOT NULL DEFAULT 0 CHECK (read IN (0, 1)),
  user_id TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS sessions (
  jti        TEXT PRIMARY KEY NOT NULL,
  user_id    TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks (user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks (project_id);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
`;

/**
 * Initialize the schema on an existing connection. Idempotent: every statement
 * uses IF NOT EXISTS so re-running against a populated database is a no-op.
 */
export function initSchema(db: Database): void {
  db.exec(SCHEMA);
}

/**
 * Create (or open) a Database, enable foreign-key enforcement, and initialize
 * the schema. Pass ":memory:" for an ephemeral in-memory database (tests).
 *
 * Foreign keys must be enabled per connection in SQLite; without this PRAGMA
 * referential-integrity CHECKs would not be enforced (R17.7).
 */
export function createDatabase(path: string = DEFAULT_DB_PATH): Database {
  const db = new Database(path);
  db.exec('PRAGMA foreign_keys = ON;');
  initSchema(db);
  return db;
}

/**
 * Run `fn` inside a single transaction. On success the transaction commits and
 * the function's return value is returned. If `fn` throws, the transaction is
 * rolled back leaving affected records in their pre-write state, and the error
 * is re-thrown so callers can report the failure (R17.9).
 *
 * Multiple statements (e.g. inserting a task and a notification together) are
 * atomic: a referential-integrity rejection on any statement rolls back the
 * whole unit of work (R17.7).
 */
export function withTransaction<T>(db: Database, fn: (db: Database) => T): T {
  const run = db.transaction(() => fn(db));
  return run();
}

// Lazily-created shared singleton for the running application (seed/auth/routes).
let sharedDb: Database | null = null;

/**
 * Return the process-wide shared Database instance, creating it on first use.
 * Tests should use `createDatabase(":memory:")` for isolation instead.
 */
export function getDatabase(path: string = DEFAULT_DB_PATH): Database {
  if (sharedDb === null) {
    sharedDb = createDatabase(path);
  }
  return sharedDb;
}

/** Reset the shared singleton (primarily for tests). */
export function resetSharedDatabase(): void {
  if (sharedDb !== null) {
    sharedDb.close();
    sharedDb = null;
  }
}
