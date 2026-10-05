import { db } from "@/lib/db/prisma";
import type { PaginationMeta } from "@/lib/api/api-response";
import type { Prisma } from "@/generated/prisma";
import {
  formatVariantMeasurement,
  formatMeasurementLabel,
} from "@/features/variants/utils/measurement.util";
import type {
  CustomerBrandListInput,
  CustomerCategoryListInput,
  CustomerProductListInput,
  CustomerVariantListInput,
  CustomerGlobalVariantListInput,
  CustomerRelatedVariantsQueryInput,
} from "../validations/catalog.schema";
import type {
  CustomerBrandDto,
  CustomerCategoryDto,
  CustomerProductListItemDto,
  CustomerProductDetailDto,
  CustomerVariantListItemDto,
  CustomerVariantDetailDto,
  CustomerVariantImageDto,
  CustomerVariantUnitPriceDto,
  CustomerItemDto,
  CustomerRelatedVariantDto,
  CustomerStyleDetailDto,
  CustomerStyleItemDto,
  CustomerItemDetailDto,
} from "../types/catalog.types";

const brandSelect = { id: true, uuid: true, name: true } as const;

type BrandRow = { id: bigint; uuid: string | null; name: string };

/**
 * A brand is chosen per Item (`styles.brand_id`); `products.brand_id` is only
 * the legacy fallback for rows created before brands moved down a level. The
 * first non-null brand wins, so callers pass the Item's brand before the
 * Product's.
 */
function toBrandDto(...brands: Array<BrandRow | null | undefined>): { id: string; name: string } | null {
  const brand = brands.find((b): b is BrandRow => Boolean(b));
  return brand ? { id: brand.uuid || String(brand.id), name: brand.name } : null;
}

/**
 * Matches Items of the given brands: the Item's own brand, or - for Items with
 * no brand of their own - the Product's.
 */
function styleBrandWhere(brandIds: bigint[]): Prisma.StyleWhereInput {
  return {
    OR: [
      { brandId: { in: brandIds } },
      { brandId: null, product: { brandId: { in: brandIds } } },
    ],
  };
}

/**
 * Selling price is not stored on the unit price row - it is basePrice minus
 * any active offer/discount, computed here at read time. No offer/discount
 * engine is wired up for the storefront yet, so this currently returns
 * basePrice unchanged. When one exists, apply it here so every price shown
 * to customers (list, detail, cart, wishlist) flows through this single
 * function instead of reading base_price directly.
 */
/**
 * The repository deals in catalog prices only. Offers are applied one layer
 * up, in `catalogOffers`, because resolving them needs a database round trip
 * and is done once per page of results rather than once per row.
 */
function computeSellingPrice(basePrice: number): number {
  return basePrice;
}

// Unit prices are always loaded with this shape when we need to derive a
// variant's display sku/price/measurement (the storefront still shows one
// price per variant - the default unit price - since cart/wishlist/orders
// key off the item-level variant, not a specific unit price).
const unitPriceListArgs = {
  where: { deleted_at: null, isActive: true },
  include: {
    product_units: {
      select: { id: true, uuid: true, name: true, code: true, type: true },
    },
    inventories: {
      select: { quantity_available: true },
    },
    // The Size leaf: admins split a Color into Sizes by pointing each unit
    // price row at a Size attribute value (S/M/L/XL). Catalogs that still use
    // this table for pack sizes leave it null and fall back to `measurement`.
    attribute_value: {
      select: { uuid: true, value: true },
    },
  },
  orderBy: [{ is_default: "desc" as const }, { createdAt: "asc" as const }],
};

type VariantUnitPriceForDto = {
  uuid: string;
  sku: string;
  base_price: Prisma.Decimal | number;
  unit_value: Prisma.Decimal | number;
  is_default: boolean;
  product_units: { id: bigint; uuid: string | null; name: string; code: string; type: string } | null;
  inventories?: { quantity_available: number } | null;
  attribute_value?: { uuid: string | null; value: string } | null;
};

function pickDefaultUnitPrice(
  unitPrices: VariantUnitPriceForDto[] | null | undefined
): VariantUnitPriceForDto | null {
  if (!unitPrices || unitPrices.length === 0) return null;
  return unitPrices.find((up) => up.is_default) ?? unitPrices[0];
}

function toVariantListItemDto(
  variant: {
    id: bigint;
    uuid: string;
    variant_name: string | null;
    color_name?: string | null;
    color_hex?: string | null;
    out_of_stock?: boolean;
    variant_unit_prices?: VariantUnitPriceForDto[] | null;
    product_variant_images?: Array<{
      id?: bigint;
      uuid?: string | null;
      image_url: string;
      sort_order?: number;
      is_primary?: boolean;
    }> | null;
    variant_attribute_values?: Array<{
      product_attributes: { name: string };
      attribute_values: { uuid: string | null; value: string };
    }> | null;
  },
  itemUuid: string,
  itemName: string
): CustomerVariantListItemDto {
  const defaultUnitPrice = pickDefaultUnitPrice(variant.variant_unit_prices);

  const unitPrices: CustomerVariantUnitPriceDto[] = (
    variant.variant_unit_prices || []
  ).map((up) => {
    const basePrice = Number(up.base_price);
    const stock = up.inventories?.quantity_available ?? 0;
    const measurement = formatVariantMeasurement(up.product_units, up.unit_value ?? 0);
    const sizeLabel = up.attribute_value?.value ?? null;
    return {
      id: up.uuid,
      sku: up.sku,
      measurement,
      sizeId: up.attribute_value?.uuid ?? null,
      sizeLabel,
      label: sizeLabel || formatMeasurementLabel(measurement),
      basePrice,
      sellingPrice: computeSellingPrice(basePrice),
      isDefault: Boolean(up.is_default),
      stock,
      inStock: stock > 0,
    };
  });

  const images = (variant.product_variant_images || []).map((img, idx) => ({
    id: img.uuid || (img.id !== undefined ? String(img.id) : String(idx)),
    imageUrl: img.image_url,
    sortOrder: img.sort_order ?? idx,
    isPrimary: Boolean(img.is_primary),
  }));

  return {
    id: variant.uuid || String(variant.id),
    itemId: itemUuid,
    itemName,
    productId: itemUuid,
    productName: itemName,
    variantName: variant.variant_name || "",
    measurement: formatVariantMeasurement(
      defaultUnitPrice?.product_units,
      defaultUnitPrice?.unit_value ?? 0
    ),
    sku: defaultUnitPrice?.sku ?? "",
    basePrice: defaultUnitPrice ? Number(defaultUnitPrice.base_price) : 0,
    // Selling price is not stored - it is basePrice minus any active
    // offer/discount (see computeSellingPrice). Mirrored here for callers
    // that still read `salePrice` directly instead of `unitPrices`.
    salePrice: defaultUnitPrice
      ? computeSellingPrice(Number(defaultUnitPrice.base_price))
      : 0,
    primaryImage: images[0]?.imageUrl ?? variant.product_variant_images?.[0]?.image_url ?? null,
    colorName: variant.color_name ?? null,
    colorHex: variant.color_hex ?? null,
    images,
    outOfStock: Boolean(variant.out_of_stock),
    unitPrices,
    attributeValues: (variant.variant_attribute_values || []).map((vav) => ({
      attributeName: vav.product_attributes.name,
      valueId: vav.attribute_values.uuid || "",
      value: vav.attribute_values.value,
    })),
  };
}

/**
 * Maps one Style row - with its admin-only Items pre-loaded - to the
 * customer-facing DTO. The Items are never exposed: their Color variants are
 * flattened into a single list here, tagging each with the Style's own
 * id/name so cards and the detail page group entirely by Style.
 */
