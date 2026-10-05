import crypto from "crypto";
import { ApiError } from "@/lib/api/api-error";
import { variantImageRepository } from "../repositories/variant-image.repository";
import { variantRepository } from "../repositories/variant.repository";
import { productRepository } from "@/features/products/repositories/product.repository";
import { userRepository } from "@/features/users/repositories/user.repository";
import type { Prisma } from "@/generated/prisma";
import type { AdminVariantImageResponse } from "../types";
import type {
  CreateAdminVariantImagesInput,
  UpdateAdminVariantImageInput,
} from "../validations/admin-variant-image.schema";

function formatAdminVariantImageResponse(img: {
  id: bigint;
  uuid: string | null;
  image_url: string;
  sort_order: number;
  is_primary: boolean;
  status: boolean | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}): AdminVariantImageResponse {
  return {
    id: img.uuid || String(img.id),
    imageUrl: img.image_url,
    sortOrder: img.sort_order,
    isPrimary: Boolean(img.is_primary),
    status: Boolean(img.status),
    isActive: Boolean(img.is_active),
    createdAt: img.created_at,
    updatedAt: img.updated_at,
  };
}

async function getAdminInternalId(email?: string): Promise<bigint | null> {
  if (!email) return null;
  const user = await userRepository.findByEmail(email);
  if (!user) return null;
  return BigInt(user.internalId || user.id);
}

async function validateProductAndVariant(productUuid: string, variantUuid: string) {
  const product = await productRepository.findByUuid(productUuid);
  if (!product || product.deleted_at !== null) {
    throw ApiError.notFound("Product not found");
  }

  const variant = await variantRepository.findByUuid(variantUuid);
  if (!variant || variant.item.style.productId !== product.id) {
    throw ApiError.notFound("Variant not found for this product");
  }

  return { product, variant };
}

export const variantImageService = {
  async createAdminVariantImages(
    productUuid: string,
    variantUuid: string,
    data: CreateAdminVariantImagesInput,
    adminEmail?: string
  ): Promise<AdminVariantImageResponse[]> {
    const { variant } = await validateProductAndVariant(productUuid, variantUuid);
    const adminId = await getAdminInternalId(adminEmail);

    const imagesToCreate = data.map((img) => ({
      uuid: crypto.randomUUID(),
      image_url: img.imageUrl,
      sort_order: img.sortOrder ?? 0,
      is_primary: Boolean(img.isPrimary),
      status: true,
      is_active: true,
      created_by: adminId,
      updated_by: adminId,
    }));

    const createdList = await variantImageRepository.createManyWithPrimaryHandling(
      variant.id,
      imagesToCreate
    );

    return createdList.map(formatAdminVariantImageResponse);
  },

  async getAdminVariantImages(
    productUuid: string,
    variantUuid: string
  ): Promise<AdminVariantImageResponse[]> {
    const { variant } = await validateProductAndVariant(productUuid, variantUuid);
    const images = await variantImageRepository.findActiveByVariantId(variant.id);

    return images.map(formatAdminVariantImageResponse);
  },

  async updateAdminVariantImage(
    productUuid: string,
    variantUuid: string,
    imageUuid: string,
    data: UpdateAdminVariantImageInput,
    adminEmail?: string
  ): Promise<AdminVariantImageResponse> {
    const { variant } = await validateProductAndVariant(productUuid, variantUuid);

    const existing = await variantImageRepository.findByUuid(imageUuid);
    if (!existing || existing.variant_id !== variant.id) {
      throw ApiError.notFound("Variant image not found");
    }

    const adminId = await getAdminInternalId(adminEmail);
    const updateData: Prisma.product_variant_imagesUncheckedUpdateInput = {};

    if (adminId) {
      updateData.updated_by = adminId;
    }

    if (data.imageUrl !== undefined) {
      updateData.image_url = data.imageUrl;
    }

    if (data.sortOrder !== undefined) {
      updateData.sort_order = data.sortOrder;
    }

    const updated = await variantImageRepository.updateByUuid(imageUuid, updateData);
    if (!updated) {
      throw ApiError.notFound("Variant image not found");
    }

    return formatAdminVariantImageResponse(updated);
  },

  async setPrimaryVariantImage(
    productUuid: string,
    variantUuid: string,
    imageUuid: string
  ): Promise<AdminVariantImageResponse> {
    const { variant } = await validateProductAndVariant(productUuid, variantUuid);

    const image = await variantImageRepository.findByUuid(imageUuid);
    if (!image || image.variant_id !== variant.id) {
      throw ApiError.notFound("Variant image not found");
    }

    const updated = await variantImageRepository.setPrimaryImage(variant.id, imageUuid);
    if (!updated) {
      throw ApiError.notFound("Variant image not found");
    }

    return formatAdminVariantImageResponse(updated);
  },

  async deleteAdminVariantImage(
    productUuid: string,
    variantUuid: string,
    imageUuid: string,
    adminEmail?: string
  ) {
    const { variant } = await validateProductAndVariant(productUuid, variantUuid);

    const image = await variantImageRepository.findByUuid(imageUuid);
    if (!image || image.variant_id !== variant.id) {
      throw ApiError.notFound("Variant image not found");
    }

    const wasPrimary = Boolean(image.is_primary);
    const adminId = await getAdminInternalId(adminEmail);

    await variantImageRepository.softDeleteByUuid(imageUuid, adminId);

    // Rule: If primary image was deleted, promote lowest sortOrder remaining active image
    if (wasPrimary) {
      await variantImageRepository.promoteLowestSortOrderPrimary(variant.id);
    }

    return {
      success: true,
      message: "Variant image deleted successfully",
    };
  },
};
