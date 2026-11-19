"use client";

import * as React from "react";
import Link from "next/link";
import { Heart, ShoppingCart } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { ProductImage } from "@/components/common/ProductImage";
import { ProductRating } from "@/features/products/components/ProductRating";
import { usePublicProductReviews } from "@/features/reviews/hooks/use-public-reviews";
import type { StorefrontProduct } from "@/constants/storefront";

export interface SnackCardVariant {
  id: string;
  label: string; // e.g. "50g", "100g"
  price: number; // Selling price e.g. 45
  comparePrice?: number | null; // Original price before discount e.g. 50
  inStock?: boolean;
}

export interface SnackCardProps {
  /** Optional ID or UUID of the product */
  id?: string;
  /** Title / Name of the snack (e.g. "THENKUZHAL MURUKKU") */
  name?: string;
  /** Subtitle (e.g. Product or Category name) */
  subtitle?: string;
  /** Image URL (relative or absolute) */
  image?: string | null;
  /** Optional link href (defaults to `/products/${id}`) */
  href?: string;
  /** Explicit discount percentage (e.g. 10 for "10% OFF") */
  discountPercent?: number | null;
  /** List of pack size variants (e.g. 50g, 100g) */
  variants?: SnackCardVariant[];
  /** Currently selected variant ID (uncontrolled if omitted) */
  selectedVariantId?: string;
  /** Callback when user clicks a variant pill */
  onVariantChange?: (variantId: string) => void;
  /** Whether the item is wishlisted */
  isWishlisted?: boolean;
  /** Callback when user clicks the heart icon */
  onWishlistToggle?: (variantId?: string) => void;
  /** Callback when user clicks "ADD TO CART" */
  onAddToCart?: (variantId?: string) => void;
  /** Loading state for add to cart */
  isLoading?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Additional container classes */
  className?: string;
  /** Optionally pass a StorefrontProduct object directly */
  product?: StorefrontProduct;
  /** Fallback price if no variants are provided */
  fallbackPrice?: number;
  /** Optional preformatted price range text (e.g. "₹135.00 – ₹260.00") */
  priceRangeText?: string;
  /** Fetch and show the real average rating/review count for this product. Off by default to avoid firing a reviews request per card in large grids. */
  showRating?: boolean;
  /**
   * Style cards have no single sellable combination - Colour and Size are
   * picked on the detail page - so the card links there instead of offering
   * pack-size pills and an add-to-cart button.
   */
  viewOnly?: boolean;
  /** CTA label used in `viewOnly` mode. */
  viewLabel?: string;
}

