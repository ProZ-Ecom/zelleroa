import { ApiError } from "@/lib/api/api-error";
import { slugify } from "@/lib/utils";
import { userRepository } from "@/features/users/repositories/user.repository";
import { tagRepository } from "../repositories/tag.repository";
import type {
  AdminTagDetailResponse,
  AdminTagResponse,
  GetAdminTagsParams,
} from "../types";
import type {
  AssignTagProductsInput,
  CreateAdminTagInput,
  UpdateAdminTagInput,
} from "../validations/admin-tag.schema";

type TagRow = NonNullable<Awaited<ReturnType<typeof tagRepository.findById>>>;

function formatTag(tag: TagRow): AdminTagResponse {
  const products = (tag.product_tag_maps ?? []).map((m) => ({
    id: m.products.uuid || String(m.products.id),
    name: m.products.name,
  }));
  return {
    id: String(tag.id),
    name: tag.name,
    slug: tag.slug,
    isActive: tag.is_active,
    productCount: tag._count.product_tag_maps,
    products,
    productNames: products.map((p) => p.name).join(", "),
    createdAt: tag.created_at,
    updatedAt: tag.updated_at,
  };
}

function parseTagId(publicId: string): bigint {
  if (!/^\d+$/.test(publicId)) throw ApiError.badRequest("Invalid tag id");
  return BigInt(publicId);
}

async function getAdminInternalId(email?: string): Promise<bigint | null> {
  if (!email) return null;
  const user = await userRepository.findByEmail(email);
  if (!user) return null;
  return BigInt(user.internalId || user.id);
}

/** Slug from the name; a numeric suffix keeps it unique when another tag already owns it. */
async function uniqueSlug(name: string, ignoreId?: bigint): Promise<string> {
  const base = slugify(name) || "tag";
  let candidate = base;
  for (let n = 2; n < 100; n++) {
    const existing = await tagRepository.findBySlug(candidate);
    if (!existing || existing.id === ignoreId) return candidate;
    candidate = `${base}-${n}`;
  }
  throw ApiError.conflict("Could not generate a unique slug for this tag");
}

async function requireTag(publicId: string) {
  const tag = await tagRepository.findById(parseTagId(publicId));
  if (!tag) throw ApiError.notFound("Tag not found");
  return tag;
}

export const tagService = {
  async getAdminTags(params: GetAdminTagsParams = {}) {
    const result = await tagRepository.findAdminAll(params);
    return { data: result.data.map(formatTag), meta: result.meta };
  },

  async getAdminTag(publicId: string): Promise<AdminTagDetailResponse> {
    const tag = await requireTag(publicId);
    const products = await tagRepository.findProducts(tag.id);
    return {
      ...formatTag(tag),
      products: products.map((p) => ({ id: p.uuid || String(p.id), name: p.name })),
    };
  },

  async createTag(data: CreateAdminTagInput, adminEmail?: string): Promise<AdminTagResponse> {
    const adminId = await getAdminInternalId(adminEmail);
    const created = await tagRepository.create({
      name: data.name,
      slug: await uniqueSlug(data.name),
      is_active: data.isActive ?? true,
      created_by: adminId,
      updated_by: adminId,
    });
    return formatTag(created);
  },

  async updateTag(
    publicId: string,
    data: UpdateAdminTagInput,
    adminEmail?: string
  ): Promise<AdminTagResponse> {
    const existing = await requireTag(publicId);
    const adminId = await getAdminInternalId(adminEmail);

    const updated = await tagRepository.update(existing.id, {
      ...(data.name !== undefined && data.name !== existing.name
        ? { name: data.name, slug: await uniqueSlug(data.name, existing.id) }
        : {}),
      ...(data.isActive !== undefined ? { is_active: data.isActive } : {}),
      ...(adminId ? { updated_by: adminId } : {}),
    });
    return formatTag(updated);
  },

  async deleteTag(publicId: string) {
    const existing = await requireTag(publicId);
    await tagRepository.delete(existing.id);
    return { success: true, message: "Tag deleted successfully" };
  },

  async assignProducts(publicId: string, data: AssignTagProductsInput, adminEmail?: string) {
    const tag = await requireTag(publicId);
    const adminId = await getAdminInternalId(adminEmail);
    const productIds = await tagRepository.resolveProductIds(data.productIds);

    if (data.action === "add") await tagRepository.addProducts(tag.id, productIds, adminId);
    else if (data.action === "remove") await tagRepository.removeProducts(tag.id, productIds);
    else await tagRepository.setProducts(tag.id, productIds, adminId);

    return this.getAdminTag(publicId);
  },
};
