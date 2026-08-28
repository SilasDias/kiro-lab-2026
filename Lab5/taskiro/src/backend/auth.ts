// TasKiro Auth_Service.
//
// Real credential verification replacing the prototype's simulated login:
//   - Password hashing/verification via `Bun.password` (argon2id). Plaintext is
//     never stored or logged (R18.1, R17.6).
//   - Session tokens issued as JWTs (HS256) carrying a `jti` and `exp = now + 3600s`
//     (R18.2). Each issued token has a matching row in `sessions(jti, user_id,
//     expires_at)` so tokens can be revoked server-side.
//   - Token verification confirms the signature, the `exp` claim, and that the
//     `sessions` row still exists and is unexpired (R18.5, R18.6).
//   - Logout deletes the session row so the prior token is rejected afterward (R18.7).
//   - Login rejects unknown email and bad password with an identical outcome that
//     discloses neither field (R18.3), and applies the pure rate-limit tracker so
//     5 failures within 300s lock the account for 900s (R18.4).
//
// The JWT plumbing here is framework-independent and directly testable. The
// official `@elysiajs/jwt` plugin (which wraps the same `jose` primitives used
// below) is wired at the Elysia layer in task 7.2; these functions are what those
// routes call.
//
// Requirements: 17.6, 18.1, 18.2, 18.3, 18.5, 18.6, 18.7

import { SignJWT, jwtVerify } from 'jose';
import type { Database } from 'bun:sqlite';
import type { SessionRow, UserRow } from './db';
import { withTransaction } from './db';
import { attemptTracker, type AttemptTrackerConfig, type RateLimitResult } from './rate-limit';

// --- Constants ---------------------------------------------------------------

/** Token / session lifetime in seconds (R18.2): exp = issued + 3600s. */
export const SESSION_TTL_SECONDS = 3600;

/** Signing algorithm for the HS256 session tokens. */
const JWT_ALG = 'HS256';

/**
 * Uniform message used for every credential failure so callers cannot tell
 * whether the email was unknown or the password was wrong (R18.3).
 */
export const INVALID_CREDENTIALS_MESSAGE = 'Credenciais inválidas.';

// --- Public types ------------------------------------------------------------

/** The user shape safe to return over the wire — never includes `password_hash`. */
export interface PublicUser {
  id: string;
  display_name: string;
  email: string;
}

/** Claims carried by a session token. */
export interface SessionClaims {
  /** Subject — the owning user id. */
  sub: string;
  /** JWT id — primary key of the matching `sessions` row. */
  jti: string;
  /** Issued-at, epoch seconds. */
  iat: number;
  /** Expiry, epoch seconds (`iat + SESSION_TTL_SECONDS`). */
  exp: number;
}

/** A newly created session: the bearer token plus its bookkeeping fields. */
export interface CreatedSession {
  token: string;
  jti: string;
  userId: string;
  /** Epoch seconds at which both the token and the session row expire. */
  expiresAt: number;
}

/** Result of resolving a bearer token to its owner. */
export interface VerifiedToken {
  user: PublicUser;
  jti: string;
  /** Epoch seconds at which the session expires. */
  expiresAt: number;
}

/**
 * Discriminated result of a login attempt. Callers map this to HTTP status:
 *   - `ok: true`                  → 200 `{ token, user }`
 *   - `reason: "invalid"`         → 401 (uniform, no field disclosure) (R18.3)
 *   - `reason: "rate_limited"`    → 429 with `Retry-After` (R18.4)
 */
export type LoginResult =
  | { ok: true; token: string; user: PublicUser; expiresAt: number }
  | { ok: false; reason: 'invalid'; message: string }
  | {
      ok: false;
      reason: 'rate_limited';
      message: string;
      retryAfterSeconds: number;
    };

// --- Time helper -------------------------------------------------------------

/** Current time in epoch seconds. Centralized so tests can reason about it. */
function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

// --- Signing secret ----------------------------------------------------------

const textEncoder = new TextEncoder();

/**
 * Development fallback secret. Production MUST set `JWT_SECRET`; without it the
 * server still runs (single-developer lab context) but tokens are only as strong
 * as this constant, so it must never be relied on in a real deployment.
 */
const DEV_FALLBACK_SECRET = 'taskiro-dev-insecure-secret-change-me-via-JWT_SECRET';

let cachedSecret: Uint8Array | null = null;

/** Resolve the HMAC signing key from `JWT_SECRET`, caching the encoded bytes. */
function getSecretKey(): Uint8Array {
  if (cachedSecret === null) {
    const raw = (typeof process !== 'undefined' && process.env?.JWT_SECRET) || DEV_FALLBACK_SECRET;
    cachedSecret = textEncoder.encode(raw);
  }
  return cachedSecret;
}

