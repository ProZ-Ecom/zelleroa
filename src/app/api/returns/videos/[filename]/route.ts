import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-handler";
import { ApiError } from "@/lib/api/api-error";
import { userRepository } from "@/features/users/repositories/user.repository";
import { VIDEO_CONTENT_TYPES, videoService } from "@/features/returns/services/video.service";

/**
 * GET /api/returns/videos/:filename - streams a private unboxing video.
 * Allowed for the uploader and for admin / staff only; supports Range for seeking.
 */
export const GET = createApiHandler(
  {
    GET: async (request, context) => {
      const sessionUser = context.session?.user as { id?: string; role?: string } | undefined;
      const filename = context.params?.filename ?? "";
      const parsed = videoService.parseFilename(filename);
      if (!sessionUser?.id || !parsed) throw ApiError.notFound("Video not found");

      const isStaff = sessionUser.role === "ADMIN" || sessionUser.role === "STAFF";
      if (!isStaff) {
        const user = await userRepository.findById(sessionUser.id);
        if (!user?.internalId || String(user.internalId) !== parsed.ownerId) {
          throw ApiError.notFound("Video not found");
        }
      }

      const filePath = videoService.resolvePath(filename);
      let stat: fs.Stats;
      try {
        stat = await fs.promises.stat(filePath);
        if (!stat.isFile()) throw new Error("not a file");
      } catch {
        throw ApiError.notFound("Video not found");
      }

      const headers = new Headers({
        "Content-Type": VIDEO_CONTENT_TYPES[path.extname(filename)] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
        "Accept-Ranges": "bytes",
        "X-Content-Type-Options": "nosniff",
      });

      const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
      if (match) {
        const start = match[1] ? parseInt(match[1], 10) : 0;
        const end = match[2] ? parseInt(match[2], 10) : stat.size - 1;
        if (start <= end && end < stat.size) {
          headers.set("Content-Range", `bytes ${start}-${end}/${stat.size}`);
          headers.set("Content-Length", String(end - start + 1));
          return new NextResponse(
            Readable.toWeb(fs.createReadStream(filePath, { start, end })) as unknown as ReadableStream,
            { status: 206, headers }
          );
        }
      }

      headers.set("Content-Length", String(stat.size));
      return new NextResponse(
        Readable.toWeb(fs.createReadStream(filePath)) as unknown as ReadableStream,
        { status: 200, headers }
      );
    },
  },
  { requireAuth: true, rateLimit: false }
);
