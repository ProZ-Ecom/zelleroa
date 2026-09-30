import crypto from "crypto";
import { ApiError } from "@/lib/api/api-error";
import { db } from "@/lib/db/prisma";
import { headerMenuRepository } from "../repositories/header-menu.repository";
import { categoryService, flattenTree } from "@/features/categories/services/category.service";
import { userRepository } from "@/features/users/repositories/user.repository";
import type { Prisma } from "@/generated/prisma";
import type {
  AdminHeaderMenuItemResponse,
  GetAdminHeaderMenuParams,
  HeaderNavItem,
} from "../types";
import type {
  CreateAdminHeaderMenuItemInput,
  UpdateAdminHeaderMenuItemInput,
} from "../validations/admin-header-menu.schema";

type HeaderMenuItemWithCategories = Prisma.HeaderMenuItemGetPayload<{
  include: {
    categories: {
      include: {
        category: { select: { id: true; uuid: true; slug: true; name: true; icon: true } };
      };
    };
  };
}>;

function formatAdminHeaderMenuItemResponse(
  item: HeaderMenuItemWithCategories
): AdminHeaderMenuItemResponse {
  return {
    id: item.uuid || String(item.id),
    label: item.label,
    categories: item.categories.map((join) => ({
      id: join.category.uuid || String(join.category.id),
      name: join.category.name,
      slug: join.category.slug,
    })),
    link: item.link,
    gender: item.gender,
    sortOrder: item.sortOrder,
    isActive: item.isActive,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

/** Resolves a category's public UUID (or numeric id string) to its internal bigint id. */
async function resolveCategoryInternalId(publicId: string): Promise<bigint | null> {
  const numericId = Number(publicId);
  const found = await db.productCategory.findFirst({
    where: {
      isActive: true,
      deleted_at: null,
      OR: [
        { uuid: publicId },
        ...(Number.isFinite(numericId) ? [{ id: BigInt(numericId) }] : []),
      ],
    },
    select: { id: true },
  });
  return found?.id ?? null;
}

async function resolveCategoryInternalIds(publicIds: string[]): Promise<bigint[]> {
  return Promise.all(
    publicIds.map(async (publicId) => {
      const resolved = await resolveCategoryInternalId(publicId);
      if (!resolved) {
        throw ApiError.badRequest(`Category not found: ${publicId}`);
      }
      return resolved;
    })
  );
}

/** Same as resolveCategoryInternalIds but drops ids that no longer resolve instead of throwing.
 * Used on update, where stale ids are carried over from a category that was deactivated/deleted
 * after being linked, not something the admin actively chose. */
async function resolveCategoryInternalIdsLenient(publicIds: string[]): Promise<bigint[]> {
  const resolved = await Promise.all(publicIds.map((publicId) => resolveCategoryInternalId(publicId)));
  return resolved.filter((id): id is bigint => id !== null);
}

async function getAdminInternalId(email?: string): Promise<bigint | null> {
  if (!email) return null;
  const user = await userRepository.findByEmail(email);
  if (!user) return null;
  return BigInt(user.internalId || user.id);
}

export const headerMenuService = {
  async createAdminHeaderMenuItem(
    data: CreateAdminHeaderMenuItemInput,
    adminEmail?: string
  ): Promise<AdminHeaderMenuItemResponse> {
    const adminId = await getAdminInternalId(adminEmail);
    const categoryInternalIds = await resolveCategoryInternalIds(data.categoryIds ?? []);
    const hasLink = Boolean(data.link?.trim());

    if (categoryInternalIds.length === 0 && !hasLink) {
      throw ApiError.badRequest("Select a category or provide a link");
    }
    if (categoryInternalIds.length > 0 && hasLink) {
      throw ApiError.badRequest("Choose either categories or a link, not both");
    }

    const created = await headerMenuRepository.create(
      {
        uuid: crypto.randomUUID(),
        label: data.label,
        link: data.link ?? null,
        gender: data.gender ?? null,
        sortOrder: data.sortOrder ?? 0,
        isActive: data.isActive ?? true,
        created_by: adminId,
        updated_by: adminId,
      },
      categoryInternalIds
    );

    return formatAdminHeaderMenuItemResponse(created);
  },

  async getAdminHeaderMenuItems(params: GetAdminHeaderMenuParams = {}) {
    const result = await headerMenuRepository.findAdminAll(params);
    return {
      data: result.data.map((item) => formatAdminHeaderMenuItemResponse(item)),
      meta: result.meta,
    };
  },

  async getAdminHeaderMenuItemByUuid(uuid: string): Promise<AdminHeaderMenuItemResponse> {
    const item = await headerMenuRepository.findByUuid(uuid);
    if (!item) {
      throw ApiError.notFound("Header menu item not found");
    }
    return formatAdminHeaderMenuItemResponse(item);
  },

  async updateAdminHeaderMenuItem(
    uuid: string,
    data: UpdateAdminHeaderMenuItemInput,
    adminEmail?: string
  ): Promise<AdminHeaderMenuItemResponse> {
    const existing = await headerMenuRepository.findByUuid(uuid);
    if (!existing) {
      throw ApiError.notFound("Header menu item not found");
    }

    const adminId = await getAdminInternalId(adminEmail);
    const updateData: Prisma.HeaderMenuItemUncheckedUpdateInput = {};

    if (adminId) {
      updateData.updated_by = adminId;
    }
    if (data.label !== undefined) {
      updateData.label = data.label;
    }
    if (data.link !== undefined) {
      updateData.link = data.link;
    }
    if (data.gender !== undefined) {
      updateData.gender = data.gender;
    }
    if (data.sortOrder !== undefined) {
      updateData.sortOrder = data.sortOrder;
    }
    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    const categoryInternalIds =
      data.categoryIds !== undefined
        ? await resolveCategoryInternalIdsLenient(data.categoryIds)
        : undefined;

    const nextCategoryCount = categoryInternalIds?.length ?? existing.categories.length;
    const nextLink = data.link !== undefined ? data.link : existing.link;
    const nextHasLink = Boolean(nextLink?.trim());
    if (nextCategoryCount === 0 && !nextHasLink) {
      throw ApiError.badRequest("Select a category or provide a link");
    }
    if (nextCategoryCount > 0 && nextHasLink) {
      throw ApiError.badRequest("Choose either categories or a link, not both");
    }

    const updated = await headerMenuRepository.updateByUuid(uuid, updateData, categoryInternalIds);
    if (!updated) {
      throw ApiError.notFound("Header menu item not found");
    }

    return formatAdminHeaderMenuItemResponse(updated);
  },

  async deleteAdminHeaderMenuItem(uuid: string, adminEmail?: string) {
    const existing = await headerMenuRepository.findByUuid(uuid);
    if (!existing) {
      throw ApiError.notFound("Header menu item not found");
    }

    const adminId = await getAdminInternalId(adminEmail);
    await headerMenuRepository.softDeleteByUuid(uuid, adminId);

    return {
      success: true,
      message: "Header menu item deleted successfully",
    };
  },

  /** Resolves active header menu items into storefront nav data: linked categories carry their live subtree. */
  async getPublicHeaderMenu(): Promise<HeaderNavItem[]> {
    const items = await headerMenuRepository.findActiveOrdered();
    if (items.length === 0) return [];

    const categoryTree = await categoryService.getCategoryTree();
    const flatTree = flattenTree(categoryTree);

    return items.map((item) => {
      const categories = item.categories.map((join) => {
        const categoryUuid = join.category.uuid || String(join.category.id);
        const node = flatTree.find((n) => n.id === categoryUuid);
        return (
          node ?? {
            id: categoryUuid,
            name: join.category.name,
            slug: join.category.slug,
            icon: join.category.icon,
            children: [],
          }
        );
      });

      return {
        id: item.uuid || String(item.id),
        label: item.label,
        link: item.link,
        gender: item.gender,
        categories,
      };
    });
  },
};
