import bcrypt from "bcryptjs";
import { db } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/api-error";
import { userRepository } from "@/features/users/repositories/user.repository";
import {
  ACCOUNT_BLOCKED_MESSAGE,
  LOGIN_LOCKED_CODE,
  LOGIN_THROTTLED_CODE,
} from "../types";

/**
 * Failed-login protection shared by every credential check (the custom
 * /api/auth/login route and the NextAuth credentials provider), so neither
 * path can be used to bypass the other.
 *
 * Rules
 *  - Failures are counted per account inside a 30 minute window.
 *  - Failures 1-4: normal "invalid email or password" response.
 *  - From the 5th failure: progressive delay before the next attempt is even
 *    checked (5s, 10s, 20s, 30s, 60s for failures 5..9).
 *  - 10th failure: account is temporarily locked for 15 minutes. The password
 *    is not checked while locked. The counter restarts once the lock expires.
 *  - Successful login clears the counter, throttle and lock.
 *
 * This is deliberately separate from users.status / users.is_blocked, which are
 * admin-controlled and never touched here.
 *
 * Unknown emails get the same treatment from an in-memory shadow state so the
 * responses never reveal whether an account exists.
 */

export const LOGIN_FAILURE_WINDOW_MS = 30 * 60_000;
export const LOGIN_LOCK_MS = 15 * 60_000;
export const LOGIN_LOCK_THRESHOLD = 10;
export const LOGIN_THROTTLE_THRESHOLD = 5;
/** Delay applied after failure N (N = 5..9). */
const THROTTLE_DELAYS_SEC: Record<number, number> = { 5: 5, 6: 10, 7: 20, 8: 30, 9: 60 };

const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password";

// Compared against for unknown emails so response time doesn't reveal whether
// the account exists.
const DUMMY_HASH = bcrypt.hashSync("login-protection-dummy", 10);

interface ProtectionState {
  attempts: number;
  lastFailedAt: Date | null;
  throttledUntil: Date | null;
  lockedUntil: Date | null;
}

type Gate =
  | { kind: "ok" }
  | { kind: "throttled"; retryAfterSeconds: number }
  | { kind: "locked"; retryAfterSeconds: number; lockedUntil: Date };

function evaluate(state: ProtectionState, now: number): Gate {
  if (state.lockedUntil && state.lockedUntil.getTime() > now) {
    return {
      kind: "locked",
      retryAfterSeconds: Math.ceil((state.lockedUntil.getTime() - now) / 1000),
      lockedUntil: state.lockedUntil,
    };
  }
  if (state.throttledUntil && state.throttledUntil.getTime() > now) {
    return {
      kind: "throttled",
      retryAfterSeconds: Math.ceil((state.throttledUntil.getTime() - now) / 1000),
    };
  }
  return { kind: "ok" };
}

/** True when the counter no longer applies (lock served, or window elapsed). */
function isStale(state: ProtectionState, now: number): boolean {
  if (state.lockedUntil && state.lockedUntil.getTime() <= now) return true;
  return (
    !!state.lastFailedAt && now - state.lastFailedAt.getTime() > LOGIN_FAILURE_WINDOW_MS
  );
}

/** Next state after one more failure, given the (possibly stale) previous one. */
function afterFailure(prev: ProtectionState, now: number): ProtectionState {
  const attempts = (isStale(prev, now) ? 0 : prev.attempts) + 1;
  const next: ProtectionState = {
    attempts,
    lastFailedAt: new Date(now),
    throttledUntil: null,
    lockedUntil: null,
  };
  if (attempts >= LOGIN_LOCK_THRESHOLD) {
    next.lockedUntil = new Date(now + LOGIN_LOCK_MS);
  } else if (attempts >= LOGIN_THROTTLE_THRESHOLD) {
    next.throttledUntil = new Date(now + THROTTLE_DELAYS_SEC[attempts] * 1000);
  }
  return next;
}

