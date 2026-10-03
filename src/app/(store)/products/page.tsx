"use client";

import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Sparkles, ChevronRight, SlidersHorizontal, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterSidebar } from "@/components/storefront/filters/FilterSidebar";
import { CustomerProductGrid } from "@/features/customers/components/catalog/CustomerProductGrid";
import {
  useCustomerStyles,
  useCustomerCategories,
} from "@/features/customers/hooks/use-customer-catalog";
import type { CustomerProductListItemDto } from "@/features/customers/types/catalog.types";
import type { CustomerProductListInput } from "@/features/customers/validations/catalog.schema";

const SORT_OPTIONS: {
  value: string;
  label: string;
  sortBy: CustomerProductListInput["sortBy"];
  sortOrder: CustomerProductListInput["sortOrder"];
}[] = [
  { value: "createdAt_desc", label: "Newest First", sortBy: "createdAt", sortOrder: "desc" },
  { value: "price_asc", label: "Price: Low to High", sortBy: "price", sortOrder: "asc" },
  { value: "price_desc", label: "Price: High to Low", sortBy: "price", sortOrder: "desc" },
  { value: "name_asc", label: "Name: A to Z", sortBy: "name", sortOrder: "asc" },
  { value: "name_desc", label: "Name: Z to A", sortBy: "name", sortOrder: "desc" },
];

function ProductCatalogSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 gap-5 sm:gap-6 animate-in fade-in duration-200">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
        <div
          key={n}
          className="bg-white rounded-2xl border border-[#E8D9CD]/80 p-3.5 flex flex-col justify-between overflow-hidden shadow-2xs space-y-3"
        >
          {/* Image skeleton with shimmer */}
          <div className="relative aspect-square w-full rounded-xl skeleton-shimmer overflow-hidden bg-stone-100" />

          {/* Info row: Category, title & pack size pills */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between gap-2">
              <div className="h-3 w-20 rounded skeleton-shimmer bg-stone-100" />
              <div className="flex gap-1">
                <div className="h-4.5 w-10 rounded skeleton-shimmer bg-stone-100" />
                <div className="h-4.5 w-10 rounded skeleton-shimmer bg-stone-100" />
              </div>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <div className="h-4.5 w-36 rounded skeleton-shimmer bg-stone-100" />
              <div className="h-4.5 w-14 rounded skeleton-shimmer bg-stone-100" />
            </div>
          </div>

          {/* Golden CTA button skeleton */}
          <div className="h-10 w-full rounded-xl skeleton-shimmer bg-[#F8BE15]/20" />
        </div>
      ))}
    </div>
  );
}

function ProductCatalogPageSkeleton() {
  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-[#F0E4D8] bg-gradient-to-b from-[#FFFDF9] via-[#FAF4ED] to-[#F5ECE1] py-8 sm:py-12">
        <div className="w-full max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="h-3 w-12 rounded skeleton-shimmer bg-stone-200" />
            <div className="h-3 w-3 rounded skeleton-shimmer bg-stone-200" />
            <div className="h-3 w-16 rounded skeleton-shimmer bg-stone-200" />
          </div>
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-block h-5 w-36 rounded-full skeleton-shimmer bg-stone-200" />
            <div className="h-8 sm:h-10 w-64 mx-auto rounded-xl skeleton-shimmer bg-stone-200" />
            <div className="h-4 w-80 max-w-full mx-auto rounded skeleton-shimmer bg-stone-100" />
          </div>
        </div>
      </div>
      <div className="w-full max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 bg-white">
        <ProductCatalogSkeleton />
      </div>
    </div>
  );
}

const VALID_GENDERS = ["men", "women", "kids", "unisex"] as const;
type GenderFilter = (typeof VALID_GENDERS)[number];

