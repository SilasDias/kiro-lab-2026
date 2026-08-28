// TasKiro per-user scoping (owner enforcement).
//
// A single enforcement point for per-user data isolation. Every read, create,
// update, and delete of an owned record (Task / Project / Notification) flows
// through these helpers, which keep the isolation rules in SQL `WHERE`/`SET`
// clauses keyed off the *session* user id — never off client-supplied input.
//
// Guarantees (Requirement 19):
//   - Collections return only the authenticated user's records, and an empty
//     collection when the user owns none — never another user's rows
//     (R19.1, R19.2). Enforced by `WHERE user_id = ?`.
//   - Creates associate the new record with the authenticated user and ignore
//     any owner value supplied by the client (R19.3). Enforced by always
//     writing `user_id` from the session and stripping it from client input.
//   - Updates cannot change ownership (R19.4). Enforced by stripping `user_id`
//     (and the primary key) from the client-supplied patch and scoping the
//     `WHERE` clause to `id = ? AND user_id = ?`.
//   - Cross-owner reads/updates/deletes are rejected without leaking the target
//     row (R19.5). A row owned by another user simply does not match the
//     `user_id = ?` predicate, so helpers return `null` / `false` exactly as
//     they would for a non-existent row — the target's data never appears.
//   - Unauthenticated access returns/modifies nothing (R19.6). When the caller
//     passes no authenticated user id, helpers short-circuit before touching
//     the database.
//   - Because enforcement lives entirely in parameterized SQL keyed off the
//     session user, isolation is independent of browser state and holds
//     identically across every backend instance over the same store (R19.7).
//
// Table and column names cannot be SQL parameters, so they are never taken from
// caller input directly: table names are validated against a fixed registry and
// every column referenced in a statement is validated against that table's
// known columns. All *values* are bound as parameters.
//
// Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7

import type { Database } from "bun:sqlite";
import { withTransaction } from "./db";

// --- Owner column ------------------------------------------------------------

/** The column on every scoped table that records the owning user. */
export const OWNER_COLUMN = "user_id" as const;

// --- Scoped-table registry ---------------------------------------------------

/**
 * Metadata for a table whose rows are owned by a user. `columns` is the full
 * set of writable/selectable columns (used to whitelist any column name that
 * reaches a SQL string); `primaryKey` is the row identity column.
 */
export interface ScopedTableMeta {
  readonly columns: readonly string[];
  readonly primaryKey: string;
}

/**
 * The tables subject to per-user scoping and their columns. Column lists mirror
 * the schema in `db.ts`. Sessions and users are intentionally excluded — they
 * are managed by the Auth_Service, not by owner-scoped CRUD.
 */
export const SCOPED_TABLES = {
  tasks: {
    columns: [
      "id",
      "title",
      "description",
      "due",
      "priority",
      "project_id",
      "status",
      "done",
      "user_id",
    ],
    primaryKey: "id",
  },
  projects: {
    columns: ["id", "name", "color", "user_id"],
    primaryKey: "id",
  },
  notifications: {
    columns: ["id", "text", "time", "read", "user_id"],
    primaryKey: "id",
  },
} as const satisfies Record<string, ScopedTableMeta>;

/** A table name known to the scoping layer. */
export type ScopedTableName = keyof typeof SCOPED_TABLES;

/** A record of column → bound value for an insert or update. */
export type ColumnValues = Record<string, unknown>;

// --- Internal guards ---------------------------------------------------------

/**
 * Resolve and validate a scoped-table name, returning its metadata. Throws for
 * an unknown table so a typo or untrusted table name can never reach SQL.
 */
function tableMeta(table: ScopedTableName): ScopedTableMeta {
  const meta = SCOPED_TABLES[table];
  if (meta === undefined) {
    throw new Error(`Unknown scoped table: ${String(table)}`);
  }
  return meta;
}

/**
 * Whether `userId` identifies an authenticated user. A missing, non-string, or
 * blank id means "no authenticated user", so scoped operations must not touch
 * any data (R19.6).
 */
