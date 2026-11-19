import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-handler";
import { ApiError } from "@/lib/api/api-error";
import { userRepository } from "@/features/users/repositories/user.repository";
import { SLIP_CONTENT_TYPES, slipService } from "@/features/returns/services/slip.service";

/**
 * GET /api/returns/slips/:filename - streams a private return delivery slip.
 * Allowed for the customer who uploaded it and for admin / staff only.
 */
export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const sessionUser = context.session?.user as
        | { id?: string; role?: string }
        | undefined;
      const filename = context.params?.filename ?? "";
      const parsed = slipService.parseFilename(filename);
      if (!sessionUser?.id || !parsed) throw ApiError.notFound("Photo not found");

      const isStaff = sessionUser.role === "ADMIN" || sessionUser.role === "STAFF";
      if (!isStaff) {
        const user = await userRepository.findById(sessionUser.id);
        if (!user?.internalId || String(user.internalId) !== parsed.ownerId) {
          throw ApiError.notFound("Photo not found");
        }
      }

      const filePath = slipService.resolvePath(filename);
      let stat: fs.Stats | null = null;
      try {
        stat = await fs.promises.stat(filePath);
        if (!stat.isFile()) stat = null;
      } catch {
        stat = null;
      }
      if (!stat) throw ApiError.notFound("Photo not found");

      return new NextResponse(
        Readable.toWeb(fs.createReadStream(filePath)) as unknown as ReadableStream,
        {
          status: 200,
          headers: new Headers({
            "Content-Type":
              SLIP_CONTENT_TYPES[path.extname(filename)] ?? "application/octet-stream",
            "Content-Length": String(stat.size),
            "Cache-Control": "private, max-age=3600",
            "X-Content-Type-Options": "nosniff",
          }),
        }
      );
    },
  },
  { requireAuth: true, rateLimit: false }
);
