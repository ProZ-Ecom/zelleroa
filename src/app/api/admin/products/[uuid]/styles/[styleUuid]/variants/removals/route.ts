import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { variantService } from "@/features/variants/services/variant.service";
import {
  applyVariantRemovalsSchema,
  type ApplyVariantRemovalsInput,
} from "@/features/variants/validations/admin-variant.schema";

/**
 * Applies removals the admin explicitly confirmed after reviewing
 * POST .../variants/generate/preview's toRemove list. Soft-deletes only.
 */
export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const styleUuid = context.params?.styleUuid;
      if (!styleUuid) {
        throw ApiError.badRequest("Style UUID is required");
      }

      const body = context.body as ApplyVariantRemovalsInput;
      const adminEmail = context.session?.user?.email ?? undefined;

      const result = await variantService.applyVariantRemovals(styleUuid, body, adminEmail);

      return apiSuccess(
        result,
        `${result.deactivatedVariants} color(s) and ${result.deactivatedUnitPrices} size(s) deactivated`
      );
    },
  },
  {
    method: "POST",
    requireAuth: true,
    requiredRole: ["ADMIN"],
    bodySchema: applyVariantRemovalsSchema,
  }
);
