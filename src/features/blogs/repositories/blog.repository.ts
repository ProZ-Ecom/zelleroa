import { db } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma";
import type { GetBlogsParams, BlogListItem } from "../types";

const blogListInclude = Prisma.validator<Prisma.BlogInclude>()({
  author: { select: { id: true, name: true, email: true } },
});

export function formatBlogListItem(blog: any): BlogListItem {
  let status = "DRAFT";
  if (blog.is_active === false) {
    status = "ARCHIVED";
  } else if (blog.is_published) {
    status = "PUBLISHED";
  }

  return {
    id: Number(blog.id),
    title: blog.title,
    slug: blog.slug,
    content: blog.content,
    excerpt: blog.excerpt ?? null,
    image: blog.featured_image ?? blog.image ?? null,
    authorId: blog.authorId ? Number(blog.authorId) : 0,
    status,
    metaTitle: blog.metaTitle ?? null,
    metaDescription: blog.metaDescription ?? null,
    publishedAt: blog.publishedAt,
    createdAt: blog.createdAt,
    author: blog.author ? { name: blog.author.name } : undefined,
    is_published: blog.is_published,
    is_active: blog.is_active,
  } as BlogListItem;
}

function buildBlogWhere(params: GetBlogsParams): Prisma.BlogWhereInput {
  const where: Prisma.BlogWhereInput = {};

  if (params.status) {
    if (params.status === "ARCHIVED" || params.status === "archived") {
      where.is_active = false;
    } else {
      where.is_active = true;
      where.is_published = params.status === "PUBLISHED" || params.status === "published";
    }
  }

  if (params.search) {
    where.OR = [{ title: { contains: params.search } }];
  }

  return where;
}

export const blogRepository = {
  async findAll(params: GetBlogsParams = {}) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const where = buildBlogWhere(params);

    const [data, total] = await Promise.all([
      db.blog.findMany({
        where,
        include: blogListInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.blog.count({ where }),
    ]);

    return {
      data: data.map(formatBlogListItem),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async findById(id: number | bigint) {
    const blog = await db.blog.findUnique({
      where: { id: BigInt(id) },
      include: blogListInclude,
    });
    return blog ? formatBlogListItem(blog) : null;
  },

  async findBySlug(slug: string) {
    const blog = await db.blog.findUnique({
      where: { slug },
      include: blogListInclude,
    });
    return blog ? formatBlogListItem(blog) : null;
  },

  async create(data: Prisma.BlogCreateInput) {
    const blog = await db.blog.create({
      data,
      include: blogListInclude,
    });
    return formatBlogListItem(blog);
  },

  async update(id: number | bigint, data: Prisma.BlogUpdateInput) {
    const blog = await db.blog.update({
      where: { id: BigInt(id) },
      data,
      include: blogListInclude,
    });
    return formatBlogListItem(blog);
  },

  async delete(id: number | bigint) {
    return db.blog.delete({ where: { id: BigInt(id) } });
  },
};
