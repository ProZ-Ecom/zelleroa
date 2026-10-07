import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { db } from "@/lib/db/prisma";
import { requireSessionAgent } from "@/features/agents/lib/api-helpers";
import { findAssignedCustomer } from "@/features/agents/services/customer-assignment.service";

/** Saved delivery addresses of a customer assigned to THIS agent (403/404 for anyone else's customer). */
export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const { agentId } = await requireSessionAgent(context.session);
      const customer = await findAssignedCustomer(agentId, context.params?.uuid ?? "");
      if (!customer) throw ApiError.notFound("Customer not found");
      const rows = await db.customerAddress.findMany({
        where: { userId: customer.id, is_active: true, deleted_at: null },
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
