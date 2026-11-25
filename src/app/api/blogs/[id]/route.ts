import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess, apiError } from "@/lib/api/api-response";
import { blogService } from "@/features/blogs/services/blog.service";
import { updateBlogSchema } from "@/features/blogs/validations/blog.schema";

export const GET = createApiHandler({
  GET: async (_request, context) => {
    const id = context.params?.id;
    if (!id) return apiError("Blog ID is required", 400);
    const blog = await blogService.getBlog(id);
    return apiSuccess(blog, "Blog fetched successfully");
  },
});

export const PUT = createApiHandler(
  {
    PUT: async (_request, context) => {
      const id = context.params?.id;
      if (!id) return apiError("Blog ID is required", 400);
      const body = context.body as ReturnType<typeof updateBlogSchema.parse>;
      const userIdentifier =
        context.session?.user?.id || context.session?.user?.email;
      const blog = await blogService.updateBlog(parseInt(id, 10), body, userIdentifier);
      return apiSuccess(blog, "Blog updated successfully");
    },
  },
  {
    method: "PUT",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
    bodySchema: updateBlogSchema,
  }
);

export const DELETE = createApiHandler(
  {
    DELETE: async (_request, context) => {
      const id = context.params?.id;
      if (!id) return apiError("Blog ID is required", 400);
      await blogService.deleteBlog(parseInt(id, 10));
      return apiSuccess(null, "Blog deleted successfully");
    },
  },
  {
    method: "DELETE",
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
  }
);
