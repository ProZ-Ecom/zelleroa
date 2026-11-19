import type { PaginationMeta } from "@/lib/api/api-response";

export interface BannerPositionSummaryDto {
  id: string; // Public Position UUID
  name: string;
  slug: string;
  page: string | null;
}

export type BannerMediaType = "image" | "video";

export interface BannerDto {
  id: string; // Public Banner UUID
  title: string | null;
  mediaType: BannerMediaType;
  imageUrl: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  linkUrl: string | null;
  offerId: string | null; // Public Offer UUID, when the banner opens an offer
  badgeLabel: string | null;
  subtitle: string | null;
  priceText: string | null;
  sortOrder: number;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  bannerPosition: BannerPositionSummaryDto;
  createdAt: Date;
  updatedAt: Date;
}

export interface BannerListResponse {
  data: BannerDto[];
  meta: PaginationMeta;
}

export interface CustomerBannerDto {
  id: string; // Public Banner UUID
  title: string | null;
  mediaType: BannerMediaType;
  imageUrl: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  linkUrl: string | null;
  offerId: string | null; // Public Offer UUID, when the banner opens an offer
  badgeLabel: string | null;
  subtitle: string | null;
  priceText: string | null;
  sortOrder: number;
  bannerPosition: BannerPositionSummaryDto;
}
