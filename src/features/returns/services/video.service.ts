import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { ApiError } from "@/lib/api/api-error";
import { getUploadRoot } from "@/features/uploads/services/upload.service";
import {
  UNBOXING_VIDEO_MAX_BYTES,
  UNBOXING_VIDEO_URL_PREFIX,
} from "../lib/policy";

/**
 * Unboxing videos are private customer evidence, so they live in their own
 * folder (never the public /document route) and are streamed through an
 * authenticated endpoint. File names embed the uploader's user id, which is
 * how ownership is enforced both at serve time and at submission time.
 */
export const VIDEO_FOLDER = "return-videos";

const EXTENSIONS: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};

export const VIDEO_CONTENT_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};

const FILENAME_RE = /^u(\d+)-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\.mp4|\.webm|\.mov)$/;

function videoDir() {
  return path.join(getUploadRoot(), VIDEO_FOLDER);
}

/** MP4/MOV carry an `ftyp` box at byte 4, WebM/Matroska starts with the EBML magic. */
function looksLikeVideo(buffer: Buffer, mime: string): boolean {
  if (buffer.length < 12) return false;
  if (mime === "video/webm") {
    return (
      buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3
    );
  }
  return buffer.subarray(4, 8).toString("ascii") === "ftyp";
}

export const videoService = {
  parseFilename(filename: string) {
    const match = FILENAME_RE.exec(filename);
    if (!match) return null;
    return { ownerId: match[1], extension: match[3] };
  },

  async saveUnboxingVideo(userId: bigint, file: File) {
    if (!file || file.size === 0) {
      throw ApiError.badRequest("Unboxing video is required");
    }

    const mime = (file.type || "").toLowerCase();
    const extension = EXTENSIONS[mime];
    if (!extension) {
      throw ApiError.badRequest(
        "Unsupported video format. Please upload an MP4, WebM or MOV video."
      );
    }

    if (file.size > UNBOXING_VIDEO_MAX_BYTES) {
      throw ApiError.badRequest(
        `Video is too large. Maximum size is ${UNBOXING_VIDEO_MAX_BYTES / (1024 * 1024)} MB.`
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!looksLikeVideo(buffer, mime)) {
      throw ApiError.badRequest("The uploaded file is not a valid video.");
    }

    await fs.mkdir(videoDir(), { recursive: true });
    const filename = `u${userId}-${crypto.randomUUID()}${extension}`;
    await fs.writeFile(path.join(videoDir(), filename), buffer);

    return {
      url: `${UNBOXING_VIDEO_URL_PREFIX}${filename}`,
      size: file.size,
      contentType: mime,
    };
  },

  /**
   * A submitted video URL must be one this user uploaded (prefix check) and it
   * must still exist on disk. Prevents pointing a request at someone else's
   * video, at an external URL, or at an arbitrary path.
   */
  async assertOwnedVideo(userId: bigint, url: string): Promise<string> {
    if (!url || !url.startsWith(UNBOXING_VIDEO_URL_PREFIX)) {
      throw ApiError.badRequest("A valid unboxing video is required");
    }
    const filename = url.slice(UNBOXING_VIDEO_URL_PREFIX.length);
    const parsed = videoService.parseFilename(filename);
    if (!parsed || parsed.ownerId !== String(userId)) {
      throw ApiError.badRequest("A valid unboxing video is required");
    }
    try {
      const stat = await fs.stat(path.join(videoDir(), filename));
      if (!stat.isFile()) throw new Error("not a file");
    } catch {
      throw ApiError.badRequest(
        "The uploaded unboxing video could not be found. Please upload it again."
      );
    }
    return url;
  },

  async deleteVideo(userId: bigint, url: string) {
    if (!url.startsWith(UNBOXING_VIDEO_URL_PREFIX)) return;
    const filename = url.slice(UNBOXING_VIDEO_URL_PREFIX.length);
    const parsed = videoService.parseFilename(filename);
    if (!parsed || parsed.ownerId !== String(userId)) return;
    try {
      await fs.unlink(path.join(videoDir(), filename));
    } catch {
      // already gone
    }
  },

  resolvePath(filename: string) {
    return path.join(videoDir(), filename);
  },
};