function toStyleDto(
  style: {
    id: bigint;
    uuid: string;
    name: string;
    slug: string;
    short_description: string | null;
    description: string | null;
    ingredients: string | null;
    is_ready_to_mix: boolean;
    cooking_recipe: string | null;
    shelf_life: string | null;
    veg_type: string;
    is_default: boolean;
    images?: Array<{ uuid: string | null; image_url: string; sort_order: number; is_primary: boolean }> | null;
    items: Array<{
      is_default: boolean;
      variants: Array<Parameters<typeof toVariantListItemDto>[0]>;
    }>;
  },
  productUuid: string,
  productName: string
): CustomerItemDto {
  const styleUuid = style.uuid || String(style.id);
  const images = (style.images || []).map((img, idx) => ({
    id: img.uuid || String(idx),
    imageUrl: img.image_url,
    sortOrder: img.sort_order ?? idx,
    isPrimary: Boolean(img.is_primary),
  }));

  // Flatten every admin Item's Color variants into one list, default Item
  // first, so a customer never has to pick an Item to see all the Colors.
  const orderedItems = [...style.items].sort((a, b) => Number(b.is_default) - Number(a.is_default));
  const variants = orderedItems.flatMap((it) => it.variants);

  return {
    id: styleUuid,
    productId: productUuid,
    productName,
    name: style.name,
    slug: style.slug,
    shortDescription: style.short_description,
    description: style.description,
    ingredients: style.ingredients,
    isReadyToMix: Boolean(style.is_ready_to_mix),
    cookingRecipe: style.cooking_recipe,
    shelfLife: style.shelf_life,
    vegType: (style.veg_type as CustomerItemDto["vegType"]) || "na",
    isDefault: Boolean(style.is_default),
    images,
    variants: variants.map((v) => toVariantListItemDto(v, styleUuid, style.name)),
  };
}

/**
 * One Item under a Style, as the storefront sees it: its Colors, each Color's
 * own images/Sizes/prices/stock, and the price range and stock flags derived
 * from them. Shared by the Style detail page (which maps every Item through
 * it) and the standalone Item page.
 */
function toStyleItemDto(
  item: {
    id: bigint;
    uuid: string | null;
    name: string;
    slug: string;
    short_description: string | null;
    description: string | null;
    is_default: boolean;
    out_of_stock: boolean;
    base_price: Prisma.Decimal | number;
    variants: Array<Parameters<typeof toVariantListItemDto>[0]>;
    item_attribute_values?: Array<{
      product_attributes: { name: string };
      attribute_values: { uuid: string | null; value: string };
    }> | null;
  },
  styleUuid: string,
  styleImages: CustomerVariantImageDto[]
): CustomerStyleItemDto {
  const itemUuid = item.uuid || String(item.id);
  const colors = item.variants.map((v) => toVariantListItemDto(v, itemUuid, item.name));

  const prices = colors.flatMap((c) => c.unitPrices.map((up) => up.basePrice));
  // The Item falls back to its default Color's gallery until a Color is
  // picked; an Item with no Color rows at all falls back to the Style's.
  const fallbackImages = colors.find((c) => c.images.length > 0)?.images ?? styleImages;

  return {
    id: itemUuid,
    styleId: styleUuid,
    name: item.name,
    slug: item.slug,
    shortDescription: item.short_description,
    description: item.description,
    isDefault: Boolean(item.is_default),
    outOfStock: Boolean(item.out_of_stock),
    image: fallbackImages[0]?.imageUrl ?? null,
    images: fallbackImages,
    minPrice: prices.length > 0 ? Math.min(...prices) : Number(item.base_price),
    maxPrice: prices.length > 0 ? Math.max(...prices) : Number(item.base_price),
    hasSizes: colors.some((c) => c.unitPrices.some((up) => up.sizeId !== null)),
    inStock:
      !item.out_of_stock &&
      colors.some((c) => !c.outOfStock && c.unitPrices.some((up) => up.inStock)),
    colors,
    attributes: (item.item_attribute_values || [])
      .filter((iav) => {
        // Color and Size are picked with their own selectors, so they never
        // belong in the generic extra-attributes list.
        const name = iav.product_attributes.name.trim().toLowerCase();
        return name !== "color" && name !== "colour" && name !== "size";
      })
      .map((iav) => ({
        attributeName: iav.product_attributes.name,
        valueId: iav.attribute_values.uuid || "",
        value: iav.attribute_values.value,
      })),
  };
}

/**
 * The Color/Size tree every Item carries, loaded identically for the Style
 * detail page and the standalone Item page so both render the same thing.
 * Colors with no priced Size row at all are filtered out - there would be
 * nothing to sell under them.
 */
const styleItemVariantsArgs = {
  where: {
    isActive: true,
    deleted_at: null,
    variant_unit_prices: {
      some: { deleted_at: null, isActive: true, base_price: { gt: 0 } },
    },
  },
  include: {
    product_variant_images: {
      where: { is_active: true },
      orderBy: [{ is_primary: "desc" as const }, { sort_order: "asc" as const }],
    },
    variant_unit_prices: unitPriceListArgs,
    variant_attribute_values: {
      include: {
        product_attributes: { select: { name: true } },
        attribute_values: { select: { uuid: true, value: true } },
      },
    },
  },
  orderBy: [{ is_default: "desc" as const }, { createdAt: "asc" as const }],
};

/**
 * Everything one Item needs on the storefront: its Colors (and their Sizes)
 * plus the Item's own extra attributes - Material, Fit, Pattern and the like,
 * which are properties of the Item itself rather than of any one Color.
 */
const styleItemIncludeArgs = {
  variants: styleItemVariantsArgs,
  item_attribute_values: {
    include: {
      product_attributes: { select: { name: true } },
      attribute_values: { select: { uuid: true, value: true } },
    },
  },
};