/**
 * Override the signing secret (tests only). Passing `null` resets to the
 * environment/dev value resolved lazily on next use.
 */
export function __setAuthSecretForTests(secret: string | null): void {
  cachedSecret = secret === null ? null : textEncoder.encode(secret);
}

// --- Password hashing (R18.1, R17.6) -----------------------------------------

/**
 * Hash a plaintext password for storage/seed. Uses Bun's argon2id by default.
 * The plaintext is never persisted or logged.
 */
export function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password);
}

/**
 * Verify a plaintext password against a stored hash. Returns `false` (never
 * throws) for malformed/unknown hash formats so callers get a uniform outcome.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await Bun.password.verify(password, hash);
  } catch {
    return false;
  }
}

// --- JWT helpers (R18.2, R18.6) ----------------------------------------------

/**
 * Sign a session token. `iat`/`exp` are absolute epoch seconds; the caller
 * supplies them so issuance time is explicit and testable.
 */
export async function signSessionToken(claims: {
  sub: string;
  jti: string;
  iat: number;
  exp: number;
}): Promise<string> {
  return await new SignJWT({})
    .setProtectedHeader({ alg: JWT_ALG })
    .setSubject(claims.sub)
    .setJti(claims.jti)
    .setIssuedAt(claims.iat)
    .setExpirationTime(claims.exp)
    .sign(getSecretKey());
}

/**
 * Verify a token's signature and expiry. Returns the typed claims on success or
 * `null` for any failure (missing/malformed/expired/forged) so callers reject
 * uniformly with 401 (R18.6). `now` (epoch seconds) drives the expiry check,
 * keeping verification deterministic in tests.
 */
export async function verifySessionToken(
  token: string | undefined | null,
  now: number = nowSeconds(),
): Promise<SessionClaims | null> {
  if (!token || typeof token !== 'string') {
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: [JWT_ALG],
      currentDate: new Date(now * 1000),
    });
    const { sub, jti, iat, exp } = payload;
    if (
      typeof sub !== 'string' ||
      typeof jti !== 'string' ||
      typeof iat !== 'number' ||
      typeof exp !== 'number'
    ) {
      return null;
    }
    return { sub, jti, iat, exp };
  } catch {
    return null;
  }
}

// --- Session lifecycle (R18.2, R18.5, R18.6, R18.7) --------------------------

/**
 * Create a session for `userId`: mint a `jti`, sign a token with
 * `exp = now + SESSION_TTL_SECONDS`, and insert the matching `sessions` row in a
 * single transaction. Returns the bearer token and its bookkeeping fields.
 */
export async function createSession(
  db: Database,
  userId: string,
  now: number = nowSeconds(),
): Promise<CreatedSession> {
  const jti = crypto.randomUUID();
  const iat = now;
  const expiresAt = now + SESSION_TTL_SECONDS;

  const token = await signSessionToken({ sub: userId, jti, iat, exp: expiresAt });

  withTransaction(db, (tx) => {
    tx.query('INSERT INTO sessions (jti, user_id, expires_at) VALUES (?, ?, ?)').run(
      jti,
      userId,
      expiresAt,
    );
  });

  return { token, jti, userId, expiresAt };
}

/** Look up the active (unexpired) session row for `jti`, or `null`. */
function getActiveSession(db: Database, jti: string, now: number): SessionRow | null {
  const row = db.query<SessionRow, [string]>('SELECT * FROM sessions WHERE jti = ?').get(jti);
  if (row === null) return null;
  // Half-open expiry: a session is valid strictly before `expires_at`.
  if (row.expires_at <= now) return null;
  return row;
}

/** Fetch a user as a `PublicUser` (no password hash), or `null`. */
export function getUserById(db: Database, id: string): PublicUser | null {
  const row = db.query<UserRow, [string]>('SELECT * FROM users WHERE id = ?').get(id);
  return row === null ? null : toPublicUser(row);
}

function toPublicUser(row: UserRow): PublicUser {
  return { id: row.id, display_name: row.display_name, email: row.email };
}

/**
 * Resolve a bearer token to its owner. Confirms (1) the signature and `exp`
 * claim, (2) that the `sessions` row still exists and is unexpired (so revoked
 * tokens are rejected), and (3) that the user still exists. Returns `null` on
 * any failure — callers map `null` to 401 (R18.5, R18.6, R18.7).
 */
export async function verifyToken(
  db: Database,
  token: string | undefined | null,
  now: number = nowSeconds(),
): Promise<VerifiedToken | null> {
  const claims = await verifySessionToken(token, now);
  if (claims === null) return null;

  const session = getActiveSession(db, claims.jti, now);
  if (session === null || session.user_id !== claims.sub) return null;

  const user = getUserById(db, claims.sub);
  if (user === null) return null;

  return { user, jti: claims.jti, expiresAt: session.expires_at };
}

