"use client";

import Image from "next/image";
import { ExternalLink, Video } from "lucide-react";
import { FormModal } from "@/components/common/FormModal";
import { Badge } from "@/components/ui/badge";
import { parseVideoUrl, getVideoThumbnailUrl } from "@/lib/utils/video-url.util";
import {
  getBannerTypeConfig,
  getBannerTypeLabel,
  HOME_POPUP_OFFER_SLUG,
} from "../constants/banner-types";
import type { BannerDto } from "../types";

interface BannerPreviewModalProps {
  banner: BannerDto | null;
  onClose: () => void;
}

function formatDate(value: unknown): string {
  if (!value) return "";
  const d = new Date(value as string | Date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function BannerMedia({ banner }: { banner: BannerDto }) {
  const config = getBannerTypeConfig(banner.bannerPosition?.slug);
  const alt = banner.title || "Banner";

  if (banner.mediaType === "video") {
    const parsed = parseVideoUrl(banner.videoUrl);
    const poster =
      banner.thumbnailUrl ||
      banner.imageUrl ||
      getVideoThumbnailUrl(banner.videoUrl) ||
      undefined;

    return (
      <div className="relative mx-auto aspect-[9/16] w-full max-w-[260px] overflow-hidden rounded-2xl bg-black">
        {parsed?.kind === "file" && banner.videoUrl ? (
          <video
            src={banner.videoUrl}
            poster={poster}
            controls
            playsInline
            className="h-full w-full object-cover"
          />
        ) : parsed?.embedUrl ? (
          <iframe
            src={parsed.embedUrl}
            title={alt}
            allow="encrypted-media; picture-in-picture"
            allowFullScreen
            className="h-full w-full border-0"
          />
        ) : poster ? (
          <Image src={poster} alt={alt} fill className="object-cover" sizes="260px" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Video className="h-8 w-8 text-white/50" />
          </div>
        )}
      </div>
    );
  }

  const frameClassName =
    config.image?.previewClassName ?? "aspect-[3/1] w-full";

  return (
    <div
      className={`relative ${frameClassName} overflow-hidden rounded-xl border border-[var(--color-neutral-200)] bg-[var(--color-neutral-100)] ${
        banner.bannerPosition?.slug === HOME_POPUP_OFFER_SLUG ? "shadow-xl" : ""
      }`}
    >
      {banner.imageUrl ? (
        <Image
          src={banner.imageUrl}
          alt={alt}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 672px"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm text-[var(--color-neutral-400)]">
          No image
        </div>
      )}

      {config.hasCard && (banner.badgeLabel || banner.subtitle || banner.priceText) && (
        <div className="absolute bottom-3 left-3 max-w-[70%] rounded-xl bg-white/95 px-3 py-2 shadow-lg">
          {banner.badgeLabel && (
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-primary-700)]">
              {banner.badgeLabel}
            </p>
          )}
          {banner.subtitle && (
            <p className="truncate text-xs font-medium text-[var(--color-neutral-900)]">
              {banner.subtitle}
            </p>
          )}
          {banner.priceText && (
            <p className="text-xs font-bold text-[var(--color-neutral-900)]">
              {banner.priceText}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function BannerPreviewModal({ banner, onClose }: BannerPreviewModalProps) {
  const starts = banner ? formatDate(banner.startsAt) : "";
  const ends = banner ? formatDate(banner.endsAt) : "";
  const schedule =
    starts || ends
      ? `${starts || "Any time"} – ${ends || "No end"}`
      : "Always live";

  return (
    <FormModal
      open={Boolean(banner)}
      onClose={onClose}
      title="Banner Preview"
      description={
        banner
          ? getBannerTypeLabel(
              banner.bannerPosition?.slug,
              banner.bannerPosition?.name
            )
          : undefined
      }
      size="lg"
    >
      {banner && (
        <div className="space-y-5">
          <BannerMedia banner={banner} />

          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-[var(--color-neutral-500)]">Title</dt>
              <dd className="font-medium text-[var(--color-neutral-900)]">
                {banner.title || "Untitled Banner"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--color-neutral-500)]">Status</dt>
              <dd>
                <Badge variant={banner.isActive ? "success" : "secondary"}>
                  {banner.isActive ? "Active" : "Inactive"}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--color-neutral-500)]">Schedule</dt>
              <dd className="text-[var(--color-neutral-800)]">{schedule}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--color-neutral-500)]">Sort Order</dt>
              <dd className="text-[var(--color-neutral-800)]">{banner.sortOrder ?? 0}</dd>
            </div>
            {banner.linkUrl && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-[var(--color-neutral-500)]">Link</dt>
                <dd>
                  <a
                    href={banner.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 break-all text-[var(--color-primary-700)] hover:underline"
                  >
                    {banner.linkUrl}
                    <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </FormModal>
  );
}
