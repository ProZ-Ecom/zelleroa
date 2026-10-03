import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { clearAuthCookies } from "@/lib/auth/clear-auth-cookies";

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
