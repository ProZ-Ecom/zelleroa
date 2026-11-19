/**
 * Bridge between the framework-free API client and the UI. The client can't
 * render a modal, so it announces a blocked account here and a single mounted
 * listener (AccountBlockedGate) reacts.
 */
export const ACCOUNT_BLOCKED_CODE = "ACCOUNT_BLOCKED";
export const ACCOUNT_BLOCKED_EVENT = "zellora:account-blocked";

let notified = false;

/**
 * Announce a blocked account. Idempotent for the lifetime of the page: any
 * number of concurrent ACCOUNT_BLOCKED responses produce a single event. The
 * flag resets naturally because the gate finishes with a hard navigation.
 */
export function notifyAccountBlocked(): void {
  if (typeof window === "undefined" || notified) return;
  notified = true;
  window.dispatchEvent(new Event(ACCOUNT_BLOCKED_EVENT));
}
