import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { db } from "@/lib/db/prisma";
import { commissionService } from "@/features/agents/services/commission.service";

/** Audit trail for one commission (by uuid) or payout (by uuid). */
export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const type = context.searchParams?.get("type");
      const ref = context.searchParams?.get("id") ?? "";
      if (type !== "commission" && type !== "payout") throw ApiError.badRequest("type must be commission or payout");

      const entity =
        type === "commission"
          ? await db.commissions.findUnique({ where: { uuid: ref }, select: { id: true } })
          : await db.commission_payouts.findUnique({ where: { uuid: ref }, select: { id: true } });
      if (!entity) throw ApiError.notFound("Record not found");

      const logs = await commissionService.getAuditTrail(type, entity.id);
      return apiSuccess(
        logs.map((l) => ({
          id: String(l.id),
          action: l.action,
          fromStatus: l.from_status,
          toStatus: l.to_status,
          actorRole: l.actor_role,
          note: l.note,
          createdAt: l.created_at.toISOString(),
        }))
      );
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN", "STAFF"] }
);
