import { describe, expect, it } from "bun:test";
import {
  attemptTracker,
  isRateLimited,
  DEFAULT_RATE_LIMIT_CONFIG,
} from "./rate-limit";

const { windowSeconds, lockoutSeconds } = DEFAULT_RATE_LIMIT_CONFIG;

describe("attemptTracker (Requirement 18.4)", () => {
  it("does not limit an empty failure log", () => {
    expect(attemptTracker([], 1000)).toEqual({
      limited: false,
      retryAfterSeconds: 0,
      unlockAt: null,
    });
  });

  it("does not limit after only 4 failures within the window", () => {
    const log = [0, 10, 20, 30];
    expect(isRateLimited(log, 40)).toBe(false);
  });

  it("limits once the 5th failure lands within a 300s window", () => {
    const log = [0, 50, 100, 150, 200]; // span 200s <= 300s
    const res = attemptTracker(log, 200);
    expect(res.limited).toBe(true);
    expect(res.unlockAt).toBe(200 + lockoutSeconds);
    expect(res.retryAfterSeconds).toBe(lockoutSeconds);
  });

  it("does not limit when 5 failures are spread beyond the 300s window", () => {
    const log = [0, 100, 200, 300, 400]; // any 5-run spans 400s > 300s
    expect(isRateLimited(log, 400)).toBe(false);
  });

  it("limits for exactly 900s after the triggering failure, then releases", () => {
    const log = [0, 50, 100, 150, 200];
    const trigger = 200;
    // Just before unlock: still limited.
    expect(isRateLimited(log, trigger + lockoutSeconds - 1)).toBe(true);
    // At unlock boundary (half-open interval): released.
    expect(isRateLimited(log, trigger + lockoutSeconds)).toBe(false);
  });

  it("treats the 300s window boundary as inclusive", () => {
    const log = [0, 1, 2, 3, windowSeconds]; // span == 300s
    expect(isRateLimited(log, windowSeconds)).toBe(true);
  });

  it("extends the lock when a later qualifying burst overlaps an earlier one", () => {
    // First burst triggers at t=200, second qualifying failure at t=260 extends.
    const log = [0, 50, 100, 150, 200, 260];
    const res = attemptTracker(log, 300);
    expect(res.limited).toBe(true);
    // Latest 5-run is [100,150,200,260] -> needs 5: [50,100,150,200,260] span 210s.
    expect(res.unlockAt).toBe(260 + lockoutSeconds);
  });

  it("ignores failures timestamped after `now`", () => {
    const log = [1000, 1010, 1020, 1030, 1040];
    // Evaluated at t=500, before any failure occurred.
    expect(isRateLimited(log, 500)).toBe(false);
  });

  it("does not mutate the caller's failure log", () => {
    const log = [200, 0, 150, 50, 100];
    const copy = [...log];
    attemptTracker(log, 200);
    expect(log).toEqual(copy);
  });

  it("respects overridden configuration", () => {
    const log = [0, 1, 2]; // 3 failures within 5s
    const res = attemptTracker(log, 2, {
      maxFailures: 3,
      windowSeconds: 5,
      lockoutSeconds: 60,
    });
    expect(res.limited).toBe(true);
    expect(res.unlockAt).toBe(2 + 60);
  });
});
