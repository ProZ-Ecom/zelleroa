"use client";

import { Tag } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { formatAppliedOfferLabel } from "@/features/offers/constants/offer-options";
import type { OfferBreakdown } from "@/features/offers/types";

interface AppliedOfferTagProps {
  offer?: OfferBreakdown | null;
  discountAmount?: number;
  freeQuantity?: number;
  compact?: boolean;
  className?: string;
}

/**
 * Displays the winning offer applied to a cart or checkout line so the shopper
 * can see which offer was selected and how much they saved.
 */
export function AppliedOfferTag({
  offer,
  discountAmount = 0,
  freeQuantity = 0,
  compact = false,
  className,
}: AppliedOfferTagProps) {
  if (!offer && discountAmount <= 0) return null;

  const badgeLabel = offer ? formatAppliedOfferLabel(offer, freeQuantity) : null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/80 text-emerald-800",
        compact ? "mt-1 px-2 py-1 text-[10px]" : "mt-2 px-2.5 py-1.5 text-[11px]",
        className
      )}
    >
      <Tag className={cn("shrink-0 text-emerald-600", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
      <span className="font-semibold text-emerald-900">
        {offer ? offer.name : "Offer Applied"}
      </span>
      {badgeLabel && (
        <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {badgeLabel}
        </span>
      )}
      {discountAmount > 0 && (
        <span className="font-medium text-emerald-700">
          (Saved {formatPrice(discountAmount)})
        </span>
      )}
    </div>
  );
}
