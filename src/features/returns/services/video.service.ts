import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { ApiError } from "@/lib/api/api-error";
import { getUploadRoot } from "@/features/uploads/services/upload.service";
import {
  UNBOXING_VIDEO_MAX_BYTES,
  UNBOXING_VIDEO_URL_PREFIX,
} from "../lib/policy";
import { googleDriveService, isUnboxingVideoFilename } from "./google-drive.service";

/**
 * Unboxing videos are private customer evidence. They can be stored in Google Drive
 * and/or on local disk (never in public/ document root) and are streamed through
 * an authenticated endpoint.
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
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      const maxMb = UNBOXING_VIDEO_MAX_BYTES / (1024 * 1024);
      throw ApiError.badRequest(
        `Video is too large (${sizeMb} MB). Maximum size is ${maxMb} MB.`
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!looksLikeVideo(buffer, mime)) {
      throw ApiError.badRequest("The uploaded file is not a valid video.");
    }

    const filename = `u${userId}-${crypto.randomUUID()}${extension}`;

    // Always cache locally so video playback is fast
    await fs.mkdir(videoDir(), { recursive: true });
    await fs.writeFile(path.join(videoDir(), filename), buffer);

    // Upload to Google Drive if configured
    if (googleDriveService.isConfigured()) {
      try {
        await googleDriveService.uploadVideo({
          filename,
          mimeType: mime,
          buffer,
          description: `Customer ${userId} return unboxing video (${filename})`,
        });
      } catch (err) {
        console.error("[GoogleDrive] Video upload to Google Drive failed:", err);
      }
    }

    return {
      url: `${UNBOXING_VIDEO_URL_PREFIX}${filename}`,
      size: file.size,
      contentType: mime,
    };
  },

  /**
   * A submitted video URL must be one this user uploaded (prefix check) and it
   * must exist in Google Drive or on local disk.
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
      // If not on local disk, check Google Drive
      if (googleDriveService.isConfigured()) {
        const file = await googleDriveService.findFileByName(filename);
        if (file?.id) return url;
      }
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
    if (googleDriveService.isConfigured()) {
      await googleDriveService.deleteFileByName(filename);
    }
  },

  resolvePath(filename: string) {
    return path.join(videoDir(), filename);
  },

  /**
   * Calculates total video storage consumed in MB (local disk + Google Drive),
   * compares against 50 MB limit, and flags when reached 80% (40 MB).
   */
  async getStorageUsage(): Promise<{
    totalBytes: number;
    totalMb: number;
    limitMb: number;
    thresholdMb: number;
    thresholdPercent: number;
    usedPercent: number;
    fileCount: number;
    isReached: boolean;
    storageType: "google_drive" | "local" | "both";
  }> {
    const limitMb = 50;
    const thresholdPercent = 80;
    const thresholdMb = (limitMb * thresholdPercent) / 100; // 40 MB
    let localBytes = 0;
    let localCount = 0;

    try {
      const files = await fs.readdir(videoDir());
      for (const f of files) {
        // Only count return unboxing video files
        if (!isUnboxingVideoFilename(f)) continue;
        try {
          const stat = await fs.stat(path.join(videoDir(), f));
          if (stat.isFile()) {
            localBytes += stat.size;
            localCount++;
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // dir doesn't exist yet
    }

    let driveBytes = 0;
    let driveCount = 0;
    if (googleDriveService.isConfigured()) {
      const driveUsage = await googleDriveService.getFolderStorageUsage();
      driveBytes = driveUsage.totalBytes;
      driveCount = driveUsage.fileCount;
    }

    const totalBytes = Math.max(localBytes, driveBytes) || localBytes || driveBytes;
    const fileCount = Math.max(localCount, driveCount);
    const totalMb = Number((totalBytes / (1024 * 1024)).toFixed(2));
    const usedPercent = Math.min(100, Math.round((totalMb / limitMb) * 100));
    // Flag alert when 80% or more of storage is used
    const isReached = totalMb >= thresholdMb || usedPercent >= thresholdPercent;

    let storageType: "google_drive" | "local" | "both" = "local";
    if (googleDriveService.isConfigured() && driveBytes > 0) {
      storageType = localBytes > 0 ? "both" : "google_drive";
    }

    return {
      totalBytes,
      totalMb,
      limitMb,
      thresholdMb,
      thresholdPercent,
      usedPercent,
      fileCount,
      isReached,
      storageType,
    };
  },

  /**
   * Admin action to safely clear unboxing video storage.
   * STRICT SAFETY RULE: Only touches files matching return unboxing video patterns!
   * Any other files in Google Drive or local storage are completely untouched.
   */
  async clearStorage(): Promise<{
    clearedLocalCount: number;
    clearedDriveCount: number;
    totalCleared: number;
  }> {
    let clearedLocalCount = 0;
    try {
      const files = await fs.readdir(videoDir());
      for (const f of files) {
        // STRICT SAFETY CHECK: ONLY touch return unboxing video files
        if (isUnboxingVideoFilename(f)) {
          try {
            await fs.unlink(path.join(videoDir(), f));
            clearedLocalCount++;
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }

    let clearedDriveCount = 0;
    if (googleDriveService.isConfigured()) {
      const res = await googleDriveService.clearFolderStorage();
      clearedDriveCount = res.deletedCount;
    }

    return {
      clearedLocalCount,
      clearedDriveCount,
      totalCleared: clearedLocalCount + clearedDriveCount,
    };
  },
};
