import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { contactService } from "@/features/contact/services/contact.service";
import {
  createContactSchema,
  type CreateContactInput,
} from "@/features/contact/validations/contact.schema";

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const body = context.body as CreateContactInput;
      const result = await contactService.submitContactMessage(body);

      return apiSuccess(
        result,
        "Inquiry submitted successfully!",
        201
      );
    },
  },
  {
    requireAuth: false,
    bodySchema: createContactSchema,
  }
);
