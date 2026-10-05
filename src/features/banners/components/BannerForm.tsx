"use client";

import * as React from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, Info, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/forms/form-input";
import { FormSelect } from "@/components/forms/form-select";
import { FormSwitch } from "@/components/forms/FormSwitch";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import { FormImageUpload } from "@/components/forms/form-image-upload";
import { FormVideoUrl } from "@/components/forms/form-video-url";
import { isValidVideoUrl } from "@/lib/utils/video-url.util";
import {
  BANNER_IMAGE_ACCEPT_LABEL,
  BANNER_IMAGE_MAX_SIZE_MB,
  BANNER_TYPE_ORDER,
  formatRecommendedSize,
  getBannerTypeConfig,
  getBannerTypeLabel,
} from "../constants/banner-types";
import type { BannerDto } from "../types";

const bannerFormSchema = z
  .object({
    bannerPositionId: z
      .string({ message: "Banner type is required" })
      .min(1, "Please select a banner type"),
    title: z
      .string({ message: "Title is required" })
      .trim()
      .min(1, "Title is required")
      .max(150, "Title cannot exceed 150 characters"),
    // Derived from the selected banner type; never edited directly.
    mediaType: z.enum(["image", "video"]).default("image"),
    imageUrl: z.string().optional().nullable(),
    videoUrl: z.string().optional().nullable(),
    linkUrl: z
      .string()
      .trim()
      .max(500, "Link URL cannot exceed 500 characters")
      .optional()
      .nullable(),
    badgeLabel: z
      .string()
      .trim()
      .max(50, "Badge label cannot exceed 50 characters")
      .optional()
      .nullable(),
    subtitle: z
      .string()
      .trim()
      .max(100, "Subtitle cannot exceed 100 characters")
      .optional()
      .nullable(),
    priceText: z
      .string()
      .trim()
      .max(50, "Price text cannot exceed 50 characters")
      .optional()
      .nullable(),
    isActive: z.boolean().default(true),
    startsAt: z.string().optional().nullable(),
    endsAt: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.mediaType === "video") {
      if (!data.videoUrl?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["videoUrl"],
          message: "Please enter a video URL.",
        });
      } else if (!isValidVideoUrl(data.videoUrl)) {
        ctx.addIssue({
          code: "custom",
          path: ["videoUrl"],
          message:
            "Please enter a valid video URL (YouTube, Vimeo, Instagram, or a direct .mp4 / .webm link).",
        });
      }
    } else if (!data.imageUrl?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["imageUrl"],
        message: "Please upload an image.",
      });
    }

    if (data.startsAt && data.endsAt) {
      const start = new Date(data.startsAt).getTime();
      const end = new Date(data.endsAt).getTime();
      if (Number.isFinite(start) && Number.isFinite(end) && end < start) {
        ctx.addIssue({
          code: "custom",
          path: ["endsAt"],
          message: "End date cannot be earlier than the start date.",
        });
      }
    }
  });

export type BannerFormData = z.input<typeof bannerFormSchema>;

export interface BannerPositionOption {
  value: string;
  label: string;
  slug?: string;
}

