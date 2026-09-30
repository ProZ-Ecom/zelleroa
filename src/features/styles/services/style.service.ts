import crypto from "crypto";
import { ApiError } from "@/lib/api/api-error";
import { styleRepository } from "../repositories/style.repository";
import { productRepository } from "@/features/products/repositories/product.repository";
import { brandRepository } from "@/features/brands/repositories/brand.repository";
import { userRepository } from "@/features/users/repositories/user.repository";
import type { Prisma } from "@/generated/prisma";
import type { AdminStyleResponse, GetAdminStylesParams } from "../types";
import type { CreateAdminStyleInput, UpdateAdminStyleInput } from "../validations/admin-style.schema";

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/&/g, "-and-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-");
}

function formatAdminStyleResponse(item: {
  id: bigint;
  uuid: string;
  productId: bigint;
  name: string;
  slug: string;
  sku: string | null;
  short_description: string | null;
  description: string | null;
  ingredients: string | null;
  is_ready_to_mix: boolean;
  cooking_recipe: string | null;
  shelf_life: string | null;
  veg_type: string;
  base_price: Prisma.Decimal | number;
  is_featured: boolean;
  is_default: boolean;
  isActive: boolean;
  out_of_stock: boolean;
  createdAt: Date;
  updatedAt: Date;
  product?: {
    uuid: string | null;
    name: string;
    slug?: string | null;
    categoryId?: bigint | null;
  } | null;
  brand?: { uuid: string | null; name: string } | null;
  images?: Array<{ image_url: string; is_primary: boolean }> | null;
  _count?: { items: number };
  categoryName?: string | null;
}): AdminStyleResponse {
  const primaryImgObj = item.images?.find((img) => img.is_primary) ?? item.images?.[0];

  return {
    id: item.uuid,
    productId: item.product?.uuid ?? String(item.productId),
    productName: item.product?.name ?? "",
    productSlug: item.product?.slug ?? "",
    categoryId: item.product?.categoryId ? String(item.product.categoryId) : null,
    categoryName: item.categoryName ?? null,
    brandId: item.brand?.uuid ?? null,
    brandName: item.brand?.name ?? null,
    name: item.name,
    slug: item.slug,
    sku: item.sku,
    shortDescription: item.short_description,
    description: item.description,
    ingredients: item.ingredients,
    isReadyToMix: Boolean(item.is_ready_to_mix),
    cookingRecipe: item.cooking_recipe,
    shelfLife: item.shelf_life,
    vegType: (item.veg_type as AdminStyleResponse["vegType"]) || "na",
    basePrice: Number(item.base_price ?? 0),
    isFeatured: Boolean(item.is_featured),
    isDefault: Boolean(item.is_default),
    isActive: Boolean(item.isActive),
    outOfStock: Boolean(item.out_of_stock),
    primaryImage: primaryImgObj ? primaryImgObj.image_url : null,
    itemCount: item._count?.items ?? 0,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

/** Brand UUID -> internal id; rejects unknown, inactive and deleted brands. */
async function resolveActiveBrandId(brandUuid: string): Promise<bigint> {
  const brand = await brandRepository.findByUuid(brandUuid);
  if (!brand) {
    throw ApiError.badRequest("Invalid or inactive brand");
  }
  return brand.id;
}

async function getAdminInternalId(email?: string): Promise<bigint | null> {
  if (!email) return null;
  const user = await userRepository.findByEmail(email);
  if (!user) return null;
  return BigInt(user.internalId || user.id);
}

export const styleService = {
  async createAdminStyle(
    productUuid: string,
    data: CreateAdminStyleInput,
    adminEmail?: string
  ): Promise<AdminStyleResponse> {
    const adminId = await getAdminInternalId(adminEmail);

    const product = await productRepository.findByUuid(productUuid);
    if (!product || !product.isActive || product.deleted_at !== null) {
      throw ApiError.notFound("Product not found or inactive");
    }

    const styleSlug = slugify(data.slug).substring(0, 220);
    const existingSlug = await styleRepository.findBySlug(styleSlug);
    if (existingSlug) {
      throw ApiError.conflict(`An active style with slug '${data.slug}' already exists`);
    }

    const brandId = await resolveActiveBrandId(data.brandId);

    const existingCount = await styleRepository.countActiveByProductId(product.id);
    const isDefault = data.isDefault ?? existingCount === 0;

    const created = await styleRepository.create({
      uuid: crypto.randomUUID(),
      productId: product.id,
      brandId,
      name: data.name,
      slug: styleSlug,
      sku: data.sku ?? null,
      short_description: data.shortDescription ?? null,
      description: data.description ?? null,
      ingredients: data.ingredients ?? null,
      is_ready_to_mix: data.isReadyToMix ?? false,
      cooking_recipe: data.cookingRecipe ?? null,
      shelf_life: data.shelfLife ?? null,
      veg_type: (data.vegType as Prisma.StyleUncheckedCreateInput["veg_type"]) ?? "na",
      base_price: data.basePrice ?? 0,
      is_featured: data.isFeatured ?? false,
      is_default: isDefault,
      isActive: data.isActive ?? false,
      out_of_stock: data.outOfStock ?? false,
      created_by: adminId,
      updated_by: adminId,
    });

    return formatAdminStyleResponse(created);
  },

  async getAdminStyles(productUuid: string, params: GetAdminStylesParams = {}) {
    const product = await productRepository.findByUuid(productUuid);
    if (!product || !product.isActive || product.deleted_at !== null) {
      throw ApiError.notFound("Product not found or inactive");
    }

    const result = await styleRepository.findAllByProductId(product.id, params);
    return {
      data: result.data.map(formatAdminStyleResponse),
      meta: result.meta,
    };
  },

  async getAdminStyleByUuid(productUuid: string, styleUuid: string): Promise<AdminStyleResponse> {
    const product = await productRepository.findByUuid(productUuid);
    if (!product || !product.isActive || product.deleted_at !== null) {
      throw ApiError.notFound("Product not found or inactive");
    }

    const item = await styleRepository.findByUuid(styleUuid);
    if (!item || item.productId !== product.id) {
      throw ApiError.notFound("Style not found for this product");
    }

    return formatAdminStyleResponse(item);
  },

  async getStyleByUuid(styleUuid: string): Promise<AdminStyleResponse> {
    const item = await styleRepository.findByUuid(styleUuid);
    if (!item) {
      throw ApiError.notFound("Style not found");
    }
    return formatAdminStyleResponse(item);
  },

  async updateAdminStyle(
    productUuid: string,
    styleUuid: string,
    data: UpdateAdminStyleInput,
    adminEmail?: string
  ): Promise<AdminStyleResponse> {
    const product = await productRepository.findByUuid(productUuid);
    if (!product || !product.isActive || product.deleted_at !== null) {
      throw ApiError.notFound("Product not found or inactive");
    }

    const existing = await styleRepository.findByUuid(styleUuid);
    if (!existing || existing.productId !== product.id) {
      throw ApiError.notFound("Style not found for this product");
    }

    const adminId = await getAdminInternalId(adminEmail);
    const updateData: Prisma.StyleUncheckedUpdateInput = {};

    if (adminId) updateData.updated_by = adminId;
    if (data.brandId !== undefined) updateData.brandId = await resolveActiveBrandId(data.brandId);
    if (data.name !== undefined) updateData.name = data.name;
    if (data.sku !== undefined) updateData.sku = data.sku;
    if (data.shortDescription !== undefined) updateData.short_description = data.shortDescription;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.ingredients !== undefined) updateData.ingredients = data.ingredients;
    if (data.isReadyToMix !== undefined) updateData.is_ready_to_mix = data.isReadyToMix;
    if (data.cookingRecipe !== undefined) updateData.cooking_recipe = data.cookingRecipe;
    if (data.shelfLife !== undefined) updateData.shelf_life = data.shelfLife;
    if (data.vegType !== undefined) {
      updateData.veg_type = data.vegType as Prisma.StyleUncheckedUpdateInput["veg_type"];
    }
    if (data.basePrice !== undefined) updateData.base_price = data.basePrice;
    if (data.isFeatured !== undefined) updateData.is_featured = data.isFeatured;
    if (data.isDefault !== undefined) updateData.is_default = data.isDefault;
    if (typeof data.isActive === "boolean") updateData.isActive = data.isActive;
    if (typeof data.outOfStock === "boolean") updateData.out_of_stock = data.outOfStock;

    if (data.slug !== undefined) {
      const normalizedSlug = slugify(data.slug).substring(0, 220);
      const slugConflict = await styleRepository.findBySlug(normalizedSlug, styleUuid);
      if (slugConflict) {
        throw ApiError.conflict(`A style with slug '${data.slug}' already exists`);
      }
      updateData.slug = normalizedSlug;
    }

    const updated = await styleRepository.updateByUuid(styleUuid, updateData);
    if (!updated) {
      throw ApiError.notFound("Style not found");
    }

    return formatAdminStyleResponse(updated);
  },

  /**
   * Resolves a Product UUID to its default (or first) active Item's UUID -
   * lets routes that were written against the old flat Product->Variant shape
   * (before the Item level existed) keep working unchanged for the common
   * case of one Item per Product, without every caller having to pick an Item
   * explicitly.
   */
  async resolveDefaultStyleUuid(productUuid: string): Promise<string> {
    const product = await productRepository.findByUuid(productUuid);
    if (!product || !product.isActive || product.deleted_at !== null) {
      throw ApiError.notFound("Product not found or inactive");
    }

    const result = await styleRepository.findAllByProductId(product.id, { pageSize: 1 });
    const defaultItem =
      result.data.find((i) => i.is_default) ?? result.data[0] ?? null;
    if (!defaultItem) {
      throw ApiError.notFound("This product has no styles yet");
    }
    return defaultItem.uuid;
  },

  async deleteAdminStyle(productUuid: string, styleUuid: string, adminEmail?: string) {
    const product = await productRepository.findByUuid(productUuid);
    if (!product || !product.isActive || product.deleted_at !== null) {
      throw ApiError.notFound("Product not found or inactive");
    }

    const existing = await styleRepository.findByUuid(styleUuid);
    if (!existing || existing.productId !== product.id) {
      throw ApiError.notFound("Style not found for this product");
    }

    const adminId = await getAdminInternalId(adminEmail);
    await styleRepository.softDeleteByUuid(styleUuid, adminId);

    return { success: true, message: "Style deleted successfully" };
  },
};
