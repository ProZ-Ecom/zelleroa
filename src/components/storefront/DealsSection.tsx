"use client";

import * as React from "react";
import Link from "next/link";
import { Copy, Check, ArrowRight } from "lucide-react";
import { useOffers } from "@/features/offers/hooks";
import type { OfferListItem } from "@/features/offers/types";
import { formatPrice } from "@/lib/utils";
import { getOfferValidity } from "@/features/offers/utils/offer-validity";

function offerTag(offer: OfferListItem): string {
  switch (offer.type) {
    case "percentage":
      return "Special Clearance";
    case "flat":
      return "Cart Value Booster";
    case "bxgy":
      return "Buy More, Save More";
    case "special_price":
    default:
      return "Editor's Selection";
  }
}

function offerHeadline(offer: OfferListItem): string {
  switch (offer.type) {
    case "percentage":
      return `Up to ${offer.value}% Off`;
    case "flat":
      return `Flat ${formatPrice(offer.value)} Off`;
    case "bxgy":
      return `Buy ${offer.buyQuantity ?? 1}, Get ${offer.getQuantity ?? 1} Free`;
    case "special_price":
    default:
      return offer.name;
  }
}

function offerDescription(offer: OfferListItem): string {
  if (offer.terms) return offer.terms;
  if (offer.minCartValue) {
    return `On all orders above ${formatPrice(offer.minCartValue)}.`;
  }
  return offer.name;
}

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = React.useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard access can be blocked; the code is already visible to copy manually.
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-md bg-theme-primary-light px-2.5 py-1 text-xs font-bold text-theme-primary hover:bg-theme-primary/20 transition-colors"
      aria-label={`Copy code ${code}`}
    >
      Code: {code}
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/** The conditions a shopper needs to know before relying on the offer. */
function offerConditions(offer: OfferListItem): string[] {
  const conditions: string[] = [];
  if (offer.minCartValue) conditions.push(`Min. order ${formatPrice(offer.minCartValue)}`);
  if (offer.minQuantity > 1) conditions.push(`Min. ${offer.minQuantity} qty`);
  if (offer.maxDiscountAmount) conditions.push(`Max. discount ${formatPrice(offer.maxDiscountAmount)}`);
  return conditions;
}

export function OfferCard({ offer }: { offer: OfferListItem }) {
  const validity = getOfferValidity(offer.endsAt);
  const conditions = offerConditions(offer);

  return (
    <div className="flex flex-col rounded-xl border border-theme-border bg-white p-6">
      <span className="self-start rounded bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-900">
        {offerTag(offer)}
      </span>

      <h3 className="mt-4 text-2xl font-extrabold uppercase tracking-tight text-theme-text-primary leading-tight">
        {offerHeadline(offer)}
      </h3>

      <p className="mt-2 text-sm text-theme-text-subtle flex-1">
        {offerDescription(offer)}
      </p>

      {conditions.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {conditions.map((condition) => (
            <li
              key={condition}
              className="rounded-full bg-theme-surface-alt px-2.5 py-0.5 text-[11px] font-medium text-theme-text-subtle"
            >
              {condition}
            </li>
          ))}
        </ul>
      )}

      {offer.code && (
        <div className="mt-4">
          <CopyCodeButton code={offer.code} />
        </div>
      )}

      <div className="mt-5 pt-4 border-t border-theme-border flex items-center justify-between gap-3">
        <span
          className={
            validity?.urgent
              ? "text-xs font-bold text-red-600"
              : "text-xs font-medium text-theme-text-subtle"
          }
        >
          {validity?.label ??
            (offer.code ? "Auto-applies at checkout" : "Valid till stocks last")}
        </span>
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 rounded-md bg-theme-primary hover:bg-theme-primary-hover px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition-colors shrink-0"
        >
          Shop Now
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

export function DealsSection() {
  const { data } = useOffers({
    status: "active",
    sortBy: "priority",
    sortOrder: "asc",
    limit: 3,
  });

  const offers = data?.data ?? [];

  if (offers.length === 0) return null;

  return (
    <section className="w-full bg-theme-primary-light/40">
      <div className="w-full max-w-[1400px] 2xl:max-w-[1600px] 3xl:max-w-[1800px] mx-auto px-4 sm:px-6 md:px-8 py-10 sm:py-14">
        <div className="text-center">
          <span className="text-xs font-bold uppercase tracking-wide text-theme-primary">
            Limited Period Deals
          </span>
          <h2 className="mt-1 text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-theme-text-primary">
            Deals You Don&apos;t Want to Miss
          </h2>
          <p className="mt-2 text-sm text-theme-text-subtle">
            Smart shopping offers curated to give you more value per pick.
          </p>
        </div>

        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {offers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} />
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/offers"
            className="inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-theme-primary hover:text-theme-primary-hover transition-colors"
          >
            View All Offers
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export default DealsSection;
