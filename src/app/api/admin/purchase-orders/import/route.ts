import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { purchaseImportService } from "@/features/purchases/services/purchase-import.service";

const text = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
};

/** Validates an uploaded purchase Excel file and returns a preview. Nothing is saved here. */
export const POST = createApiHandler(
  {
    POST: async (request) => {
      let formData: FormData;
      try {
        formData = await request.formData();
      } catch {
        throw ApiError.badRequest("Content-Type must be multipart/form-data");
      }
      const file = formData.get("file");
      if (!(file instanceof File)) throw ApiError.badRequest("Attach an Excel file in the \"file\" field");

      const vendorId = text(formData, "vendorId");
      if (!vendorId) throw ApiError.badRequest("Select a vendor");
      const additionalCharges = text(formData, "additionalCharges") === "" ? 0 : Number(text(formData, "additionalCharges"));
      if (!Number.isFinite(additionalCharges) || additionalCharges < 0) {
        throw ApiError.badRequest("Additional charges must be 0 or more");
      }
      const notes = text(formData, "notes");
      if (notes.length > 500) throw ApiError.badRequest("Notes cannot exceed 500 characters");

      const preview = await purchaseImportService.preview(file, {
        vendorId,
        invoiceNumber: text(formData, "invoiceNumber"),
        purchaseDate: text(formData, "purchaseDate"),
        additionalCharges,
        notes: notes || null,
      });
      return apiSuccess(preview, "File checked");
    },
  },
  { method: "POST", requireAuth: true, requiredRole: ["ADMIN", "STAFF"], rateLimit: { limit: 20, windowMs: 60_000 } }
);
