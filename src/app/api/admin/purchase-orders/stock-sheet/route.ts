import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-handler";
import { db } from "@/lib/db/prisma";
import { buildStockSheet, stockSheetFileName } from "@/features/purchases/services/stock-sheet.service";
import {
  stockSheetQuerySchema,
  type StockSheetFilters,
} from "@/features/purchases/validations/purchase.schema";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Downloads the stock sheet for a selection of the catalogue: one row per SKU
 * with its identity and current figures filled in, ready for the admin to enter
 * what arrived. Reads nothing back and changes nothing.
 */
export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const filters = context.query as unknown as StockSheetFilters;
      const buffer = await buildStockSheet(filters);

      const vendor = filters.vendorId
        ? await db.vendors.findFirst({
            where: { uuid: filters.vendorId },
            select: { code: true },
          })
        : null;

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": XLSX,
          "Content-Disposition": `attachment; filename="${stockSheetFileName(vendor?.code ?? null)}"`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    },
  },
  {
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    querySchema: stockSheetQuerySchema,
    rateLimit: { limit: 20, windowMs: 60_000 },
  }
);
