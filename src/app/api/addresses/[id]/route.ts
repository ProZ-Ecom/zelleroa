import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiFromError } from "@/lib/api/api-response";
import { addressService } from "@/features/addresses/services/address.service";
import { updateAddressSchema } from "@/features/addresses/validations/address.schema";
import type { UpdateAddressSchemaInput } from "@/features/addresses/validations/address.schema";

function getUserId(context: { session?: { user?: unknown } | null }) {
  const id = parseInt((context.session?.user as { id?: string })?.id ?? "0");
  if (!id) {
    throw new Error("Unauthorized");
  }
  return id;
}

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      try {
        const userId = getUserId(context);
        const id = parseInt(context.params?.id ?? "0", 10);
        const address = await addressService.getAddress(userId, id);
        return apiSuccess(address, "Address fetched successfully");
      } catch (error) {
        return apiFromError(error);
      }
    },
  },
  { requireAuth: true, requiredRole: ["CUSTOMER", "AGENT"] }
);

export const PUT = createApiHandler(
  {
    PUT: async (_request, context) => {
      try {
        const userId = getUserId(context);
        const id = parseInt(context.params?.id ?? "0", 10);
        const body = context.body as UpdateAddressSchemaInput;
        const address = await addressService.updateAddress(userId, id, body);
        return apiSuccess(address, "Address updated successfully");
      } catch (error) {
        return apiFromError(error);
      }
    },
  },
  { requireAuth: true, requiredRole: ["CUSTOMER", "AGENT"], bodySchema: updateAddressSchema }
);

export const DELETE = createApiHandler(
  {
    DELETE: async (_request, context) => {
      try {
        const userId = getUserId(context);
        const id = parseInt(context.params?.id ?? "0", 10);
        const result = await addressService.deleteAddress(userId, id);
        return apiSuccess(result, "Address deleted successfully");
      } catch (error) {
        return apiFromError(error);
      }
    },
  },
  { requireAuth: true, requiredRole: ["CUSTOMER", "AGENT"] }
);
