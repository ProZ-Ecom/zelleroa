import { NextRequest, NextResponse } from "next/server";

export const REFERRAL_AGENT_COOKIE = "referral_agent";
const REFERRAL_AGENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const IS_PROD = process.env.NODE_ENV === "production";

/** Public referral / agent codes are short and alphanumeric; anything else is junk and never stored. */
export const REFERRAL_CODE_PATTERN = /^[A-Za-z0-9_-]{3,30}$/;

export function setReferralCookie<T>(response: NextResponse<T>, code: string): NextResponse<T> {
  response.cookies.set(REFERRAL_AGENT_COOKIE, code, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/",
    maxAge: REFERRAL_AGENT_COOKIE_MAX_AGE,
  });
  return response;
}


/**
 * Captures `?ref=<referral_code>` off the request URL into the
 * `referral_agent` cookie (last-click wins), if present. Called from
 * middleware on every page so the cookie survives to signup/checkout
 * regardless of the landing page.
 *
 * Kept dependency-free (no Prisma) so it stays safe to import from the
 * Edge middleware bundle.
 */
export function captureReferralCookie<T>(
  request: NextRequest,
  response: NextResponse<T>
): NextResponse<T> {
  const params = request.nextUrl.searchParams;
  const ref = params.get("ref") ?? params.get("agent");
  if (ref && REFERRAL_CODE_PATTERN.test(ref)) {
    setReferralCookie(response, ref);
  }
  return response;
}
