// TasKiro Task routes (ElysiaJS).
//
// Owner-scoped CRUD for Tasks, mounted under `/api/tasks`. Every route requires
// a valid session via `requireAuth` (→ 401 when absent) and every data access
// flows through the per-user scoping helpers so a user only ever sees or mutates
// their own Tasks.
//
//   GET    /api/tasks      → 200 Task[]            (owner only)
//   POST   /api/tasks      → 201 Task              (created, owned by session)
//   GET    /api/tasks/:id  → 200 Task | 404
//   PATCH  /api/tasks/:id  → 200 Task | 404        (partial; ownership immutable)
//   DELETE /api/tasks/:id  → 200 { ok: true } | 404
//
// Status codes: 201 create, 200 read/update/delete, 400 validation (via the
// `t` body schemas + centralized `onError`), 401 (the `requireAuth` guard),
// 404 not owned / not found.
//
// Requirements: 16.2, 16.6, 16.7, 19.1, 19.3, 19.4, 19.5
//
// --- Row ⇄ DTO mapping -------------------------------------------------------
//
// The database row (`TaskRow` in db.ts) and the wire DTO the frontend consumes
// (the `logic.ts` `Task` shape, mirrored by `api.ts`) differ in three ways:
//
//   DB column      ↔  DTO field     transformation
//   ────────────────────────────────────────────────────────────
//   description    ↔  desc          rename only
//   project_id     ↔  project       rename only (nullable in both)
//   done (0 | 1)   ↔  done (bool)   integer ⇄ boolean
//   id,title,due,priority,status     identical (carried through unchanged)
//
// `rowToDto` performs DB-row → wire-DTO for responses; the inverse mapping for
// writes is done inline by `createColumns` / `patchColumns`, which translate the
// DTO field names back to column names and `done` back to 0/1 before handing
// the values to the scoping layer (`insertOwned` / `updateOwned`).

import { Elysia, t } from 'elysia';
import { NotFoundError, BackendUnreachableError, requireAuth } from './app';
import { getDatabase, type Priority, type Status, type TaskRow } from './db';
import {
  type ColumnValues,
  deleteOwned,
  getOwned,
  insertOwned,
  listOwned,
  updateOwned,
} from './scoping';

// --- Wire DTO ----------------------------------------------------------------

/**
 * The Task shape sent to / accepted from the frontend. Mirrors the `logic.ts`
 * `Task` interface exactly (`desc`, `project`, boolean `done`) so the client's
 * pure logic and `api.ts` types line up with API responses.
 */
export interface TaskDto {
  id: string;
  title: string;
  desc: string;
  due: string | null;
  priority: Priority;
  project: string | null;
  status: Status;
  done: boolean;
}

/**
 * Map a stored `TaskRow` to the wire DTO: rename `description` → `desc` and
 * `project_id` → `project`, and convert the `done` integer (0/1) to a boolean.
 * All other fields carry through unchanged.
 */
export function rowToDto(row: TaskRow): TaskDto {
  return {
    id: row.id,
    title: row.title,
    desc: row.description,
    due: row.due,
    priority: row.priority,
    project: row.project_id,
    status: row.status,
    done: row.done === 1,
  };
}

// --- Validation schemas (`t`) ------------------------------------------------

/** ISO 'YYYY-MM-DD' calendar date, or null when no due date is set. */
const DueSchema = t.Union([
  t.String({
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
    description: "ISO date 'YYYY-MM-DD'",
  }),
  t.Null(),
]);

const PrioritySchema = t.Union([t.Literal('low'), t.Literal('medium'), t.Literal('high')]);

const StatusSchema = t.Union([t.Literal('todo'), t.Literal('doing'), t.Literal('done')]);

/** POST body: title required; everything else optional with sane defaults. */
const CreateTaskSchema = t.Object({
  title: t.String({ minLength: 1, maxLength: 200 }),
  desc: t.Optional(t.String({ minLength: 0, maxLength: 2000 })),
  due: t.Optional(DueSchema),
  priority: PrioritySchema,
  project: t.Optional(t.Union([t.String(), t.Null()])),
});

