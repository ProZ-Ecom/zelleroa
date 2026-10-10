import { NextRequest, NextResponse } from "next/server";

export const REFERRAL_AGENT_COOKIE = "referral_agent";
const DEFAULT_REFERRAL_EXPIRY_DAYS = 30;
const IS_PROD = process.env.NODE_ENV === "production";

/** Public referral / agent codes are short and alphanumeric; anything else is junk and never stored. */
export const REFERRAL_CODE_PATTERN = /^[A-Za-z0-9_-]{3,30}$/;

/** Attribution lifetime in seconds; `REFERRAL_COOKIE_DAYS` overrides the 30-day default. */
export function referralCookieMaxAge(env: string | undefined = process.env.REFERRAL_COOKIE_DAYS): number {
  const days = Number(env);
  return (Number.isFinite(days) && days > 0 ? days : DEFAULT_REFERRAL_EXPIRY_DAYS) * 24 * 60 * 60;
}

export function setReferralCookie<T>(response: NextResponse<T>, code: string): NextResponse<T> {
  response.cookies.set(REFERRAL_AGENT_COOKIE, code, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/",
    maxAge: referralCookieMaxAge(),
  });
  return response;
}

/**
 * Expires the pending referral. Called once the referral has been consumed (login / registration)
 * and on logout, so one visitor's link can never be applied to the NEXT account on the browser.
 * The customer's permanent assignment lives in the database and is untouched.
 */
export function clearReferralCookie<T>(response: NextResponse<T>): NextResponse<T> {
  response.cookies.set(REFERRAL_AGENT_COOKIE, "", {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  return response;
}

/** Only same-site relative paths may be used as a post-landing destination (no open redirect). */
export function safeLandingPath(to: string | null | undefined): string {
  if (!to || !to.startsWith("/") || to.startsWith("//") || to.startsWith("/\\") || /[\r\n]/.test(to)) return "/";
  return to;
}

/**
 * If the request carries `?ref=<code>` (or legacy `?agent=`), returns the `/ref/<code>` URL that
 * validates it server-side, sets the cookie only when it is a live agent's code, and sends the
 * visitor back to the same page without the parameter. The middleware cannot query the database
 * (Edge), so it only hands off; it never writes the cookie itself, which is what stops a junk
 * code from overwriting a valid attribution.
 */
export function referralLandingRedirect(request: NextRequest): URL | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  if (request.nextUrl.pathname.startsWith("/ref/")) return null;
  const params = request.nextUrl.searchParams;
  const ref = params.get("ref") ?? params.get("agent");
  if (!ref || !REFERRAL_CODE_PATTERN.test(ref)) return null;

  const rest = new URLSearchParams(params);
  rest.delete("ref");
  rest.delete("agent");
  const qs = rest.toString();
  const url = request.nextUrl.clone();
  url.pathname = `/ref/${encodeURIComponent(ref)}`;
  url.search = `?to=${encodeURIComponent(request.nextUrl.pathname + (qs ? `?${qs}` : ""))}`;
  return url;
}
