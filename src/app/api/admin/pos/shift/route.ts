import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { db } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/api-error";
import { posSessionService } from "@/features/pos/services/pos-session.service";
import { posStoreService } from "@/features/pos/services/pos-store.service";

/**
 * The caller's open shift plus the counter they are billing at, or
 * `{ session: null }` when they have not started one - which is what makes the
 * screen show "Open shift" instead of the keypad.
 */
export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const email = context.session?.user?.email;
      if (!email) throw ApiError.unauthorized();

      const user = await db.user.findFirst({
        where: { email },
        select: { id: true },
      });
      if (!user) throw ApiError.unauthorized();

      const session = await posSessionService.getCurrent(user.id);
      const store = await posStoreService.getActiveStore(
        session ? BigInt(session.storeId) : null
      );

      return apiSuccess({ session, store }, "Shift fetched");
    },
  },
  {
    method: "GET",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    requiredPermission: "POS_VIEW",
  }
);
