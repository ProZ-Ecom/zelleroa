import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { variantService } from "@/features/variants/services/variant.service";
import {
  previewGenerateVariantsSchema,
  type PreviewGenerateVariantsInput,
} from "@/features/variants/validations/admin-variant.schema";

/**
 * Dry run for POST .../variants/generate - returns what would be added, and
 * which existing Colors/Sizes fall outside the current attribute-value
 * selection, without writing anything. The admin confirms removals separately
 * via POST .../variants/removals.
 */
export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const styleUuid = context.params?.styleUuid;
      if (!styleUuid) {
        throw ApiError.badRequest("Style UUID is required");
      }

      const body = context.body as PreviewGenerateVariantsInput;
      const preview = await variantService.previewGenerateVariants(styleUuid, body.options);

      return apiSuccess(preview, "Variant generation preview computed successfully");
    },
  },
  {
    method: "POST",
    requireAuth: true,
    requiredRole: ["ADMIN"],
    bodySchema: previewGenerateVariantsSchema,
  }
);