export function isAuthenticated(
  userId: string | null | undefined,
): userId is string {
  return typeof userId === "string" && userId.trim().length > 0;
}

/** Whether `id` is a usable row identity (non-blank string). */
function isValidId(id: string | null | undefined): id is string {
  return typeof id === "string" && id.length > 0;
}

/**
 * Pick the writable entries from `values` that are known columns of `meta`,
 * excluding any column in `forbidden`. The owner column and (for updates) the
 * primary key are forbidden so client input can never set ownership or identity
 * where it must not. Unknown keys are silently dropped so stray client fields
 * (including an attempt to smuggle `user_id`) have no effect.
 */
function pickColumns(
  meta: ScopedTableMeta,
  values: ColumnValues,
  forbidden: readonly string[],
): Array<[string, unknown]> {
  const allowed = new Set(meta.columns);
  const blocked = new Set(forbidden);
  const entries: Array<[string, unknown]> = [];
  for (const [key, value] of Object.entries(values)) {
    if (!allowed.has(key) || blocked.has(key)) continue;
    if (value === undefined) continue; // `undefined` = "leave unset/unchanged"
    entries.push([key, value as unknown]);
  }
  return entries;
}

/** Bind a JS value to a SQLite-compatible parameter. */
type SqlValue = string | number | bigint | boolean | null | Uint8Array;

function toSqlValue(value: unknown): SqlValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "boolean" ||
    value instanceof Uint8Array
  ) {
    return value as SqlValue;
  }
  // Defensive: anything else (objects, arrays) is not a valid column value.
  throw new Error("Unsupported SQL value type for scoped write");
}

// --- Read helpers (R19.1, R19.2, R19.5, R19.6) -------------------------------

/** Options controlling collection ordering. */
export interface ListOptions {
  /** Column to order by (validated against the table's columns). */
  orderBy?: string;
  /** Sort direction; defaults to ascending. */
  direction?: "asc" | "desc";
}

/**
 * Return every row of `table` owned by `userId`. Returns an empty array when
 * the user owns none (R19.2) and when there is no authenticated user (R19.6).
 * Rows owned by other users are excluded by the `WHERE user_id = ?` predicate
 * (R19.1).
 */
export function listOwned<T>(
  db: Database,
  table: ScopedTableName,
  userId: string | null | undefined,
  options: ListOptions = {},
): T[] {
  if (!isAuthenticated(userId)) return [];
  const meta = tableMeta(table);

  let sql = `SELECT * FROM ${table} WHERE ${OWNER_COLUMN} = ?`;

  if (options.orderBy !== undefined) {
    if (!meta.columns.includes(options.orderBy)) {
      throw new Error(`Unknown order-by column: ${options.orderBy}`);
    }
    const direction = options.direction === "desc" ? "DESC" : "ASC";
    sql += ` ORDER BY ${options.orderBy} ${direction}`;
  }

  return db.query<T, [string]>(sql).all(userId);
}

/**
 * Return the single row of `table` with `id` *if* it is owned by `userId`,
 * otherwise `null`. A row that does not exist and a row owned by another user
 * are indistinguishable to the caller, so the cross-owner row's data never
 * leaks (R19.5). Returns `null` when unauthenticated (R19.6).
 */
export function getOwned<T>(
  db: Database,
  table: ScopedTableName,
  userId: string | null | undefined,
  id: string | null | undefined,
): T | null {
  if (!isAuthenticated(userId) || !isValidId(id)) return null;
  const meta = tableMeta(table);

  const sql = `SELECT * FROM ${table} WHERE ${meta.primaryKey} = ? AND ${OWNER_COLUMN} = ?`;
  return db.query<T, [string, string]>(sql).get(id, userId) ?? null;
}

// --- Write helpers (R19.3, R19.4, R19.5, R19.6) ------------------------------

