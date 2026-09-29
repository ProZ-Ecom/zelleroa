import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { purchaseService } from "@/features/purchases/services/purchase.service";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const search = (context.query?.search as string | undefined) || undefined;
      const options = await purchaseService.searchProducts(search);
      return apiSuccess(options, "Products fetched successfully");
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN", "STAFF"] }
);
