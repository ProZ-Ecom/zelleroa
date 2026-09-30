import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiCreated } from "@/lib/api/api-response";
import { vendorService } from "@/features/purchases/services/vendor.service";
import {
  vendorSchema,
  vendorsQuerySchema,
  type VendorInput,
} from "@/features/purchases/validations/purchase.schema";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const query = (context.query ?? {}) as { page?: number; pageSize?: number; search?: string };
      const result = await vendorService.list({
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 10,
        search: query.search,
      });
      return apiSuccess(result.data, "Vendors fetched successfully", 200, result.meta);
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN", "STAFF"], querySchema: vendorsQuerySchema }
);

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const vendor = await vendorService.create(
        context.body as VendorInput,
        context.session?.user?.email
      );
      return apiCreated(vendor, "Vendor created successfully");
    },
  },
  { method: "POST", requireAuth: true, requiredRole: ["ADMIN", "STAFF"], bodySchema: vendorSchema }
);
