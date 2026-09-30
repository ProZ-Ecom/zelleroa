"use client";

import Link from "next/link";
import { useOffers } from "@/features/offers/hooks";
import { OfferCard } from "@/components/storefront/DealsSection";

export function OffersClient() {
  const { data, isLoading } = useOffers({
    status: "active",
    sortBy: "priority",
    sortOrder: "asc",
    limit: 100,
  });

  const offers = data?.data ?? [];

  return (
    <div className="w-full max-w-[1400px] 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 py-10 sm:py-14">
      <div className="text-center">
        <span className="text-xs font-bold uppercase tracking-wide text-theme-primary">
          Limited Period Deals
        </span>
        <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-theme-text-primary">
          All Offers
        </h1>
        <p className="mt-2 text-sm text-theme-text-subtle">
          Every running offer in one place. Discounts show up automatically on the products they apply to.
        </p>
      </div>

      {isLoading ? (
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-xl bg-theme-surface-alt" />
          ))}
        </div>
      ) : offers.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-theme-text-subtle">No active offers right now. Please check back soon.</p>
          <Link
            href="/products"
            className="mt-4 inline-block rounded-md bg-theme-primary hover:bg-theme-primary-hover px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition-colors"
          >
            Browse Products
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {offers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} />
          ))}
        </div>
      )}
    </div>
  );
}