export interface BannerFormPayload {
  bannerPositionId: string;
  title: string;
  mediaType: "image" | "video";
  imageUrl: string;
  videoUrl: string | null;
  linkUrl: string | null;
  badgeLabel: string | null;
  subtitle: string | null;
  priceText: string | null;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

interface BannerFormProps {
  /** Banner being edited; omit for the create flow. */
  initialData?: Partial<BannerDto> | null;
  /** Banner positions from the API - one per selectable banner type. */
  bannerPositions: BannerPositionOption[];
  onSubmit: (data: BannerFormPayload) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  submitLabel?: string;
}

function formatDateForInput(dateValue: unknown): string {
  if (!dateValue) return "";
  const date = new Date(dateValue as string | Date);
  if (Number.isNaN(date.getTime())) return "";
  // datetime-local expects local time, not the UTC string from toISOString().
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

/**
 * Create / edit form for a storefront banner. Everything below the banner type
 * dropdown is driven by that type's entry in `constants/banner-types` - image
 * slots get an upload cropped to their exact size, video slots get a URL
 * field, and neither ever shows the other's inputs.
 */
export function BannerForm({
  initialData,
  bannerPositions,
  onSubmit,
  onCancel,
  isLoading = false,
  submitLabel = "Save Banner",
}: BannerFormProps) {
  const typeOptions = React.useMemo(() => {
    const ranked = [...bannerPositions].sort((a, b) => {
      const aRank = BANNER_TYPE_ORDER.indexOf(a.slug ?? "");
      const bRank = BANNER_TYPE_ORDER.indexOf(b.slug ?? "");
      return (
        (aRank === -1 ? BANNER_TYPE_ORDER.length : aRank) -
        (bRank === -1 ? BANNER_TYPE_ORDER.length : bRank)
      );
    });

    return ranked.map((position) => ({
      value: position.value,
      label: getBannerTypeLabel(position.slug, position.label),
    }));
  }, [bannerPositions]);

  const getFormDefaults = React.useCallback(
    (): BannerFormData => ({
      bannerPositionId: initialData?.bannerPosition?.id ?? "",
      title: initialData?.title ?? "",
      mediaType: initialData?.mediaType ?? "image",
      imageUrl: initialData?.imageUrl ?? "",
      videoUrl: initialData?.videoUrl ?? "",
      linkUrl: initialData?.linkUrl ?? "",
      badgeLabel: initialData?.badgeLabel ?? "",
      subtitle: initialData?.subtitle ?? "",
      priceText: initialData?.priceText ?? "",
      isActive: initialData?.isActive ?? true,
      startsAt: formatDateForInput(initialData?.startsAt),
      endsAt: formatDateForInput(initialData?.endsAt),
    }),
    [initialData]
  );

  const methods = useForm<BannerFormData>({
    resolver: zodResolver(bannerFormSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: getFormDefaults(),
  });

  const { control, setValue, reset, formState } = methods;
  const selectedPositionId = useWatch({ control, name: "bannerPositionId" });
  const isActive = useWatch({ control, name: "isActive" });

  const selectedSlug = React.useMemo(
    () =>
      bannerPositions.find((position) => position.value === selectedPositionId)
        ?.slug ?? "",
    [bannerPositions, selectedPositionId]
  );
  const typeConfig = React.useMemo(
    () => getBannerTypeConfig(selectedSlug),
    [selectedSlug]
  );

  // Tracks the slug the media fields currently belong to, so switching types
  // only clears media that no longer fits the new slot.
  const appliedSlugRef = React.useRef<string | null>(null);

  // Read inside effects without making them re-run when the array identity
  // changes, which would wipe whatever the admin has typed so far.
  const positionsRef = React.useRef(bannerPositions);
  React.useEffect(() => {
    positionsRef.current = bannerPositions;
  }, [bannerPositions]);

  const resetToDefaults = React.useCallback(() => {
    const defaults = getFormDefaults();
    reset(defaults);
    appliedSlugRef.current =
      positionsRef.current.find(
        (position) => position.value === defaults.bannerPositionId
      )?.slug ?? null;
  }, [getFormDefaults, reset]);

  React.useEffect(() => {
    resetToDefaults();
  }, [resetToDefaults]);

  React.useEffect(() => {
    if (!selectedPositionId) return;

    const previousSlug = appliedSlugRef.current;
    if (previousSlug === selectedSlug) return;

    appliedSlugRef.current = selectedSlug;
    setValue("mediaType", typeConfig.media, { shouldValidate: true });

    if (previousSlug === null) return;

    const previousConfig = getBannerTypeConfig(previousSlug);
    const mediaKindChanged = previousConfig.media !== typeConfig.media;
    const ratioChanged =
      previousConfig.image?.ratio !== typeConfig.image?.ratio;

    if (mediaKindChanged || ratioChanged) {
      setValue("imageUrl", "", { shouldValidate: true });
    }
    if (mediaKindChanged) {
      setValue("videoUrl", "", { shouldValidate: true });
    }
  }, [selectedPositionId, selectedSlug, setValue, typeConfig]);

  const handleFormSubmit = async (values: BannerFormData) => {
    const isVideo = typeConfig.media === "video";
    const trimmedVideoUrl = values.videoUrl?.trim() ?? "";
    const trimmedImageUrl = values.imageUrl?.trim() ?? "";

    await onSubmit({
      bannerPositionId: values.bannerPositionId,
      title: values.title.trim(),
      mediaType: isVideo ? "video" : "image",
      // Video slots have no image field, but a legacy poster on an existing
      // banner is preserved rather than silently wiped on save.
      imageUrl: trimmedImageUrl,
      videoUrl: isVideo && trimmedVideoUrl ? trimmedVideoUrl : null,
      linkUrl: values.linkUrl?.trim() || null,
      badgeLabel: typeConfig.hasCard ? values.badgeLabel?.trim() || null : null,
      subtitle: typeConfig.hasCard ? values.subtitle?.trim() || null : null,
      priceText: typeConfig.hasCard ? values.priceText?.trim() || null : null,
      isActive: Boolean(values.isActive),
      startsAt: values.startsAt?.trim()
        ? new Date(values.startsAt).toISOString()
        : null,
      endsAt: values.endsAt?.trim()
        ? new Date(values.endsAt).toISOString()
        : null,
    });
  };

  const handleFormError = (errors: Record<string, any>) => {
    const firstKey = Object.keys(errors)[0];
    if (firstKey && typeof document !== "undefined") {
      const el =
        document.querySelector(`[name="${firstKey}"]`) ||
        document.getElementById(firstKey);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        if ("focus" in el) (el as HTMLElement).focus();
      }
    }
  };

  const hasType = Boolean(selectedPositionId);
  const imageSpec = typeConfig.image;
  // `formState.errors` (not `isValid`) drives every field's highlighted
  // state below, so it's the only source that can't disagree with what's
  // actually on screen - `isValid` is a separately debounced flag that can
  // lag behind rapid setValue() calls (e.g. the type-switch effect above)
  // and falsely block a submission with nothing left to fix.
  const showSubmitBlockedNotice =
    formState.isSubmitted &&
    Object.keys(formState.errors).length > 0 &&
    !formState.isSubmitting;

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(handleFormSubmit, handleFormError)}
        className="space-y-5"
        noValidate
      >
        {/* SECTION - Banner type & title */}
        <section className="rounded-xl border border-theme-border bg-theme-surface p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-theme-text-primary">
            Banner details
          </h3>
          <p className="mt-0.5 text-xs text-theme-text-muted">
            The banner type decides where it appears and what media it needs.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormSelect
              name="bannerPositionId"
              label="Banner Type"
              placeholder="Select a banner type"
              options={typeOptions}
              required
              description={hasType ? typeConfig.description : undefined}
            />

            <FormInput
              name="title"
              label="Title"
              required
              placeholder="e.g. Diwali Special Offer"
              description="Shown in the admin list and as image alt text."
              maxLength={150}
            />

            <FormInput
              name="linkUrl"
              label="Link URL"
              placeholder="e.g. /products"
              description="Where shoppers go when they click this banner. Optional."
              maxLength={500}
            />
          </div>

          {typeConfig.hasCard && (
            <div className="mt-4 rounded-xl border border-dashed border-theme-border-input bg-theme-surface-alt p-4">
              <p className="text-xs font-semibold text-theme-text-primary">
                Floating card
              </p>
              <p className="mt-0.5 text-xs text-theme-text-muted">
                Shown overlaid on the image. Leave a field empty to hide it.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
                <FormInput
                  name="badgeLabel"
                  label="Badge Label"
                  placeholder="e.g. Trending"
                  maxLength={50}
                />
                <FormInput
                  name="subtitle"
                  label="Subtitle"
                  placeholder="e.g. Curated"
                  maxLength={100}
                />
                <FormInput
                  name="priceText"
                  label="Price Text"
                  placeholder="e.g. Starting ₹899"
                  maxLength={50}
                />
              </div>
            </div>
          )}
        </section>

        {/* SECTION - Media, driven entirely by the selected banner type */}
        <section className="rounded-xl border border-theme-border bg-theme-surface p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-theme-text-primary">
            Banner media
          </h3>

          {!hasType ? (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-dashed border-theme-border-input bg-theme-surface-alt p-4">
              <Info className="mt-px h-4 w-4 shrink-0 text-theme-text-muted" />
              <p className="text-xs text-theme-text-subtle">
                Select a banner type to see the media fields it needs.
              </p>
            </div>
          ) : typeConfig.media === "video" ? (
            <div className="mt-4">
              <FormVideoUrl
                name="videoUrl"
                label="Video URL"
                required
                placeholder="Enter video URL"
                description="Paste the video/reels URL"
                previewClassName="aspect-[9/16] w-full max-w-[220px]"
              />
            </div>
          ) : (
            imageSpec && (
              <div className="mt-4">
                {/* Cropping to the slot's exact size is what guarantees the
                    aspect ratio, so each type just feeds its own dimensions in. */}
                <FormImageUpload
                  key={imageSpec.previewClassName}
                  name="imageUrl"
                  label="Upload Banner Image"
                  required
                  folder="banners"
                  enableCrop
                  cropWidth={imageSpec.width}
                  cropHeight={imageSpec.height}
                  aspectRatioClassName={imageSpec.previewClassName}
                  maxSizeMB={BANNER_IMAGE_MAX_SIZE_MB}
                  infoMessage={`${formatRecommendedSize(
                    imageSpec
                  )}. Accepted formats: ${BANNER_IMAGE_ACCEPT_LABEL}.`}
                />
                <p className="mt-2 text-xs text-theme-text-muted">
                  {formatRecommendedSize(imageSpec)}
                </p>
              </div>
            )
          )}
        </section>

        {/* SECTION - Placement & visibility */}
        <section className="rounded-xl border border-theme-border bg-theme-surface p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-theme-text-primary">
            Placement &amp; visibility
          </h3>

          <div className="mt-1 flex items-center justify-between gap-4 rounded-xl border border-theme-border bg-theme-surface-alt p-4">
            <div>
              <p className="text-sm font-semibold text-theme-text-primary">
                Status
              </p>
              <p className="text-xs text-theme-text-muted">
                {isActive
                  ? "Active - visible on the storefront."
                  : "Inactive - hidden from the storefront."}
              </p>
            </div>
            <FormSwitch
              checked={Boolean(isActive)}
              onCheckedChange={(checked) =>
                setValue("isActive", checked, { shouldDirty: true })
              }
            />
          </div>
        </section>

        {/* SECTION - Schedule */}
        <section className="rounded-xl border border-theme-border bg-theme-surface p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-theme-text-primary">
            Schedule
          </h3>
          <p className="mt-0.5 text-xs text-theme-text-muted">
            Optional. Leave both empty to keep the banner live at all times.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormInput name="startsAt" type="datetime-local" label="Start Date" />
            <FormInput name="endsAt" type="datetime-local" label="End Date" />
          </div>
        </section>

        {showSubmitBlockedNotice && (
          <div className="flex items-start gap-2 rounded-xl border border-theme-status-can-fg/30 bg-theme-status-can-bg p-3">
            <AlertCircle className="mt-px h-4 w-4 shrink-0 text-theme-status-can-fg" />
            <p className="text-xs font-medium text-theme-status-can-fg">
              Please fix the highlighted fields before saving.
            </p>
          </div>
        )}

        {/* ACTIONS */}
        <div className="flex flex-col-reverse gap-2 border-t border-theme-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onCancel?.()}
            disabled={isLoading || formState.isSubmitting}
            className="sm:w-auto"
          >
            Cancel
          </Button>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              onClick={resetToDefaults}
              disabled={isLoading || formState.isSubmitting}
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Reset
            </Button>

            <FormSubmitButton isLoading={isLoading} variant="secondary">
              {submitLabel}
            </FormSubmitButton>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}