/**
 * Insert a new row into `table` owned by `userId`. The owner is always taken
 * from the session: any `user_id` (or other owner alias) in `values` is
 * stripped before the insert and `user_id` is set explicitly (R19.3). A primary
 * key is generated when not supplied. Returns the inserted row, or `null` when
 * unauthenticated (R19.6). The insert runs in a transaction so a constraint
 * failure rolls back cleanly.
 */
export function insertOwned<T>(
  db: Database,
  table: ScopedTableName,
  userId: string | null | undefined,
  values: ColumnValues,
): T | null {
  if (!isAuthenticated(userId)) return null;
  const meta = tableMeta(table);

  // Client-supplied owner is ignored; identity is generated when absent.
  const entries = pickColumns(meta, values, [OWNER_COLUMN]);
  const columnMap = new Map<string, SqlValue>(
    entries.map(([col, val]) => [col, toSqlValue(val)]),
  );

  if (!columnMap.has(meta.primaryKey)) {
    columnMap.set(meta.primaryKey, crypto.randomUUID());
  }
  // Owner is always the session user — never client input (R19.3).
  columnMap.set(OWNER_COLUMN, userId);

  const columns = [...columnMap.keys()];
  const placeholders = columns.map(() => "?").join(", ");
  const params = columns.map((c) => columnMap.get(c)!);

  const sql = `INSERT INTO ${table} (${columns.join(
    ", ",
  )}) VALUES (${placeholders}) RETURNING *`;

  return withTransaction(db, (tx) => tx.query<T, SqlValue[]>(sql).get(...params) ?? null);
}

/**
 * Update the row of `table` with `id` *if* it is owned by `userId`. Ownership
 * and identity are immutable: `user_id` and the primary key are stripped from
 * `values`, so a client can never reassign a record to another user (R19.4) nor
 * change its id. The `WHERE id = ? AND user_id = ?` predicate means an attempt
 * to update a row owned by another user matches nothing and returns `null`
 * without modifying or leaking it (R19.5). Returns `null` when unauthenticated
 * (R19.6) or when the row is not owned / not found. When `values` contains no
 * updatable columns, the existing owned row is returned unchanged.
 */
export function updateOwned<T>(
  db: Database,
  table: ScopedTableName,
  userId: string | null | undefined,
  id: string | null | undefined,
  values: ColumnValues,
): T | null {
  if (!isAuthenticated(userId) || !isValidId(id)) return null;
  const meta = tableMeta(table);

  // Neither ownership nor identity may be changed by client input.
  const entries = pickColumns(meta, values, [OWNER_COLUMN, meta.primaryKey]);

  if (entries.length === 0) {
    // Nothing to change — return the row only if it is owned by the caller.
    return getOwned<T>(db, table, userId, id);
  }

  const setClause = entries.map(([col]) => `${col} = ?`).join(", ");
  const params: SqlValue[] = [
    ...entries.map(([, val]) => toSqlValue(val)),
    id,
    userId,
  ];

  const sql = `UPDATE ${table} SET ${setClause} WHERE ${meta.primaryKey} = ? AND ${OWNER_COLUMN} = ? RETURNING *`;

  return withTransaction(db, (tx) => tx.query<T, SqlValue[]>(sql).get(...params) ?? null);
}

/**
 * Delete the row of `table` with `id` *if* it is owned by `userId`. Returns
 * `true` when a row was deleted, `false` otherwise — including when the row is
 * owned by another user (the `WHERE` predicate does not match, so the target is
 * left unchanged and no data leaks, R19.5) and when unauthenticated (R19.6).
 */
export function deleteOwned(
  db: Database,
  table: ScopedTableName,
  userId: string | null | undefined,
  id: string | null | undefined,
): boolean {
  if (!isAuthenticated(userId) || !isValidId(id)) return false;
  const meta = tableMeta(table);

  const sql = `DELETE FROM ${table} WHERE ${meta.primaryKey} = ? AND ${OWNER_COLUMN} = ?`;
  return withTransaction(db, (tx) => {
    const result = tx.query<unknown, [string, string]>(sql).run(id, userId);
    return result.changes > 0;
  });
}
