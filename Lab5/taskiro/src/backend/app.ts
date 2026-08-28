// TasKiro ElysiaJS application skeleton.
//
// This module owns three cross-cutting concerns for the REST API; the concrete
// route handlers live in their own modules and plug in here:
//
//   1. The Elysia application factory (`createApp`) with `/api/health` and a
//      clearly-marked registration point where the Task / Project / Notification
//      / Auth route plugins (tasks 7.2–7.5) are mounted.
//   2. A centralized error contract (`onError` → `mapError`) that maps every
//      failure condition to the JSON shape `{ error, constraint? }` with the
//      correct HTTP status (400 / 401 / 403 / 404 / 409 / 429 / 503), following
//      the Error Handling table in the design. Stored data is never modified on
//      an error path (writes run in transactions in the persistence layer).
//   3. A reusable authentication guard (`requireAuth`) that extracts the Bearer
//      token, verifies it against the database via the Auth_Service, and either
//      resolves the authenticated `user` into the request context or rejects with
//      401. Route modules apply it with `.use(requireAuth)` and then read `user`.
//
// Requirements: 16.1, 16.5, 16.6, 16.7, 16.8, 13.5
//
// Integration surface for tasks 7.2–7.5:
//   - `requireAuth`  — scoped plugin; `new Elysia({ prefix: '/api/tasks' }).use(requireAuth)`
//                      then handlers receive `{ user }` (a `PublicUser`).
//   - error classes  — throw `UnauthorizedError` / `ForbiddenError` / `NotFoundError`
//                      / `ConflictError` / `RateLimitError` / `BadRequestError`
//                      from handlers; `onError` serializes them to the contract.
//   - `createApp`    — pass the route plugins (Elysia instances) to mount them.

import { Elysia } from 'elysia';
import { getDatabase } from './db';
import { extractBearerToken, verifyToken, type PublicUser } from './auth';

// --- Error contract messages (pt-BR where the design specifies them) ---------

/** 401 — missing/malformed/expired token on a protected route (R16.8, R18.6). */
export const UNAUTHORIZED_MESSAGE = 'Autenticação necessária';
/** 403 — access to a record owned by another user (R19.5); leaks no target data. */
export const FORBIDDEN_MESSAGE = 'Acesso negado.';
/** 404 — resource not found (R16.6). */
export const NOT_FOUND_MESSAGE = 'Recurso não encontrado';
/** 400 — schema validation failure or malformed JSON (R16.7). */
export const VALIDATION_MESSAGE = 'Dados inválidos.';
/** 400 — request body was not valid JSON. */
export const MALFORMED_JSON_MESSAGE = 'Corpo da requisição inválido (JSON malformado).';
/** 409 — referential / constraint violation on a write (R17.7, R17.9). */
export const CONFLICT_MESSAGE = 'Violação de integridade dos dados.';
/** 503 — unexpected backend failure / timeout when routing (R13.5). */
export const BACKEND_UNREACHABLE_MESSAGE = 'Backend indisponível';

// --- Typed API errors --------------------------------------------------------

/**
 * Base class for every error the API maps to a deliberate HTTP status. Route
 * handlers throw these; the centralized `onError` hook serializes them to the
 * `{ error, constraint? }` contract. `constraint` optionally names the violated
 * field/rule (used for 400/409 bodies).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly constraint?: string;

  constructor(status: number, message: string, constraint?: string) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.constraint = constraint;
  }
}

/** 400 — a request failed validation in a handler (beyond Elysia's `t` schemas). */
export class BadRequestError extends ApiError {
  constructor(message: string = VALIDATION_MESSAGE, constraint?: string) {
    super(400, message, constraint);
  }
}

/** 401 — authentication is required but absent/invalid (R16.8, R18.6). */
export class UnauthorizedError extends ApiError {
  constructor(message: string = UNAUTHORIZED_MESSAGE) {
    super(401, message);
  }
}

/** 403 — the caller is authenticated but not permitted (cross-owner) (R19.5). */
export class ForbiddenError extends ApiError {
  constructor(message: string = FORBIDDEN_MESSAGE) {
    super(403, message);
  }
}

/** 404 — the requested resource does not exist / is not owned (R16.6, R19.5). */
export class NotFoundError extends ApiError {
  constructor(message: string = NOT_FOUND_MESSAGE) {
    super(404, message);
  }
}

/** 409 — a referential-integrity or other constraint violation on write (R17.7). */
export class ConflictError extends ApiError {
  constructor(message: string = CONFLICT_MESSAGE, constraint?: string) {
    super(409, message, constraint);
  }
}

/**
 * 429 — too many failed attempts; carries the retry window so `onError` can set
 * the `Retry-After` header (R18.4).
 */
