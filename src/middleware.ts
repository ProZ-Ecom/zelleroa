import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/auth.config";
import { captureReferralCookie } from "@/lib/referral/cookie";

const { auth } = NextAuth(authConfig);

function parseJwtPayload(
  token?: string,
  checkExp: boolean = true
): { role?: string; userId?: string; email?: string; exp?: number } | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    // Edge-safe base64url decoding
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );

    const payload = JSON.parse(jsonPayload);

    // Verify token expiration if requested
    if (checkExp && payload.exp && payload.exp * 1000 < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export default auth(async (req) => {
  const { pathname } = req.nextUrl;
  const nextAuthUser = req.auth?.user;

  // Check HttpOnly access_token cookie
  const accessTokenCookie = req.cookies.get("access_token")?.value;
  let validAccessToken = parseJwtPayload(accessTokenCookie, true);
  let rawAccessToken = parseJwtPayload(accessTokenCookie, false);

  // Check HttpOnly refresh_token cookie
  const refreshTokenCookie = req.cookies.get("refresh_token")?.value;
  const validRefreshToken = parseJwtPayload(refreshTokenCookie, true);

  // User is authenticated if valid access_token, valid refresh_token, OR NextAuth session exists
  const isAuthenticated =
    !!validAccessToken || !!validRefreshToken || !!nextAuthUser;

  const userRole =
    validAccessToken?.role ||
    rawAccessToken?.role ||
    (nextAuthUser as { role?: string })?.role;

  // Authenticated areas and the auth pages must never be served from the
  // browser's back/forward cache after logout.
  const isAuthSensitivePath =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/agent") ||
    ["/orders", "/profile", "/wishlist", "/login", "/register"].some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    );

  const applyCookies = (res: NextResponse) => {
    const out = captureReferralCookie(req, res);
    if (isAuthSensitivePath) out.headers.set("Cache-Control", "no-store");
    return out;
  };

  if (pathname.startsWith("/admin")) {
    // /admin or /admin/ direct navigation
    if (pathname === "/admin" || pathname === "/admin/") {
      const url = req.nextUrl.clone();
      if (isAuthenticated && (userRole === "ADMIN" || userRole === "STAFF")) {
        url.pathname = "/admin/dashboard";
      } else {
        url.pathname = "/admin/login";
      }
      url.search = "";
      return applyCookies(NextResponse.redirect(url));
    }

    if (pathname === "/admin/login") {
      if (isAuthenticated && (userRole === "ADMIN" || userRole === "STAFF")) {
        const url = req.nextUrl.clone();
        url.pathname = "/admin/dashboard";
        url.search = "";
        return applyCookies(NextResponse.redirect(url));
      }
      return applyCookies(NextResponse.next());
    }

    if (!isAuthenticated || (userRole !== "ADMIN" && userRole !== "STAFF")) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = "";
      return applyCookies(NextResponse.redirect(url));
    }

    return applyCookies(NextResponse.next());
  }

  if (pathname.startsWith("/agent")) {
    if (!isAuthenticated || userRole !== "AGENT") {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = `?callbackUrl=${encodeURIComponent(pathname)}`;
      return applyCookies(NextResponse.redirect(url));
    }
    return applyCookies(NextResponse.next());
  }

  // /cart and /checkout intentionally left off this list: guest checkout
  // means anonymous visitors can shop and place an order without an account.
  const protectedCustomerRoutes = [
    "/orders",
    "/profile",
    "/wishlist",
  ];
  const isProtectedCustomer = protectedCustomerRoutes.some((route) =>
    pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isProtectedCustomer && !isAuthenticated) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?callbackUrl=${encodeURIComponent(pathname)}`;
    return applyCookies(NextResponse.redirect(url));
  }

  if ((pathname === "/login" || pathname === "/register") && isAuthenticated) {
    const url = req.nextUrl.clone();
    url.search = "";
    if (userRole === "ADMIN" || userRole === "STAFF") {
      url.pathname = "/admin/dashboard";
    } else if (userRole === "AGENT") {
      url.pathname = "/agent/dashboard";
    } else {
      url.pathname = "/";
    }
    return applyCookies(NextResponse.redirect(url));
  }

  return applyCookies(NextResponse.next());
});

export const config = {
  matcher: [
    // Broad catch-all so `?ref=<code>` is captured into the referral_agent
    // cookie no matter which page a shared link lands on, while still
    // skipping static assets and API routes.
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
