import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { db } from "@/lib/db/prisma";
import { requireSessionAgent } from "@/features/agents/lib/api-helpers";

/** The signed-in agent's own saved delivery addresses, used when they place an order for themselves. */
export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const { agentId } = await requireSessionAgent(context.session);
      const rows = await db.customerAddress.findMany({
        where: { userId: agentId, is_active: true, deleted_at: null },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        select: { uuid: true, label: true, full_name: true, phone: true, address_line1: true, address_line2: true, city: true, state: true, pincode: true, isDefault: true },
      });
      return apiSuccess(
        rows.map((a) => ({
          id: a.uuid ?? "",
          label: a.label,
          fullName: a.full_name,
          phone: a.phone,
          line: [a.address_line1, a.address_line2, a.city, a.state, a.pincode].filter(Boolean).join(", "),
          isDefault: a.isDefault,
        })),
        "Success"
      );
    },
  },
  { requireAuth: true, requiredRole: ["AGENT"] }
);
