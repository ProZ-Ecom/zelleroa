"use client";

import { CustomerProductCard } from "./CustomerProductCard";
import { CustomerVariantCard } from "./CustomerVariantCard";
import { CustomerStyleCard } from "./CustomerStyleCard";
import { Sparkles } from "lucide-react";
import type {
  CustomerProductListItemDto,
  CustomerVariantListItemDto,
} from "../../types/catalog.types";

interface CustomerProductGridProps {
  products?: CustomerProductListItemDto[];
  variants?: CustomerVariantListItemDto[];
  /** One card per Style - the storefront listing's default mode. */
  styles?: CustomerProductListItemDto[];
  onResetFilters?: () => void;
  columns?: 3 | 4;
}

export function CustomerProductGrid({
  products,
  variants,
  styles,
  onResetFilters,
  columns = 3,
}: CustomerProductGridProps) {
  const hasVariants = Boolean(variants && variants.length > 0);
  const hasProducts = Boolean(products && products.length > 0);
  const hasStyles = Boolean(styles && styles.length > 0);

  if (!hasVariants && !hasProducts && !hasStyles) {
    return (
      <div className="rounded-3xl border border-theme-border bg-theme-surface p-12 text-center max-w-md mx-auto my-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-theme-surface-alt text-theme-text-muted">
          <Sparkles className="h-7 w-7 text-theme-secondary" />
        </div>
        <h3 className="text-lg font-bold text-theme-text-primary mb-1">
          No items matched your search
        </h3>
        <p className="text-sm text-theme-text-subtle mb-6">
          Try clearing your active filters or searching for something else.
        </p>
        {onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="px-5 py-2.5 rounded-xl bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg text-xs font-semibold cursor-pointer transition-colors"
          >
            Clear All Filters
          </button>
        )}
      </div>
    );
  }

  const gridColsClass =
    columns === 4
      ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5"
      : "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5";

  return (
    <div className={`grid ${gridColsClass} gap-3 sm:gap-4 lg:gap-5`}>
      {hasStyles
        ? styles!.map((style) => <CustomerStyleCard key={style.id} style={style} />)
        : hasVariants
          ? variants!.map((variant) => (
              <CustomerVariantCard key={variant.id} variant={variant} />
            ))
          : products!.map((product) => (
              <CustomerProductCard key={product.id} product={product} />
            ))}
    </div>
  );
}

export default CustomerProductGrid;
