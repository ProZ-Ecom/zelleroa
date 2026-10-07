import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { db } from "@/lib/db/prisma";
import { requireSessionAgent } from "@/features/agents/lib/api-helpers";

/** Sellable SKUs for the agent's order form. Display only - the order itself is always re-priced server-side. */
export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      await requireSessionAgent(context.session);
      const term = (context.searchParams?.get("search") ?? "").trim().slice(0, 80);
      if (term.length < 2) return apiSuccess([], "Success");
      const rows = await db.variantUnitPrice.findMany({
        where: {
          isActive: true,
          deleted_at: null,
          inventories: { is: { quantity_available: { gt: 0 } } },
          variant: {
            is: {
              isActive: true,
              deleted_at: null,
              item: { is: { isActive: true, deleted_at: null, style: { is: { product: { is: { isActive: true, deleted_at: null } } } } } },
            },
          },
          OR: [
            { sku: { contains: term } },
            { variant: { is: { variant_name: { contains: term } } } },
            { variant: { is: { item: { is: { style: { is: { product: { is: { name: { contains: term } } } } } } } } } },
          ],
        },
        select: {
          uuid: true,
          sku: true,
          base_price: true,
          unit_value: true,
          product_units: { select: { code: true, name: true } },
          attribute_value: { select: { value: true } },
          inventories: { select: { quantity_available: true } },
          variant: { select: { variant_name: true, item: { select: { style: { select: { product: { select: { name: true } } } } } } } },
        },
        take: 20,
      });
      return apiSuccess(
        rows.map((r) => ({
          id: r.uuid,
          sku: r.sku,
          productName: r.variant.item.style.product.name,
          variantName: r.variant.variant_name,
          size: r.attribute_value?.value ?? (Number(r.unit_value) > 0 ? `${Number(r.unit_value)} ${r.product_units.code || r.product_units.name}` : null),
          price: Number(r.base_price),
          available: r.inventories?.quantity_available ?? 0,
        })),
        "Success"
      );
    },
  },
  { requireAuth: true, requiredRole: ["AGENT"] }
);
