import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/auth.config";
import { getRoleHome } from "@/lib/auth/role-routes";
import { referralLandingRedirect } from "@/lib/referral/cookie";

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

  // `?ref=<code>` on any page: validate the code on the server (see /ref/[code]) before it is stored.
  const referralLanding = referralLandingRedirect(req);
  if (referralLanding) return NextResponse.redirect(referralLanding);

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
    if (isAuthSensitivePath) res.headers.set("Cache-Control", "no-store");
    return res;
  };

  const isStaffRole = userRole === "ADMIN" || userRole === "STAFF";

  const redirectTo = (path: string, search = "") => {
    const url = req.nextUrl.clone();
    url.pathname = path;
    url.search = search;
    return applyCookies(NextResponse.redirect(url));
  };
  const toLogin = () =>
    redirectTo("/login", `?callbackUrl=${encodeURIComponent(pathname)}`);

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin" || pathname === "/admin/") {
      return redirectTo(isAuthenticated && isStaffRole ? "/admin/dashboard" : "/admin/login");
    }

    if (pathname === "/admin/login") {
      if (isAuthenticated && isStaffRole) return redirectTo("/admin/dashboard");
      // A signed-in customer/agent has no business on the admin login screen.
      if (isAuthenticated && userRole) return redirectTo(getRoleHome(userRole));
      return applyCookies(NextResponse.next());
    }

    if (!isAuthenticated) return redirectTo("/admin/login");
    // Signed in, but not as admin/staff: send them to their own dashboard.
    if (!isStaffRole) return redirectTo(getRoleHome(userRole));

    return applyCookies(NextResponse.next());
  }

  if (pathname.startsWith("/agent")) {
    if (!isAuthenticated) return toLogin();
    if (userRole !== "AGENT") return redirectTo(getRoleHome(userRole));
    return applyCookies(NextResponse.next());
  }

  // Customer account area. Admin/staff never see it; agents have their own
  // dashboard and profile, so only the purchase pages stay open to them.
  const isAccountArea = ["/account", "/profile"].some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
  const isPurchaseArea = ["/orders", "/wishlist"].some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isAccountArea || isPurchaseArea) {
    if (!isAuthenticated) return toLogin();
    if (userRole === "CUSTOMER" || (isPurchaseArea && userRole === "AGENT")) {
      // Legacy /profile URL lives on as /account/dashboard.
      if (pathname === "/profile") {
        return redirectTo("/account/dashboard", req.nextUrl.search);
      }
      return applyCookies(NextResponse.next());
    }
    if (userRole) return redirectTo(getRoleHome(userRole));
    // Role unknown (e.g. expired access token, refresh pending): let the page decide.
    return applyCookies(NextResponse.next());
  }

  if ((pathname === "/login" || pathname === "/register") && isAuthenticated) {
    return redirectTo(getRoleHome(userRole));
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
