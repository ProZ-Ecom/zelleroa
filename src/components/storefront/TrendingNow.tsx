"use client";

import * as React from "react";
import { Flame } from "lucide-react";
import { SnackCard } from "./cards/SnackCard";
import { ProductCardSkeleton } from "./cards/ProductCardSkeleton";
import { useCustomerStyles } from "@/features/customers/hooks/use-customer-catalog";
import { useCategoryTree } from "@/features/categories/hooks";
import { formatStylePriceRange, mapStyleToStorefrontProduct } from "@/lib/storefront";

/**
 * Trending styles on the home page - one card per Style, linking to the Style
 * page where Item, Colour and Size are picked.
 */
export function TrendingNow() {
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string | null>(null);

  const { data: categoryTree = [] } = useCategoryTree();

  const selectedCategory = React.useMemo(
    () => categoryTree.find((c) => c.id === selectedCategoryId),
    [categoryTree, selectedCategoryId]
  );

  const isSpecialDiscount = Boolean(
    selectedCategory?.slug?.toLowerCase().includes("special_discount") ||
      selectedCategory?.name.toLowerCase() === "special discount"
  );
  const isNewCollection = Boolean(
    selectedCategory?.slug?.toLowerCase().includes("new_collection") ||
      selectedCategory?.name.toLowerCase() === "new collection"
  );

  const { data: response, isLoading, isError } = useCustomerStyles({
    categoryIds:
      selectedCategoryId && !isSpecialDiscount && !isNewCollection
        ? [selectedCategoryId]
        : undefined,
    page: 1,
    pageSize: 4,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  const styles = React.useMemo(() => response?.data ?? [], [response]);

  return (
    <section className="relative w-full bg-white">
      <div className="w-full max-w-[1400px] 2xl:max-w-[1600px] 3xl:max-w-[1800px] mx-auto px-4 sm:px-6 md:px-8 py-10 sm:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-600">
              <Flame className="h-3.5 w-3.5" />
              High Demand
            </span>
            <h2 className="mt-1 text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-theme-text-primary">
              Trending Now
            </h2>
            <p className="mt-2 text-sm text-theme-text-subtle">
              The styles and everyday essentials everyone&apos;s talking about.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategoryId(null)}
              className={`rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
                selectedCategoryId === null
                  ? "bg-theme-primary text-white"
                  : "bg-theme-primary-light text-theme-primary hover:bg-theme-primary/20"
              }`}
            >
              All
            </button>
            {categoryTree.map((root) => (
              <button
                key={root.id}
                type="button"
                onClick={() => setSelectedCategoryId(root.id)}
                className={`rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
                  selectedCategoryId === root.id
                    ? "bg-theme-primary text-white"
                    : "bg-theme-primary-light text-theme-primary hover:bg-theme-primary/20"
                }`}
              >
                {root.name}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
          {isLoading &&
            Array.from({ length: 4 }).map((_, index) => (
              <ProductCardSkeleton key={`skeleton-${index}`} />
            ))}

          {!isLoading &&
            styles.map((style) => (
              <SnackCard
                key={style.id}
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
      </div>
    </section>
  );
}

export default TrendingNow;
