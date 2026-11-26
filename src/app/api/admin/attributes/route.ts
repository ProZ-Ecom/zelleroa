import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiCreated } from "@/lib/api/api-response";
import { attributeService } from "@/features/attributes/services/attribute.service";
import {
  createAdminAttributeSchema,
  adminAttributesQuerySchema,
  type CreateAdminAttributeInput,
  type AdminAttributesQueryInput,
} from "@/features/attributes/validations/admin-attribute.schema";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const query = context.query as AdminAttributesQueryInput;
      const result = await attributeService.getAdminAttributes({
        page: query?.page ?? 1,
        pageSize: query?.pageSize ?? 10,
        search: query?.search,
        type: query?.type,
        multipleSelection: query?.multipleSelection,
      });

      return apiSuccess(result.data, "Attributes fetched successfully", 200, result.meta);
    },
  },
  {
    requireAuth: true,
    requiredRole: ["ADMIN"],
    querySchema: adminAttributesQuerySchema,
  }
);

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const body = context.body as CreateAdminAttributeInput;
      const adminEmail = context.session?.user?.email ?? undefined;

      const attribute = await attributeService.createAdminAttribute(body, adminEmail);

      return apiCreated(attribute, "Attribute created successfully");
    },
  },
  {
    method: "POST",
    requireAuth: true,
    requiredRole: ["ADMIN"],
    bodySchema: createAdminAttributeSchema,
  }
);
