import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiCreated } from "@/lib/api/api-response";
import { unitService } from "@/features/units/services/unit.service";
import {
  createAdminUnitSchema,
  adminUnitsQuerySchema,
  type CreateAdminUnitInput,
  type AdminUnitsQueryInput,
} from "@/features/units/validations/admin-unit.schema";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const query = context.query as AdminUnitsQueryInput;
      const result = await unitService.getAdminUnits({
        page: query?.page ?? 1,
        pageSize: query?.pageSize ?? 10,
        search: query?.search,
        type: query?.type,
      });

      return apiSuccess(result.data, "Units fetched successfully", 200, result.meta);
    },
  },
  {
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    querySchema: adminUnitsQuerySchema,
  }
);

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const body = context.body as CreateAdminUnitInput;
      const adminEmail = context.session?.user?.email ?? undefined;

      const unit = await unitService.createAdminUnit(body, adminEmail);

      return apiCreated(unit, "Unit created successfully");
    },
  },
  {
    method: "POST",
    requireAuth: true,
    requiredRole: ["ADMIN"],
    bodySchema: createAdminUnitSchema,
  }
);
