import type { NextResponse } from "next/server";

/**
 * Cookies set by the custom login (see /api/auth/login) and reset flow.
 * They are created with `path: "/"` and no `domain`, so expiring them with the
 * same attributes is what makes the browser actually drop them.
 */
const CUSTOM_AUTH_COOKIES = ["access_token", "refresh_token", "reset_token"];

/**
 * Auth.js / NextAuth cookies. The session JWT may be split into chunks
 * (`.0`, `.1`, ...) and is prefixed with `__Secure-` over HTTPS; `__Host-`
 * is used for the CSRF token. Matched by prefix so none are missed.
 */
const NEXTAUTH_COOKIE_PATTERN =
  /^(?:__Secure-|__Host-)?(?:authjs|next-auth)\.(?:session-token|csrf-token|callback-url|pkce\.code_verifier|state|nonce)(?:\.\d+)?$/;

const IS_PROD = process.env.NODE_ENV === "production";

/**
 * Expires every auth cookie on the given response by sending an explicit
 * `Set-Cookie` with `Max-Age=0` and the same path/sameSite/httpOnly/secure
 * attributes the cookies were created with. `requestCookieNames` lets us also
 * catch chunked or prefixed NextAuth cookies that are present on the request.
 */
export function clearAuthCookies(
  response: NextResponse,
  requestCookieNames: string[] = []
): void {
  const names = new Set<string>(CUSTOM_AUTH_COOKIES);
  for (const name of requestCookieNames) {
    if (NEXTAUTH_COOKIE_PATTERN.test(name)) names.add(name);
  }
  // Always cover the base session cookie names, even if absent on the request.
  names.add("authjs.session-token");
  names.add("__Secure-authjs.session-token");
  names.add("next-auth.session-token");
  names.add("__Secure-next-auth.session-token");

  for (const name of names) {
    const secure = IS_PROD || name.startsWith("__Secure-") || name.startsWith("__Host-");
    response.cookies.set(name, "", {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });
  }
}
