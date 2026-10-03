import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiFromError } from "@/lib/api/api-response";
import { addressService } from "@/features/addresses/services/address.service";
import { createAddressSchema } from "@/features/addresses/validations/address.schema";
import type { CreateAddressSchemaInput } from "@/features/addresses/validations/address.schema";

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
        const addresses = await addressService.getAddresses(userId);
        return apiSuccess(addresses, "Addresses fetched successfully");
      } catch (error) {
        return apiFromError(error);
      }
    },
  },
  { requireAuth: true, requiredRole: ["CUSTOMER", "AGENT"] }
);

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      try {
        const userId = getUserId(context);
        const body = context.body as CreateAddressSchemaInput;
        const address = await addressService.createAddress(userId, body);
        return apiSuccess(address, "Address created successfully", 201);
      } catch (error) {
        return apiFromError(error);
      }
    },
  },
  { requireAuth: true, requiredRole: ["CUSTOMER", "AGENT"], bodySchema: createAddressSchema }
);
