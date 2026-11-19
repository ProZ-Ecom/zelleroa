"use client";

import { useCallback, useEffect, useState } from "react";
import { LOGIN_LOCKED_CODE, LOGIN_THROTTLED_CODE } from "../types";

/**
 * UI-only countdown for a throttled/locked login. The server enforces the
 * limit regardless; this just stops the form from sending doomed requests.
 */
export function useLoginCooldown() {
  const [until, setUntil] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (until === null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) setUntil(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [until]);

  /** Starts a countdown if the error is a throttle/lock response. */
  const startFromError = useCallback((error: unknown) => {
    const e = error as { code?: string; details?: { retryAfterSeconds?: number } };
    const seconds = e?.details?.retryAfterSeconds;
    if (
      (e?.code === LOGIN_LOCKED_CODE || e?.code === LOGIN_THROTTLED_CODE) &&
      typeof seconds === "number" &&
      seconds > 0
    ) {
      setUntil(Date.now() + seconds * 1000);
    }
  }, []);

  const label =
    secondsLeft >= 60
      ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`
      : `${secondsLeft}s`;

  return { secondsLeft, label, coolingDown: secondsLeft > 0, startFromError };
}