export const catalogRepository = {
  // ----------------------------------------------------
  // BRAND REPOSITORY METHODS
  // ----------------------------------------------------
  async findCustomerBrands(params: CustomerBrandListInput) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;

    const where: Prisma.ProductBrandWhereInput = {
      isActive: true,
      deleted_at: null,
      status: true,
    };

    if (params.search) {
      where.OR = [
        { name: { contains: params.search } },
        { description: { contains: params.search } },
      ];
    }

    const orderBy: Prisma.ProductBrandOrderByWithRelationInput =
      params.sortBy === "createdAt"
        ? { createdAt: params.sortOrder ?? "asc" }
        : { name: params.sortOrder ?? "asc" };

    const [brands, total] = await Promise.all([
      db.productBrand.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          produt_brand_images: {
            where: { is_active: true },
            take: 1,
          },
        },
      }),
      db.productBrand.count({ where }),
    ]);

    const data: CustomerBrandDto[] = brands.map((b) => ({
      id: b.uuid || String(b.id),
      name: b.name,
      image: b.produt_brand_images[0]?.image_url ?? null,
    }));

    return {
      data,
      meta: {
        page,
        limit: pageSize,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  async findCustomerBrandByUuid(uuid: string): Promise<CustomerBrandDto | null> {
    const brand = await db.productBrand.findFirst({
      where: {
        uuid,
        isActive: true,
        deleted_at: null,
        status: true,
      },
      include: {
        produt_brand_images: {
          where: { is_active: true },
          take: 1,
        },
      },
    });

    if (!brand) return null;

    return {
      id: brand.uuid || String(brand.id),
      name: brand.name,
      image: brand.produt_brand_images[0]?.image_url ?? null,
    };
  },

  // ----------------------------------------------------
  // CATEGORY REPOSITORY METHODS
  // ----------------------------------------------------
  async findCustomerCategories(params: CustomerCategoryListInput) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;

    const where: Prisma.ProductCategoryWhereInput = {
      isActive: true,
      deleted_at: null,
      status: true,
    };

    if (params.search) {
      where.OR = [
        { name: { contains: params.search } },
        { description: { contains: params.search } },
      ];
    }

    const orderBy: Prisma.ProductCategoryOrderByWithRelationInput =
      params.sortBy === "createdAt"
        ? { createdAt: params.sortOrder ?? "asc" }
        : { name: params.sortOrder ?? "asc" };

    const [categories, total] = await Promise.all([
      db.productCategory.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          product_category_images: {
            where: { is_active: true },
            take: 1,
          },
          parent: { select: { uuid: true } },
        },
      }),
      db.productCategory.count({ where }),
    ]);

    const data: CustomerCategoryDto[] = categories.map((c) => ({
      id: c.uuid || String(c.id),
      name: c.name,
      slug: c.slug,
      parentId: c.parent?.uuid ?? null,
      image: c.icon || c.product_category_images[0]?.image_url || null,
    }));

    return {
      data,
      meta: {
        page,
        limit: pageSize,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  async findCustomerCategoryByUuid(uuid: string): Promise<CustomerCategoryDto | null> {
    const category = await db.productCategory.findFirst({
      where: {
        uuid,
        isActive: true,
        deleted_at: null,
        status: true,
      },
      include: {
        product_category_images: {
          where: { is_active: true },
          take: 1,
        },
        parent: { select: { uuid: true } },
      },
    });

    if (!category) return null;

    return {
      id: category.uuid || String(category.id),
      name: category.name,
      slug: category.slug,
      parentId: category.parent?.uuid ?? null,
      image: category.icon || category.product_category_images[0]?.image_url || null,
    };
  },

  // ----------------------------------------------------
  // PRODUCT REPOSITORY METHODS
  // ----------------------------------------------------
  async findCustomerProducts(params: CustomerProductListInput) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;

    const where: Prisma.ProductWhereInput = {
      isActive: true,
      deleted_at: null,
    };

    // Filter by Brand UUIDs
    if (params.brandIds && params.brandIds.length > 0) {
      const matchingBrands = await db.productBrand.findMany({
        where: { uuid: { in: params.brandIds }, isActive: true, deleted_at: null },
        select: { id: true },
      });
      const brandIds = matchingBrands.map((b) => b.id);
      // Brand lives on the Item; the Product's brand only counts for Items
      // with none of their own - same rule the card label uses.
      where.AND = [{ styles: { some: { deleted_at: null, ...styleBrandWhere(brandIds) } } }];
    }

    // Filter by Category UUIDs
    if (params.categoryIds && params.categoryIds.length > 0) {
      const matchingCategories = await db.productCategory.findMany({
        where: { uuid: { in: params.categoryIds }, isActive: true, deleted_at: null },
        select: { id: true },
      });
      where.categoryId = { in: matchingCategories.map((c) => c.id) };
    }

    // Filter by Product UUIDs
    if (params.productIds && params.productIds.length > 0) {
      where.uuid = { in: params.productIds };
    }

    // Search filter
    if (params.search) {
      where.OR = [{ name: { contains: params.search } }];
    }

    // Filter by audience - a men's/women's/kids' filter also includes unisex
    // products, since those are designed to fit anyone.
    if (params.gender) {
      where.gender = params.gender === "unisex" ? "unisex" : { in: [params.gender, "unisex", "na"] };
    }

    // Variant-level filters (inStock, price range) - vegType lives on Item now.
    const variantWhere: Prisma.ProductVariantWhereInput = {
      isActive: true,
      deleted_at: null,
    };

    if (params.inStock !== undefined) {
      variantWhere.out_of_stock = !params.inStock;
    }

    if (params.vegType) {
      const mappedVegType =
        params.vegType === "non_veg" || params.vegType === "nonveg"
          ? ("nonveg" as const)
          : (params.vegType as "veg" | "vegan" | "na");
      variantWhere.item = { style: { veg_type: mappedVegType } };
    }

    const minProductP = params.minPrice ? Math.max(params.minPrice, 0.01) : 0.01;
    const maxProductP = params.maxPrice ?? Number.MAX_SAFE_INTEGER;
    variantWhere.variant_unit_prices = {
      some: {
        deleted_at: null,
        isActive: true,
        base_price: { gte: minProductP, lte: maxProductP },
      },
    };

    where.styles = { some: { deleted_at: null, items: { some: { deleted_at: null, variants: { some: variantWhere } } } } };

    let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: "desc" };
    if (params.sortBy === "name") {
      orderBy = { name: params.sortOrder ?? "asc" };
    } else if (params.sortBy === "createdAt") {
      orderBy = { createdAt: params.sortOrder ?? "desc" };
    }

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        orderBy: params.sortBy === "price" ? undefined : orderBy,
        ...(params.sortBy === "price" ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
        include: {
          brand: { select: brandSelect },
          images: {
            where: { is_active: true },
            orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
            take: 1,
          },
          styles: {
            where: { deleted_at: null },
            include: {
              brand: { select: brandSelect },
              items: {
                where: { deleted_at: null },
                include: {
                  variants: {
                    where: {
                      isActive: true,
                      deleted_at: null,
                      variant_unit_prices: {
                        some: {
                          deleted_at: null,
                          isActive: true,
                          base_price: { gt: 0 },
                        },
                      },
                    },
                    include: {
                      product_variant_images: {
                        where: { is_active: true },
                        orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
                        take: 1,
                      },
                      variant_unit_prices: unitPriceListArgs,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      db.product.count({ where }),
    ]);

    // Map each product & calculate minPrice/maxPrice across every style's items' variants' unit prices
    let items: CustomerProductListItemDto[] = products.map((p) => {
      const allVariants = p.styles.flatMap((s) => s.items.flatMap((i) => i.variants));
      const allPrices = allVariants.flatMap((v) =>
        (v.variant_unit_prices || []).map((up) => Number(up.base_price))
      );

      let minP = allPrices.length > 0 ? Math.min(...allPrices) : 0;
      let maxP = allPrices.length > 0 ? Math.max(...allPrices) : 0;

      // Resolve primary image from product.images or the first style's variant images
      let imgUrl: string | null = p.images[0]?.image_url ?? null;
      if (!imgUrl && allVariants.length > 0) {
        imgUrl = allVariants[0].product_variant_images[0]?.image_url ?? null;
      }

      const primaryItem = p.styles.find((s) => s.is_default) ?? p.styles[0] ?? null;
      const primaryVariant =
        allVariants.find((v) => v.is_default) ?? allVariants[0] ?? null;

      // Extract all active unit prices from the primary variant or variants with unit prices
      const variantWithPrices =
        allVariants.find((v) => (v.variant_unit_prices || []).length > 0) ?? primaryVariant;

      const unitPrices = (variantWithPrices?.variant_unit_prices || []).map((up) => {
        const basePrice = Number(up.base_price);
        const measurement = formatVariantMeasurement(up.product_units, up.unit_value ?? 0);
        return {
          id: up.uuid,
          label: formatMeasurementLabel(measurement) || "Standard",
          basePrice,
          sellingPrice: computeSellingPrice(basePrice),
        };
      });

      return {
        id: p.uuid || String(p.id),
        name: p.name,
        description:
          primaryItem?.short_description || primaryItem?.description || null,
        brand: toBrandDto(primaryItem?.brand, p.brand),
        category: null,
        image: imgUrl,
        minPrice: minP,
        maxPrice: maxP,
        unitPrices,
      };
    });

    // Populate category UUID/name if categoryId exists
    const categoryIds = products
      .map((p) => p.categoryId)
      .filter((id): id is bigint => id !== null && id !== undefined);

    if (categoryIds.length > 0) {
      const categories = await db.productCategory.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, uuid: true, name: true },
      });
      const catMap = new Map(categories.map((c) => [c.id.toString(), c]));

      products.forEach((p, idx) => {
        if (p.categoryId) {
          const cat = catMap.get(p.categoryId.toString());
          if (cat) {
            items[idx].category = {
              id: cat.uuid || String(cat.id),
              name: cat.name,
            };
          }
        }
      });
    }

    // Handle price sorting in JavaScript if requested
    if (params.sortBy === "price") {
      const isAsc = params.sortOrder === "asc";
      items.sort((a, b) => (isAsc ? a.minPrice - b.minPrice : b.minPrice - a.minPrice));
      items = items.slice((page - 1) * pageSize, page * pageSize);
    }

    return {
      data: items,
      meta: {
        page,
        limit: pageSize,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  /**
   * The storefront listing page shows one card per Style ("V Neck T-Shirt"),
   * never one per Item or per Color - a Style with 5 Items and a dozen Colors
   * between them still renders as exactly one card here.
   */
  async findCustomerStyleListItems(params: CustomerProductListInput) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;

    const where: Prisma.StyleWhereInput = {
      isActive: true,
      deleted_at: null,
      product: { isActive: true, deleted_at: null },
    };
    const productWhere = (): Prisma.ProductWhereInput =>
      (where.product as Prisma.ProductWhereInput) ?? {};

    if (params.productIds && params.productIds.length > 0) {
      where.product = { ...productWhere(), uuid: { in: params.productIds } };
    }

    if (params.brandIds && params.brandIds.length > 0) {
      const matchingBrands = await db.productBrand.findMany({
        where: { uuid: { in: params.brandIds }, isActive: true, deleted_at: null },
        select: { id: true },
      });
      where.AND = [styleBrandWhere(matchingBrands.map((b) => b.id))];
    }

    if (params.categoryIds && params.categoryIds.length > 0) {
      const matchingCategories = await db.productCategory.findMany({
        where: { uuid: { in: params.categoryIds }, isActive: true, deleted_at: null },
        select: { id: true },
      });
      where.product = { ...productWhere(), categoryId: { in: matchingCategories.map((c) => c.id) } };
    }

    if (params.search) {
      where.name = { contains: params.search };
    }

    if (params.gender) {
      where.product = {
        ...productWhere(),
        gender: params.gender === "unisex" ? "unisex" : { in: [params.gender, "unisex", "na"] },
      };
    }

    const minP = params.minPrice ? Math.max(params.minPrice, 0.01) : 0.01;
    const maxP = params.maxPrice ?? Number.MAX_SAFE_INTEGER;

    where.items = {
      some: {
        deleted_at: null,
        isActive: true,
        ...(params.inStock !== undefined ? { out_of_stock: !params.inStock } : {}),
        variants: {
          some: {
            isActive: true,
            deleted_at: null,
            variant_unit_prices: {
              some: { deleted_at: null, isActive: true, base_price: { gte: minP, lte: maxP } },
            },
          },
        },
      },
    };

    let orderBy: Prisma.StyleOrderByWithRelationInput = { createdAt: "desc" };
    if (params.sortBy === "name") {
      orderBy = { name: params.sortOrder ?? "asc" };
    } else if (params.sortBy === "createdAt") {
      orderBy = { createdAt: params.sortOrder ?? "desc" };
    }

    const isPriceSort = params.sortBy === "price";

    const [styles, total] = await Promise.all([
      db.style.findMany({
        where,
        orderBy: isPriceSort ? undefined : orderBy,
        ...(isPriceSort ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
        include: {
          product: {
            select: {
              id: true,
              uuid: true,
              name: true,
              categoryId: true,
              brand: { select: brandSelect },
            },
          },
          brand: { select: brandSelect },
          images: {
            where: { is_active: true },
            orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
            take: 1,
          },
          items: {
            where: { deleted_at: null, isActive: true },
            include: {
              variants: {
                where: {
                  isActive: true,
                  deleted_at: null,
                  variant_unit_prices: { some: { deleted_at: null, isActive: true, base_price: { gt: 0 } } },
                },
                include: {
                  product_variant_images: {
                    where: { is_active: true },
                    orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
                    take: 1,
                  },
                  variant_unit_prices: unitPriceListArgs,
                },
              },
            },
          },
        },
      }),
      db.style.count({ where }),
    ]);

    let data: CustomerProductListItemDto[] = styles.map((s) => {
      const allVariants = s.items.flatMap((i) => i.variants);
      const colorNames = new Set(allVariants.map((v) => v.color_name).filter(Boolean));
      const allPrices = allVariants.flatMap((v) =>
        (v.variant_unit_prices || []).map((up) => Number(up.base_price))
      );
      const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
      const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : 0;

      let imgUrl: string | null = s.images[0]?.image_url ?? null;
      if (!imgUrl && allVariants.length > 0) {
        imgUrl = allVariants[0].product_variant_images[0]?.image_url ?? null;
      }

      return {
        id: s.uuid || String(s.id),
        name: s.name,
        description: s.short_description || s.description || null,
        brand: toBrandDto(s.brand, s.product.brand),
        category: null,
        image: imgUrl,
        minPrice,
        maxPrice,
        colorCount: colorNames.size,
      };
    });

    const categoryIds = styles
      .map((s) => s.product.categoryId)
      .filter((id): id is bigint => id !== null && id !== undefined);

    if (categoryIds.length > 0) {
      const categories = await db.productCategory.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, uuid: true, name: true },
      });
      const catMap = new Map(categories.map((c) => [c.id.toString(), c]));

      styles.forEach((s, idx) => {
        const catId = s.product.categoryId;
        if (catId) {
          const cat = catMap.get(catId.toString());
          if (cat) {
            data[idx].category = { id: cat.uuid || String(cat.id), name: cat.name };
          }
        }
      });
    }

    if (isPriceSort) {
      const isAsc = params.sortOrder !== "desc";
      data.sort((a, b) => (isAsc ? a.minPrice - b.minPrice : b.minPrice - a.minPrice));
      data = data.slice((page - 1) * pageSize, page * pageSize);
    }

    return {
      data,
      meta: {
        page,
        limit: pageSize,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  /**
   * The customer-facing "product detail" page is keyed by a Style's UUID, not
   * a Product's - a Style is the unit customers browse and buy ("V Neck
   * T-Shirt"), so each Style gets its own page. The admin-only Items under
   * that Style are never surfaced; their Color/Size variants are flattened
   * into one list here (see toStyleDto) so the page never needs an Item
   * picker.
   */
  async findCustomerProductByUuid(uuid: string): Promise<CustomerProductDetailDto | null> {
    const style = await db.style.findFirst({
      where: {
        uuid,
        isActive: true,
        deleted_at: null,
      },
      include: {
        product: {
          select: {
            id: true,
            uuid: true,
            name: true,
            gender: true,
            categoryId: true,
            brand: { select: brandSelect },
          },
        },
        brand: { select: brandSelect },
        images: {
          where: { is_active: true },
          orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
        },
        items: {
          where: { deleted_at: null, isActive: true },
          include: {
            variants: {
              where: {
                isActive: true,
                deleted_at: null,
                variant_unit_prices: {
                  some: {
                    deleted_at: null,
                    isActive: true,
                    base_price: { gt: 0 },
                  },
                },
              },
              include: {
                product_variant_images: {
                  where: { is_active: true },
                  orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
                },
                variant_unit_prices: unitPriceListArgs,
                variant_attribute_values: {
                  include: {
                    product_attributes: { select: { name: true } },
                    attribute_values: { select: { uuid: true, value: true } },
                  },
                },
              },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: [{ is_default: "desc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!style) return null;

    let categoryDto: { id: string; name: string } | null = null;
    if (style.product.categoryId) {
      const cat = await db.productCategory.findFirst({
        where: { id: style.product.categoryId },
        select: { id: true, uuid: true, name: true },
      });
      if (cat) {
        categoryDto = {
          id: cat.uuid || String(cat.id),
          name: cat.name,
        };
      }
    }

    const allVariants = style.items.flatMap((i) => i.variants);
    let imgUrl: string | null = style.images[0]?.image_url ?? null;
    if (!imgUrl && allVariants.length > 0) {
      imgUrl = allVariants[0].product_variant_images[0]?.image_url ?? null;
    }

    const productUuid = style.product.uuid || String(style.product.id);
    const styleDto = toStyleDto(style, productUuid, style.product.name);

    return {
      id: productUuid,
      name: style.product.name,
      description: style.description || style.short_description || null,
      brand: toBrandDto(style.brand, style.product.brand),
      category: categoryDto,
      image: imgUrl,
      gender: (style.product.gender as CustomerProductDetailDto["gender"]) ?? null,
      items: [styleDto],
    };
  },

  /**
   * The storefront Style detail page, keyed by the Style UUID the listing card
   * links to. Unlike `findCustomerProductByUuid` - which flattens every Item's
   * Colors into one list - this keeps the real
   * Style -> Item -> Color -> Size tree intact, because the shopper now picks
   * an Item first and each Color carries its own images, sizes, prices and
   * stock.
   */
  async findCustomerStyleDetailByUuid(uuid: string): Promise<CustomerStyleDetailDto | null> {
    const style = await db.style.findFirst({
      where: { uuid, isActive: true, deleted_at: null },
      include: {
        product: {
          select: {
            id: true,
            uuid: true,
            name: true,
            gender: true,
            categoryId: true,
            brand: { select: brandSelect },
          },
        },
        brand: { select: brandSelect },
        images: {
          where: { is_active: true },
          orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
        },
        items: {
          where: { deleted_at: null, isActive: true },
          include: styleItemIncludeArgs,
          orderBy: [{ is_default: "desc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!style) return null;

    let categoryDto: { id: string; name: string } | null = null;
    if (style.product.categoryId) {
      const cat = await db.productCategory.findFirst({
        where: { id: style.product.categoryId },
        select: { id: true, uuid: true, name: true },
      });
      if (cat) categoryDto = { id: cat.uuid || String(cat.id), name: cat.name };
    }

    const styleUuid = style.uuid || String(style.id);
    const styleImages: CustomerVariantImageDto[] = style.images.map((img, idx) => ({
      id: img.uuid || String(idx),
      imageUrl: img.image_url,
      sortOrder: img.sort_order ?? idx,
      isPrimary: Boolean(img.is_primary),
    }));

    const items: CustomerStyleItemDto[] = style.items.map((item) =>
      toStyleItemDto(item, styleUuid, styleImages)
    );

    const allPrices = items.flatMap((i) => [i.minPrice, i.maxPrice]).filter((p) => p > 0);

    return {
      id: styleUuid,
      name: style.name,
      slug: style.slug,
      shortDescription: style.short_description,
      description: style.description,
      ingredients: style.ingredients,
      isReadyToMix: Boolean(style.is_ready_to_mix),
      cookingRecipe: style.cooking_recipe,
      shelfLife: style.shelf_life,
      vegType: (style.veg_type as CustomerStyleDetailDto["vegType"]) || "na",
      product: {
        id: style.product.uuid || String(style.product.id),
        name: style.product.name,
        gender: (style.product.gender as CustomerStyleDetailDto["product"]["gender"]) ?? null,
      },
      brand: toBrandDto(style.brand, style.product.brand),
      category: categoryDto,
      image: styleImages[0]?.imageUrl ?? items.find((i) => i.image)?.image ?? null,
      images: styleImages,
      minPrice: allPrices.length > 0 ? Math.min(...allPrices) : 0,
      maxPrice: allPrices.length > 0 ? Math.max(...allPrices) : 0,
      items,
    };
  },

  /**
   * The standalone Item detail page: one Item with its Colors, each Color's
   * Sizes/prices/stock, and enough Style/Product context for the breadcrumb,
   * the title and the "more from this style" link. Mirrors exactly what the
   * Style detail page hands its selected Item, so both render the same view.
   */
  async findCustomerItemDetailByUuid(uuid: string): Promise<CustomerItemDetailDto | null> {
    const item = await db.item.findFirst({
      where: { uuid, isActive: true, deleted_at: null },
      include: {
        ...styleItemIncludeArgs,
        style: {
          include: {
            brand: { select: brandSelect },
            images: {
              where: { is_active: true },
              orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
            },
            product: {
              select: {
                id: true,
                uuid: true,
                name: true,
                gender: true,
                categoryId: true,
                brand: { select: brandSelect },
              },
            },
          },
        },
      },
    });

    if (!item || !item.style || !item.style.isActive || item.style.deleted_at) {
      return null;
    }

    const style = item.style;

    let categoryDto: { id: string; name: string } | null = null;
    if (style.product.categoryId) {
      const cat = await db.productCategory.findFirst({
        where: { id: style.product.categoryId },
        select: { id: true, uuid: true, name: true },
      });
      if (cat) categoryDto = { id: cat.uuid || String(cat.id), name: cat.name };
    }

    const styleUuid = style.uuid || String(style.id);
    const styleImages: CustomerVariantImageDto[] = style.images.map((img, idx) => ({
      id: img.uuid || String(idx),
      imageUrl: img.image_url,
      sortOrder: img.sort_order ?? idx,
      isPrimary: Boolean(img.is_primary),
    }));

    return {
      ...toStyleItemDto(item, styleUuid, styleImages),
      styleName: style.name,
      styleSlug: style.slug,
      styleDescription: style.description,
      styleShortDescription: style.short_description,
      product: {
        id: style.product.uuid || String(style.product.id),
        name: style.product.name,
        gender: (style.product.gender as CustomerItemDetailDto["product"]["gender"]) ?? null,
      },
      brand: toBrandDto(style.brand, style.product.brand),
      category: categoryDto,
    };
  },

  async findRelatedProducts(
    productUuid: string,
    limit: number
  ): Promise<CustomerProductListItemDto[] | null> {
    const product = await db.product.findFirst({
      where: { uuid: productUuid, isActive: true, deleted_at: null },
      select: { id: true, categoryId: true, brandId: true },
    });

    if (!product) return null;

    const where: Prisma.ProductWhereInput = {
      isActive: true,
      deleted_at: null,
      id: { not: product.id },
      OR: [
        ...(product.categoryId ? [{ categoryId: product.categoryId }] : []),
        ...(product.brandId ? [{ brandId: product.brandId }] : []),
      ],
    };

    // No category/brand to relate on - nothing to return.
    if (!where.OR || where.OR.length === 0) return [];

    const related = await db.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        brand: { select: brandSelect },
        images: {
          where: { is_active: true },
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
          take: 1,
        },
        styles: {
          where: { deleted_at: null },
          include: {
            brand: { select: brandSelect },
            items: {
              where: { deleted_at: null },
              include: {
                variants: {
                  where: { isActive: true, deleted_at: null },
                  include: {
                    product_variant_images: {
                      where: { is_active: true },
                      orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
                      take: 1,
                    },
                    variant_unit_prices: unitPriceListArgs,
                  },
                },
              },
            },
          },
        },
      },
    });

    const categoryIds = related
      .map((p) => p.categoryId)
      .filter((id): id is bigint => id !== null && id !== undefined);

    const categories = categoryIds.length
      ? await db.productCategory.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, uuid: true, name: true },
        })
      : [];
    const catMap = new Map(categories.map((c) => [c.id.toString(), c]));

    return related.map((p) => {
      const allVariants = p.styles.flatMap((s) => s.items.flatMap((i) => i.variants));
      const allPrices = allVariants.flatMap((v) =>
        (v.variant_unit_prices || []).map((up) => Number(up.base_price))
      );
      const minP = allPrices.length > 0 ? Math.min(...allPrices) : 0;
      const maxP = allPrices.length > 0 ? Math.max(...allPrices) : 0;

      let imgUrl: string | null = p.images[0]?.image_url ?? null;
      if (!imgUrl && allVariants.length > 0) {
        imgUrl = allVariants[0].product_variant_images[0]?.image_url ?? null;
      }

      const primaryItem = p.styles.find((s) => s.is_default) ?? p.styles[0] ?? null;
      const primaryVariant = allVariants.find((v) => v.is_default) ?? allVariants[0] ?? null;
      const variantWithPrices =
        allVariants.find((v) => (v.variant_unit_prices || []).length > 0) ?? primaryVariant;

      const unitPrices = (variantWithPrices?.variant_unit_prices || []).map((up) => {
        const basePrice = Number(up.base_price);
        const measurement = formatVariantMeasurement(up.product_units, up.unit_value ?? 0);
        return {
          id: up.uuid,
          label: formatMeasurementLabel(measurement) || "Standard",
          basePrice,
          sellingPrice: computeSellingPrice(basePrice),
        };
      });

      const cat = p.categoryId ? catMap.get(p.categoryId.toString()) : undefined;

      return {
        id: p.uuid || String(p.id),
        name: p.name,
        description: primaryItem?.short_description || primaryItem?.description || null,
        brand: toBrandDto(primaryItem?.brand, p.brand),
        category: cat ? { id: cat.uuid || String(cat.id), name: cat.name } : null,
        image: imgUrl,
        minPrice: minP,
        maxPrice: maxP,
        unitPrices,
      };
    });
  },

  // ----------------------------------------------------
  // VARIANT REPOSITORY METHODS
  // ----------------------------------------------------
  async findCustomerVariantsByProductUuid(
    productUuid: string,
    params: CustomerVariantListInput
  ) {
    const product = await db.product.findFirst({
      where: {
        uuid: productUuid,
        isActive: true,
        deleted_at: null,
      },
      select: { id: true, uuid: true, name: true },
    });

    if (!product) return null;

    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;

    const where: Prisma.ProductVariantWhereInput = {
      item: { style: { productId: product.id } },
      isActive: true,
      deleted_at: null,
    };

    if (params.search) {
      where.OR = [
        { variant_name: { contains: params.search } },
        { variant_unit_prices: { some: { sku: { contains: params.search } } } },
      ];
    }

    const minVariantP = params.minPrice ? Math.max(params.minPrice, 0.01) : 0.01;
    const maxVariantP = params.maxPrice ?? Number.MAX_SAFE_INTEGER;

    where.variant_unit_prices = {
      some: {
        deleted_at: null,
        isActive: true,
        base_price: { gte: minVariantP, lte: maxVariantP },
      },
    };

    // Price/sku sorting now lives on VariantUnitPrice (one-to-many), so we
    // fetch by createdAt/variantName at the DB level and, when price sorting
    // is requested, sort in-memory by each variant's default unit price.
    let orderBy: Prisma.ProductVariantOrderByWithRelationInput = { createdAt: "desc" };
    if (params.sortBy === "variantName") {
      orderBy = { variant_name: params.sortOrder ?? "asc" };
    } else if (params.sortBy === "createdAt") {
      orderBy = { createdAt: params.sortOrder ?? "desc" };
    }

    const isPriceSort = params.sortBy === "basePrice" || params.sortBy === "salePrice";

    const [variants, total] = await Promise.all([
      db.productVariant.findMany({
        where,
        orderBy,
        ...(isPriceSort ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
        include: {
          item: { select: { style: { select: { id: true, uuid: true, name: true } } } },
          product_variant_images: {
            where: { is_active: true },
            orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
            take: 1,
          },
          variant_unit_prices: unitPriceListArgs,
        },
      }),
      db.productVariant.count({ where }),
    ]);

    let data: CustomerVariantListItemDto[] = variants.map((v) =>
      toVariantListItemDto(v, v.item.style.uuid || String(v.item.style.id), v.item.style.name)
    );

    if (isPriceSort) {
      const isAsc = params.sortOrder !== "desc";
      data.sort((a, b) => (isAsc ? a.basePrice - b.basePrice : b.basePrice - a.basePrice));
      data = data.slice((page - 1) * pageSize, page * pageSize);
    }

    return {
      data,
      meta: {
        page,
        limit: pageSize,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  async findCustomerVariantByUuids(
    productUuid: string,
    variantUuid: string
  ): Promise<CustomerVariantDetailDto | null> {
    const variant = await db.productVariant.findFirst({
      where: {
        uuid: variantUuid,
        isActive: true,
        deleted_at: null,
        item: {
          style: {
            product: {
              uuid: productUuid,
              isActive: true,
              deleted_at: null,
            },
          },
        },
        variant_unit_prices: {
          some: {
            deleted_at: null,
            isActive: true,
            base_price: { gt: 0 },
          },
        },
      },
      include: {
        item: {
          select: { style: { select: { id: true, uuid: true, name: true } } },
        },
        product_variant_images: {
          where: { is_active: true },
          orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
        },
        variant_unit_prices: unitPriceListArgs,
      },
    });

    if (!variant || !variant.item) return null;

    const images: CustomerVariantImageDto[] = variant.product_variant_images.map((img) => ({
      id: img.uuid || String(img.id),
      imageUrl: img.image_url,
      sortOrder: img.sort_order,
      isPrimary: Boolean(img.is_primary),
    }));

    const listItem = toVariantListItemDto(
      variant,
      variant.item.style.uuid || String(variant.item.style.id),
      variant.item.style.name
    );

    return {
      ...listItem,
      images,
    };
  },

  async findCustomerGlobalVariants(params: CustomerGlobalVariantListInput) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;

    const where: Prisma.ProductVariantWhereInput = {
      isActive: true,
      deleted_at: null,
      item: {
        isActive: true,
        deleted_at: null,
        style: {
          isActive: true,
          deleted_at: null,
          product: {
            isActive: true,
            deleted_at: null,
          },
        },
      },
    };

    // Filter by Product / Brand / Category UUIDs (run independent lookups in parallel)
    const [matchingProducts, matchingBrands, matchingCategories] = await Promise.all([
      params.productIds && params.productIds.length > 0
        ? db.product.findMany({
            where: { uuid: { in: params.productIds }, isActive: true, deleted_at: null },
            select: { id: true },
          })
        : null,
      params.brandIds && params.brandIds.length > 0
        ? db.productBrand.findMany({
            where: { uuid: { in: params.brandIds }, isActive: true, deleted_at: null },
            select: { id: true },
          })
        : null,
      params.categoryIds && params.categoryIds.length > 0
        ? db.productCategory.findMany({
            where: { uuid: { in: params.categoryIds }, isActive: true, deleted_at: null },
            select: { id: true },
          })
        : null,
    ]);

    const itemStyleWhere = (): Prisma.StyleWhereInput =>
      ((where.item as Prisma.ItemWhereInput)?.style as Prisma.StyleWhereInput) ?? {};
    const itemStyleProductWhere = (): Prisma.ProductWhereInput =>
      (itemStyleWhere().product as Prisma.ProductWhereInput) ?? {};

    if (matchingProducts) {
      where.item = {
        ...(where.item as Prisma.ItemWhereInput),
        style: { ...itemStyleWhere(), productId: { in: matchingProducts.map((p) => p.id) } },
      };
    }

    if (matchingBrands) {
      where.item = {
        ...(where.item as Prisma.ItemWhereInput),
        style: {
          ...itemStyleWhere(),
          ...styleBrandWhere(matchingBrands.map((b) => b.id)),
        },
      };
    }

    if (matchingCategories) {
      where.item = {
        ...(where.item as Prisma.ItemWhereInput),
        style: {
          ...itemStyleWhere(),
          product: {
            ...itemStyleProductWhere(),
            categoryId: { in: matchingCategories.map((c) => c.id) },
          },
        },
      };
    }

    // Filter by audience - a men's/women's/kids' filter also includes unisex
    // products, since those are designed to fit anyone.
    if (params.gender) {
      where.item = {
        ...(where.item as Prisma.ItemWhereInput),
        style: {
          ...itemStyleWhere(),
          product: {
            ...itemStyleProductWhere(),
            gender: params.gender === "unisex" ? "unisex" : { in: [params.gender, "unisex", "na"] },
          },
        },
      };
    }

    // Search filter across variantName, SKU, and style/product name
    if (params.search) {
      where.OR = [
        { variant_name: { contains: params.search } },
        { variant_unit_prices: { some: { sku: { contains: params.search } } } },
        { item: { style: { name: { contains: params.search } } } },
        { item: { style: { product: { name: { contains: params.search } } } } },
      ];
    }

    // Price range filter - always require active unit price with base_price > 0
    const minP = params.minPrice ? Math.max(params.minPrice, 0.01) : 0.01;
    const maxP = params.maxPrice ?? Number.MAX_SAFE_INTEGER;

    const priceCondition: Prisma.ProductVariantWhereInput = {
      variant_unit_prices: {
        some: { deleted_at: null, isActive: true, base_price: { gte: minP, lte: maxP } },
      },
    };

    if (where.OR) {
      where.AND = [priceCondition];
    } else {
      Object.assign(where, priceCondition);
    }

    // Base facet where: before inStock and vegType filters are applied
    const baseFacetWhere: Prisma.ProductVariantWhereInput = { ...where };

    // In Stock / Out of Stock filter
    if (params.inStock !== undefined) {
      where.out_of_stock = !params.inStock;
    }

    // Dietary (veg / non_veg / vegan) filter - lives on Style now
    const withItemVegType = (
      vegTypeWhere: Prisma.StyleWhereInput["veg_type"]
    ): Prisma.ProductVariantWhereInput => ({
      ...baseFacetWhere,
      item: {
        ...(baseFacetWhere.item as Prisma.ItemWhereInput),
        style: { veg_type: vegTypeWhere },
      },
    });

    if (params.vegType) {
      let vegTypeWhere: Prisma.StyleWhereInput["veg_type"];
      if (params.vegType === "non_veg" || params.vegType === "nonveg") {
        vegTypeWhere = "nonveg";
      } else if (params.vegType === "vegan") {
        vegTypeWhere = "vegan";
      } else if (params.vegType === "veg") {
        vegTypeWhere = { in: ["veg", "na"] };
      } else {
        vegTypeWhere = params.vegType as "veg" | "vegan" | "na";
      }
      where.item = {
        ...(where.item as Prisma.ItemWhereInput),
        style: { ...itemStyleWhere(), veg_type: vegTypeWhere },
      };
    }

    // Sorting
    let orderBy: Prisma.ProductVariantOrderByWithRelationInput = { createdAt: "desc" };
    if (params.sortBy === "variantName") {
      orderBy = { variant_name: params.sortOrder ?? "asc" };
    } else if (params.sortBy === "productName") {
      orderBy = { item: { style: { name: params.sortOrder ?? "asc" } } };
    } else if (params.sortBy === "createdAt") {
      orderBy = { createdAt: params.sortOrder ?? "desc" };
    }

    const isPriceSort = params.sortBy === "basePrice" || params.sortBy === "salePrice";

    const [
      variants,
      total,
      inStockCount,
      outOfStockCount,
      vegCount,
      nonVegCount,
      veganCount,
    ] = await Promise.all([
      db.productVariant.findMany({
        where,
        orderBy,
        ...(isPriceSort ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
        include: {
          item: {
            select: { style: { select: { id: true, uuid: true, name: true } } },
          },
          product_variant_images: {
            where: { is_active: true },
            orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
            take: 1,
          },
          variant_unit_prices: unitPriceListArgs,
        },
      }),
      db.productVariant.count({ where }),
      db.productVariant.count({ where: { ...baseFacetWhere, out_of_stock: false } }),
      db.productVariant.count({ where: { ...baseFacetWhere, out_of_stock: true } }),
      db.productVariant.count({ where: withItemVegType({ in: ["veg", "na"] }) }),
      db.productVariant.count({ where: withItemVegType("nonveg") }),
      db.productVariant.count({ where: withItemVegType("vegan") }),
    ]);

    let data: CustomerVariantListItemDto[] = variants.map((v) =>
      toVariantListItemDto(
        v,
        v.item?.style ? v.item.style.uuid || String(v.item.style.id) : "",
        v.item?.style ? v.item.style.name : ""
      )
    );

    if (isPriceSort) {
      const isAsc = params.sortOrder !== "desc";
      data.sort((a, b) => (isAsc ? a.basePrice - b.basePrice : b.basePrice - a.basePrice));
      data = data.slice((page - 1) * pageSize, page * pageSize);
    }

    return {
      data,
      meta: {
        page,
        limit: pageSize,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        facets: {
          inStockCount,
          outOfStockCount,
          vegCount,
          nonVegCount,
          veganCount,
        },
      },
    };
  },

  // ----------------------------------------------------
  // RELATED PRODUCTS (BY VARIANT)
  // ----------------------------------------------------

  /**
   * Related items for a single variant.
   *
   * Relatedness comes from the catalog tree already in the database: products
   * hang off `product_categories`, which is a self-referencing tree, so the
   * source product's category is either a subcategory (it has a parent) or a
   * top-level category. Candidates are ranked closest-first:
   *   0 - same subcategory/category as the source product
   *   1 - sibling subcategory under the same parent category
   *   2 - same brand only
   *
   * The source product is excluded entirely, which also guarantees the source
   * variant is never returned. One representative variant (the default one,
   * else the oldest active one) is emitted per product, so neither a product
   * nor a variant can appear twice.
   *
   * Ranking cannot be expressed as a Prisma `orderBy`, so candidates are first
   * read as id-only rows (cheap), ranked and paginated in memory, and only the
   * page's variants are then loaded with their images, prices and stock.
   */
  async findRelatedVariantsByVariantId(
    variantId: string,
    params: CustomerRelatedVariantsQueryInput
  ): Promise<{ data: CustomerRelatedVariantDto[]; meta: PaginationMeta } | null> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;

    // Storefront resources are addressed by UUID, but the legacy product
    // routes still expose numeric primary keys - accept whichever was given.
    const isNumericId = /^\d+$/.test(variantId);

    const sourceVariant = await db.productVariant.findFirst({
      where: {
        ...(isNumericId ? { id: BigInt(variantId) } : { uuid: variantId }),
        isActive: true,
        deleted_at: null,
        item: { style: { product: { isActive: true, deleted_at: null } } },
      },
      select: {
        id: true,
        item: {
          select: {
            style: { select: { product: { select: { id: true, categoryId: true, brandId: true } } } },
          },
        },
      },
    });

    if (!sourceVariant?.item?.style?.product) return null;

    const sourceProduct = sourceVariant.item.style.product;

    const emptyResult = {
      data: [] as CustomerRelatedVariantDto[],
      meta: { page, limit, pageSize: limit, total: 0, totalPages: 0 },
    };

    // Resolve the source category's siblings (same parent) so "related" widens
    // from the exact subcategory out to the rest of the parent category.
    let siblingCategoryIds: bigint[] = [];
    if (sourceProduct.categoryId !== null && sourceProduct.categoryId !== undefined) {
      const sourceCategory = await db.productCategory.findFirst({
        where: { id: sourceProduct.categoryId, isActive: true, deleted_at: null },
        select: { id: true, parentId: true },
      });

      if (sourceCategory?.parentId) {
        const siblings = await db.productCategory.findMany({
          where: {
            parentId: sourceCategory.parentId,
            isActive: true,
            deleted_at: null,
            id: { not: sourceCategory.id },
          },
          select: { id: true },
        });
        siblingCategoryIds = siblings.map((c) => c.id);
      }
    }

    const categoryIdsToMatch = [
      ...(sourceProduct.categoryId ? [sourceProduct.categoryId] : []),
      ...siblingCategoryIds,
    ];

    const relatedOr: Prisma.ProductWhereInput[] = [
      ...(categoryIdsToMatch.length ? [{ categoryId: { in: categoryIdsToMatch } }] : []),
      ...(sourceProduct.brandId ? [{ brandId: sourceProduct.brandId }] : []),
    ];

    // Nothing to relate on - the source product has neither category nor brand.
    if (relatedOr.length === 0) return emptyResult;

    const candidateWhere: Prisma.ProductVariantWhereInput = {
      isActive: true,
      deleted_at: null,
      item: {
        isActive: true,
        deleted_at: null,
        style: {
          product: {
            isActive: true,
            deleted_at: null,
            id: { not: sourceProduct.id },
            OR: relatedOr,
          },
        },
      },
      variant_unit_prices: {
        some: {
          deleted_at: null,
          isActive: true,
          base_price: { gt: 0 },
        },
      },
    };

    // Id-only pass: enough to rank and to collapse to one variant per product,
    // without pulling images/prices for rows that will not be on this page.
    const candidates = await db.productVariant.findMany({
      where: candidateWhere,
      orderBy: [{ is_default: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        item: {
          select: {
            style: {
              select: {
                productId: true,
                product: { select: { categoryId: true, brandId: true, createdAt: true } },
              },
            },
          },
        },
      },
    });

    if (candidates.length === 0) return emptyResult;

    type RankedProduct = {
      productId: bigint;
      variantId: bigint;
      rank: number;
      createdAt: Date;
    };

    // First hit per product wins - the orderBy above puts the default variant
    // first, so each product is represented by its default (or oldest) variant.
    const byProduct = new Map<string, RankedProduct>();
    const siblingIdSet = new Set(siblingCategoryIds.map((id) => id.toString()));

    for (const candidate of candidates) {
      const productId = candidate.item.style.productId;
      const key = productId.toString();
      if (byProduct.has(key)) continue;

      const categoryId = candidate.item.style.product?.categoryId ?? null;
      let rank = 2;
      if (
        categoryId !== null &&
        sourceProduct.categoryId !== null &&
        categoryId === sourceProduct.categoryId
      ) {
        rank = 0;
      } else if (categoryId !== null && siblingIdSet.has(categoryId.toString())) {
        rank = 1;
      }

      byProduct.set(key, {
        productId,
        variantId: candidate.id,
        rank,
        createdAt: candidate.item.style.product?.createdAt ?? new Date(0),
      });
    }

    const ranked = Array.from(byProduct.values()).sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      // Newest product first within a rank, then id so page boundaries are
      // stable across requests.
      const byDate = b.createdAt.getTime() - a.createdAt.getTime();
      if (byDate !== 0) return byDate;
      return a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0;
    });

    const total = ranked.length;
    const totalPages = Math.ceil(total / limit);
    const pageSlice = ranked.slice((page - 1) * limit, page * limit);

    if (pageSlice.length === 0) {
      return { data: [], meta: { page, limit, pageSize: limit, total, totalPages } };
    }

    // Detail pass: only the variants on this page.
    const variants = await db.productVariant.findMany({
      where: { id: { in: pageSlice.map((r) => r.variantId) } },
      select: {
        id: true,
        uuid: true,
        variant_name: true,
        out_of_stock: true,
        item: {
          select: {
            style: {
              select: {
                brand: { select: brandSelect },
                product: {
                  select: {
                    id: true,
                    uuid: true,
                    name: true,
                    categoryId: true,
                    brand: { select: brandSelect },
                    images: {
                      where: { is_active: true },
                      orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
                      take: 1,
                      select: { image_url: true },
                    },
                  },
                },
              },
            },
          },
        },
        product_variant_images: {
          where: { is_active: true },
          orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
          take: 1,
          select: { image_url: true },
        },
        variant_unit_prices: {
          where: { deleted_at: null, isActive: true },
          orderBy: [{ is_default: "desc" }, { createdAt: "asc" }],
          select: {
            uuid: true,
            sku: true,
            base_price: true,
            unit_value: true,
            is_default: true,
            product_units: {
              select: { id: true, uuid: true, name: true, code: true, type: true },
            },
            inventories: { select: { quantity_available: true, quantity_reserved: true } },
          },
        },
      },
    });

    // Categories for the page's products, loaded with their parents so each
    // row can report both `category` and `subcategory`.
    const pageCategoryIds = Array.from(
      new Map(
        variants
          .map((v) => v.item?.style?.product?.categoryId)
          .filter((id): id is bigint => id !== null && id !== undefined)
          .map((id) => [id.toString(), id] as const)
      ).values()
    );

    const pageCategories = pageCategoryIds.length
      ? await db.productCategory.findMany({
          where: { id: { in: pageCategoryIds } },
          select: {
            id: true,
            uuid: true,
            name: true,
            parent: { select: { id: true, uuid: true, name: true } },
          },
        })
      : [];
    const categoryMap = new Map(pageCategories.map((c) => [c.id.toString(), c]));
    const variantMap = new Map(variants.map((v) => [v.id.toString(), v]));

    const data: CustomerRelatedVariantDto[] = [];

    // Walk pageSlice (not `variants`) so the ranked order is preserved.
    for (const entry of pageSlice) {
      const variant = variantMap.get(entry.variantId.toString());
      if (!variant?.item?.style?.product) continue;

      const product = variant.item.style.product;
      const defaultUnitPrice = pickDefaultUnitPrice(variant.variant_unit_prices);
      const basePrice = defaultUnitPrice ? Number(defaultUnitPrice.base_price) : 0;
      const sellingPrice = computeSellingPrice(basePrice);

      // Stock is tracked per unit price row (inventories key off them), so a
      // variant is available when any of its pack sizes has unreserved stock.
      const stockQuantity = variant.variant_unit_prices.reduce((sum, up) => {
        const inventory = up.inventories;
        if (!inventory) return sum;
        return sum + Math.max(inventory.quantity_available - inventory.quantity_reserved, 0);
      }, 0);

      const categoryRow = product.categoryId
        ? categoryMap.get(product.categoryId.toString())
        : undefined;
      // A category with a parent IS the subcategory; its parent is the category.
      const parentCategory = categoryRow?.parent ?? null;

      data.push({
        productId: product.uuid || String(product.id),
        productName: product.name,
        variantId: variant.uuid || String(variant.id),
        variantName: variant.variant_name || "",
        measurement: formatVariantMeasurement(
          defaultUnitPrice?.product_units,
          defaultUnitPrice?.unit_value ?? 0
        ),
        sku: defaultUnitPrice?.sku ?? "",
        unitPriceId: defaultUnitPrice?.uuid ?? null,
        price: basePrice,
        offerPrice: sellingPrice < basePrice ? sellingPrice : null,
        image:
          variant.product_variant_images[0]?.image_url ?? product.images[0]?.image_url ?? null,
        category: parentCategory
          ? { id: parentCategory.uuid || String(parentCategory.id), name: parentCategory.name }
          : categoryRow
            ? { id: categoryRow.uuid || String(categoryRow.id), name: categoryRow.name }
            : null,
        subcategory:
          parentCategory && categoryRow
            ? { id: categoryRow.uuid || String(categoryRow.id), name: categoryRow.name }
            : null,
        brand: toBrandDto(variant.item.style.brand, product.brand),
        inStock: !variant.out_of_stock && stockQuantity > 0,
        stockQuantity,
      });
    }

    return { data, meta: { page, limit, pageSize: limit, total, totalPages } };
  },
};