function ShopAllContent() {
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [genderFilter, setGenderFilter] = useState<GenderFilter | undefined>(() => {
    const raw = searchParams.get("gender");
    return (VALID_GENDERS as readonly string[]).includes(raw ?? "")
      ? (raw as GenderFilter)
      : undefined;
  });
  // Nav links change only `?gender=` on this same route, so the page stays
  // mounted and the initial state above never re-runs - follow the URL.
  const urlGender = searchParams.get("gender");
  useEffect(() => {
    setGenderFilter(
      (VALID_GENDERS as readonly string[]).includes(urlGender ?? "")
        ? (urlGender as GenderFilter)
        : undefined
    );
    setPage(1);
  }, [urlGender]);
  const [sortKey, setSortKey] = useState("createdAt_desc");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [stockStatus, setStockStatus] = useState<"all" | "in_stock" | "out_of_stock">("all");
  const [vegType, setVegType] = useState<"all" | "veg" | "non_veg" | "vegan">("all");
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(1000);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // Accumulated styles for Infinite Scroll
  const [accumulatedVariants, setAccumulatedVariants] = useState<CustomerProductListItemDto[]>([]);

  // Fetch all categories (supports 250 categories)
  const { data: categoriesData, isLoading: isLoadingCategories } = useCustomerCategories({ pageSize: 250 });
  const categories = categoriesData?.data ?? [];

  const currentCategory = useMemo(() => {
    if (selectedCategoryIds.length !== 1) return null;
    return categories.find((c) => c.id === selectedCategoryIds[0]);
  }, [categories, selectedCategoryIds]);

  const pageTitle = useMemo(() => {
    if (selectedCategoryIds.length === 1 && currentCategory?.name) return currentCategory.name;
    if (selectedCategoryIds.length > 1) return `${selectedCategoryIds.length} Categories Selected`;
    return "Shop All Collections";
  }, [currentCategory, selectedCategoryIds]);

  // Find active sort config
  const activeSort = useMemo(() => {
    return SORT_OPTIONS.find((s) => s.value === sortKey) ?? SORT_OPTIONS[0];
  }, [sortKey]);

  const inStockParam =
    stockStatus === "in_stock" ? true : stockStatus === "out_of_stock" ? false : undefined;
  const vegTypeParam =
    vegType === "veg"
      ? ("veg" as const)
      : vegType === "non_veg"
      ? ("non_veg" as const)
      : vegType === "vegan"
      ? ("vegan" as const)
      : undefined;

  // Query the listing as Styles - one card per Style (Postman: POST /api/customer/styles)
  const {
    data: variantsResponse,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useCustomerStyles({
    page,
    pageSize: 18,
    search: search.trim() ? search.trim() : undefined,
    categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
    productIds: selectedProductIds.length > 0 ? selectedProductIds : undefined,
    minPrice: minPrice > 0 ? minPrice : undefined,
    maxPrice: maxPrice < 1000 ? maxPrice : undefined,
    inStock: inStockParam,
    vegType: vegTypeParam,
    gender: genderFilter,
    sortBy: activeSort.sortBy,
    sortOrder: activeSort.sortOrder,
  });

  const meta = variantsResponse?.meta;

  // Infinite Scroll accumulation logic
  useEffect(() => {
    if (!variantsResponse?.data) return;

    if (page === 1) {
      setAccumulatedVariants(variantsResponse.data);
    } else {
      setAccumulatedVariants((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newItems = variantsResponse.data.filter((p) => !existingIds.has(p.id));
        return [...prev, ...newItems];
      });
    }
  }, [variantsResponse?.data, page]);

  // Derive displayed variants: on page 1 always prioritize variantsResponse.data directly
  const displayedVariants = useMemo(() => {
    if (page === 1 && variantsResponse?.data) {
      return variantsResponse.data;
    }
    return accumulatedVariants;
  }, [page, variantsResponse?.data, accumulatedVariants]);

  // Catalog container ref for smooth viewport scroll on filter change
  const catalogContentRef = useRef<HTMLDivElement>(null);

  const scrollToCatalogTop = () => {
    if (typeof window === "undefined" || !catalogContentRef.current) return;
    const rect = catalogContentRef.current.getBoundingClientRect();
    if (rect.top < 80) {
      const targetY = window.scrollY + rect.top - 90;
      window.scrollTo({ top: Math.max(0, targetY), behavior: "smooth" });
    }
  };

  // Infinite Scroll IntersectionObserver sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (
          first.isIntersecting &&
          meta &&
          page < meta.totalPages &&
          !isFetching &&
          !isLoading &&
          displayedVariants.length < (meta.total ?? 0)
        ) {
          setPage((prev) => prev + 1);
        }
      },
      { threshold: 0.1, rootMargin: "150px" }
    );

    const currentSentinel = sentinelRef.current;
    observer.observe(currentSentinel);

    return () => {
      if (currentSentinel) observer.unobserve(currentSentinel);
      observer.disconnect();
    };
  }, [meta, page, isFetching, isLoading, displayedVariants.length]);

  // Category Selection (Multi-select)
  const handleCategorySelect = (categoryIds: string[]) => {
    setSelectedCategoryIds(categoryIds);
    setPage(1);
    scrollToCatalogTop();
  };

  // Product Selection under Category (Multi-select)
  const handleProductSelect = (productIds: string[]) => {
    setSelectedProductIds(productIds);
    setPage(1);
    scrollToCatalogTop();
  };

  const hasActiveFilters =
    Boolean(search.trim()) ||
    selectedCategoryIds.length > 0 ||
    selectedProductIds.length > 0 ||
    stockStatus !== "all" ||
    vegType !== "all" ||
    Boolean(genderFilter) ||
    minPrice > 0 ||
    maxPrice < 1000 ||
    sortKey !== "createdAt_desc";

  // Reset Filters
  const handleResetFilters = () => {
    if (!hasActiveFilters) return;
    setSearch("");
    setSortKey("createdAt_desc");
    setSelectedCategoryIds([]);
    setSelectedProductIds([]);
    setStockStatus("all");
    setVegType("all");
    setGenderFilter(undefined);
    setMinPrice(0);
    setMaxPrice(1000);
    setPage(1);
    scrollToCatalogTop();
  };

  const activeFilterCount = [
    Boolean(search.trim()),
    selectedCategoryIds.length > 0,
    selectedProductIds.length > 0,
    stockStatus !== "all",
    vegType !== "all",
    Boolean(genderFilter),
    minPrice > 0 || maxPrice < 1000,
    sortKey !== "createdAt_desc",
  ].filter(Boolean).length;

  const hasMorePages = meta ? page < meta.totalPages : false;

  return (
    <div className="min-h-screen bg-white">
      {/* Hero / Header Banner */}
      <div className="border-b border-[#F0E4D8] bg-gradient-to-b from-[#FFFDF9] via-[#FAF4ED] to-[#F5ECE1] py-8 sm:py-12">
        <div className="w-full max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb navigation */}
          <nav className="flex items-center justify-center gap-2 text-xs sm:text-sm text-[#7A6258] mb-3">
            <Link href="/" className="hover:text-[#7A2224] transition-colors">
              Home
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-[#7A6258]">
              Shop All
            </span>
            {selectedCategoryIds.length === 1 && currentCategory && (
              <>
                <ChevronRight className="w-3.5 h-3.5" />
                <span className="font-bold text-[#2D1810]">
                  {currentCategory.name}
                </span>
              </>
            )}
            {selectedCategoryIds.length > 1 && (
              <>
                <ChevronRight className="w-3.5 h-3.5" />
                <span className="font-bold text-[#2D1810]">
                  Selected Collections
                </span>
              </>
            )}
          </nav>

          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#7A2224]/10 text-[#7A2224] text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles className="h-3.5 w-3.5 text-[#F8BE15]" />
              Authentic Collection
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#2D1810] font-serif tracking-tight">
              {pageTitle}
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-[#7A6258] max-w-2xl mx-auto leading-relaxed">
              Explore bespoke dresses, ethnic silhouettes, modern kurtis, and timeless apparel curated with craftsmanship.
            </p>
          </div>
        </div>
      </div>

      <div className="w-full bg-white">
        <div className="w-full max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 bg-white">
          {/* Mobile Filter Toggle Button */}
          <div className="lg:hidden mb-6 flex items-center justify-between gap-3 bg-white border border-[#E8D9CD] rounded-xl p-3 shadow-xs">
            <button
              type="button"
              onClick={() => setIsMobileFilterOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#7A2224] text-white font-bold text-xs shadow-xs cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="w-4.5 h-4.5 rounded-full bg-[#F8BE15] text-[#2D1810] font-black text-[10px] flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <span className="text-xs text-[#7A6258] font-medium">
              Showing <strong className="text-[#2D1810]">{meta?.total ?? displayedVariants.length}</strong> items
            </span>
          </div>

          {/* 2-Column Layout: Left FilterSidebar, Right Products Grid */}
          <div className="flex flex-col lg:flex-row items-start gap-8">
            {/* Left Sticky FilterSidebar */}
            <FilterSidebar
              categories={categories}
              isLoadingCategories={isLoadingCategories && categories.length === 0}
              selectedCategoryIds={selectedCategoryIds}
              onSelectCategories={handleCategorySelect}
              selectedProductIds={selectedProductIds}
              onSelectProducts={handleProductSelect}
              searchQuery={search}
              onSearchChange={(val) => {
                setSearch(val);
                setPage(1);
                scrollToCatalogTop();
              }}
              sortKey={sortKey}
              onSortChange={(val) => {
                setSortKey(val);
                setPage(1);
                scrollToCatalogTop();
              }}
              stockStatus={stockStatus}
              onStockStatusChange={(val) => {
                setStockStatus(val);
                setPage(1);
                scrollToCatalogTop();
              }}
              vegType={vegType}
              onVegTypeChange={(val) => {
                setVegType(val);
                setPage(1);
                scrollToCatalogTop();
              }}
              genderFilter={genderFilter ?? "all"}
              onGenderFilterChange={(val) => {
                setGenderFilter(val === "all" ? undefined : val);
                setPage(1);
                scrollToCatalogTop();
              }}
              minPriceLimit={0}
              maxPriceLimit={1000}
              currentMinPrice={minPrice}
              currentMaxPrice={maxPrice}
              onPriceChange={(min, max) => {
                setMinPrice(min);
                setMaxPrice(max);
                setPage(1);
                scrollToCatalogTop();
              }}
              onResetFilters={handleResetFilters}
              hasActiveFilters={hasActiveFilters}
              isMobileOpen={isMobileFilterOpen}
              onCloseMobile={() => setIsMobileFilterOpen(false)}
              totalResultsCount={meta?.total}
              facets={meta?.facets}
            />

            {/* Right Main Products Display (3 cards per row) */}
            <div ref={catalogContentRef} className="flex-1 min-w-0 w-full min-h-[750px] lg:min-h-[850px]">
              {/* Header info bar */}
              <div className="hidden lg:flex items-center justify-between mb-6 pb-3 border-b border-[#E8D9CD]">
                <p className="text-sm text-[#7A6258]">
                  Showing{" "}
                  <strong className="text-[#2D1810]">
                    {meta?.total ?? displayedVariants.length}
                  </strong>{" "}
                  curated {meta?.total === 1 ? "item" : "items"}
                  {currentCategory && (
                    <>
                      {" "}in <strong className="text-[#7A2224] font-bold">{currentCategory.name}</strong>
                    </>
                  )}
                  {selectedProductIds.length > 0 && (
                    <span className="ml-2 text-xs bg-[#F5ECE1] text-[#7A2224] px-2 py-0.5 rounded-full font-semibold">
                      {selectedProductIds.length === 1
                        ? "1 Product filtered"
                        : `${selectedProductIds.length} Products filtered`}
                    </span>
                  )}
                </p>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="text-xs font-bold text-[#7A2224] hover:underline cursor-pointer transition-colors"
                  >
                    Reset All Filters
                  </button>
                )}
              </div>

              {/* Error State */}
              {error && (
                <div className="rounded-2xl border border-[#E8D9CD] bg-[#FFFDF9] p-8 text-center max-w-md mx-auto my-8 shadow-xs">
                  <h3 className="text-base font-bold text-[#2D1810] mb-2">
                    Unable to load items
                  </h3>
                  <p className="text-xs text-[#7A6258] mb-4">
                    We encountered a connection issue fetching the product catalog.
                  </p>
                  <Button
                    onClick={() => refetch()}
                    className="h-9 px-5 rounded-xl bg-[#7A2224] hover:bg-[#5A1911] text-white text-xs font-bold cursor-pointer"
                  >
                    Retry
                  </Button>
                </div>
              )}

              {/* Content Area: Skeleton only while initial load or empty and fetching */}
              {(isLoading && displayedVariants.length === 0) ? (
                <ProductCatalogSkeleton />
              ) : (
                <div className={isFetching && page === 1 ? "opacity-60 transition-opacity duration-200" : "transition-opacity duration-200"}>
                  <CustomerProductGrid
                    styles={displayedVariants}
                    columns={3}
                    onResetFilters={hasActiveFilters ? handleResetFilters : undefined}
                  />

                  {/* Shimmer cards appended at the bottom while next infinite scroll page loads */}
                  {isFetching && page > 1 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 gap-5 sm:gap-6 mt-6 animate-in fade-in duration-200">
                      {[1, 2, 3, 4].map((n) => (
                        <div
                          key={`append-skel-${n}`}
                          className="bg-white rounded-2xl border border-[#E8D9CD]/80 p-3.5 flex flex-col justify-between overflow-hidden shadow-2xs space-y-3"
                        >
                          <div className="relative aspect-square w-full rounded-xl skeleton-shimmer overflow-hidden bg-stone-100" />
                          <div className="space-y-2 pt-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="h-3 w-20 rounded skeleton-shimmer bg-stone-100" />
                              <div className="h-4.5 w-10 rounded skeleton-shimmer bg-stone-100" />
                            </div>
                            <div className="h-4.5 w-36 rounded skeleton-shimmer bg-stone-100" />
                          </div>
                          <div className="h-10 w-full rounded-xl skeleton-shimmer bg-[#F8BE15]/20" />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Infinite Scroll Sentinel & Loading Indicator */}
                  <div
                    ref={sentinelRef}
                    className="h-16 flex items-center justify-center my-6"
                  >
                    {isFetching && page > 1 && (
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-[#E8D9CD] shadow-xs text-xs font-bold text-[#7A2224] animate-in fade-in">
                        <Loader2 className="w-4 h-4 animate-spin text-[#7A2224]" />
                        Loading more items...
                      </div>
                    )}

                    {!hasMorePages && displayedVariants.length > 0 && !isFetching && (
                      <p className="text-xs font-semibold text-[#9C8274] select-none">
                        ✦ You have viewed all {displayedVariants.length} items ✦
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ShopAllPage() {
  return (
    <Suspense fallback={<ProductCatalogPageSkeleton />}>
      <ShopAllContent />
    </Suspense>
  );
}
