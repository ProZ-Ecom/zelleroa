import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { db } from "@/lib/db/prisma";
import { roleHasPermission } from "@/lib/permissions/server";
import { posSessionService } from "@/features/pos/services/pos-session.service";
import {
  posShiftCloseSchema,
  type PosShiftCloseInput,
} from "@/features/pos/validations/pos.schema";
import { z } from "zod";

const bodySchema = posShiftCloseSchema.and(z.object({ sessionUuid: z.string().trim().min(1) }));

/**
 * Close a shift against counted cash.
 *
 * The variance is computed on the server from the shift's own bills - the
 * client never sends it - and a drawer that does not balance needs a reason.
 */
export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const email = context.session?.user?.email;
      if (!email) throw ApiError.unauthorized();

      const user = await db.user.findFirst({ where: { email }, select: { id: true } });
      if (!user) throw ApiError.unauthorized();

      const body = context.body as PosShiftCloseInput & { sessionUuid: string };
      // A manager may close a cashier's drawer when they have gone home; a
      // cashier may only close their own.
      const canCloseOthers = await roleHasPermission(
        context.session?.user?.role,
        "POS_REPORT_VIEW"
      );

      const summary = await posSessionService.close(
        user.id,
        body.sessionUuid,
        body,
        canCloseOthers
      );
      return apiSuccess(summary, "Shift closed");
    },
  },
  {
    method: "POST",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    requiredPermission: "POS_SHIFT",
    bodySchema,
  }
);
