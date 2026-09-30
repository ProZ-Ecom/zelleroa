import crypto from "crypto";
import { ApiError } from "@/lib/api/api-error";
import { db } from "@/lib/db/prisma";
import { categoryRepository } from "../repositories/category.repository";
import { userRepository } from "@/features/users/repositories/user.repository";
import type { Prisma } from "@/generated/prisma";
import type {
  GetCategoriesParams,
  CreateCategoryInput,
  UpdateCategoryInput,
  GetAdminCategoriesParams,
  AdminCategoryResponse,
  AdminCategoriesCountResponse,
  CategoryTreeNode,
} from "../types";
import type {
  CreateAdminCategoryInput,
  UpdateAdminCategoryInput,
} from "../validations/admin-category.schema";

function formatAdminCategoryResponse(category: {
  id: bigint;
  uuid: string | null;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  status: boolean | null;
  isActive: boolean;
  sortOrder: number;
  parentId?: bigint | null;
  parentUuid?: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AdminCategoryResponse {
  const categoryUuid = category.uuid || String(category.id);
  return {
    id: categoryUuid,
    name: category.name,
    slug: category.slug,
    description: category.description ?? null,
    icon: category.icon ?? null,
    status: category.status === null || category.status === undefined ? true : Boolean(category.status),
    isActive: Boolean(category.isActive),
    sortOrder: category.sortOrder ?? 0,
    parentId: category.parentUuid ?? (category.parentId ? String(category.parentId) : null),
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

/** Resolves a category's public UUID (or numeric id string) to its internal bigint id. */
async function resolveCategoryInternalId(publicId: string): Promise<bigint | null> {
  const numericId = Number(publicId);
  const found = await db.productCategory.findFirst({
    where: {
      OR: [
        { uuid: publicId },
        ...(Number.isFinite(numericId) ? [{ id: BigInt(numericId) }] : []),
      ],
    },
    select: { id: true },
  });
  return found?.id ?? null;
}

/** Builds a nested tree from the flat active-category list, sorted by sortOrder. */
function buildCategoryTree(
  flat: { id: bigint; uuid: string | null; slug: string; name: string; icon: string | null; parentId: bigint | null; sortOrder: number }[]
): CategoryTreeNode[] {
  const byParent = new Map<string, typeof flat>();
  for (const cat of flat) {
    const key = cat.parentId === null ? "root" : String(cat.parentId);
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(cat);
  }

  function build(parentKey: string): CategoryTreeNode[] {
    const children = byParent.get(parentKey) ?? [];
    return children
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => ({
        id: c.uuid || String(c.id),
        name: c.name,
        slug: c.slug,
        icon: c.icon,
        children: build(String(c.id)),
      }));
  }

  return build("root");
}

export function flattenTree(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
  return nodes.flatMap((n) => [n, ...flattenTree(n.children)]);
}

async function buildParentUuidMap(): Promise<Map<string, string | null>> {
  const flat = await categoryRepository.findAllActiveFlat();
  return new Map(flat.map((c) => [String(c.id), c.uuid]));
}

/** Internal-id (not uuid) descendant set, used to block moving a category under its own subtree. */
async function getDescendantInternalIds(rootId: bigint): Promise<Set<string>> {
  const flat = await categoryRepository.findAllActiveFlat();
  const byParent = new Map<string, typeof flat>();
  for (const cat of flat) {
    const key = cat.parentId === null ? "root" : String(cat.parentId);
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(cat);
  }

  const result = new Set<string>();
  const stack = [String(rootId)];
  while (stack.length) {
    const current = stack.pop()!;
    const children = byParent.get(current) ?? [];
    for (const child of children) {
      result.add(String(child.id));
      stack.push(String(child.id));
    }
  }
  return result;
}

async function getAdminInternalId(email?: string): Promise<bigint | null> {
  if (!email) return null;
  const user = await userRepository.findByEmail(email);
  if (!user) return null;
  return BigInt(user.internalId || user.id);
}

export const categoryService = {
  // Public Category Methods
  async getCategories(params: GetCategoriesParams = {}) {
    return categoryRepository.findAll(params);
  },

  async getCategory(slugOrId: string) {
    const category = await categoryRepository.findBySlugOrId(slugOrId);
    if (!category) {
      throw ApiError.notFound("Category not found");
    }
    return category;
  },

  async getCategoryById(id: number) {
    const category = await categoryRepository.findById(id);
    if (!category) {
      throw ApiError.notFound("Category not found");
    }
    return category;
  },

  async createCategory(data: CreateCategoryInput) {
    const existingSlug = await categoryRepository.findBySlug(data.slug);
    if (existingSlug) {
      throw ApiError.conflict("A category with this slug already exists");
    }
    // if (data.parentId) {
    //   const parent = await categoryRepository.findById(data.parentId);
    //   if (!parent) {
    //     throw ApiError.badRequest("Parent category not found");
    //   }
    // }

    return categoryRepository.create({
      name: data.name,
      slug: data.slug,
      description: data.description,
      icon: data.image,
      isActive: data.isActive ?? true,
      status: true,
      sortOrder: data.sortOrder ?? 0,
    });
  },

  async updateCategory(id: number, data: UpdateCategoryInput) {
    const existing = await categoryRepository.findById(id);
    if (!existing) {
      throw ApiError.notFound("Category not found");
    }

    if (data.slug && data.slug !== existing.slug) {
      const slugExists = await categoryRepository.findBySlug(data.slug);
      if (slugExists) {
        throw ApiError.conflict("A category with this slug already exists");
      }
    }

    const updateData: Prisma.ProductCategoryUncheckedUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.image !== undefined) updateData.icon = data.image;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

    return categoryRepository.update(id, updateData);
  },

  async deleteCategory(id: number) {
    const existing = await categoryRepository.findById(id);
    if (!existing) {
      throw ApiError.notFound("Category not found");
    }

    return categoryRepository.softDeleteByUuid(existing.uuid || String(existing.id));
  },

  // Admin Master Category API Methods
  async createAdminCategory(
    data: CreateAdminCategoryInput,
    adminEmail?: string
  ): Promise<AdminCategoryResponse> {
    const adminId = await getAdminInternalId(adminEmail);

    // 1. Check duplicate slug
    const existingSlug = await categoryRepository.findBySlug(data.slug);
    if (existingSlug) {
      throw ApiError.conflict(`A category with slug '${data.slug}' already exists`);
    }

    // 2. Check duplicate name
    const existingName = await categoryRepository.findByName(data.name);
    if (existingName) {
      throw ApiError.conflict(`A category with name '${data.name}' already exists`);
    }

    // 3. Resolve parent (if any)
    let parentInternalId: bigint | null = null;
    if (data.parentId) {
      parentInternalId = await resolveCategoryInternalId(data.parentId);
      if (!parentInternalId) {
        throw ApiError.badRequest("Parent category not found");
      }
    }

    const created = await categoryRepository.create({
      uuid: crypto.randomUUID(),
      name: data.name,
      slug: data.slug, // Use exact frontend slug without modification
      description: data.description ?? null,
      icon: data.icon ?? null,
      sortOrder: data.sortOrder ?? 0,
      parentId: parentInternalId ?? undefined,
      status: true, // Reserved field - always set to true
      isActive: true, // Active status
      created_by: adminId,
      updated_by: adminId,
    });

    const parentUuidMap = await buildParentUuidMap();
    return formatAdminCategoryResponse({
      ...created,
      parentUuid: created.parentId ? parentUuidMap.get(String(created.parentId)) ?? null : null,
    });
  },

  async getAdminCategories(params: GetAdminCategoriesParams = {}) {
    const result = await categoryRepository.findAdminAll(params);
    const parentUuidMap = await buildParentUuidMap();
    return {
      data: result.data.map((cat) =>
        formatAdminCategoryResponse({
          ...cat,
          parentUuid: cat.parentId ? parentUuidMap.get(String(cat.parentId)) ?? null : null,
        })
      ),
      meta: result.meta,
    };
  },

  async countAdminCategories(
    params: GetAdminCategoriesParams = {}
  ): Promise<AdminCategoriesCountResponse> {
    return categoryRepository.countAdminCategories(params);
  },

  async getAdminCategoryByUuid(uuid: string): Promise<AdminCategoryResponse> {
    const category = await categoryRepository.findByUuid(uuid);
    if (!category) {
      throw ApiError.notFound("Category not found");
    }
    const parentUuidMap = await buildParentUuidMap();
    return formatAdminCategoryResponse({
      ...category,
      parentUuid: category.parentId ? parentUuidMap.get(String(category.parentId)) ?? null : null,
    });
  },

  async updateAdminCategory(
    uuid: string,
    data: UpdateAdminCategoryInput,
    adminEmail?: string
  ): Promise<AdminCategoryResponse> {
    const existing = await categoryRepository.findByUuid(uuid);
    if (!existing) {
      throw ApiError.notFound("Category not found");
    }

    const adminId = await getAdminInternalId(adminEmail);
    const updateData: Prisma.ProductCategoryUncheckedUpdateInput = {};

    if (adminId) {
      updateData.updated_by = adminId;
    }

    // Check slug conflict if slug changes
    if (data.slug !== undefined && data.slug !== existing.slug) {
      const slugConflict = await categoryRepository.findBySlug(data.slug, uuid);
      if (slugConflict) {
        throw ApiError.conflict(`A category with slug '${data.slug}' already exists`);
      }
      updateData.slug = data.slug;
    }

    // Check name conflict if name changes
    if (data.name !== undefined && data.name !== existing.name) {
      const nameConflict = await categoryRepository.findByName(data.name, uuid);
      if (nameConflict) {
        throw ApiError.conflict(`A category with name '${data.name}' already exists`);
      }
      updateData.name = data.name;
    }

    if (data.description !== undefined) {
      updateData.description = data.description;
    }

    if (data.icon !== undefined) {
      updateData.icon = data.icon;
    }

    if (data.sortOrder !== undefined) {
      updateData.sortOrder = data.sortOrder;
    }

    if (data.parentId !== undefined) {
      if (data.parentId === null) {
        updateData.parentId = null;
      } else {
        const parentInternalId = await resolveCategoryInternalId(data.parentId);
        if (!parentInternalId) {
          throw ApiError.badRequest("Parent category not found");
        }
        if (parentInternalId === existing.id) {
          throw ApiError.badRequest("A category cannot be its own parent");
        }
        const descendantIds = await getDescendantInternalIds(existing.id);
        if (descendantIds.has(String(parentInternalId))) {
          throw ApiError.badRequest("Cannot move a category under its own subcategory");
        }
        updateData.parentId = parentInternalId;
      }
    }

    const updated = await categoryRepository.updateByUuid(uuid, updateData);
    if (!updated) {
      throw ApiError.notFound("Category not found");
    }

    const parentUuidMap = await buildParentUuidMap();
    return formatAdminCategoryResponse({
      ...updated,
      parentUuid: updated.parentId ? parentUuidMap.get(String(updated.parentId)) ?? null : null,
    });
  },

  /** Builds the nested category tree (id/uuid/name/slug/icon/children[]) for nav/routing. */
  async getCategoryTree(): Promise<CategoryTreeNode[]> {
    const flat = await categoryRepository.findAllActiveFlat();
    return buildCategoryTree(flat);
  },

  /** Walks the tree following each slug segment; returns the matched chain, or null if any segment doesn't match. */
  async resolveCategoryPath(slugs: string[]): Promise<CategoryTreeNode[] | null> {
    if (slugs.length === 0) return null;
    const tree = await this.getCategoryTree();
    const chain: CategoryTreeNode[] = [];
    let currentLevel = tree;

    for (const slug of slugs) {
      const match = currentLevel.find((c) => c.slug === slug);
      if (!match) return null;
      chain.push(match);
      currentLevel = match.children;
    }

    return chain;
  },

  /** Returns the category's own uuid plus every descendant's uuid. */
  async getDescendantCategoryUuids(categoryUuid: string): Promise<string[]> {
    const tree = await this.getCategoryTree();
    const flatAll = flattenTree(tree);
    const root = flatAll.find((c) => c.id === categoryUuid);
    if (!root) return [categoryUuid];
    return [root.id, ...flattenTree(root.children).map((c) => c.id)];
  },

  async deleteAdminCategory(uuid: string, adminEmail?: string) {
    const existing = await categoryRepository.findByUuid(uuid);
    if (!existing) {
      throw ApiError.notFound("Category not found");
    }

    const adminId = await getAdminInternalId(adminEmail);
    await categoryRepository.softDeleteByUuid(uuid, adminId);

    return {
      success: true,
      message: "Category deleted successfully",
    };
  },
};
