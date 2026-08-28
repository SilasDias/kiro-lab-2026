// TasKiro Notification routes (ElysiaJS).
//
// Exposes the per-user Notification endpoints under `/api/notifications`, all
// guarded by `requireAuth` so every handler runs with an authenticated session
// `user`. Reads and writes are scoped to that session user via the scoping
// layer / a parameterized `WHERE user_id = ?`, so a caller only ever sees and
// mutates their own notifications and never another user's (R19.1).
//
// Endpoints (see the Backend REST API table in design.md):
//   - GET  /api/notifications            → 200 Notification[] (owner only)
//   - POST /api/notifications/mark-all-read → 200 { updated: number }
//
// The wire DTO mirrors the front-end `Notification` shape: the stored `read`
// flag (INTEGER 0/1) is mapped to a boolean, and the round-trippable `time`
// timestamp is returned as stored — the frontend computes the relative-time
// label and read/unread indicator at render (R10.3).
//
// Requirements: 10.5, 10.6, 16.4, 19.1

import { Elysia } from 'elysia';
import { requireAuth } from './app';
import { getDatabase, type NotificationRow } from './db';
import { listOwned, OWNER_COLUMN } from './scoping';

/** Wire representation of a Notification (front-end `Notification` shape). */
export interface NotificationDTO {
  id: string;
  text: string;
  time: string;
  read: boolean;
}

/** Map a stored {@link NotificationRow} to the API DTO (read 0/1 → boolean). */
export function toNotificationDTO(row: NotificationRow): NotificationDTO {
  return {
    id: row.id,
    text: row.text,
    time: row.time,
    read: row.read === 1,
  };
}

/**
 * Mark every notification owned by `userId` as read, inside a transaction so a
 * failure rolls back cleanly (R17.9). Scoped to the session user via
 * `WHERE user_id = ?` (R19.1). Returns the number of rows updated.
 */
export function markAllNotificationsRead(userId: string): number {
  const db = getDatabase();
  const sql = `UPDATE notifications SET read = 1 WHERE ${OWNER_COLUMN} = ?`;
  const run = db.transaction(() => db.query<unknown, [string]>(sql).run(userId));
  return run().changes;
}

/**
 * Notification route plugin. Mounted by `createApp` (task 9.1). Applies
 * `requireAuth`, so each handler receives the authenticated `user`; the guard
 * rejects unauthenticated requests with 401 before any handler runs.
 */
export const notificationRoutes = new Elysia({ prefix: '/api/notifications' })
  .use(requireAuth)
  // List the authenticated user's notifications, most-recent-first (R16.4, R19.1).
  .get('/', ({ user }) => {
    const rows = listOwned<NotificationRow>(getDatabase(), 'notifications', user.id, {
      orderBy: 'time',
      direction: 'desc',
    });
    return rows.map(toNotificationDTO);
  })
  // Mark all of the user's notifications as read (R10.5, R10.6, R19.1).
  .post('/mark-all-read', ({ user }) => {
    const updated = markAllNotificationsRead(user.id);
    return { updated };
  });