export class RateLimitError extends ApiError {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number, message: string) {
    super(429, message);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** 503 — the backend could not produce a response (unexpected failure) (R13.5). */
export class BackendUnreachableError extends ApiError {
  constructor(message: string = BACKEND_UNREACHABLE_MESSAGE) {
    super(503, message);
  }
}

// --- Error mapping ------------------------------------------------------------

/** The serialized error body returned to clients. */
export interface ErrorBody {
  error: string;
  constraint?: string;
}

/** A fully-resolved error response: HTTP status, JSON body, and any headers. */
export interface MappedError {
  status: number;
  body: ErrorBody;
  headers?: Record<string, string>;
}

/**
 * Best-effort extraction of the offending field name from an Elysia validation
 * error so the 400 body can name the violated constraint (R16.7). Defensive
 * across Elysia versions: prefers the first validation entry's `path`
 * (e.g. `/title` → `title`), then falls back to its summary or a `property`.
 */
function extractConstraint(error: unknown): string | undefined {
  if (error === null || typeof error !== 'object') return undefined;
  const candidate = error as {
    all?: Array<{ path?: unknown; summary?: unknown; message?: unknown }>;
    property?: unknown;
  };

  const first = Array.isArray(candidate.all) ? candidate.all[0] : undefined;
  if (first !== undefined) {
    if (typeof first.path === 'string' && first.path.length > 0) {
      const field = first.path.replace(/^\//, '');
      if (field.length > 0) return field;
    }
    if (typeof first.summary === 'string' && first.summary.length > 0) {
      return first.summary;
    }
  }

  if (typeof candidate.property === 'string' && candidate.property.length > 0) {
    return candidate.property;
  }
  return undefined;
}

/**
 * Map a thrown error (plus Elysia's classified `code`) to the API error
 * contract. Pure and side-effect free so it is directly unit-testable.
 *
 * Precedence:
 *   1. Our own {@link ApiError}s carry their intended status, message, and any
 *      `constraint`/`Retry-After`.
 *   2. Elysia's built-in codes map per the design's Error Handling table:
 *      `VALIDATION` → 400 (+ constraint), `PARSE` (malformed JSON) → 400,
 *      `NOT_FOUND` → 404.
 *   3. Anything else (unexpected failure / timeout) → 503 "Backend indisponível".
 */
export function mapError(code: string | number, error: unknown): MappedError {
  if (error instanceof ApiError) {
    const body: ErrorBody = { error: error.message };
    if (error.constraint !== undefined) body.constraint = error.constraint;

    if (error instanceof RateLimitError && error.retryAfterSeconds > 0) {
      return {
        status: error.status,
        body,
        headers: { 'Retry-After': String(error.retryAfterSeconds) },
      };
    }
    return { status: error.status, body };
  }

  switch (code) {
    case 'VALIDATION': {
      const constraint = extractConstraint(error);
      const body: ErrorBody = { error: VALIDATION_MESSAGE };
      if (constraint !== undefined) body.constraint = constraint;
      return { status: 400, body };
    }
    case 'PARSE':
      return { status: 400, body: { error: MALFORMED_JSON_MESSAGE } };
    case 'NOT_FOUND':
      return { status: 404, body: { error: NOT_FOUND_MESSAGE } };
    default:
      // INTERNAL_SERVER_ERROR / UNKNOWN / anything unhandled (R13.5).
      return { status: 503, body: { error: BACKEND_UNREACHABLE_MESSAGE } };
  }
}

// --- Authentication guard (R16.8, R18.5, R18.6) ------------------------------

/**
 * Reusable authentication guard, exposed as a named (deduplicated) scoped
 * plugin. It extracts the `Authorization: Bearer <token>` header, resolves the
 * token against the database via the Auth_Service, and either injects the
 * authenticated `user` into the request context or throws `UnauthorizedError`
 * (→ 401 via `onError`).
 *
 * Usage by route modules (tasks 7.2–7.5):
 * ```ts
 * import { requireAuth } from "./app";
 * export const taskRoutes = new Elysia({ prefix: "/api/tasks" })
 *   .use(requireAuth)
 *   .get("/", ({ user }) => listOwned(getDatabase(), "tasks", user.id));
 * ```
 * `as: "scoped"` propagates the resolved `user` to the consuming instance's
 * routes without leaking the guard globally across unrelated plugins.
 */
export const requireAuth = new Elysia({ name: 'taskiro-require-auth' }).resolve(
  { as: 'scoped' },
  async ({ headers }): Promise<{ user: PublicUser }> => {
    const token = extractBearerToken(headers.authorization);
    const verified = await verifyToken(getDatabase(), token);
    if (verified === null) {
      throw new UnauthorizedError();
    }
    return { user: verified.user };
  },
);

// --- Application factory ------------------------------------------------------

/** A mountable route plugin (an Elysia instance from a route module). */
export type RoutePlugin = Elysia<any, any, any, any, any, any, any>;

/**
 * Build the TasKiro Elysia application: install the centralized error contract,
 * expose a lightweight `/api/health` probe, and mount each provided route
 * plugin under `/api`.
 *
 * The route plugins for authentication (7.2), tasks (7.3), projects (7.4), and
 * notifications (7.5) are passed in by the server wiring (task 9.1) — this keeps
 * `app.ts` free of route-handler logic while giving those modules a single,
 * consistent place to register. Example:
 * ```ts
 * createApp([authRoutes, taskRoutes, projectRoutes, notificationRoutes]);
 * ```
 */
export function createApp(routes: RoutePlugin[] = []): RoutePlugin {
  const app: RoutePlugin = new Elysia()
    // Centralized error contract → `{ error, constraint? }` (R16.5–16.8, R13.5).
    .onError(({ code, error, set }) => {
      const mapped = mapError(code, error);
      set.status = mapped.status;
      if (mapped.headers !== undefined) {
        Object.assign(set.headers, mapped.headers);
      }
      return mapped.body;
    })
    // Liveness probe (unauthenticated).
    .get('/api/health', () => ({ status: 'ok' as const }));

  // ---- Route registration point (tasks 7.2–7.5) ----------------------------
  // Auth, Task, Project, and Notification route plugins mount here. Each is an
  // Elysia instance that applies `requireAuth` (except public auth endpoints).
  for (const route of routes) {
    app.use(route);
  }

  return app;
}
