import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { ApiError } from "@/lib/api/api-error";
import { getUploadRoot } from "@/features/uploads/services/upload.service";
import {
  ADMIN_UPLOAD_URL_PREFIX,
  SHIPPING_SLIP_MAX_BYTES,
  SHIPPING_SLIP_URL_PREFIX,
} from "../lib/policy";

/**
 * Courier / delivery slip photos proving the customer posted the return. They
 * carry names, addresses and tracking numbers, so - like unboxing videos -
 * they live outside the public document root and are streamed through an
 * authenticated endpoint that only the uploader and staff can reach.
 */
export const SLIP_FOLDER = "return-slips";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export const SLIP_CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/** `u<ownerId>-<uuid><ext>` - the owner is part of the name, as for videos. */
const FILENAME_RE =
  /^u(\d+)-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\.jpg|\.png|\.webp)$/;

function slipDir() {
  return path.join(getUploadRoot(), SLIP_FOLDER);
}

/** Magic-byte check, so a renamed file cannot pass as an image. */
function looksLikeImage(buffer: Buffer, mime: string): boolean {
  if (buffer.length < 12) return false;
  if (mime === "image/png") {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  if (mime === "image/webp") {
    return (
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  // JPEG: SOI marker.
  return buffer[0] === 0xff && buffer[1] === 0xd8;
}

export const slipService = {
  parseFilename(filename: string) {
    const match = FILENAME_RE.exec(filename);
    if (!match) return null;
    return { ownerId: match[1], extension: match[3] };
  },

  resolvePath(filename: string) {
    return path.join(slipDir(), filename);
  },

  async saveShippingSlip(userId: bigint, file: File) {
    if (!file || file.size === 0) {
      throw ApiError.badRequest("A delivery slip photo is required");
    }

    const mime = (file.type || "").toLowerCase();
    const extension = EXTENSIONS[mime];
    if (!extension) {
      throw ApiError.badRequest(
        "Unsupported image format. Please upload a JPG, PNG or WebP photo."
      );
    }

    if (file.size > SHIPPING_SLIP_MAX_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      const maxMb = SHIPPING_SLIP_MAX_BYTES / (1024 * 1024);
      throw ApiError.badRequest(
        `Photo is too large (${sizeMb} MB). Maximum size is ${maxMb} MB.`
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!looksLikeImage(buffer, mime)) {
      throw ApiError.badRequest("The uploaded file is not a valid image.");
    }

    const filename = `u${userId}-${crypto.randomUUID()}${extension}`;
    await fs.mkdir(slipDir(), { recursive: true });
    await fs.writeFile(path.join(slipDir(), filename), buffer);

    return {
      url: `${SHIPPING_SLIP_URL_PREFIX}${filename}`,
      size: file.size,
      contentType: mime,
    };
  },

  /**
   * A slip submitted with a `shipped` transition must be one this customer
   * uploaded and that still exists on disk. Staff may instead pass an image
   * they uploaded to the shared document root, for the case where the customer
   * sent the slip to them another way - a customer may not, or they could
   * point the slip at any file under the document root.
   */
  async assertUsableSlip(
    ownerId: bigint,
    url: string,
    { allowAdminUpload = false }: { allowAdminUpload?: boolean } = {}
  ): Promise<string> {
    const trimmed = url.trim();
    if (allowAdminUpload && trimmed.startsWith(ADMIN_UPLOAD_URL_PREFIX)) return trimmed;

    if (!trimmed.startsWith(SHIPPING_SLIP_URL_PREFIX)) {
      throw ApiError.badRequest("A valid delivery slip photo is required");
    }
    const filename = trimmed.slice(SHIPPING_SLIP_URL_PREFIX.length);
    const parsed = slipService.parseFilename(filename);
    if (!parsed || parsed.ownerId !== String(ownerId)) {
      throw ApiError.badRequest("A valid delivery slip photo is required");
    }
    try {
      const stat = await fs.stat(path.join(slipDir(), filename));
      if (!stat.isFile()) throw new Error("not a file");
    } catch {
      throw ApiError.badRequest(
        "The uploaded delivery slip could not be found. Please upload it again."
      );
    }
    return trimmed;
  },
};
