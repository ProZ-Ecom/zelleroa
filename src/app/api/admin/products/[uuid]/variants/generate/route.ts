import { createApiHandler } from "@/lib/api/api-handler";
import { apiCreated } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { variantService } from "@/features/variants/services/variant.service";
import { styleService } from "@/features/styles/services/style.service";
import {
  generateVariantsSchema,
  type GenerateVariantsInput,
} from "@/features/variants/validations/admin-variant.schema";

// Legacy Product-scoped shim: resolves the Product's default Style, which is
// what a variant hangs off now.

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const productUuid = context.params?.uuid;
      if (!productUuid) {
        throw ApiError.badRequest("Product UUID is required");
      }

      const body = context.body as GenerateVariantsInput;
      const adminEmail = context.session?.user?.email ?? undefined;
      const styleUuid = await styleService.resolveDefaultStyleUuid(productUuid);

      const result = await variantService.generateVariants(styleUuid, body, adminEmail);

      return apiCreated(
        result,
        result.created > 0
          ? `Successfully created ${result.created} item${result.created === 1 ? "" : "s"}.`
          : result.skipped > 0
            ? "Selected combination(s) already exist."
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
