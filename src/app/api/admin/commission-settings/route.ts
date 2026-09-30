import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { db } from "@/lib/db/prisma";
import { RETURN_PERIOD_SETTING_KEY } from "@/features/agents/constants";
import { getReturnPeriodDays } from "@/features/agents/services/commission.service";
import { writeAudit } from "@/features/agents/services/commission-audit";
import { returnPeriodSchema } from "@/features/agents/validations/agent.schema";
import { resolveActor } from "@/features/agents/lib/api-helpers";
import type { z } from "zod";

export const GET = createApiHandler(
  { GET: async () => apiSuccess({ returnPeriodDays: await getReturnPeriodDays() }) },
  { requireAuth: true, requiredRole: ["ADMIN", "STAFF"] }
);

export const PUT = createApiHandler(
  {
    PUT: async (_request, context) => {
      const { days } = context.body as z.infer<typeof returnPeriodSchema>;
      const actor = await resolveActor(context.session);
      const previous = await getReturnPeriodDays();
      await db.$transaction(async (tx) => {
        await tx.settings.upsert({
          where: { key_name: RETURN_PERIOD_SETTING_KEY },
          update: { value: String(days), updated_by: actor.id },
          create: { key_name: RETURN_PERIOD_SETTING_KEY, value: String(days), type: "number", created_by: actor.id },
        });
        await writeAudit(tx, {
          entityType: "rate",
          entityId: BigInt(0),
          action: "return_period_updated",
          actor,
          metadata: { from: previous, to: days },
        });
      });
      return apiSuccess({ returnPeriodDays: days }, "Return period updated. It applies to orders delivered from now on.");
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN"], bodySchema: returnPeriodSchema }
);