/**
 * Revoke a session by deleting its row, so any token bearing that `jti` is
 * rejected by {@link verifyToken} afterward (R18.7). Returns `true` if a row was
 * deleted.
 */
export function revokeSession(db: Database, jti: string): boolean {
  let changes = 0;
  withTransaction(db, (tx) => {
    const result = tx.query('DELETE FROM sessions WHERE jti = ?').run(jti);
    changes = result.changes;
  });
  return changes > 0;
}

/** Remove every expired session row (housekeeping). Returns rows deleted. */
export function purgeExpiredSessions(db: Database, now: number = nowSeconds()): number {
  let changes = 0;
  withTransaction(db, (tx) => {
    const result = tx.query('DELETE FROM sessions WHERE expires_at <= ?').run(now);
    changes = result.changes;
  });
  return changes;
}

// --- Failed-login tracking (R18.4) -------------------------------------------

/**
 * In-memory per-email log of failed-login timestamps (epoch seconds). The
 * pure {@link attemptTracker} reads this log to decide rate limiting; this map
 * is the only mutable state in the service and is reset between tests.
 */
const failureLog = new Map<string, number[]>();

/** Normalize an email for use as a stable rate-limit key. */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Record a failed login for `email` at `now`, pruning entries that can no
 * longer contribute to a lockout to keep the log bounded. */
function recordFailure(email: string, now: number, config: Partial<AttemptTrackerConfig>): void {
  const key = normalizeEmail(email);
  const horizon = now - ((config.windowSeconds ?? 300) + (config.lockoutSeconds ?? 900));
  const existing = (failureLog.get(key) ?? []).filter((t) => t >= horizon);
  existing.push(now);
  failureLog.set(key, existing);
}

/** Clear the failure log for `email` (called on successful login). */
function clearFailures(email: string): void {
  failureLog.delete(normalizeEmail(email));
}

/** Evaluate the current rate-limit state for `email`. */
export function getRateLimitState(
  email: string,
  now: number = nowSeconds(),
  config: Partial<AttemptTrackerConfig> = {},
): RateLimitResult {
  return attemptTracker(failureLog.get(normalizeEmail(email)) ?? [], now, config);
}

/** Reset all in-memory auth state (tests only). */
export function resetAuthState(): void {
  failureLog.clear();
}

// --- Login / logout (R18.2, R18.3, R18.4, R18.7) -----------------------------

/**
 * Attempt to authenticate `email`/`password`.
 *
 * Order of checks:
 *   1. If the account is currently rate-limited, reject 429 without touching
 *      credentials (R18.4).
 *   2. Look up the user and verify the password. Unknown email and bad password
 *      both record a failure and return the same uniform `invalid` result so no
 *      field is disclosed (R18.3).
 *   3. On success, clear the failure log and create a session (R18.2).
 */
export async function login(
  db: Database,
  email: string,
  password: string,
  now: number = nowSeconds(),
  config: Partial<AttemptTrackerConfig> = {},
): Promise<LoginResult> {
  const limit = getRateLimitState(email, now, config);
  if (limit.limited) {
    return {
      ok: false,
      reason: 'rate_limited',
      message: 'Muitas tentativas. Tente novamente mais tarde.',
      retryAfterSeconds: limit.retryAfterSeconds,
    };
  }

  const userRow = db
    .query<UserRow, [string]>('SELECT * FROM users WHERE email = ?')
    .get(normalizeEmail(email));

  const passwordOk = userRow !== null && (await verifyPassword(password, userRow.password_hash));

  if (userRow === null || !passwordOk) {
    recordFailure(email, now, config);
    return {
      ok: false,
      reason: 'invalid',
      message: INVALID_CREDENTIALS_MESSAGE,
    };
  }

  clearFailures(email);
  const session = await createSession(db, userRow.id, now);
  return {
    ok: true,
    token: session.token,
    user: toPublicUser(userRow),
    expiresAt: session.expiresAt,
  };
}

/**
 * Log out the bearer of `token`: verify it, then revoke its session so the token
 * is rejected on subsequent requests (R18.7). Returns `true` when a valid token
 * was revoked; `false` (→ 401) when the token is missing/invalid/already revoked.
 */
export async function logout(
  db: Database,
  token: string | undefined | null,
  now: number = nowSeconds(),
): Promise<boolean> {
  const verified = await verifyToken(db, token, now);
  if (verified === null) return false;
  return revokeSession(db, verified.jti);
}

/**
 * Extract a bearer token from an `Authorization` header value. Returns the raw
 * token or `null` if the header is missing or not a well-formed `Bearer` scheme
 * (callers map `null` to 401) (R18.6).
 */
export function extractBearerToken(authorization: string | undefined | null): string | null {
  if (!authorization || typeof authorization !== 'string') return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1]!.trim() : null;
}