export function SnackCard({
  id,
  name,
  subtitle,
  image,
  href,
  discountPercent: explicitDiscount,
  variants = [],
  selectedVariantId: controlledSelectedVariantId,
  onVariantChange,
  isWishlisted = false,
  onWishlistToggle,
  onAddToCart,
  isLoading = false,
  disabled = false,
  className = "",
  product,
  fallbackPrice,
  priceRangeText,
  showRating = false,
  viewOnly = false,
  viewLabel = "View Style",
}: SnackCardProps) {
  // If product prop is supplied, derive fields from it
  const resolvedId = id || product?.productId || product?.id || "";
  const resolvedName = name || product?.name || "Fashion Item";
  const resolvedImage = image || product?.image || "";
  const resolvedHref = href || (resolvedId ? `/products/${resolvedId}` : "#");

  const { data: reviewsData } = usePublicProductReviews(resolvedId, {
    enabled: showRating && !!resolvedId,
  });
  const avgRating = reviewsData?.ratingSummary?.averageRating ?? 0;
  const reviewCount = reviewsData?.ratingSummary?.totalReviews ?? 0;

  // Derive variants from StorefrontProduct if variants prop not explicitly given
  const resolvedVariants: SnackCardVariant[] = React.useMemo(() => {
    if (variants.length > 0) return variants;
    if (product?.unitPrices && product.unitPrices.length > 0) {
      return product.unitPrices.map((up) => ({
        id: up.id,
        label: up.label,
        price: up.sellingPrice,
        comparePrice: up.basePrice > up.sellingPrice ? up.basePrice : null,
        inStock: !product.outOfStock,
      }));
    }
    return [];
  }, [variants, product]);

  // Uncontrolled or controlled selected variant
  const defaultVariantId = resolvedVariants[0]?.id || "";
  const [internalSelectedId, setInternalSelectedId] = React.useState(defaultVariantId);

  const activeVariantId =
    controlledSelectedVariantId !== undefined
      ? controlledSelectedVariantId
      : internalSelectedId;

  // Selected variant details
  const activeVariant =
    resolvedVariants.find((v) => v.id === activeVariantId) || resolvedVariants[0] || null;

  const currentPrice = activeVariant ? activeVariant.price : (fallbackPrice ?? 0);
  const originalPrice = activeVariant?.comparePrice ?? null;

  // Calculate discount percentage
  const discount =
    explicitDiscount !== undefined && explicitDiscount !== null
      ? explicitDiscount
      : originalPrice && originalPrice > currentPrice
        ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
        : 0;

  const handleSelectVariant = (variantId: string) => {
    if (controlledSelectedVariantId === undefined) {
      setInternalSelectedId(variantId);
    }
    onVariantChange?.(variantId);
  };

  return (
    <div
      className={`group bg-theme-surface rounded-xl border border-theme-border pb-2.5 sm:pb-3 flex flex-col justify-between w-full max-w-sm overflow-hidden transition-all duration-300 hover:shadow-md hover:border-theme-primary/40 ${className}`}
    >
      {/* 1. Square Product Image Container */}
      <div className="relative aspect-square w-full overflow-hidden rounded-t-xl bg-theme-surface-alt">
        <Link href={resolvedHref} className="block w-full h-full">
          <ProductImage
            src={resolvedImage}
            alt={resolvedName}
            fallbackText={resolvedName}
            containerClassName="w-full h-full aspect-square"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </Link>

        {/* Discount Badge (Top-Left) */}
        {discount > 0 && (
          <div className="absolute top-2.5 left-2.5 z-10 bg-amber-100 text-amber-900 font-extrabold text-[11px] sm:text-xs px-2 py-0.5 uppercase tracking-wider rounded shadow-xs pointer-events-none">
            {discount}% OFF
          </div>
        )}

        {/* Wishlist Button (Top-Right) - a Style has no single row to save,
            so it is hidden until a Colour+Size is picked on the detail page */}
        {!viewOnly && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onWishlistToggle?.(activeVariant?.id);
            }}
            aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            className="absolute top-2.5 right-2.5 z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/90 backdrop-blur-xs shadow-xs flex items-center justify-center text-[var(--neutral-600)] hover:bg-white hover:text-[var(--danger-base)] hover:scale-105 transition-all cursor-pointer active:scale-90"
          >
            <Heart
              className={`w-5 h-5 transition-colors duration-200 ${isWishlisted
                  ? "text-[var(--danger-base)] fill-[var(--danger-base)]"
                  : "text-[var(--neutral-500)] stroke-[2]"
                }`}
            />
          </button>
        )}
      </div>

      {/* 2. Middle Info: Title on top, Variants & Price below with responsive wrapping */}
      <div className="mt-2.5 sm:mt-3 flex flex-1 flex-col justify-between px-2.5 sm:px-3 min-w-0">
        {/* Product/Variant Title */}
        <div className="w-full min-w-0">
          {subtitle && (
            <p className="text-[10px] sm:text-xs text-theme-text-subtle font-medium truncate mb-0.5">
              {subtitle}
            </p>
          )}
          <Link href={resolvedHref} className="block">
            <h3 className="font-bold text-theme-text-primary text-xs sm:text-sm tracking-tight leading-snug line-clamp-2 text-hover-primary transition-colors break-words">
              {resolvedName}
            </h3>
          </Link>
          {showRating && reviewCount > 0 && (
            <ProductRating rating={avgRating} reviewCount={reviewCount} size="sm" className="mt-1" />
          )}
        </div>

        {/* Variant Selector Pills & Prices Container */}
        <div className="mt-2 w-full min-w-0 flex flex-col gap-1.5">
          {/* Variant Selector Pills */}
          {!viewOnly && resolvedVariants.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {resolvedVariants.map((v) => {
                const isSelected = v.id === activeVariant?.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleSelectVariant(v.id)}
                    className={`px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-bold rounded transition-all cursor-pointer select-none ${isSelected
                        ? "bg-theme-primary text-white border border-theme-primary"
                        : "bg-white text-theme-primary border border-theme-primary hover:bg-theme-primary-light"
                      }`}
                  >
                    {typeof v.label === "string"
                      ? v.label
                      : typeof v.label === "object" && v.label !== null && "value" in v.label
                        ? `${String((v.label as Record<string, unknown>).value ?? "")} ${String((v.label as Record<string, unknown>).unit ?? "")}`.trim() || "Standard"
                        : String(v.label || "")}
                  </button>
                );
              })}
            </div>
          )}

          {/* Price & Strikethrough Row */}
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 min-w-0">
            {priceRangeText && (viewOnly || resolvedVariants.length === 0) ? (
              <span className="font-extrabold text-theme-text-primary text-xs sm:text-sm tracking-tight break-words">
                {priceRangeText}
              </span>
            ) : (
              <>
                <span className="font-extrabold text-theme-text-primary text-xs sm:text-sm tracking-tight">
                  {formatPrice(currentPrice)}
                </span>

                {originalPrice && originalPrice > currentPrice && (
                  <span className="text-[10px] sm:text-xs text-[var(--neutral-400)] line-through tracking-tight font-normal">
                    {formatPrice(originalPrice)}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 3. Bottom Action: add to cart, or - for a Style - a link to its page */}
      <div className="w-full px-2.5 sm:px-3 mt-3 sm:mt-3.5">
        {viewOnly ? (
          <Link
            href={resolvedHref}
            className="w-full bg-theme-primary-light text-theme-primary hover:bg-theme-primary hover:text-theme-primary-fg font-bold text-xs sm:text-sm tracking-wide uppercase py-2 sm:py-2.5 px-3 rounded-lg shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer text-center"
          >
            {viewLabel}
          </Link>
        ) : (
          <button
            type="button"
            disabled={disabled || isLoading || (activeVariant && activeVariant.inStock === false)}
            onClick={() => onAddToCart?.(activeVariant?.id)}
            className="w-full bg-theme-primary-light text-theme-primary hover:bg-theme-primary hover:text-theme-primary-fg font-bold text-xs sm:text-sm tracking-wide uppercase py-2 sm:py-2.5 px-3 rounded-lg shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ShoppingCart className="w-4 h-4" strokeWidth={2} />
            {isLoading
              ? "Adding..."
              : activeVariant?.inStock === false
                ? "Out of Stock"
                : "ADD TO CART"}
          </button>
        )}
      </div>
    </div>
  );
}

export default SnackCard;
