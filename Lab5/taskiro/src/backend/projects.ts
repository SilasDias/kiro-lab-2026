// TasKiro Project routes (`/api/projects`).
//
// Owner-scoped CRUD for projects, mounted as an Elysia route plugin. Every
// handler runs behind `requireAuth` (→ 401 when unauthenticated) and reads/
// writes exclusively through the scoping helpers, so a user only ever sees and
// creates their own projects (R19.1, R19.3). Persisted rows carry `user_id`;
// the wire DTO (`Project`) strips it to match the frontend `api.ts` shape.
//
//   GET  /api/projects → 200 Project[]   (owner only, via `listOwned`)
//   POST /api/projects → 201 Project      (`{ name, color }`, owner from session)
//
// Status codes: 201 create, 200 read, 400 validation (Elysia `t` → onError),
// 401 guard (`requireAuth` → onError).
//
// Requirements: 16.3, 16.7, 19.1, 19.3

import { Elysia, t } from 'elysia';
import { requireAuth } from './app';
import { getDatabase, type ProjectRow } from './db';
import { insertOwned, listOwned } from './scoping';

/** The project shape returned over the wire (mirrors frontend `api.ts`). */
export interface Project {
  id: string;
  name: string;
  color: string;
}

/**
 * Map a persisted {@link ProjectRow} to its wire DTO, stripping the owner
 * column (`user_id`) so ownership is never leaked to the client.
 */
export function rowToDto(row: ProjectRow): Project {
  return { id: row.id, name: row.name, color: row.color };
}

/**
 * Request body schema for creating a project. `name` is required, trimmed, and
 * 1–100 characters; `color` is a required non-empty string. Validation failures
 * are classified by Elysia as `VALIDATION` and serialized to a 400 by the
 * centralized error contract (R16.7).
 */
const createProjectBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
  color: t.String({ minLength: 1 }),
});

/**
 * Project route plugin. Mount via `createApp([..., projectRoutes])`.
 */
export const projectRoutes = new Elysia({ prefix: '/api/projects' })
  .use(requireAuth)
  // GET /api/projects → the authenticated user's projects (R16.3, R19.1).
  .get('/', ({ user }): Project[] =>
    listOwned<ProjectRow>(getDatabase(), 'projects', user.id).map(rowToDto),
  )
  // POST /api/projects → create a project owned by the session user (R19.3).
  .post(
    '/',
    ({ user, body, set }): Project => {
      const name = body.name.trim();
      const created = insertOwned<ProjectRow>(getDatabase(), 'projects', user.id, {
        name,
        color: body.color,
      });
      set.status = 201;
      // `insertOwned` only returns null when unauthenticated, which the
      // `requireAuth` guard has already ruled out before this handler runs.
      return rowToDto(created!);
    },
    { body: createProjectBody },
  );
