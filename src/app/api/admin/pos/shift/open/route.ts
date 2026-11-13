import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { db } from "@/lib/db/prisma";
import { posSessionService } from "@/features/pos/services/pos-session.service";
import {
  posShiftOpenSchema,
  type PosShiftOpenInput,
} from "@/features/pos/validations/pos.schema";

/** Start a shift with the cash already in the drawer. */
export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const email = context.session?.user?.email;
      if (!email) throw ApiError.unauthorized();

      const user = await db.user.findFirst({ where: { email }, select: { id: true } });
      if (!user) throw ApiError.unauthorized();

      const session = await posSessionService.open(user.id, context.body as PosShiftOpenInput);
      return apiSuccess(session, "Shift opened");
    },
  },
  {
    method: "POST",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    requiredPermission: "POS_SHIFT",
    bodySchema: posShiftOpenSchema,
  }
);
