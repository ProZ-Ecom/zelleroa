import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { commissionRateService } from "@/features/agents/services/commission-rate.service";
import { upsertRateSchema } from "@/features/agents/validations/agent.schema";
import { resolveActor } from "@/features/agents/lib/api-helpers";
import type { z } from "zod";

export const GET = createApiHandler(
  { GET: async () => apiSuccess(await commissionRateService.list()) },
  { requireAuth: true, requiredRole: ["ADMIN", "STAFF"] }
);

export const PUT = createApiHandler(
  {
    PUT: async (_request, context) => {
      const actor = await resolveActor(context.session);
      const saved = await commissionRateService.upsert(context.body as z.infer<typeof upsertRateSchema>, actor);
      return apiSuccess(saved, "Commission rate saved. Existing commissions are not changed.");
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN"], bodySchema: upsertRateSchema }
);

export const DELETE = createApiHandler(
  {
    DELETE: async (_request, context) => {
      const id = context.searchParams?.get("id");
      if (!id) throw ApiError.badRequest("Rate id is required");
      const actor = await resolveActor(context.session);
      await commissionRateService.remove(id, actor);
      return apiSuccess(null, "Commission rate removed");
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN"] }
);
