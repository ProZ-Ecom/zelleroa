import { ApiError } from "@/lib/api/api-error";
import { slugify } from "@/lib/utils";
import { userRepository } from "@/features/users/repositories/user.repository";
import { Prisma } from "@/generated/prisma";
import { blogRepository } from "../repositories/blog.repository";
import type { GetBlogsParams, CreateBlogInput, UpdateBlogInput } from "../types";

export const blogService = {
  async getBlogs(params: GetBlogsParams = {}) {
    return blogRepository.findAll(params);
  },

  async getBlog(slugOrId: string) {
    const isNumeric = /^\d+$/.test(slugOrId);
    const blog = isNumeric
      ? await blogRepository.findById(parseInt(slugOrId, 10))
      : await blogRepository.findBySlug(slugOrId);
    if (!blog) {
      throw ApiError.notFound("Blog not found");
    }
    return blog;
  },

  async createBlog(data: CreateBlogInput, sessionUserIdentifier?: string | null) {
    const slug = slugify(data.title);

    const existing = await blogRepository.findBySlug(slug);
    if (existing) {
      throw ApiError.conflict("A blog with this slug already exists");
    }

    let authorId: bigint | undefined = undefined;

    if (
      data.authorId !== undefined &&
      data.authorId !== null &&
      !isNaN(Number(data.authorId))
    ) {
      authorId = BigInt(data.authorId);
    } else if (sessionUserIdentifier) {
      const user = await userRepository.findById(sessionUserIdentifier);
      if (user?.internalId) {
        authorId = user.internalId;
      }
    }

    const isPublished = data.status === "PUBLISHED";
    return blogRepository.create({
      title: data.title,
      slug,
      content: data.content,
      featured_image: data.image ? data.image : undefined,
      is_published: isPublished,
      publishedAt: isPublished ? new Date() : null,
      ...(authorId
        ? {
            author: { connect: { id: authorId } },
            users_blogs_created_byTousers: { connect: { id: authorId } },
            users_blogs_updated_byTousers: { connect: { id: authorId } },
          }
        : {}),
    });
  },

  async updateBlog(
    id: number,
    data: UpdateBlogInput,
    sessionUserIdentifier?: string | null
  ) {
    const existing = await blogRepository.findById(id);
    if (!existing) {
      throw ApiError.notFound("Blog not found");
    }

    const slug = data.title ? slugify(data.title) : existing.slug;

    if (slug !== existing.slug) {
      const slugExists = await blogRepository.findBySlug(slug);
      if (slugExists) {
        throw ApiError.conflict("A blog with this slug already exists");
      }
    }

    let updatedBy: bigint | undefined = undefined;
    if (sessionUserIdentifier) {
      const user = await userRepository.findById(sessionUserIdentifier);
      if (user?.internalId) {
        updatedBy = user.internalId;
      }
    }

    const updateData: Prisma.BlogUpdateInput = {};
    if (data.title !== undefined) updateData.title = data.title;
    updateData.slug = slug;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.image !== undefined) updateData.featured_image = data.image ? data.image : null;
    if (
      data.authorId !== undefined &&
      data.authorId !== null &&
      !isNaN(Number(data.authorId))
    ) {
      updateData.author = { connect: { id: BigInt(data.authorId) } };
    }
    if (updatedBy) {
      updateData.users_blogs_updated_byTousers = { connect: { id: updatedBy } };
    }

    if (data.status !== undefined) {
      const isPub = data.status === "PUBLISHED";
      updateData.is_published = isPub;
      if (isPub && !existing.is_published) {
        updateData.publishedAt = new Date();
      }
    }

    return blogRepository.update(id, updateData as never);
  },

  async deleteBlog(id: number) {
    const existing = await blogRepository.findById(id);
    if (!existing) {
      throw ApiError.notFound("Blog not found");
    }
    return blogRepository.delete(id);
  },
};
