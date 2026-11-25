import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiCreated } from "@/lib/api/api-response";
import { blogService } from "@/features/blogs/services/blog.service";
import { getBlogsQuerySchema, createBlogSchema } from "@/features/blogs/validations/blog.schema";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const query = context.query as ReturnType<typeof getBlogsQuerySchema.parse>;
      const result = await blogService.getBlogs({
        page: query.page,
        limit: query.limit,
        search: query.search,
        status: query.status,
      });
      return apiSuccess(result.data, "Blogs fetched successfully", 200, result.meta);
    },
  },
  { querySchema: getBlogsQuerySchema }
);

export const POST = createApiHandler(
  {
    POST: async (_request, context) => {
      const body = context.body as ReturnType<typeof createBlogSchema.parse>;
      const userIdentifier =
        context.session?.user?.id || context.session?.user?.email;
      const blog = await blogService.createBlog(body, userIdentifier);
      return apiCreated(blog, "Blog created successfully");
    },
  },
  {
    method: "POST",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    bodySchema: createBlogSchema,
  }
);