function toError(gate: Exclude<Gate, { kind: "ok" }>) {
  if (gate.kind === "locked") {
    const minutes = Math.max(1, Math.ceil(gate.retryAfterSeconds / 60));
    return new ApiError(
      `Too many failed login attempts. Please try again after ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      429,
      undefined,
      true,
      { retryAfterSeconds: gate.retryAfterSeconds, lockedUntil: gate.lockedUntil.toISOString() },
      LOGIN_LOCKED_CODE
    );
  }
  return new ApiError(
    `Too many attempts. Please wait ${gate.retryAfterSeconds} second${gate.retryAfterSeconds === 1 ? "" : "s"} before trying again.`,
    429,
    undefined,
    true,
    { retryAfterSeconds: gate.retryAfterSeconds },
    LOGIN_THROTTLED_CODE
  );
}

// Shadow state for emails that have no account (in-memory, per process).
const shadow = new Map<string, ProtectionState>();
const SHADOW_MAX = 10_000;

function shadowGet(email: string): ProtectionState {
  return (
    shadow.get(email) ?? { attempts: 0, lastFailedAt: null, throttledUntil: null, lockedUntil: null }
  );
}

function shadowSet(email: string, state: ProtectionState) {
  if (shadow.size >= SHADOW_MAX && !shadow.has(email)) {
    const oldest = shadow.keys().next().value;
    if (oldest !== undefined) shadow.delete(oldest);
  }
  shadow.set(email, state);
}

/**
 * Validates credentials with failed-login protection and returns the user
 * (repository shape, including role). Throws ApiError otherwise.
 */
export async function verifyCredentialsWithProtection(rawEmail: string, password: string) {
  const email = rawEmail.trim();
  const shadowKey = email.toLowerCase();
  const user = await userRepository.findByEmail(email);
  const now = Date.now();

  if (!user || !user.password_hash) {
    const state = shadowGet(shadowKey);
    const gate = evaluate(state, now);
    if (gate.kind !== "ok") throw toError(gate);

    await bcrypt.compare(password, DUMMY_HASH);
    shadowSet(shadowKey, afterFailure(state, now));
    throw ApiError.unauthorized(INVALID_CREDENTIALS_MESSAGE);
  }

  // Admin block/deactivation is permanent and reported as before.
  if (user.status !== "active") {
    throw ApiError.forbidden(ACCOUNT_BLOCKED_MESSAGE);
  }

  const internalId = BigInt(user.internalId);
  const state: ProtectionState = {
    attempts: user.failed_login_attempts,
    lastFailedAt: user.last_failed_login_at,
    throttledUntil: user.login_throttled_until,
    lockedUntil: user.login_locked_until,
  };

  const gate = evaluate(state, now);
  if (gate.kind !== "ok") throw toError(gate);

  const valid = await bcrypt.compare(password, user.password_hash);

  if (valid) {
    if (
      state.attempts !== 0 ||
      state.throttledUntil ||
      state.lockedUntil ||
      state.lastFailedAt
    ) {
      await db.user.update({
        where: { id: internalId },
        data: {
          failed_login_attempts: 0,
          last_failed_login_at: null,
          login_throttled_until: null,
          login_locked_until: null,
        },
      });
    }
    shadow.delete(shadowKey);
    return user;
  }

  // Wrong password. Reset a stale counter first, then increment atomically so
  // concurrent attempts can't undercount.
  if (isStale(state, now)) {
    await db.user.updateMany({
      where: { id: internalId },
      data: { failed_login_attempts: 0, login_locked_until: null, login_throttled_until: null },
    });
  }
  const updated = await db.user.update({
    where: { id: internalId },
    data: {
      failed_login_attempts: { increment: 1 },
      last_failed_login_at: new Date(now),
    },
    select: { failed_login_attempts: true },
  });
  const next = afterFailure(
    { ...state, attempts: updated.failed_login_attempts - 1, lastFailedAt: new Date(now) },
    now
  );
  if (next.lockedUntil || next.throttledUntil) {
    await db.user.update({
      where: { id: internalId },
      data: {
        login_locked_until: next.lockedUntil,
        login_throttled_until: next.throttledUntil,
      },
    });
  }

  // The response to the failing attempt itself stays generic; the lock/throttle
  // is reported on the next attempt.
  throw ApiError.unauthorized(INVALID_CREDENTIALS_MESSAGE);
}
