"use client";

import * as React from "react";
import { useCategoryListing } from "../../hooks/use-customer-catalog";
import { ItemCard } from "./ItemCard";

const FETCH_SIZE = 12;

interface RelatedItemsProps {
  /** The Item being viewed - never listed among its own related items. */
  itemId: string;
  /** Category UUID (or slug) the related items are drawn from. */
  categoryId: string | null | undefined;
  title?: string;
  limit?: number;
}

/** Other Items from the same category - "You may also like" on the Item page. */
export function RelatedItems({
  itemId,
  categoryId,
  title = "You May Also Like",
  limit = 8,
}: RelatedItemsProps) {
  const listing = useCategoryListing(categoryId ?? "", "", FETCH_SIZE);

  const items = React.useMemo(
    () =>
      (listing.data?.pages[0]?.data.items ?? [])
        .filter((item) => item.id !== itemId)
        .slice(0, limit),
    [listing.data, itemId, limit]
  );

  if (!categoryId || listing.isLoading || items.length === 0) return null;

  return (
    <section className="mt-12" aria-labelledby="related-items-heading">
      <h2
        id="related-items-heading"
        className="mb-6 text-xl font-bold text-theme-text-primary sm:text-2xl"
      >
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} variant="grid" />
        ))}
      </div>
    </section>
  );
}

export default RelatedItems;
