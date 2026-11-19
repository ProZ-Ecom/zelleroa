import { ApiError } from "@/lib/api/api-error";
import { userRepository } from "@/features/users/repositories/user.repository";
import { offerRepository } from "@/features/offers/repositories/offer.repository";
import { bannerPositionRepository } from "../repositories/banner-position.repository";
import {
  bannerRepository,
  formatBanner,
} from "../repositories/banner.repository";
import type {
  CreateBannerInput,
  UpdateBannerInput,
  BannerListQueryInput,
  CustomerBannerQueryInput,
} from "../validations/banner.schema";
import type {
  BannerDto,
  BannerListResponse,
  CustomerBannerDto,
} from "../types/banner.types";

import { uploadService } from "@/features/uploads/services/upload.service";

async function resolveInternalUserId(
  sessionUserId?: string
): Promise<bigint | undefined> {
  if (!sessionUserId) return undefined;
  const user = await userRepository.findById(sessionUserId);
  return user?.internalId;
}

async function resolveBannerPosition(positionUuid: string) {
  const position = await bannerPositionRepository.findByUuid(positionUuid);
  if (!position) {
    throw ApiError.notFound("Banner position not found");
  }
  return position;
}

async function resolveOfferInternalId(
  offerUuid: string | null | undefined
): Promise<bigint | null | undefined> {
  if (offerUuid === undefined) return undefined;
  if (offerUuid === null) return null;
  const id = await offerRepository.findInternalIdByUuid(offerUuid);
  if (!id) throw ApiError.notFound("Offer not found");
  return id;
}

export const bannerService = {
  async createBanner(
    input: CreateBannerInput,
    sessionUserId?: string
  ): Promise<BannerDto> {
    const position = await resolveBannerPosition(input.bannerPositionId);

    if (input.startsAt && input.endsAt) {
      if (input.startsAt.getTime() > input.endsAt.getTime()) {
        throw ApiError.badRequest("startsAt must be before or equal to endsAt");
      }
    }

    const userInternalId = await resolveInternalUserId(sessionUserId);

    return bannerRepository.create(
      {
        ...input,
        positionInternalId: position.id,
        offerInternalId: await resolveOfferInternalId(input.offerId),
      },
      userInternalId
    );
  },

  async getBanners(
    params: BannerListQueryInput
  ): Promise<BannerListResponse> {
    let resolvedPositionId: bigint | undefined = undefined;

    if (params.bannerPositionId) {
      const position = await bannerPositionRepository.findByUuid(
        params.bannerPositionId
      );
      if (!position) {
        return {
          data: [],
          meta: {
            page: params.page ?? 1,
            limit: params.limit ?? 10,
            total: 0,
            totalPages: 1,
          },
        };
      }
      resolvedPositionId = position.id;
    }

    return bannerRepository.findAll(params, resolvedPositionId);
  },

  async getBannerByUuid(uuid: string): Promise<BannerDto> {
    const record = await bannerRepository.findByUuid(uuid);
    if (!record) {
      throw ApiError.notFound("Banner not found");
    }
    return formatBanner(record);
  },

  async updateBanner(
    uuid: string,
    input: UpdateBannerInput,
    sessionUserId?: string
  ): Promise<BannerDto> {
    const existing = await bannerRepository.findByUuid(uuid);
    if (!existing) {
      throw ApiError.notFound("Banner not found");
    }

    let positionInternalId: bigint | undefined = undefined;
    if (input.bannerPositionId) {
      const position = await resolveBannerPosition(input.bannerPositionId);
      positionInternalId = position.id;
    }

    const effectiveStartsAt =
      input.startsAt !== undefined ? input.startsAt : existing.startsAt;
    const effectiveEndsAt =
      input.endsAt !== undefined ? input.endsAt : existing.ends_at;

    if (effectiveStartsAt && effectiveEndsAt) {
      if (effectiveStartsAt.getTime() > effectiveEndsAt.getTime()) {
        throw ApiError.badRequest("startsAt must be before or equal to endsAt");
      }
    }

    const userInternalId = await resolveInternalUserId(sessionUserId);

    return bannerRepository.update(
      existing.id,
      {
        ...input,
        positionInternalId,
        offerInternalId: await resolveOfferInternalId(input.offerId),
      },
      userInternalId
    );
  },

  async deleteBanner(uuid: string): Promise<void> {
    const record = await bannerRepository.findByUuid(uuid);
    if (!record) {
      throw ApiError.notFound("Banner not found");
    }

    // Safely delete local image/video files if stored under /uploads/banners/
    if (record.image_url) {
      try {
        await uploadService.deleteUploadedFile(record.image_url, "banners");
      } catch (error) {
        console.error("Failed to delete banner image file:", error);
      }
    }

    if (record.video_url) {
      try {
        await uploadService.deleteUploadedFile(record.video_url, "banners");
      } catch (error) {
        console.error("Failed to delete banner video file:", error);
      }
    }

    if (record.thumbnail_url) {
      try {
        await uploadService.deleteUploadedFile(
          record.thumbnail_url,
          "banners"
        );
      } catch (error) {
        console.error("Failed to delete banner thumbnail file:", error);
      }
    }

    // Permanently delete database record
    await bannerRepository.delete(record.id);
  },

  async getCustomerActiveBanners(
    params: CustomerBannerQueryInput
  ): Promise<CustomerBannerDto[]> {
    return bannerRepository.findActiveCustomerBanners(params);
  },
};