/** PATCH body: every field optional; `id`/owner are never accepted. */
const UpdateTaskSchema = t.Object({
  title: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
  desc: t.Optional(t.String({ minLength: 0, maxLength: 2000 })),
  due: t.Optional(DueSchema),
  priority: t.Optional(PrioritySchema),
  project: t.Optional(t.Union([t.String(), t.Null()])),
  status: t.Optional(StatusSchema),
  done: t.Optional(t.Boolean()),
});

type CreateTaskBody = typeof CreateTaskSchema.static;
type UpdateTaskBody = typeof UpdateTaskSchema.static;

// --- DTO → column mapping (writes) -------------------------------------------

/**
 * Build the column values for a new Task from a validated create body. A new
 * task always starts as `status: 'todo'` and `done: 0` (R8.5). `desc`/`project`
 * are renamed to their column names; absent optional fields fall back to the
 * stored defaults (`description = ''`, `project_id = null`).
 */
function createColumns(body: CreateTaskBody): ColumnValues {
  return {
    title: body.title,
    description: body.desc ?? '',
    due: body.due ?? null,
    priority: body.priority,
    project_id: body.project ?? null,
    status: 'todo',
    done: 0,
  };
}

/**
 * Build the column values for a partial Task update from a validated patch.
 * Only fields present in the body are included so `updateOwned` leaves the rest
 * unchanged; `desc`/`project` are renamed to columns and `done` is converted to
 * 0/1. `id` and ownership are never derived from client input.
 */
function patchColumns(body: UpdateTaskBody): ColumnValues {
  const values: ColumnValues = {};
  if (body.title !== undefined) values.title = body.title;
  if (body.desc !== undefined) values.description = body.desc;
  if (body.due !== undefined) values.due = body.due;
  if (body.priority !== undefined) values.priority = body.priority;
  if (body.project !== undefined) values.project_id = body.project;
  if (body.status !== undefined) values.status = body.status;
  if (body.done !== undefined) values.done = body.done ? 1 : 0;
  return values;
}

// --- Route plugin ------------------------------------------------------------

/**
 * Task route plugin. Mounted by the server wiring (task 9.1) via
 * `createApp([... , taskRoutes, ...])`. `requireAuth` resolves the
 * authenticated `user` into context; every handler scopes by `user.id`.
 */
export const taskRoutes = new Elysia({ prefix: '/api/tasks' })
  .use(requireAuth)
  // GET /api/tasks → the authenticated user's tasks (R16.2, R19.1).
  .get('/', ({ user }) => {
    const rows = listOwned<TaskRow>(getDatabase(), 'tasks', user.id);
    return rows.map(rowToDto);
  })
  // POST /api/tasks → 201 created, owned by the session user (R16.2, R16.7, R19.3).
  .post(
    '/',
    ({ user, body, set }) => {
      const row = insertOwned<TaskRow>(getDatabase(), 'tasks', user.id, createColumns(body));
      // The guard guarantees an authenticated user, so a null result here means
      // the write did not return a row — surface it as a backend failure.
      if (row === null) throw new BackendUnreachableError();
      set.status = 201;
      return rowToDto(row);
    },
    { body: CreateTaskSchema },
  )
  // GET /api/tasks/:id → 200 owned task, else 404 (R16.6, R19.5).
  .get('/:id', ({ user, params }) => {
    const row = getOwned<TaskRow>(getDatabase(), 'tasks', user.id, params.id);
    if (row === null) throw new NotFoundError();
    return rowToDto(row);
  })
  // PATCH /api/tasks/:id → 200 updated task, else 404 (R16.2, R19.4, R19.5).
  .patch(
    '/:id',
    ({ user, params, body }) => {
      const row = updateOwned<TaskRow>(
        getDatabase(),
        'tasks',
        user.id,
        params.id,
        patchColumns(body),
      );
      if (row === null) throw new NotFoundError();
      return rowToDto(row);
    },
    { body: UpdateTaskSchema },
  )
  // DELETE /api/tasks/:id → 200 { ok: true }, else 404 (R16.2, R19.5).
  .delete('/:id', ({ user, params }) => {
    const deleted = deleteOwned(getDatabase(), 'tasks', user.id, params.id);
    if (!deleted) throw new NotFoundError();
    return { ok: true as const };
  });
