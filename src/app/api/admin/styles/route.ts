import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiError } from "@/lib/api/api-response";
import { categoryRepository } from "@/features/categories/repositories/category.repository";
import { styleRepository } from "@/features/styles/repositories/style.repository";
import { adminStyleListQuerySchema, type AdminStyleListQueryInput } from "@/features/styles/validations/admin-style.schema";
import type { AdminStyleResponse } from "@/features/styles/types";
import { db } from "@/lib/db/prisma";

type StyleListRow = Awaited<ReturnType<typeof styleRepository.findAdminList>>["data"][number];

function formatStyleListRow(style: StyleListRow, categoryNames: Map<string, string>): AdminStyleResponse {
  // Brand lives on the Product now; older Items may still carry their own.
  const brand = style.brand ?? style.product?.brand ?? null;
  const primaryImgObj = style.images?.find((img) => img.is_primary) ?? style.images?.[0];

  const colorNames = new Set<string>();
  let totalStock = 0;

  for (const it of style.items ?? []) {
    for (const v of it.variants ?? []) {
      if (v.color_name && v.color_name.trim()) {
        colorNames.add(v.color_name.trim());
      }
      for (const vup of v.variant_unit_prices ?? []) {
        totalStock += vup.inventories?.quantity_available ?? 0;
      }
    }
  }

  // If the style was given the parent product's name (e.g. "pant" with "women_women-default"),
  // but a custom model item exists under it (e.g. "palloza"), display the custom model name/slug.
  const productNameLower = (style.product?.name || "").trim().toLowerCase();
  const customModelItem = (style.items as any[])?.find(
    (it) => it.name && it.name.trim().toLowerCase() !== productNameLower
  );

  const modelName =
    customModelItem && style.name.trim().toLowerCase() === productNameLower
      ? customModelItem.name
      : style.name;

  const modelSlug =
    customModelItem && style.name.trim().toLowerCase() === productNameLower
      ? customModelItem.slug || style.slug
      : style.slug;

  const modelPrice =
    customModelItem && customModelItem.base_price && Number(customModelItem.base_price) > 0
      ? Number(customModelItem.base_price)
      : Number(style.base_price ?? 0);

  return {
    id: style.uuid,
    productId: style.product?.uuid ?? String(style.productId),
    productName: style.product?.name ?? "",
    productSlug: style.product?.slug ?? "",
    categoryId: style.product?.categoryId ? String(style.product.categoryId) : null,
    categoryName: style.product?.categoryId
      ? categoryNames.get(String(style.product.categoryId)) ?? null
      : null,
    brandId: brand?.uuid ?? null,
    brandName: brand?.name ?? null,
    name: modelName,
    slug: modelSlug,
    sku: style.sku,
    shortDescription: style.short_description,
    description: style.description,
    ingredients: style.ingredients,
    isReadyToMix: Boolean(style.is_ready_to_mix),
    cookingRecipe: style.cooking_recipe,
    shelfLife: style.shelf_life,
    vegType: (style.veg_type as AdminStyleResponse["vegType"]) || "na",
    basePrice: modelPrice,
    isFeatured: Boolean(style.is_featured),
    isNewArrival: Boolean(style.is_new_arrival),
    newArrivalUntil: style.new_arrival_until ? style.new_arrival_until.toISOString().slice(0, 10) : null,
    isDefault: Boolean(style.is_default),
    isActive: Boolean(style.isActive),
    outOfStock: Boolean(style.out_of_stock),
    primaryImage: primaryImgObj ? primaryImgObj.image_url : null,
    itemCount: style._count?.items ?? 0,
    totalStock,
    colors: Array.from(colorNames),
    createdAt: style.createdAt,
    updatedAt: style.updatedAt,
  };
}

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      // STAFF users need the MODELS_VIEW permission to access the Model Management list.
      // ADMIN users always have full access.
      const rawRole = (context.session?.user as { role?: string })?.role;
      const userRole = rawRole?.toUpperCase();
      if (userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
        const hasPermission = await db.rolePermission.findFirst({
          where: {
            role: {
              OR: [
                ...(userRole ? [{ name: userRole }] : []),
                ...(rawRole ? [{ name: rawRole }, { slug: rawRole.toLowerCase() }] : []),
              ],
            },
            permission: {
              OR: [
                { name: "MODELS_VIEW" },
                { slug: "models-view" },
              ],
            },
          },
        });
        if (!hasPermission) {
          return apiError("You don't have permission", 403);
        }
      }

      const query = context.query as AdminStyleListQueryInput & {
        productId?: string;
        categoryId?: string;
      };

      const result = await styleRepository.findAdminList({
        page: query?.page ?? 1,
        pageSize: query?.pageSize ?? 20,
        search: query?.search,
        isActive: query?.isActive,
        productId: query?.productId,
        categoryId: query?.categoryId,
      });

      const categoryIds = [
        ...new Set(
          result.data.flatMap((s) => (s.product?.categoryId ? [s.product.categoryId] : []))
        ),
      ];
      const categoryNames = new Map<string, string>();
      await Promise.all(
        categoryIds.map(async (id) => {
          const category = await categoryRepository.findById(id);
          if (category?.name) categoryNames.set(String(id), category.name);
        })
      );

      return apiSuccess(
        result.data.map((s) => formatStyleListRow(s, categoryNames)),
        "Styles fetched successfully",
        200,
        result.meta
      );
    },
  },
  {
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    querySchema: adminStyleListQuerySchema,
  }
);
