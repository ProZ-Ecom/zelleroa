/**
 * Central registry describing how each banner slot behaves in the admin form.
 *
 * The banner "type" the admin picks in the dropdown is really a banner
 * *position* row (`banner_positions.slug`). Everything that varies per slot -
 * whether it takes an uploaded image or a video link, the recommended pixel
 * size, the aspect ratio we enforce and how the preview is framed - lives here
 * so a new slot only needs one entry added below.
 */

export type BannerMediaKind = "image" | "video";

export interface BannerImageSpec {
  /** Recommended width in px. */
  width: number;
  /** Recommended height in px. */
  height: number;
  /** width / height, used for aspect-ratio validation. */
  ratio: number;
  /** Human readable ratio, e.g. "3:1". */
  ratioLabel: string;
  orientation: "landscape" | "portrait" | "square";
  /** Tailwind classes framing the upload / preview box. */
  previewClassName: string;
  /** Small square-ish frame used in the banners list table. */
  thumbnailClassName: string;
  /**
   * When false the recommended size is advisory only - used for custom
   * positions an admin creates that have no known design spec.
   */
  enforce: boolean;
}

export interface BannerTypeConfig {
  slug: string;
  /** Label shown in the Banner Type dropdown. */
  label: string;
  /** One-line explanation shown under the media field. */
  description: string;
  media: BannerMediaKind;
  /** Present for every image-based banner type. */
  image?: BannerImageSpec;
  /**
   * When true, the form also shows the floating-card fields (badge label,
   * subtitle, price text) alongside the usual title/link/media inputs.
   */
  hasCard?: boolean;
}

export const BANNER_IMAGE_ACCEPT_LABEL = "JPG, JPEG, PNG, WEBP";
export const BANNER_IMAGE_MAX_SIZE_MB = 5;

const LANDSCAPE_3_1: BannerImageSpec = {
  width: 1200,
  height: 400,
  ratio: 3,
  ratioLabel: "3:1",
  orientation: "landscape",
  previewClassName: "aspect-[3/1] w-full",
  thumbnailClassName: "aspect-[3/1] w-28",
  enforce: true,
};

const PORTRAIT_4_5: BannerImageSpec = {
  width: 1080,
  height: 1350,
  ratio: 1080 / 1350,
  ratioLabel: "4:5",
  orientation: "portrait",
  previewClassName: "aspect-[4/5] w-full max-w-[280px] mx-auto",
  thumbnailClassName: "aspect-[4/5] w-16",
  enforce: true,
};

const LANDSCAPE_4_3: BannerImageSpec = {
  width: 1200,
  height: 900,
  ratio: 4 / 3,
  ratioLabel: "4:3",
  orientation: "landscape",
  previewClassName: "aspect-[4/3] w-full max-w-[420px] mx-auto",
  thumbnailClassName: "aspect-[4/3] w-24",
  enforce: true,
};

export const HOME_HERO_SLUG = "home-hero";
export const HOME_HERO_INTRO_SLUG = "home-hero-intro";
export const HOME_OFFER_SLUG = "home-offer";
export const HOME_POPUP_OFFER_SLUG = "home-popup-offer";
export const HOME_REELS_SLUG = "home-reels";

export const BANNER_TYPE_CONFIGS: Record<string, BannerTypeConfig> = {
  [HOME_HERO_SLUG]: {
    slug: HOME_HERO_SLUG,
    label: "Home Hero Banner",
    description:
      "Full-width slider banner shown at the top of the home page.",
    media: "image",
    image: LANDSCAPE_3_1,
  },
  [HOME_HERO_INTRO_SLUG]: {
    slug: HOME_HERO_INTRO_SLUG,
    label: "Home Intro Image",
    description:
      "Image and floating trending card shown beside the home page intro heading.",
    media: "image",
    image: LANDSCAPE_4_3,
    hasCard: true,
  },
  [HOME_OFFER_SLUG]: {
    slug: HOME_OFFER_SLUG,
    label: "Home Offer Banner",
    description: "Promotional strip shown between home page sections.",
    media: "image",
    image: LANDSCAPE_3_1,
  },
  [HOME_POPUP_OFFER_SLUG]: {
    slug: HOME_POPUP_OFFER_SLUG,
    label: "Home Popup Offer",
    description:
      "Portrait pop-up shown to shoppers when they land on the home page.",
    media: "image",
    image: PORTRAIT_4_5,
  },
  [HOME_REELS_SLUG]: {
    slug: HOME_REELS_SLUG,
    label: "Home Reels",
    description:
      "Short vertical video shown in the home page reels carousel.",
    media: "video",
  },
};

/** Order the known slots appear in the Banner Type dropdown. */
export const BANNER_TYPE_ORDER = [
  HOME_HERO_SLUG,
  HOME_HERO_INTRO_SLUG,
  HOME_OFFER_SLUG,
  HOME_POPUP_OFFER_SLUG,
  HOME_REELS_SLUG,
];

/**
 * Used for banner positions created by an admin that have no design spec.
 * Image based, with the standard 3:1 size suggested but not enforced.
 */
export const FALLBACK_BANNER_TYPE_CONFIG: BannerTypeConfig = {
  slug: "",
  label: "Banner",
  description: "Custom banner slot.",
  media: "image",
  image: { ...LANDSCAPE_3_1, enforce: false },
};

export function getBannerTypeConfig(slug?: string | null): BannerTypeConfig {
  if (!slug) return FALLBACK_BANNER_TYPE_CONFIG;
  return BANNER_TYPE_CONFIGS[slug] ?? FALLBACK_BANNER_TYPE_CONFIG;
}

export function getBannerTypeLabel(
  slug?: string | null,
  fallbackName?: string | null
): string {
  if (slug && BANNER_TYPE_CONFIGS[slug]) return BANNER_TYPE_CONFIGS[slug].label;
  return fallbackName || slug || "Banner";
}

/** "Recommended size: 1200 × 400 px (3:1)" */
export function formatRecommendedSize(spec: BannerImageSpec): string {
  const orientation = spec.orientation === "portrait" ? " portrait" : "";
  return `Recommended size: ${spec.width} × ${spec.height} px (${spec.ratioLabel}${orientation})`;
}
