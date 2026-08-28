// TasKiro authentication routes (ElysiaJS).
//
// Mounts the three authentication endpoints onto the REST API, delegating all
// credential logic to the framework-independent Auth_Service (`auth.ts`) and
// all error serialization to the centralized contract in `app.ts`:
//
//   - POST /api/auth/login  — PUBLIC. Validates `{ email, password }` with `t`,
//     calls `auth.login`, and maps the discriminated `LoginResult`:
//       * ok            → 200 `{ token, user }`
//       * "invalid"     → 401 uniform message (no field disclosure)   (R18.3)
//       * "rate_limited"→ 429 with `Retry-After` via `RateLimitError`  (R18.4)
//   - POST /api/auth/logout — PROTECTED (Bearer). Revokes the current session so
//     the presented token is rejected afterwards; returns 200 `{ ok: true }` (R18.7).
//   - GET  /api/me          — PROTECTED (Bearer). Returns 200 `{ user }` for the
//     authenticated user (R18.5).
//
// Requirements: 18.2, 18.3, 18.4, 18.5, 18.7
//
// --- Wire shape note (Data/Auth context mapping is task 10.3) ----------------
// These routes return the Auth_Service `PublicUser` shape verbatim:
// `{ id, display_name, email }`. The frontend `api.ts` models the user as
// `{ id, displayName, email }`. That `display_name` ↔ `displayName` mapping is
// intentionally NOT performed here; it is the responsibility of the frontend
// AuthContext/DataContext wiring (task 10.3). Keeping the backend boundary on
// the canonical snake_case `PublicUser` keeps every server response consistent.

import { Elysia, t } from 'elysia';
import { getDatabase } from './db';
import { RateLimitError, UnauthorizedError, requireAuth } from './app';
import {
  extractBearerToken,
  login,
  logout,
  INVALID_CREDENTIALS_MESSAGE,
  type PublicUser,
} from './auth';

/** Request body schema for `POST /api/auth/login` (R16.7 validation → 400). */
const loginBody = t.Object({
  email: t.String({ minLength: 1, maxLength: 320 }),
  password: t.String({ minLength: 1, maxLength: 1024 }),
});

/**
 * Public authentication routes — no `requireAuth`. Only `POST /api/auth/login`
 * lives here so the guard never applies to the credential exchange itself.
 */
const publicAuthRoutes = new Elysia().post(
  '/api/auth/login',
  async ({ body }): Promise<{ token: string; user: PublicUser }> => {
    const result = await login(getDatabase(), body.email, body.password);

    if (result.ok) {
      // 200 — issue the bearer token and the safe public user shape.
      return { token: result.token, user: result.user };
    }

    if (result.reason === 'rate_limited') {
      // 429 — too many failures; carry the retry window for `Retry-After` (R18.4).
      throw new RateLimitError(result.retryAfterSeconds, result.message);
    }

    // 401 — unknown email and bad password are indistinguishable (R18.3).
    throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE);
  },
  { body: loginBody },
);

/**
 * Protected authentication routes — guarded by `requireAuth`, which resolves the
 * authenticated `user` (a `PublicUser`) into the context or rejects with 401.
 */
const protectedAuthRoutes = new Elysia()
  .use(requireAuth)
  // POST /api/auth/logout — revoke the presented session token (R18.7).
  .post('/api/auth/logout', async ({ headers }): Promise<{ ok: true }> => {
    // `requireAuth` has already validated the token; re-extract it to revoke
    // the matching session row so the same token fails on the next request.
    const token = extractBearerToken(headers.authorization);
    await logout(getDatabase(), token);
    return { ok: true };
  })
  // GET /api/me — return the authenticated user (R18.5).
  .get('/api/me', ({ user }): { user: PublicUser } => ({ user }));

/**
 * Combined authentication route plugin, mounted by `createApp` (task 9.1 wiring):
 * ```ts
 * createApp([authRoutes, taskRoutes, projectRoutes, notificationRoutes]);
 * ```
 * The public and protected sub-instances are composed so `requireAuth` (a
 * `scoped` plugin) protects only `/api/auth/logout` and `/api/me`, never the
 * public `/api/auth/login` and never leaking out to unrelated app routes.
 */
export const authRoutes = new Elysia({ name: 'taskiro-auth-routes' })
  .use(publicAuthRoutes)
  .use(protectedAuthRoutes);
