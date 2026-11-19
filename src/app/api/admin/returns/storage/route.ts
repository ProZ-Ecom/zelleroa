import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { videoService } from "@/features/returns/services/video.service";

export const GET = createApiHandler(
  {
    GET: async () => {
      const usage = await videoService.getStorageUsage();
      return apiSuccess(usage, "Storage usage fetched successfully");
    },
  },
  {
    requireAuth: true,
    requiredRole: ["ADMIN", "STAFF"],
  }
);

export const POST = createApiHandler(
  {
    POST: async () => {
      const cleared = await videoService.clearStorage();
      return apiSuccess(
        cleared,
        `Storage cleared successfully. Deleted ${cleared.totalCleared} unboxing video(s). Other files were not touched.`
      );
    },
  },
  {
    requireAuth: true,
    requiredRole: ["ADMIN"],
  }
);

