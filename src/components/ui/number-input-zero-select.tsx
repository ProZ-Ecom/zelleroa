"use client";

import { useEffect } from "react";

/** True for a field showing only the default zero ("0", "0.0", "00"). */
const isDefaultZero = (value: string) => /^0+(\.0*)?$/.test(value.trim());

/**
 * Mount once (root layout). When a number input holding only a default `0`
 * receives focus, its content is selected so the first keystroke replaces it
 * ("0" + typing 500 -> "500", not "0500"). Values such as 0.5, -1 or 10 and
 * empty fields are left alone. Purely a selection change: no value, state,
 * validation or payload is touched, so it works for controlled, uncontrolled
 * and react-hook-form inputs alike.
 */
export function NumberInputZeroSelect() {
  useEffect(() => {
    const isNumberInput = (el: EventTarget | null): el is HTMLInputElement =>
      el instanceof HTMLInputElement &&
      el.type === "number" &&
      !el.readOnly &&
      !el.disabled;

    const onFocusIn = (e: FocusEvent) => {
      const el = e.target;
      if (!isNumberInput(el) || !isDefaultZero(el.value)) return;
      el.select();
      // Browsers collapse the selection on the mouseup that follows a click-focus.
      el.addEventListener("mouseup", (ev) => ev.preventDefault(), { once: true });
    };

    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);

  return null;
}
