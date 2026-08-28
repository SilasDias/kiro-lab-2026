/**
 * Pure rate-limit attempt tracker for the Auth_Service.
 *
 * Implements Requirement 18.4 / Correctness Property 24:
 * "Once 5 failed login attempts occur within a 300-second window, every further
 *  attempt within the following 900 seconds is rejected with a rate-limited (429)
 *  outcome; sequences with fewer than 5 failures in any 300-second window are not
 *  rate-limited."
 *
 * This module is intentionally PURE: `attemptTracker` is a deterministic function
 * of (timestamped failure log, current time). It holds no global mutable clock or
 * state, which makes it directly unit- and property-testable. The Auth_Service in
 * `auth.ts` imports it and supplies the per-account failure log plus `Date.now()`.
 *
 * Timestamps are expressed in **seconds** (matching the 300s / 900s windows of the
 * requirement). Callers using millisecond clocks should divide by 1000, or override
 * the window/lockout via `config`.
 */

/** Tunable thresholds. Defaults encode Requirement 18.4. */
export interface AttemptTrackerConfig {
  /** Number of failures within `windowSeconds` that triggers a lockout. */
  maxFailures: number;
  /** Sliding window, in seconds, over which failures are counted. */
  windowSeconds: number;
  /** Duration, in seconds, the account stays locked once the threshold is hit. */
  lockoutSeconds: number;
}

/** Default configuration fixed by Requirement 18.4: 5 failures / 300s → lock 900s. */
export const DEFAULT_RATE_LIMIT_CONFIG: AttemptTrackerConfig = {
  maxFailures: 5,
  windowSeconds: 300,
  lockoutSeconds: 900,
};

/** Result of evaluating the failure log at a given instant. */
export interface RateLimitResult {
  /** True when the account is currently rate-limited (the API should answer 429). */
  limited: boolean;
  /**
   * Whole seconds the caller must wait before retrying. `0` when not limited.
   * Suitable for a `Retry-After` header.
   */
  retryAfterSeconds: number;
  /** Absolute time (seconds) at which the lock expires, or `null` when not limited. */
  unlockAt: number | null;
}

/**
 * Determine whether an account is currently rate-limited given its timestamped
 * failed-login log and the current time.
 *
 * Algorithm (deterministic, side-effect free):
 *  1. Consider only failures at or before `now` (future failures cannot lock the
 *     account in the present) and sort them ascending without mutating the input.
 *  2. A "trigger" occurs at the timestamp of the Nth failure (N = `maxFailures`)
 *     whenever a run of `maxFailures` consecutive failures spans `<= windowSeconds`.
 *  3. A trigger at time `T` locks the account for the half-open interval
 *     `[T, T + lockoutSeconds)`. The account is limited at `now` if any trigger's
 *     interval contains `now`; the effective unlock time is the latest such
 *     interval's end (overlapping lockouts extend protection).
 *
 * @param failureLog Timestamps (seconds) of failed login attempts for one account.
 * @param now        Current time in seconds.
 * @param config     Optional overrides for the thresholds/windows.
 */
export function attemptTracker(
  failureLog: readonly number[],
  now: number,
  config: Partial<AttemptTrackerConfig> = {},
): RateLimitResult {
  const { maxFailures, windowSeconds, lockoutSeconds } = {
    ...DEFAULT_RATE_LIMIT_CONFIG,
    ...config,
  };

  const notLimited: RateLimitResult = {
    limited: false,
    retryAfterSeconds: 0,
    unlockAt: null,
  };

  // A non-positive threshold would mean "never count" — treat as never limited.
  if (maxFailures <= 0) {
    return notLimited;
  }

  // Only past/present failures can produce a lock that is active now. Copy before
  // sorting so the caller's array is never mutated (purity).
  const failures = failureLog.filter((t) => t <= now).sort((a, b) => a - b);

  if (failures.length < maxFailures) {
    return notLimited;
  }

  // Scan every window of `maxFailures` consecutive failures. Track the latest
  // unlock time among windows whose lockout interval still covers `now`.
  let latestUnlock = -Infinity;
  for (let i = maxFailures - 1; i < failures.length; i++) {
    const windowStart = failures[i - (maxFailures - 1)]!;
    const triggerTime = failures[i]!;

    // Are these `maxFailures` failures bunched within the allowed window?
    if (triggerTime - windowStart <= windowSeconds) {
      const unlockAt = triggerTime + lockoutSeconds;
      // Active iff the lockout interval [triggerTime, unlockAt) contains `now`.
      if (now < unlockAt && unlockAt > latestUnlock) {
        latestUnlock = unlockAt;
      }
    }
  }

  if (latestUnlock === -Infinity) {
    return notLimited;
  }

  return {
    limited: true,
    retryAfterSeconds: Math.max(0, Math.ceil(latestUnlock - now)),
    unlockAt: latestUnlock,
  };
}

/** Convenience boolean wrapper around {@link attemptTracker}. */
export function isRateLimited(
  failureLog: readonly number[],
  now: number,
  config: Partial<AttemptTrackerConfig> = {},
): boolean {
  return attemptTracker(failureLog, now, config).limited;
}
