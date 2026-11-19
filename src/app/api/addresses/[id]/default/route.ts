import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiFromError } from "@/lib/api/api-response";
import { addressService } from "@/features/addresses/services/address.service";

export const PATCH = createApiHandler(
  {
    PATCH: async (_request, context) => {
      try {
        const userId = parseInt((context.session?.user as { id?: string })?.id ?? "0");
        if (!userId) return apiFromError(new Error("Unauthorized"));
        const id = parseInt(context.params?.id ?? "0", 10);
        const addresses = await addressService.setDefaultAddress(userId, id);
        return apiSuccess(addresses, "Default address updated");
      } catch (error) {
        return apiFromError(error);
      }
    },
  },
  { requireAuth: true, requiredRole: ["CUSTOMER", "AGENT"] }
);
