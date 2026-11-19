"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Tag } from "lucide-react";
import { useOffer } from "@/features/offers/hooks";
import { getOfferValidity } from "@/features/offers/utils/offer-validity";
import { CustomerProductGrid } from "@/features/customers/components/catalog/CustomerProductGrid";
import { useCustomerStyles } from "@/features/customers/hooks/use-customer-catalog";
import { formatPrice } from "@/lib/utils";
import type { OfferListItem } from "@/features/offers/types";

const PAGE_SIZE = 24;

function offerHeadline(offer: OfferListItem): string {
  switch (offer.type) {
    case "percentage":
      return `${offer.value}% Off`;
    case "flat":
      return `Flat ${formatPrice(offer.value)} Off`;
    case "bxgy":
      return `Buy ${offer.buyQuantity ?? 1}, Get ${offer.getQuantity ?? 1} Free`;
    case "special_price":
    default:
      return `Special Price ${formatPrice(offer.value)}`;
  }
}

function EndedState({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-2xl font-extrabold text-theme-text-primary">{title}</h1>
      <p className="mt-2 text-sm text-theme-text-subtle">{message}</p>
      <Link
        href="/offers"
        className="mt-6 inline-block rounded-md bg-theme-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-theme-primary-hover"
      >
        View All Offers
      </Link>
    </div>
  );
}

export function OfferProductsClient({ offerId }: { offerId: string }) {
  const [page, setPage] = useState(1);
  const { data: offer, isLoading: offerLoading, isError } = useOffer(offerId);

  // Product-level offers list their products; item-level offers list the
  // products that own the chosen pack sizes. Either way the storefront
  // listing is filtered by product UUID.
  const productIds = useMemo(() => {
    if (!offer) return [];
    const ids = new Set<string>();
    offer.products.forEach((product) => ids.add(product.id));
    offer.items.forEach((item) => ids.add(item.productId));
    return [...ids];
  }, [offer]);

  const isRunning = offer?.status === "active";

  const { data, isLoading: productsLoading, isFetching } = useCustomerStyles(
    { page, pageSize: PAGE_SIZE, productIds },
    { enabled: isRunning && productIds.length > 0 }
  );

  if (offerLoading) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-10">
        <div className="h-32 animate-pulse rounded-xl bg-theme-surface-alt" />
      </div>
    );
  }

  if (isError || !offer) {
    return <EndedState title="Offer not found" message="This offer is no longer available." />;
  }

  if (!isRunning) {
    return (
      <EndedState
        title="This offer has ended"
        message={
          offer.status === "scheduled"
            ? "This offer hasn't started yet. Please check back soon."
            : "Sorry, this offer is no longer running. Have a look at our other deals."
        }
      />
    );
  }

  const validity = getOfferValidity(offer.endsAt);
  const meta = data?.meta;

  return (
    <div className="w-full">
      <div className="border-b border-theme-border bg-theme-surface-alt py-8 sm:py-12">
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <nav className="mb-3 flex items-center justify-center gap-2 text-xs text-theme-text-subtle">
            <Link href="/" className="hover:text-theme-primary">Home</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href="/offers" className="hover:text-theme-primary">Offers</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="font-bold text-theme-text-primary">{offer.name}</span>
          </nav>
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-900">
              <Tag className="h-3.5 w-3.5" />
              {offerHeadline(offer)}
            </span>
            <h1 className="mt-3 text-2xl font-extrabold text-theme-text-primary sm:text-4xl">
              {offer.name}
            </h1>
            {offer.terms && (
              <p className="mx-auto mt-2 max-w-2xl text-sm text-theme-text-subtle">{offer.terms}</p>
            )}
            {validity && (
              <p className={`mt-2 text-xs font-bold ${validity.urgent ? "text-red-600" : "text-theme-text-subtle"}`}>
                {validity.label}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        {productIds.length === 0 ? (
          <p className="py-12 text-center text-theme-text-subtle">
            No products are linked to this offer yet.
          </p>
        ) : (
          <>
            {meta && (
              <p className="mb-4 text-xs text-theme-text-subtle">
                Showing <strong className="text-theme-text-primary">{meta.total}</strong> items on this offer
              </p>
            )}
            {productsLoading ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="aspect-[4/5] animate-pulse rounded-xl bg-theme-surface-alt" />
                ))}
              </div>
            ) : (
              <CustomerProductGrid styles={data?.data ?? []} columns={4} />
            )}
            {meta && meta.totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={page <= 1 || isFetching}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-md border border-theme-border px-4 py-2 text-xs font-bold disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-xs text-theme-text-subtle">
                  Page {page} of {meta.totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= meta.totalPages || isFetching}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-md border border-theme-border px-4 py-2 text-xs font-bold disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
