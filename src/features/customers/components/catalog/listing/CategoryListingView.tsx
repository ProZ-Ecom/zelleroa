"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, PackageSearch, SlidersHorizontal, X } from "lucide-react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Select } from "@/components/ui/select";
import { formatPrice } from "@/lib/utils";
import { useHeaderMenu } from "@/features/header-menu/hooks";
import { useCategoryListing } from "../../../hooks/use-customer-catalog";
import {
  EMPTY_LISTING_QUERY,
  LISTING_SORT_OPTIONS,
  categoryHref,
  withGenderParam,
  withNavParam,
  countActiveListingFilters,
  parseListingQuery,
  serializeListingQuery,
  type ListingQuery,
  type ListingSort,
} from "../../../utils/catalog-listing-query";
import type { ListingFiltersDto } from "../../../types/catalog-listing.types";
import { ListingFilterPanel } from "./ListingFilterPanel";
import { ListingItemCard } from "./ListingItemCard";

const PAGE_SIZE = 24;
const GRID = "grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 2xl:grid-cols-4";

function GridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className={GRID} aria-hidden>
      {Array.from({ length: count }, (_, n) => (
        <div key={n} className="overflow-hidden rounded-2xl border border-theme-border bg-theme-surface">
          <div className="aspect-square w-full skeleton-shimmer" />
          <div className="space-y-2 p-3.5">
            <div className="h-3 w-16 rounded skeleton-shimmer" />
            <div className="h-4 w-3/4 rounded skeleton-shimmer" />
            <div className="h-4 w-1/3 rounded skeleton-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface ActiveChip {
  id: string;
  label: string;
  remove: (q: ListingQuery) => ListingQuery;
}

/** One removable chip per applied condition, labelled from the filter metadata. */
function buildActiveChips(query: ListingQuery, filters: ListingFiltersDto | undefined): ActiveChip[] {
  const chips: ActiveChip[] = [];

  if (query.search) {
    chips.push({ id: "q", label: `“${query.search}”`, remove: (q) => ({ ...q, search: "" }) });
  }

  for (const [key, values] of Object.entries(query.attributes)) {
    const attribute = filters?.attributes.find((a) => a.key === key);
    // Filters the category doesn't have were ignored server-side; don't claim them.
    if (filters && !attribute) continue;
    for (const value of values) {
      const known = attribute?.values.find((v) => v.key.toLowerCase() === value.toLowerCase());
      if (filters && !known) continue;
      chips.push({
        id: `${key}:${value}`,
        label: `${attribute?.name ?? key}: ${known?.label ?? value}`,
        remove: (q) => {
          const rest = (q.attributes[key] ?? []).filter((v) => v.toLowerCase() !== value.toLowerCase());
          const attributes = { ...q.attributes };
          if (rest.length > 0) attributes[key] = rest;
          else delete attributes[key];
          return { ...q, attributes };
        },
      });
    }
  }

  for (const brand of query.brands) {
    const known = filters?.brands.find((b) => b.key === brand);
    chips.push({
      id: `brand:${brand}`,
      label: known?.label ?? brand,
      remove: (q) => ({ ...q, brands: q.brands.filter((b) => b !== brand) }),
    });
  }

  for (const gender of query.genders) {
    chips.push({
      id: `gender:${gender}`,
      label: gender.charAt(0).toUpperCase() + gender.slice(1),
      remove: (q) => ({ ...q, genders: q.genders.filter((g) => g !== gender) }),
    });
  }

  if (query.minPrice !== null || query.maxPrice !== null) {
    const label =
      query.minPrice !== null && query.maxPrice !== null
        ? `${formatPrice(query.minPrice)} – ${formatPrice(query.maxPrice)}`
        : query.minPrice !== null
          ? `Over ${formatPrice(query.minPrice)}`
          : `Under ${formatPrice(query.maxPrice!)}`;
    chips.push({ id: "price", label, remove: (q) => ({ ...q, minPrice: null, maxPrice: null }) });
  }

  if (query.inStockOnly) {
    chips.push({ id: "stock", label: "In stock only", remove: (q) => ({ ...q, inStockOnly: false }) });
  }

  return chips;
}

export interface CategoryListingViewProps {
  /** Canonical category slug (lower-cased), or "all". */
  categoryKey: string;
  /** Server-resolved name, shown before the first response arrives. */
  initialTitle: string;
}

export function CategoryListingView({ categoryKey, initialTitle }: CategoryListingViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isMobileFilterOpen, setIsMobileFilterOpen] = React.useState(false);
  const resultsRef = React.useRef<HTMLDivElement>(null);

  // The URL is the only filter state; everything below derives from it.
  const query = React.useMemo(() => parseListingQuery(searchParams), [searchParams]);
  const queryString = React.useMemo(() => serializeListingQuery(query).toString(), [query]);

  const listing = useCategoryListing(categoryKey, queryString, PAGE_SIZE);
  const firstPage = listing.data?.pages[0];
  const category = firstPage?.data.category ?? null;
  const subcategories = firstPage?.data.subcategories ?? [];
  const serverActiveId = firstPage?.data.activeSubcategoryId ?? null;
  const categoryImages = firstPage?.data.categoryImages;

  // The image strip only appears when the shopper arrived through a header nav
  // link (`?nav=<item id>`); links inside the dropdown don't carry it.
  const navId = searchParams.get("nav");
  const { data: headerMenu = [] } = useHeaderMenu();
  const navItem = navId ? headerMenu.find((item) => item.id === navId) : undefined;
  const isGroupedNav = !!navItem && navItem.categories.length > 1;
  const stripTiles = !navItem
    ? []
    : isGroupedNav
      ? navItem.categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          image: categoryImages?.[c.id] ?? c.icon ?? null,
        }))
      : subcategories;
  const activeSubcategoryId = isGroupedNav ? (category?.id ?? null) : serverActiveId;
  const filters = firstPage?.data.filters;
  const total = firstPage?.meta?.total;
  const items = React.useMemo(
    () => listing.data?.pages.flatMap((p) => p.data.items) ?? [],
    [listing.data]
  );

  const isAll = categoryKey === "all";
  const title = category?.name ?? (isAll ? navItem?.label ?? "All Products" : initialTitle);
  const activeCount = countActiveListingFilters(query);
  const chips = buildActiveChips(query, filters);
  const isRefreshing = listing.isPlaceholderData;

  const applyQuery = React.useCallback(
    (next: ListingQuery) => {
      const qs = serializeListingQuery(next).toString();
      // The serializer only knows filter params; carry the nav marker over.
      const params = new URLSearchParams(qs);
      if (navId) params.set("nav", navId);
      const nextQs = params.toString();
      router.replace(nextQs ? `${pathname}?${nextQs}` : pathname, { scroll: false });

      // Bring the top of the results into view if the shopper has scrolled past it.
      const top = resultsRef.current?.getBoundingClientRect().top;
      if (top !== undefined && top < 0) {
        window.scrollTo({ top: window.scrollY + top - 96, behavior: "smooth" });
      }
    },
    [navId, pathname, router]
  );

  const clearAll = React.useCallback(
    () => applyQuery({ ...EMPTY_LISTING_QUERY, sort: query.sort }),
    [applyQuery, query.sort]
  );
  const closeMobileFilters = React.useCallback(() => setIsMobileFilterOpen(false), []);

  // Infinite scroll.
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = listing;
  React.useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNextPage) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: "400px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // A nav item's landing page (e.g. Mens) is introduced by its image strip alone.
  const hideTitle = isAll && isGroupedNav;

  // The current page is the <h1> right below, so the trail stops at its parent
  // (or at Home when there is none) instead of repeating the title.
  const breadcrumb = [
    ...(isAll ? [] : [{ label: "Shop All", href: categoryHref({ slug: "all", id: "all" }) }]),
    ...(category?.ancestors ?? []).map((a) => ({ label: a.name, href: categoryHref(a) })),
  ];

  return (
    <div className="min-h-screen bg-theme-bg">
      {/* Header */}
      <header className="border-b border-theme-border bg-gradient-to-b from-theme-primary-light/60 via-theme-surface to-theme-surface">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1600px] px-4 sm:px-6 lg:px-8 pt-5 pb-4 sm:pt-7 sm:pb-6">
          {breadcrumb.length > 0 && <Breadcrumb items={breadcrumb} className="text-xs sm:text-sm" />}
          <div className={`${hideTitle ? "" : "mt-3 "}flex flex-wrap items-end justify-between gap-2`}>
            <div className="min-w-0">
              <h1
                className={
                  hideTitle
                    ? "sr-only"
                    : "text-2xl sm:text-4xl font-extrabold tracking-tight text-theme-text-primary"
                }
              >
                {title}
              </h1>
              {!hideTitle && (
                <span className="mt-2 block h-1 w-12 rounded-full bg-theme-primary" aria-hidden />
              )}
              {category?.description && (
                <p className="mt-1.5 max-w-3xl text-sm text-theme-text-subtle line-clamp-2">
                  {category.description}
                </p>
              )}
            </div>
          </div>

          {stripTiles.length > 0 && (
            <nav
              aria-label={isAll ? "Categories" : "Subcategories"}
              className="mt-6 -mx-4 flex gap-4 overflow-x-auto px-4 pb-3 pt-2 sm:-mx-6 sm:px-6 sm:gap-7 lg:-mx-8 lg:px-8 scrollbar-hide"
            >
              {stripTiles.map((sub) => {
                const isActive = sub.id === activeSubcategoryId;
                return (
                  <Link
                    key={sub.id}
                    href={withNavParam(withGenderParam(categoryHref(sub), navItem?.gender), navId)}
                    aria-current={isActive ? "page" : undefined}
                    className="group flex w-[76px] shrink-0 flex-col items-center gap-2.5 sm:w-28"
                  >
                    <span
                      className={`relative flex h-[68px] w-[68px] items-center justify-center overflow-hidden rounded-full bg-theme-surface-alt shadow-sm transition-all duration-300 sm:h-24 sm:w-24 ${
                        isActive
                          ? "scale-105 ring-[3px] ring-theme-primary ring-offset-[3px] shadow-lg"
                          : "ring-1 ring-theme-border group-hover:-translate-y-1 group-hover:shadow-lg group-hover:ring-2 group-hover:ring-theme-primary"
                      }`}
                    >
                      {sub.image ? (
                        <Image
                          src={sub.image}
                          alt={sub.name}
                          fill
                          sizes="96px"
                          unoptimized
                          className="object-cover object-top transition-transform duration-500 group-hover:scale-110"
                        />
                      ) : (
                        <span className="text-xl font-bold text-theme-text-muted sm:text-2xl">
                          {sub.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span
                      className={`text-center text-[11px] uppercase tracking-wider transition-colors sm:text-[13px] ${
                        isActive
                          ? "font-extrabold text-theme-primary"
                          : "font-semibold text-theme-text-secondary group-hover:text-theme-primary"
                      }`}
                    >
                      {sub.name}
                    </span>
                    <span
                      aria-hidden
                      className={`-mt-1 h-0.5 rounded-full bg-theme-primary transition-all duration-300 ${
                        isActive ? "w-6 opacity-100" : "w-0 opacity-0 group-hover:w-4 group-hover:opacity-60"
                      }`}
                    />
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1600px] px-4 sm:px-6 lg:px-8 py-5 sm:py-8">
        <div className="flex items-start gap-8">
          <ListingFilterPanel
            filters={filters}
            query={query}
            onChange={applyQuery}
            onClearAll={clearAll}
            isLoading={listing.isLoading}
            isFetching={listing.isFetching && !isFetchingNextPage}
            totalResults={total}
            isMobileOpen={isMobileFilterOpen}
            onCloseMobile={closeMobileFilters}
            searchPlaceholder={isAll ? "Search products" : `Search in ${title}`}
          />

          <div ref={resultsRef} className="min-w-0 flex-1">
            {/* Toolbar */}
            <div className="mb-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(true)}
                className="lg:hidden inline-flex items-center gap-2 rounded-xl border border-theme-border-input bg-theme-surface px-3.5 py-2 text-sm font-bold text-theme-text-primary shadow-2xs cursor-pointer"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {activeCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-theme-primary px-1 text-[11px] font-bold text-theme-primary-fg">
                    {activeCount}
                  </span>
                )}
              </button>
              <p className="hidden lg:block text-sm text-theme-text-muted">
                {total === undefined ? (
                  "Loading products…"
                ) : (
                  <>
                    Showing <strong className="text-theme-text-primary">{total}</strong> product
                    {total === 1 ? "" : "s"}
                    {!isAll && (
                      <>
                        {" "}in <strong className="text-theme-text-primary">{title}</strong>
                      </>
                    )}
                  </>
                )}
              </p>
              <div className="flex items-center gap-2">
                <span className="hidden sm:block whitespace-nowrap text-xs font-semibold text-theme-text-muted">
                  Sort by
                </span>
                <Select
                  id="listing-sort"
                  value={query.sort}
                  onValueChange={(sort) => applyQuery({ ...query, sort: sort as ListingSort })}
                  options={LISTING_SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  size="md"
                  className="min-w-44 rounded-xl text-sm font-medium"
                />
              </div>
            </div>

            {/* Applied filters */}
            {chips.length > 0 && (
              <div className="mb-5 flex flex-wrap items-center gap-2" aria-label="Applied filters">
                {chips.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => applyQuery(chip.remove(query))}
                    className="inline-flex items-center gap-1.5 rounded-full border border-theme-border-accent bg-theme-primary-light px-3 py-1 text-xs font-semibold text-theme-primary transition-colors hover:border-theme-primary cursor-pointer"
                    aria-label={`Remove filter ${chip.label}`}
                  >
                    {chip.label}
                    <X className="h-3.5 w-3.5" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearAll}
                  className="px-1 text-xs font-bold text-theme-text-subtle underline-offset-2 hover:text-theme-primary hover:underline cursor-pointer"
                >
                  Clear all filters
                </button>
              </div>
            )}

            {/* Results */}
            {listing.isError && !listing.data ? (
              <div className="mx-auto my-10 max-w-md rounded-2xl border border-theme-border bg-theme-surface p-8 text-center">
                <h2 className="text-base font-bold text-theme-text-primary">Unable to load products</h2>
                <p className="mt-1 text-sm text-theme-text-subtle">
                  Something went wrong while fetching this category. Please try again.
                </p>
                <button
                  type="button"
                  onClick={() => listing.refetch()}
                  className="mt-5 rounded-xl bg-theme-primary px-5 py-2.5 text-sm font-bold text-theme-primary-fg hover:bg-theme-primary-hover cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : listing.isLoading ? (
              <GridSkeleton />
            ) : items.length === 0 ? (
              <div className="mx-auto my-10 max-w-md rounded-2xl border border-theme-border bg-theme-surface p-8 sm:p-10 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-theme-surface-alt">
                  <PackageSearch className="h-7 w-7 text-theme-text-muted" />
                </div>
                {activeCount > 0 ? (
                  <>
                    <h2 className="text-base font-bold text-theme-text-primary">
                      No products found matching your selected filters.
                    </h2>
                    <p className="mt-1 text-sm text-theme-text-subtle">
                      Try removing a filter or widening the price range.
                    </p>
                    <button
                      type="button"
                      onClick={clearAll}
                      className="mt-5 rounded-xl bg-theme-primary px-5 py-2.5 text-sm font-bold text-theme-primary-fg hover:bg-theme-primary-hover cursor-pointer"
                    >
                      Clear Filters
                    </button>
                  </>
                ) : (
                  <>
                    <h2 className="text-base font-bold text-theme-text-primary">
                      No products in {title} yet
                    </h2>
                    <p className="mt-1 text-sm text-theme-text-subtle">
                      New arrivals are on their way. Explore the rest of the store meanwhile.
                    </p>
                    {!isAll && (
                      <Link
                        href={categoryHref({ slug: "all", id: "all" })}
                        className="mt-5 inline-block rounded-xl bg-theme-primary px-5 py-2.5 text-sm font-bold text-theme-primary-fg hover:bg-theme-primary-hover"
                      >
                        Browse all products
                      </Link>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div
                className={`transition-opacity duration-200 ${isRefreshing ? "opacity-50" : ""}`}
                aria-busy={isRefreshing}
              >
                <div className={GRID}>
                  {items.map((item) => (
                    <ListingItemCard key={item.id} item={item} />
                  ))}
                </div>
                {isFetchingNextPage && (
                  <div className="mt-5">
                    <GridSkeleton count={4} />
                  </div>
                )}

                <div ref={sentinelRef} className="flex min-h-16 items-center justify-center py-6">
                  {hasNextPage ? (
                    <button
                      type="button"
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                      className="inline-flex items-center gap-2 rounded-xl border border-theme-border-input bg-theme-surface px-5 py-2 text-sm font-bold text-theme-text-primary hover:border-theme-primary disabled:opacity-60 cursor-pointer"
                    >
                      {isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />}
                      {isFetchingNextPage ? "Loading…" : "Load more"}
                    </button>
                  ) : (
                    items.length > PAGE_SIZE && (
                      <p className="text-xs font-semibold text-theme-text-muted">
                        You&apos;ve seen all {items.length} products
                      </p>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CategoryListingView;
