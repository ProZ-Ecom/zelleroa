import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { staffService } from "@/features/staff/services/staff.service";

/** Roles a staff member can be put in: every active admin-panel role except the owner roles. */
export const GET = createApiHandler(
  {
    GET: async () => {
      const roles = await staffService.getAssignableRoles();
      return apiSuccess(roles, "Assignable staff roles fetched successfully");
    },
  },
  {
    requireAuth: true,
    requiredRole: ["ADMIN"],
  }
);
