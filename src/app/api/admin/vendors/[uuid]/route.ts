import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { vendorService } from "@/features/purchases/services/vendor.service";
import { vendorSchema, type VendorInput } from "@/features/purchases/validations/purchase.schema";

const roles = ["ADMIN", "STAFF"];

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const vendor = await vendorService.get(context.params!.uuid);
      return apiSuccess(vendor, "Vendor fetched successfully");
    },
  },
  { requireAuth: true, requiredRole: roles }
);

export const PUT = createApiHandler(
  {
    PUT: async (_request, context) => {
      const vendor = await vendorService.update(
        context.params!.uuid,
        context.body as VendorInput,
        context.session?.user?.email
      );
      return apiSuccess(vendor, "Vendor updated successfully");
    },
  },
  { method: "PUT", requireAuth: true, requiredRole: roles, bodySchema: vendorSchema.partial() }
);

export const DELETE = createApiHandler(
  {
    DELETE: async (_request, context) => {
      const result = await vendorService.remove(
        context.params!.uuid,
        context.session?.user?.email
      );
      return apiSuccess(null, result.message);
    },
  },
  { method: "DELETE", requireAuth: true, requiredRole: ["ADMIN"] }
);
