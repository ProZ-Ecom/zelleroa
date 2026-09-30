"use client";

import { cn, formatPrice } from "@/lib/utils";
import { getOfferValidity } from "@/features/offers/utils/offer-validity";
import type { CustomerVariantUnitPriceDto } from "@/features/customers/types/catalog.types";

interface ItemPriceBlockProps {
  /** The exact Colour+Size row being priced. */
  size: CustomerVariantUnitPriceDto | null;
  /** Fallback range, used before a Size resolves. */
  minPrice: number;
  maxPrice: number;
  className?: string;
}

/**
 * What this exact Colour+Size costs. When an offer applies, the base price is
 * shown struck through beside the offer price and the saving as a percentage -
 * both figures come from the offer engine, which has already run server-side.
 */
export function ItemPriceBlock({
  size,
  minPrice,
  maxPrice,
  className,
}: ItemPriceBlockProps) {
  if (!size) {
    const range =
      maxPrice > minPrice
        ? `${formatPrice(minPrice)} - ${formatPrice(maxPrice)}`
        : formatPrice(minPrice);
    return (
      <div
        className={cn(
          "flex items-baseline gap-2 rounded-2xl bg-theme-surface-alt px-4",
          className
        )}
      >
        <span className="text-xl font-bold text-theme-text-primary">{range}</span>
      </div>
    );
  }

  const hasOffer = size.sellingPrice < size.basePrice;
  const discountPercent =
    size.discountPercent && size.discountPercent > 0
      ? Math.round(size.discountPercent)
      : hasOffer
        ? Math.round(((size.basePrice - size.sellingPrice) / size.basePrice) * 100)
        : 0;
  const validity = getOfferValidity(size.offer?.endsAt);

  return (
    <div className={cn("space-y-1.5 rounded-2xl bg-theme-surface-alt px-4", className)}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-2xl font-bold tracking-tight text-theme-text-primary">
          {formatPrice(size.sellingPrice)}
        </span>

        {hasOffer && (
          <>
            <span className="text-sm font-medium text-theme-text-subtle line-through">
              {formatPrice(size.basePrice)}
            </span>
            {discountPercent > 0 && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700 shadow-sm">
                {discountPercent}% OFF
              </span>
            )}
          </>
        )}
      </div>

      {hasOffer && (
        <p className="text-xs font-semibold text-emerald-700">
          You save {formatPrice(size.basePrice - size.sellingPrice)}
        </p>
      )}
      {hasOffer && size.offer?.name && (
        <p className="text-xs font-semibold text-emerald-700">{size.offer.name}</p>
      )}
      {hasOffer && validity && (
        <p
          className={cn(
            "text-xs font-medium",
            validity.urgent ? "font-bold text-red-600" : "text-theme-text-subtle"
          )}
        >
          {validity.label}
        </p>
      )}
      <p className="text-xs text-theme-text-subtle">Inclusive of all taxes</p>
    </div>
  );
}

export default ItemPriceBlock;
