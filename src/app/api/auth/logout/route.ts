import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { clearAuthCookies } from "@/lib/auth/clear-auth-cookies";
import { clearReferralCookie } from "@/lib/referral/cookie";

export const POST = createApiHandler(
  {
    POST: async (request) => {
      const response = apiSuccess(null, "Logged out successfully");

      // Expire the custom JWT cookies AND the Auth.js session cookies on the
      // response itself, so the browser receives explicit Set-Cookie headers.
      clearAuthCookies(
        response,
        request.cookies.getAll().map((c) => c.name)
      );
      // A pending referral belongs to the session that is ending; the next login must not inherit it.
      clearReferralCookie(response);
      response.headers.set("Cache-Control", "no-store");

      return response;
    },
  },
  {
    method: "POST",
    // Logout must never be throttled into leaving the user signed in.
    rateLimit: false,
  }
);
