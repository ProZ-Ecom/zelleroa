import { cookies } from "next/headers";
import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { loginSchema } from "@/features/auth/validations/auth.schema";
import { authService } from "@/features/auth/services/auth.service";
import type { LoginInput } from "@/features/auth/types";
import { db } from "@/lib/db/prisma";
import { REFERRAL_AGENT_COOKIE, clearReferralCookie } from "@/lib/referral/cookie";
import { customerAssignmentService } from "@/features/agents/services/customer-assignment.service";

const IS_PROD = process.env.NODE_ENV === "production";

export const POST = createApiHandler(
  {
    POST: async (request, context) => {
      const body = context.body as LoginInput;

      const authData = await authService.authenticateUser(body);

      // An existing customer who arrives with an agent's referral code gets assigned (only if they have
      // no agent yet; an existing assignment is never changed). The pending referral is single-use: it
      // is cleared below whether or not it applied, so it cannot leak to the next account on this
      // browser. A failure here must not block login.
      const refCode = request.cookies.get(REFERRAL_AGENT_COOKIE)?.value;
      if (refCode) {
        try {
          const u = await db.user.findFirst({ where: { uuid: authData.user.id }, select: { id: true } });
          if (u) await customerAssignmentService.assignFromReferralCode(u.id, refCode);
        } catch (err) {
          console.error("[login] referral assignment failed", err);
        }
      }

      // Set Server-Side HttpOnly Cookies
      const cookieStore = await cookies();

      if (authData.accessToken) {
        cookieStore.set("access_token", authData.accessToken, {
          httpOnly: true,
          secure: IS_PROD,
          sameSite: "lax",
          path: "/",
          maxAge: 15 * 60, // 15 minutes
        });
      }

      if (authData.refreshToken) {
        cookieStore.set("refresh_token", authData.refreshToken, {
          httpOnly: true,
          secure: IS_PROD,
          sameSite: "lax",
          path: "/",
          maxAge: 30 * 24 * 60 * 60, // 30 days
        });
      }

      const response = apiSuccess(
        {
          user: authData.user,
        },
        "Login successful"
      );
      if (refCode !== undefined) clearReferralCookie(response);
      return response;
    },
  },
  {
    method: "POST",
    bodySchema: loginSchema,
    rateLimit: { limit: 10, windowMs: 60_000 },
  }
);
