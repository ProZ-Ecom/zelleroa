import { ApiError } from "@/lib/api/api-error";
import { productImageRepository } from "../repositories/product-image.repository";
import { productRepository } from "../repositories/product.repository";
import { userRepository } from "@/features/users/repositories/user.repository";
import type { Prisma } from "@/generated/prisma";
import type { AdminProductImageResponse } from "../types";
import type {
  CreateAdminProductImagesInput,
  UpdateAdminProductImageInput,
} from "../validations/admin-product-image.schema";

function formatAdminProductImageResponse(img: {
  id: bigint;
  image_url: string;
  sortOrder: number;
  isPrimary: boolean;
  is_active: boolean;
  createdAt: Date;
  updated_at: Date;
}): AdminProductImageResponse {
  return {
    id: String(img.id),
    imageUrl: img.image_url,
    sortOrder: img.sortOrder,
    isPrimary: Boolean(img.isPrimary),
    isActive: Boolean(img.is_active),
    createdAt: img.createdAt,
    updatedAt: img.updated_at,
  };
}

async function getAdminInternalId(email?: string): Promise<bigint | null> {
  if (!email) return null;
  const user = await userRepository.findByEmail(email);
  if (!user) return null;
  return BigInt(user.internalId || user.id);
}

async function validateProduct(productUuid: string) {
  const product = await productRepository.findByUuid(productUuid);
  if (!product || product.deleted_at !== null) {
    throw ApiError.notFound("Product not found");
  }
  return product;
}

function parseImageId(imageId: string): bigint {
  if (!/^\d+$/.test(imageId)) {
    throw ApiError.badRequest("Invalid image ID");
  }
  return BigInt(imageId);
}

export const productImageService = {
  async createAdminProductImages(
    productUuid: string,
    data: CreateAdminProductImagesInput,
    adminEmail?: string
  ): Promise<AdminProductImageResponse[]> {
    const product = await validateProduct(productUuid);
    const adminId = await getAdminInternalId(adminEmail);

    const imagesToCreate = data.map((img) => ({
      image_url: img.imageUrl,
      sortOrder: img.sortOrder ?? 0,
      isPrimary: Boolean(img.isPrimary),
      is_active: true,
      created_by: adminId,
      updated_by: adminId,
    }));

    const createdList = await productImageRepository.createManyWithPrimaryHandling(
      product.id,
      imagesToCreate
    );

    return createdList.map(formatAdminProductImageResponse);
  },

  async getAdminProductImages(
    productUuid: string
  ): Promise<AdminProductImageResponse[]> {
    const product = await validateProduct(productUuid);
    const images = await productImageRepository.findActiveByProductId(product.id);

    return images.map(formatAdminProductImageResponse);
  },

  async updateAdminProductImage(
    productUuid: string,
    imageId: string,
    data: UpdateAdminProductImageInput,
    adminEmail?: string
  ): Promise<AdminProductImageResponse> {
    const product = await validateProduct(productUuid);
    const id = parseImageId(imageId);

    const existing = await productImageRepository.findById(id);
    if (!existing || existing.productId !== product.id) {
      throw ApiError.notFound("Product image not found");
    }

    const adminId = await getAdminInternalId(adminEmail);
    const updateData: Prisma.ProductImageUncheckedUpdateInput = {};

    if (adminId) {
      updateData.updated_by = adminId;
    }

    if (data.imageUrl !== undefined) {
      updateData.image_url = data.imageUrl;
    }

    if (data.sortOrder !== undefined) {
      updateData.sortOrder = data.sortOrder;
    }

    const updated = await productImageRepository.updateById(id, updateData);
    if (!updated) {
      throw ApiError.notFound("Product image not found");
    }

    return formatAdminProductImageResponse(updated);
  },

  async setPrimaryProductImage(
    productUuid: string,
    imageId: string
  ): Promise<AdminProductImageResponse> {
    const product = await validateProduct(productUuid);
    const id = parseImageId(imageId);

    const image = await productImageRepository.findById(id);
    if (!image || image.productId !== product.id) {
      throw ApiError.notFound("Product image not found");
    }

    const updated = await productImageRepository.setPrimaryImage(product.id, id);
    if (!updated) {
      throw ApiError.notFound("Product image not found");
    }

    return formatAdminProductImageResponse(updated);
  },

  async deleteAdminProductImage(
    productUuid: string,
    imageId: string,
    adminEmail?: string
  ) {
    const product = await validateProduct(productUuid);
    const id = parseImageId(imageId);

    const image = await productImageRepository.findById(id);
    if (!image || image.productId !== product.id) {
      throw ApiError.notFound("Product image not found");
    }

    const wasPrimary = Boolean(image.isPrimary);
    const adminId = await getAdminInternalId(adminEmail);

    await productImageRepository.softDeleteById(id, adminId);

    // Rule: If primary image was deleted, promote lowest sortOrder remaining active image
    if (wasPrimary) {
      await productImageRepository.promoteLowestSortOrderPrimary(product.id);
    }

    return {
      success: true,
      message: "Product image deleted successfully",
    };
  },
};
