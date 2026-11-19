import { createApiHandler } from "@/lib/api/api-handler";
import { apiCreated } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { variantService } from "@/features/variants/services/variant.service";
import {
  generateVariantsFromStyleSchema,
  type GenerateVariantsFromStyleInput,
} from "@/features/variants/validations/admin-variant.schema";

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const styleUuid = context.params?.styleUuid;
      if (!styleUuid) {
        throw ApiError.badRequest("Style UUID is required");
      }

      const body = context.body as GenerateVariantsFromStyleInput;
      const adminEmail = context.session?.user?.email ?? undefined;

      const result = await variantService.generateVariantsFromStyleAttributeValues(
        styleUuid,
        body,
        adminEmail
      );

      return apiCreated(
        result,
        `${result.created} color${result.created === 1 ? "" : "s"} created${
          result.skipped > 0
            ? `, ${result.skipped} combination(s) skipped (already existed, or not allowed by a configured attribute dependency rule)`
            : ""
        }`
      );
    },
  },
  {
    method: "POST",
    requireAuth: true,
    requiredRole: ["ADMIN"],
    bodySchema: generateVariantsFromStyleSchema,
  }
);
