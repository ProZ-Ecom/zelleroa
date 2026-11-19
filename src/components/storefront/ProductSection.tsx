"use client";

import * as React from "react";
import { Clock, ArrowRight } from "lucide-react";
import { SnackCard } from "./cards/SnackCard";
import { ProductCardSkeleton } from "./cards/ProductCardSkeleton";
import { useCustomerStyles } from "@/features/customers/hooks/use-customer-catalog";
import { formatStylePriceRange, mapStyleToStorefrontProduct } from "@/lib/storefront";
import { styleHref } from "@/features/customers/utils/style-href";

export interface ProductSectionProps {
  selectedCategoryId?: string | null;
}

/**
 * The home page listing. It shows one card per Style - never one per Item or
 * per Colour - so the shopper lands on the Style page and picks the Item,
 * Colour and Size there, where price and stock are known.
 */
export function ProductSection({ selectedCategoryId }: ProductSectionProps) {
  const [showAll, setShowAll] = React.useState(false);

  // Style listing from the real Customer Catalog API (POST /api/customer/styles)
  const { data: response, isLoading, isError } = useCustomerStyles({
    categoryIds: selectedCategoryId ? [selectedCategoryId] : undefined,
    page: 1,
    pageSize: 20,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  const styles = React.useMemo(() => response?.data ?? [], [response]);
  const visibleStyles = showAll ? styles : styles.slice(0, 4);
  const totalStyles = response?.meta?.total ?? styles.length;

  return (
    <section className="relative w-full bg-theme-primary-light/40">
      <div className="w-full max-w-[1400px] 2xl:max-w-[1600px] 3xl:max-w-[1800px] mx-auto px-4 sm:px-6 md:px-8 py-10 sm:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-theme-primary">
              <Clock className="h-3.5 w-3.5" />
              Fresh Drops
            </span>
            <h2 className="mt-1 text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-theme-text-primary">
              Just In
            </h2>
            <p className="mt-2 text-sm text-theme-text-subtle">
              Fresh styles, new finds and products you&apos;ll want to add to your collection.
            </p>
          </div>

          {!isLoading && styles.length > 0 && (
            <span className="text-xs font-semibold text-theme-text-subtle">
              Showing {visibleStyles.length} of {totalStyles} styles
            </span>
          )}
        </div>

        {/* Styles Grid */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
          {isLoading &&
            Array.from({ length: 4 }).map((_, index) => (
              <ProductCardSkeleton key={`skeleton-${index}`} />
            ))}

          {!isLoading &&
            visibleStyles.map((style) => (
              <SnackCard
                key={style.id}
                href={styleHref(style.id)}
                product={mapStyleToStorefrontProduct(style)}
                subtitle={style.category?.name}
                priceRangeText={formatStylePriceRange(style)}
                showRating
                viewOnly
              />
            ))}
        </div>

        {/* Empty State */}
        {!isLoading && !isError && styles.length === 0 && (
          <div className="py-16 text-center text-sm text-theme-text-subtle">
            <p className="text-base font-medium text-theme-text-primary">
              No items found in this collection.
            </p>
            <p className="mt-1 text-xs text-theme-text-subtle">
              Please explore our other fashion categories and arrivals.
            </p>
          </div>
        )}

        {/* View All Button */}
        {styles.length > 4 && (
          <div className="flex justify-center mt-10">
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="flex items-center justify-center gap-2 px-7 py-3 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold uppercase tracking-wide transition-colors cursor-pointer"
            >
              {showAll ? "Show Less" : "View All New Arrivals"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export default ProductSection;
