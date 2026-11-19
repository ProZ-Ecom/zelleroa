import { createApiHandler } from "@/lib/api/api-handler";
import { apiCreated } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { variantService } from "@/features/variants/services/variant.service";
import {
  generateVariantsSchema,
  type GenerateVariantsInput,
} from "@/features/variants/validations/admin-variant.schema";

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const styleUuid = context.params?.styleUuid;
      if (!styleUuid) {
        throw ApiError.badRequest("Style UUID is required");
      }

      const body = context.body as GenerateVariantsInput;
      const adminEmail = context.session?.user?.email ?? undefined;

      const result = await variantService.generateVariants(styleUuid, body, adminEmail);

      return apiCreated(
        result,
        result.created > 0
          ? `Successfully created ${result.created} color variant${result.created === 1 ? "" : "s"}.`
          : result.skipped > 0
            ? "Selected color(s) already exist for this model."
            : "No new variants were created."
      );
    },
  },
  {
    method: "POST",
    requireAuth: true,
    requiredRole: ["ADMIN"],
    bodySchema: generateVariantsSchema,
  }
);
