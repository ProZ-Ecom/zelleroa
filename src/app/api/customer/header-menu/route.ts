import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { headerMenuService } from "@/features/header-menu/services/header-menu.service";

export const GET = createApiHandler({
  GET: async () => {
    const items = await headerMenuService.getPublicHeaderMenu();
    return apiSuccess(items, "Header menu fetched successfully");
  },
});
