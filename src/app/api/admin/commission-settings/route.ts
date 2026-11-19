import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { db } from "@/lib/db/prisma";
import { AUTO_APPROVE_SETTING_KEY, RETURN_PERIOD_SETTING_KEY } from "@/features/agents/constants";
import { getAutoApprove, getReturnPeriodDays } from "@/features/agents/services/commission.service";
import { writeAudit } from "@/features/agents/services/commission-audit";
import { commissionSettingsSchema } from "@/features/agents/validations/agent.schema";
import { resolveActor } from "@/features/agents/lib/api-helpers";
import type { z } from "zod";

export const GET = createApiHandler(
  {
    GET: async () =>
      apiSuccess({
        returnPeriodDays: await getReturnPeriodDays(),
        autoApprove: await getAutoApprove(),
      }),
  },
  { requireAuth: true, requiredRole: ["ADMIN", "STAFF"] }
);

export const PUT = createApiHandler(
  {
    PUT: async (_request, context) => {
      const { days, autoApprove } = context.body as z.infer<typeof commissionSettingsSchema>;
      const actor = await resolveActor(context.session);
      const previousDays = await getReturnPeriodDays();
      const previousAuto = await getAutoApprove();

      await db.$transaction(async (tx) => {
        if (days !== undefined) {
          await tx.settings.upsert({
            where: { key_name: RETURN_PERIOD_SETTING_KEY },
            update: { value: String(days), updated_by: actor.id },
            create: {
              key_name: RETURN_PERIOD_SETTING_KEY,
              value: String(days),
              type: "number",
              created_by: actor.id,
            },
          });
          await writeAudit(tx, {
            entityType: "rate",
            entityId: BigInt(0),
            action: "return_period_updated",
            actor,
            metadata: { from: previousDays, to: days },
          });
        }
        if (autoApprove !== undefined) {
          await tx.settings.upsert({
            where: { key_name: AUTO_APPROVE_SETTING_KEY },
            update: { value: autoApprove ? "true" : "false", updated_by: actor.id },
            create: {
              key_name: AUTO_APPROVE_SETTING_KEY,
              value: autoApprove ? "true" : "false",
              type: "boolean",
              created_by: actor.id,
            },
          });
          await writeAudit(tx, {
            entityType: "rate",
            entityId: BigInt(0),
            action: "commission_auto_approve_updated",
            actor,
            metadata: { from: previousAuto, to: autoApprove },
          });
        }
      });

      const messages: string[] = [];
      if (days !== undefined) messages.push("Return period updated. It applies to orders delivered from now on.");
      if (autoApprove !== undefined) {
        messages.push(
          autoApprove
            ? "Commissions will be approved automatically once the return period ends."
            : "Commissions will wait for admin approval after the return period."
        );
      }

      return apiSuccess(
        {
          returnPeriodDays: days ?? previousDays,
          autoApprove: autoApprove ?? previousAuto,
        },
        messages.join(" ")
      );
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN"], bodySchema: commissionSettingsSchema }
);
