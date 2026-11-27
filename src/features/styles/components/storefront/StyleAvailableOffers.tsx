"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Tag } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { useItemOffers } from "@/features/offers/hooks";
import { formatOfferDiscount } from "@/features/offers/constants/offer-options";
import { selectBestOffer } from "@/features/offers/services/offer-calculation";
import { getOfferValidity } from "@/features/offers/utils/offer-validity";
import type { ApplicableOffer, OfferListItem } from "@/features/offers/types";

interface StyleAvailableOffersProps {
  itemId: string | null;
  unitPrice: number | null;
  quantity: number;
  appliedOfferId?: string | null;
  className?: string;
}

function toApplicableOffer(offer: OfferListItem): ApplicableOffer {
  return {
    id: offer.id,
    internalId: BigInt(0),
    name: offer.name,
    code: offer.code,
    level: offer.level,
    type: offer.type,
    value: offer.value,
    buyQuantity: offer.buyQuantity,
    getQuantity: offer.getQuantity,
    minQuantity: offer.minQuantity,
    maxQuantity: offer.maxQuantity,
    minCartValue: offer.minCartValue,
    maxDiscountAmount: offer.maxDiscountAmount,
    priority: offer.priority,
    terms: offer.terms,
    startsAt: offer.startsAt ? new Date(offer.startsAt) : null,
    endsAt: offer.endsAt ? new Date(offer.endsAt) : null,
    isActive: offer.isActive,
  };
}

function getOfferConditions(offer: OfferListItem): string[] {
  const chips: string[] = [];
  if (offer.minQuantity > 1) chips.push(`Min. qty: ${offer.minQuantity}`);
  if (offer.maxQuantity != null) chips.push(`Max. qty: ${offer.maxQuantity}`);
  if (offer.minCartValue != null && offer.minCartValue > 0) {
    chips.push(`Min. cart: ${formatPrice(offer.minCartValue)}`);
  }
  if (offer.maxDiscountAmount != null && offer.maxDiscountAmount > 0) {
    chips.push(`Max. discount: ${formatPrice(offer.maxDiscountAmount)}`);
  }
  return chips;
}

/**
 * Lists every active offer reaching the currently selected variant/pack size
 * (both variant-specific and product-wide), highlighting the one that wins
 * for the selected quantity.
 */
export function StyleAvailableOffers({
  itemId,
  unitPrice,
  quantity,
  appliedOfferId,
  className,
}: StyleAvailableOffersProps) {
  const { data: offers = [], isLoading } = useItemOffers(itemId);

  const winningOfferId = React.useMemo(() => {
    if (!itemId || offers.length === 0) return appliedOfferId ?? null;
    if (unitPrice != null && unitPrice > 0) {
      const best = selectBestOffer(
        offers.map(toApplicableOffer),
        { itemId, unitPrice, quantity: Math.max(1, quantity) }
      );
      if (best) return best.offer.id;
    }
    return appliedOfferId ?? null;
  }, [itemId, offers, unitPrice, quantity, appliedOfferId]);

  // Keep the winning offer first so the shopper immediately sees which one applies.
  const orderedOffers = React.useMemo(() => {
    if (!winningOfferId) return offers;
    const winner = offers.find((o) => o.id === winningOfferId);
    if (!winner) return offers;
    return [winner, ...offers.filter((o) => o.id !== winningOfferId)];
  }, [offers, winningOfferId]);

  if (!itemId || (!isLoading && orderedOffers.length === 0)) return null;

  if (isLoading) {
    return (
      <div
        className={cn(
          "space-y-2 rounded-2xl border border-theme-border bg-theme-surface-alt/60 p-4",
          className
        )}
      >
        <div className="h-4 w-36 animate-pulse rounded bg-theme-border/60" />
        <div className="h-14 animate-pulse rounded-xl bg-theme-border/40" />
      </div>
    );
  }

  return (
    <section
      aria-label="Available offers"
      className={cn(
        "space-y-3 rounded-2xl border border-theme-border bg-theme-surface-alt/50 p-4",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-theme-text-primary">
          <Tag className="h-4 w-4 text-emerald-600" />
          Available Offers ({orderedOffers.length})
        </h2>
        {orderedOffers.length > 1 && (
          <span className="text-[11px] text-theme-text-subtle">
            Best applicable offer applies automatically
          </span>
        )}
      </div>

      <ul className="space-y-2.5">
        {orderedOffers.map((offer) => {
          const isApplied = offer.id === winningOfferId;
          const conditions = getOfferConditions(offer);
          const validity = getOfferValidity(offer.endsAt);

          return (
            <li
              key={offer.id}
              className={cn(
                "rounded-xl border p-3 transition-colors",
                isApplied
                  ? "border-emerald-300 bg-emerald-50/70"
                  : "border-theme-border bg-theme-surface"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-bold",
                        isApplied
                          ? "bg-emerald-600 text-white"
                          : "bg-amber-100 text-amber-900"
                      )}
                    >
                      {formatOfferDiscount(offer)}
                    </span>

                    <span className="text-sm font-bold text-theme-text-primary">
                      {offer.name}
                    </span>

                    {isApplied && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                        <CheckCircle2 className="h-3 w-3" />
                        Applied
                      </span>
                    )}

                    <span className="rounded-md border border-theme-border bg-theme-surface-alt px-1.5 py-0.5 text-[10px] font-medium text-theme-text-subtle">
                      {offer.level === "item" ? "Variant Offer" : "Product Offer"}
                    </span>
                  </div>

                  {offer.terms && (
                    <p className="text-xs leading-relaxed text-theme-text-subtle">
                      {offer.terms}
                    </p>
                  )}

                  {(conditions.length > 0 || validity) && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {conditions.map((chip) => (
                        <span
                          key={chip}
                          className="rounded-md bg-theme-surface-alt px-2 py-0.5 text-[11px] font-medium text-theme-text-secondary"
                        >
                          {chip}
                        </span>
                      ))}
                      {validity && (
                        <span
                          className={cn(
                            "text-[11px] font-medium",
                            validity.urgent ? "text-red-600" : "text-theme-text-subtle"
                          )}
                        >
                          {validity.label}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <Link
                  href={`/offers/${offer.id}`}
                  className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-theme-primary hover:underline"
                >
                  View
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default StyleAvailableOffers;
