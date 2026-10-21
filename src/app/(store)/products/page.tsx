"use client";

import { Suspense, useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Sparkles, ChevronRight, ChevronLeft, SlidersHorizontal, Loader2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterSidebar } from "@/components/storefront/filters/FilterSidebar";
import { CustomerProductGrid } from "@/features/customers/components/catalog/CustomerProductGrid";
import { useHeaderMenu } from "@/features/header-menu/hooks";
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

const VALID_GENDERS = ["all", "men", "women", "kids", "unisex"] as const;
type GenderFilter = (typeof VALID_GENDERS)[number];

function ShopAllContent() {
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [genderFilter, setGenderFilter] = useState<GenderFilter | undefined>(() => {
    const raw = searchParams.get("gender") || searchParams.get("category");
    const lower = raw?.toLowerCase() ?? "";
    return (VALID_GENDERS as readonly string[]).includes(lower)
      ? (lower as GenderFilter)
      : undefined;
  });
  // Nav links change `?gender=` or `?category=` on this same route, so follow the URL.
  const urlGender = searchParams.get("gender") || searchParams.get("category");
  useEffect(() => {
    const lower = (urlGender ?? "").toLowerCase();
    setGenderFilter(
      (VALID_GENDERS as readonly string[]).includes(lower)
        ? (lower as GenderFilter)
        : undefined
    );
    setPage(1);
  }, [urlGender]);
  const [sortKey, setSortKey] = useState(() => {
    const rawSort = searchParams.get("sortBy") || searchParams.get("sort");
    if (rawSort && SORT_OPTIONS.some((s) => s.value === rawSort)) return rawSort;
    return "createdAt_desc";
  });
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

  // Sync category param with selectedCategoryIds if it refers to a specific category
  const urlCategory = searchParams.get("category");
  useEffect(() => {
    if (!urlCategory || categories.length === 0) return;
    const catLower = urlCategory.toLowerCase();
    if ((VALID_GENDERS as readonly string[]).includes(catLower)) return;
    const matched = categories.find(
      (c) =>
        c.id.toLowerCase() === catLower ||
        ((c as any).slug && (c as any).slug.toLowerCase() === catLower) ||
        c.name.toLowerCase() === catLower
    );
    if (matched && !selectedCategoryIds.includes(matched.id)) {
      setSelectedCategoryIds([matched.id]);
      setPage(1);
    }
  }, [urlCategory, categories]);

  // Curated storefront header navigation menu to dynamically populate round category carousel
  const { data: headerMenu = [] } = useHeaderMenu();

  // Carousel tiles:
  // If gender is selected, show all categories and subcategories for that gender
  // Otherwise, show all available categories and subcategories across the entire store
  const carouselTiles = useMemo(() => {
    const list: { id: string; name: string; slug: string; image: string | null }[] = [];

    const categoryImageMap = new Map<string, string | null>();
    for (const cat of categories) {
      if (cat.image) {
        categoryImageMap.set(cat.id, cat.image);
        if ((cat as any).slug) categoryImageMap.set((cat as any).slug, cat.image);
      }
    }

    const addUnique = (c: { id: string; name: string; slug: string; image: string | null }) => {
      if (!c.id || !c.name) return;
      if (!list.some((existing) => existing.id === c.id || existing.name.toLowerCase() === c.name.toLowerCase())) {
        const resolvedImage = c.image || categoryImageMap.get(c.id) || (c.slug ? categoryImageMap.get(c.slug) : null) || null;
        list.push({
          ...c,
          image: resolvedImage,
        });
      }
    };

    if (genderFilter) {
      const matchedMenu = headerMenu.find(
        (m) =>
          m.gender === genderFilter ||
          m.label.toLowerCase() === genderFilter.toLowerCase()
      );
      if (matchedMenu && matchedMenu.categories.length > 0) {
        for (const cat of matchedMenu.categories) {
          if (cat.children && cat.children.length > 0) {
            for (const sub of cat.children) {
              addUnique({
                id: sub.id,
                name: sub.name,
                slug: sub.slug,
                image: sub.icon || (sub as any).image || null,
              });
            }
          }
          addUnique({
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            image: cat.icon || (cat as any).image || null,
          });
        }
      }
    } else {
      // Gather all categories & subcategories across all departments
      for (const menu of headerMenu) {
        if (menu.label.toLowerCase() === "sale" || menu.label.toLowerCase() === "home") continue;
        for (const cat of menu.categories) {
          addUnique({
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            image: cat.icon || (cat as any).image || null,
          });
          if (cat.children && cat.children.length > 0) {
            for (const sub of cat.children) {
              addUnique({
                id: sub.id,
                name: sub.name,
                slug: sub.slug,
                image: sub.icon || (sub as any).image || null,
              });
            }
          }
        }
      }

      // Also merge any categories from categoriesData that have images
      for (const cat of categories) {
        if (cat.image) {
          addUnique({
            id: cat.id,
            name: cat.name,
            slug: (cat as any).slug || cat.id,
            image: cat.image,
          });
        }
      }
    }

    return list;
  }, [genderFilter, headerMenu, categories]);

  const carouselRef = useRef<HTMLDivElement>(null);

  const scrollCarousel = (direction: "left" | "right") => {
    if (!carouselRef.current) return;
    const amount = Math.max(280, Math.floor(carouselRef.current.clientWidth * 0.6));
    carouselRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

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
    gender: genderFilter === "all" ? undefined : genderFilter,
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
    Boolean(genderFilter && genderFilter !== "all") ||
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
    Boolean(genderFilter && genderFilter !== "all"),
    minPrice > 0 || maxPrice < 1000,
    sortKey !== "createdAt_desc",
  ].filter(Boolean).length;

  const hasMorePages = meta ? page < meta.totalPages : false;

  return (
    <div className="min-h-screen bg-white">
      {/* Category Round Carousel Strip (replacing old text banner) */}
      <header className="border-b border-slate-200 bg-gradient-to-b from-blue-50/40 via-white to-white">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1800px] px-4 sm:px-6 lg:px-8 pt-4 pb-4 sm:pt-6 sm:pb-6">
          {/* Breadcrumb navigation */}
          <nav className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 mb-3 sm:mb-4">
            <Link href="/" className="hover:text-theme-primary transition-colors">
              Home
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <button
              type="button"
              onClick={() => handleCategorySelect([])}
              className={`transition-colors cursor-pointer ${selectedCategoryIds.length === 0 ? "font-bold text-slate-900" : "text-slate-500 hover:text-slate-800"
                }`}
            >
              Shop All
            </button>
            {selectedCategoryIds.length === 1 && currentCategory && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-bold text-theme-primary">
                  {currentCategory.name}
                </span>
              </>
            )}
            {selectedCategoryIds.length > 1 && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-bold text-theme-primary">
                  {selectedCategoryIds.length} Selected
                </span>
              </>
            )}
          </nav>

          {/* Round Carousel Navigation */}
          <div className="relative group/carousel px-2 sm:px-4">
            {/* Always-visible Previous Button */}
            <button
              type="button"
              onClick={() => scrollCarousel("left")}
              aria-label="Previous categories"
              className="absolute left-0 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-white text-slate-800 border border-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.12)] transition-all hover:bg-white hover:text-black hover:border-slate-300 hover:shadow-[0_4px_16px_rgba(0,0,0,0.25)] hover:scale-105 active:scale-95 cursor-pointer"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <nav
              ref={carouselRef}
              aria-label="Category Carousel"
              className="flex items-center gap-4 sm:gap-7 overflow-x-auto px-6 sm:px-8 py-2 scroll-smooth scrollbar-hide"
            >
              {/* Dynamic Category Avatars */}
              {carouselTiles.map((tile) => {
                const isActive = selectedCategoryIds.includes(tile.id);
                return (
                  <button
                    key={tile.id}
                    type="button"
                    onClick={() => handleCategorySelect(isActive ? [] : [tile.id])}
                    className="group flex w-[76px] shrink-0 flex-col items-center gap-2.5 sm:w-28 cursor-pointer select-none"
                  >
                    <span
                      className={`relative flex h-[68px] w-[68px] items-center justify-center overflow-hidden rounded-full bg-slate-100 shadow-sm transition-all duration-300 sm:h-24 sm:w-24 ${isActive
                          ? "scale-105 ring-[3px] ring-theme-primary ring-offset-[3px] shadow-lg"
                          : "ring-1 ring-slate-200 group-hover:-translate-y-1 group-hover:shadow-lg group-hover:ring-2 group-hover:ring-theme-primary"
                        }`}
                    >
                      {tile.image ? (
                        <Image
                          src={tile.image}
                          alt={tile.name}
                          fill
                          sizes="96px"
                          unoptimized
                          className="object-cover object-top transition-transform duration-500 group-hover:scale-110"
                        />
                      ) : (
                        <span className="text-xl font-bold text-slate-400 sm:text-2xl">
                          {tile.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span
                      className={`text-center text-[11px] uppercase tracking-wider transition-colors sm:text-[13px] truncate max-w-full ${isActive
                          ? "font-extrabold text-theme-primary"
                          : "font-semibold text-slate-600 group-hover:text-theme-primary"
                        }`}
                      title={tile.name}
                    >
                      {tile.name}
                    </span>
                    <span
                      aria-hidden
                      className={`-mt-1 h-0.5 rounded-full bg-theme-primary transition-all duration-300 ${isActive ? "w-6 opacity-100" : "w-0 opacity-0 group-hover:w-4 group-hover:opacity-60"
                        }`}
                    />
                  </button>
                );
              })}
            </nav>

            {/* Always-visible Next Button */}
            <button
              type="button"
              onClick={() => scrollCarousel("right")}
              aria-label="Next categories"
              className="absolute right-0 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-white text-slate-800 border border-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.12)] transition-all hover:bg-white hover:text-black hover:border-slate-300 hover:shadow-[0_4px_16px_rgba(0,0,0,0.25)] hover:scale-105 active:scale-95 cursor-pointer"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="w-full bg-white">
        <div className="w-full max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 bg-white">
          {/* Mobile Filter Toggle Button */}
          <div className="lg:hidden mb-6 flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
            <button
              type="button"
              onClick={() => setIsMobileFilterOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-theme-primary hover:bg-theme-primary-hover text-white font-bold text-xs shadow-xs cursor-pointer transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="w-4.5 h-4.5 rounded-full bg-white text-theme-primary font-black text-[10px] flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <span className="text-xs text-slate-500 font-medium">
              Showing <strong className="text-slate-900">{meta?.total ?? displayedVariants.length}</strong> items
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
                setGenderFilter(val);
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
