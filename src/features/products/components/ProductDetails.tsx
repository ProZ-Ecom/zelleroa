"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Heart,
  ShoppingBag,
  Truck,
  ShieldCheck,
  RotateCcw,
  Check,
  Sparkles,
  Loader2,
  Star,
  Clock,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductGallery } from "./ProductGallery";
import { ProductVariantSelector } from "./ProductVariantSelector";
import { useSizeChart } from "@/features/size-charts/hooks/use-size-chart";
import { getImageUrl } from "@/lib/utils";
import { formatMeasurementLabel } from "@/features/variants/utils/measurement.util";
import { useAddToCart } from "@/features/cart/hooks/use-cart";
import { useWishlist, useAddToWishlist, useRemoveFromWishlist } from "@/features/wishlist/hooks/use-wishlist";
import { usePublicVariantReviews } from "@/features/reviews/hooks/use-public-reviews";
import { ProductReviewsSection } from "@/features/reviews/components/ProductReviewsSection";
import type { CustomerProductDetailDto, CustomerItemDto, CustomerVariantListItemDto } from "../types";
import { sanitizeRichText } from "@/lib/sanitize-html";
import { toast } from "@/components/ui/Toast";
import { categoryHref } from "@/features/customers/utils/catalog-listing-query";

interface ProductDetailsProps {
  product: CustomerProductDetailDto;
}

function ProductDetails({ product }: ProductDetailsProps) {
  const router = useRouter();
  const { data: session } = useSession();

  // Product -> Item selection. Most products migrated from the old flat
  // catalog have exactly one Item, so this silently auto-selects it and the
  // rest of the page behaves exactly as before; only products with more than
  // one Item (e.g. "V Neck T-Shirt" vs "Solo T-Shirt" under Product "T-Shirt")
  // show the picker below.
  const items = product.items ?? [];
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    () => items.find((i) => i.isDefault)?.id ?? items[0]?.id ?? null
  );
  const selectedItem: CustomerItemDto | null =
    items.find((i) => i.id === selectedItemId) ?? items[0] ?? null;

  const variants = selectedItem?.variants ?? [];
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    () => variants[0]?.id ?? null
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const v = sp.get("variant");
      if (v && variants.some((varItem) => varItem.id === v)) {
        setSelectedVariantId((prev) => (prev === v ? prev : v));
      }
    }
  }, [variants]);

  const selectedVariant: CustomerVariantListItemDto | null =
    variants.find((v) => v.id === selectedVariantId) ?? variants[0] ?? null;

  const unitPrices = selectedVariant?.unitPrices ?? [];
  const [selectedUnitPriceId, setSelectedUnitPriceId] = useState<string | null>(
    unitPrices.find((u) => u.isDefault)?.id ?? unitPrices[0]?.id ?? null
  );
  const selectedUnitPrice =
    unitPrices.find((u) => u.id === selectedUnitPriceId) ?? unitPrices[0] ?? null;

  const [quantity, setQuantity] = useState(1);

  // Accordion state (Authentic Ingredients open by default like Figma)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    ingredients: true,
    storage: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const addToCart = useAddToCart();
  const { data: wishlist } = useWishlist({ enabled: !!session });
  const addToWishlist = useAddToWishlist();
  const removeFromWishlist = useRemoveFromWishlist();
  const { data: variantReviewsData } = usePublicVariantReviews(selectedVariant?.id);
  const avgRating = variantReviewsData?.ratingSummary?.averageRating ?? 0;
  const totalReviews =
    variantReviewsData?.ratingSummary?.totalReviews ??
    variantReviewsData?.reviews?.length ??
    0;

  const handleSelectVariant = (variantId: string) => {
    setSelectedVariantId(variantId);
    const next = variants.find((v) => v.id === variantId);
    const nextUnitPrices = next?.unitPrices ?? [];
    setSelectedUnitPriceId(
      nextUnitPrices.find((u) => u.isDefault && u.inStock)?.id ??
        nextUnitPrices.find((u) => u.inStock)?.id ??
        nextUnitPrices.find((u) => u.isDefault)?.id ??
        nextUnitPrices[0]?.id ??
        null
    );
    setQuantity(1);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 120, behavior: "smooth" });
    }
  };

  const handleSelectItem = (itemId: string) => {
    setSelectedItemId(itemId);
    const nextItem = items.find((i) => i.id === itemId);
    const nextVariant = nextItem?.variants?.[0] ?? null;
    setSelectedVariantId(nextVariant?.id ?? null);
    const nextUnitPrices = nextVariant?.unitPrices ?? [];
    setSelectedUnitPriceId(
      nextUnitPrices.find((u) => u.isDefault)?.id ?? nextUnitPrices[0]?.id ?? null
    );
    setQuantity(1);
    // Color/Size multi-select is scoped to whichever Style is selected - a
    // different Style has its own colors and sizes, so ticks made under the
    // previous Style don't carry over and try to match values that don't
    // exist here.
    setSelectedColorNames(new Set());
    setSelectedSizeValueIds(new Set());
    setExcludedComboIds(new Set());
    setComboQuantities({});
  };

  // Clothing Size (e.g. S/M/L) - a separate concept from the pack-size/measurement
  // selector below. Hidden entirely when the category+gender has no size chart.
  const { data: sizeChart = [] } = useSizeChart(product.category?.id ?? null, product.gender);
  const selectedSizeValueId = useMemo(
    () =>
      selectedVariant?.attributeValues.find(
        (av) => av.attributeName.trim().toLowerCase() === "size"
      )?.valueId ?? null,
    [selectedVariant]
  );

  // Size values that actually have a variant for the currently selected color.
  // Sizes outside this set exist in the category's size chart but were never
  // generated as a combination (or were filtered out by attribute dependency
  // rules), so they should be shown but disabled rather than hidden.
  const availableSizeValueIds = useMemo(() => {
    const ids = new Set<string>();
    for (const v of variants) {
      if (selectedVariant?.colorName && v.colorName !== selectedVariant.colorName) continue;
      for (const av of v.attributeValues) {
        if (av.attributeName.trim().toLowerCase() === "size") ids.add(av.valueId);
      }
    }
    return ids;
  }, [variants, selectedVariant?.colorName]);

  const handleSelectSize = (sizeValueId: string) => {
    // Prefer a variant that also matches the currently selected color; fall
    // back to the first variant with this size otherwise.
    const match =
      variants.find(
        (v) =>
          v.attributeValues.some((av) => av.valueId === sizeValueId) &&
          v.colorName === selectedVariant?.colorName
      ) ?? variants.find((v) => v.attributeValues.some((av) => av.valueId === sizeValueId));
    if (match) handleSelectVariant(match.id);
  };

  // Multi-select: on top of the single "preview" color/size above, let the
  // customer tick multiple colors and/or sizes and add every resulting
  // combination to the cart in one go, each with its own quantity.
  const colorOptions = useMemo(() => {
    const byName = new Map<string, { colorName: string; colorHex?: string | null }>();
    for (const v of variants) {
      if (!v.colorName) continue;
      if (!byName.has(v.colorName)) byName.set(v.colorName, { colorName: v.colorName, colorHex: v.colorHex });
    }
    return Array.from(byName.values());
  }, [variants]);

  const hasColorDimension = colorOptions.length > 0;
  const hasSizeDimension = sizeChart.length > 0;

  const [selectedColorNames, setSelectedColorNames] = useState<Set<string>>(new Set());
  const [selectedSizeValueIds, setSelectedSizeValueIds] = useState<Set<string>>(new Set());
  const [excludedComboIds, setExcludedComboIds] = useState<Set<string>>(new Set());
  const [comboQuantities, setComboQuantities] = useState<Record<string, number>>({});

  const toggleColorChip = (colorName: string) => {
    setSelectedColorNames((prev) => {
      const next = new Set(prev);
      if (next.has(colorName)) next.delete(colorName);
      else next.add(colorName);
      return next;
    });
  };

  const toggleSizeChip = (sizeValueId: string) => {
    setSelectedSizeValueIds((prev) => {
      const next = new Set(prev);
      if (next.has(sizeValueId)) next.delete(sizeValueId);
      else next.add(sizeValueId);
      return next;
    });
  };

  const findVariantForColorSize = (colorName: string | null, sizeValueId: string | null) =>
    variants.find(
      (v) =>
        (colorName === null || v.colorName === colorName) &&
        (sizeValueId === null || v.attributeValues.some((av) => av.valueId === sizeValueId))
    );

  const selectedCombos = useMemo(() => {
    if (!hasColorDimension && !hasSizeDimension) return [];
    const colors = hasColorDimension ? Array.from(selectedColorNames) : [null];
    const sizes = hasSizeDimension ? Array.from(selectedSizeValueIds) : [null];
    if (colors.length === 0 || sizes.length === 0) return [];
    const seen = new Set<string>();
    const combos: CustomerVariantListItemDto[] = [];
    for (const color of colors) {
      for (const size of sizes) {
        const match = findVariantForColorSize(color, size);
        if (match && !seen.has(match.id)) {
          seen.add(match.id);
          combos.push(match);
        }
      }
    }
    return combos;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variants, selectedColorNames, selectedSizeValueIds, hasColorDimension, hasSizeDimension]);

  useEffect(() => {
    setExcludedComboIds(new Set());
  }, [selectedColorNames, selectedSizeValueIds]);

  const visibleCombos = selectedCombos.filter((c) => !excludedComboIds.has(c.id));

  const getComboQty = (variantId: string) => comboQuantities[variantId] ?? 1;
  const bumpComboQty = (variantId: string, delta: number) =>
    setComboQuantities((prev) => ({
      ...prev,
      [variantId]: Math.max(1, (prev[variantId] ?? 1) + delta),
    }));
  const removeCombo = (variantId: string) =>
    setExcludedComboIds((prev) => new Set(prev).add(variantId));

  const handleAddCombosToCart = () => {
    if (!session) {
      router.push(`/login?callbackUrl=/products/${product.id}`);
      return;
    }
    if (visibleCombos.length === 0) return;
    let added = 0;
    for (const combo of visibleCombos) {
      const defaultUnit =
        combo.unitPrices?.find((u) => u.isDefault && u.inStock) ||
        combo.unitPrices?.find((u) => u.inStock) ||
        combo.unitPrices?.[0];
      if (!defaultUnit) continue;
      addToCart.mutate({
        variantUnitPriceId: defaultUnit.id,
        variantId: combo.id,
        quantity: getComboQty(combo.id),
      });
      added++;
    }
    if (added > 0) {
      toast.success(`Added ${added} item${added > 1 ? "s" : ""} to cart`);
      setSelectedColorNames(new Set());
      setSelectedSizeValueIds(new Set());
      setComboQuantities({});
    }
  };

  // Any product attribute besides Color and Size (Material, Strap, etc.) - Color
  // and Size get their own dedicated selectors above/below; every other
  // attribute a product's variants carry is rendered generically here so a
  // product isn't limited to those two. Grouped by attribute name, values
  // taken from whichever variants actually have that attribute.
  const otherAttributes = useMemo(() => {
    const byName = new Map<string, Map<string, string>>(); // attrName -> valueId -> value label
    for (const v of variants) {
      for (const av of v.attributeValues) {
        const name = av.attributeName.trim();
        const key = name.toLowerCase();
        if (key === "color" || key === "size") continue;
        if (!byName.has(name)) byName.set(name, new Map());
        byName.get(name)!.set(av.valueId, av.value);
      }
    }
    return Array.from(byName.entries()).map(([attributeName, values]) => ({
      attributeName,
      values: Array.from(values.entries()).map(([valueId, value]) => ({ valueId, value })),
    }));
  }, [variants]);

  const selectedOtherValueIds = useMemo(() => {
    const map: Record<string, string> = {};
    for (const av of selectedVariant?.attributeValues ?? []) {
      const key = av.attributeName.trim().toLowerCase();
      if (key === "color" || key === "size") continue;
      map[av.attributeName.trim()] = av.valueId;
    }
    return map;
  }, [selectedVariant]);

  // A value for `attributeName` is available if some variant matches it plus
  // every other attribute currently selected (color, size, and the other
  // "other" attributes) - not just a lone match, so e.g. picking Leather for
  // Material doesn't offer a Color that only ever shipped in Canvas.
  const isOtherValueAvailable = (attributeName: string, valueId: string) =>
    variants.some((v) => {
      if (selectedVariant?.colorName && v.colorName !== selectedVariant.colorName) return false;
      if (
        selectedSizeValueId &&
        !v.attributeValues.some((av) => av.valueId === selectedSizeValueId)
      )
        return false;
      for (const [otherName, otherValueId] of Object.entries(selectedOtherValueIds)) {
        if (otherName === attributeName) continue;
        if (!v.attributeValues.some((av) => av.valueId === otherValueId)) return false;
      }
      return v.attributeValues.some((av) => av.valueId === valueId);
    });

  const handleSelectOtherAttribute = (attributeName: string, valueId: string) => {
    const constraints = { ...selectedOtherValueIds, [attributeName]: valueId };
    let best: CustomerVariantListItemDto | null = null;
    let bestScore = -1;
    for (const v of variants) {
      if (!v.attributeValues.some((av) => av.valueId === valueId)) continue;
      let score = 0;
      if (selectedVariant?.colorName && v.colorName === selectedVariant.colorName) score += 1;
      if (
        selectedSizeValueId &&
        v.attributeValues.some((av) => av.valueId === selectedSizeValueId)
      )
        score += 1;
      for (const otherValueId of Object.values(constraints)) {
        if (v.attributeValues.some((av) => av.valueId === otherValueId)) score += 1;
      }
      if (score > bestScore) {
        bestScore = score;
        best = v;
      }
    }
    if (best) handleSelectVariant(best.id);
  };

  const isInStock =
    !selectedVariant?.outOfStock && (!selectedUnitPrice || selectedUnitPrice.inStock);
  const sellingPrice = selectedUnitPrice?.sellingPrice ?? 0;
  const basePrice = selectedUnitPrice?.basePrice ?? 0;
  const hasDiscount = sellingPrice < basePrice;
  const discountPercent =
    hasDiscount && basePrice > 0
      ? Math.round(((basePrice - sellingPrice) / basePrice) * 100)
      : 0;

  const isInWishlist =
    !!selectedUnitPrice &&
    !!wishlist?.items.some((i) => i.variantUnitPriceId === selectedUnitPrice.id);

  const galleryImages =
    selectedVariant?.images && selectedVariant.images.length > 0
      ? selectedVariant.images.map((img) => ({
          id: img.id,
          url: getImageUrl(img.imageUrl),
          altText: selectedVariant.variantName || product.name,
        }))
      : selectedVariant?.primaryImage
        ? [
            {
              id: selectedVariant.id,
              url: getImageUrl(selectedVariant.primaryImage),
              altText: selectedVariant.variantName || product.name,
            },
          ]
        : product.image
          ? [{ id: product.id, url: getImageUrl(product.image), altText: product.name }]
          : [];

  const handleAddToCart = () => {
    if (!session) {
      router.push(`/login?callbackUrl=/products/${product.id}`);
      return;
    }
    if (!selectedUnitPrice) return;
    addToCart.mutate({
      variantUnitPriceId: selectedUnitPrice.id,
      variantId: selectedVariant?.id,
      quantity,
    });
  };

  const handleWishlistToggle = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!session) {
      router.push(`/login?callbackUrl=/products/${product.id}`);
      return;
    }
    if (!selectedUnitPrice) return;
    if (addToWishlist.isPending || removeFromWishlist.isPending) return;

    if (isInWishlist) {
      removeFromWishlist.mutate(selectedUnitPrice.id);
    } else {
      addToWishlist.mutate(selectedUnitPrice.id);
    }
  };

  const rawIngredients = selectedItem?.ingredients?.trim();
  const hasIngredients = Boolean(rawIngredients);
  const parsedIngredients = hasIngredients
    ? rawIngredients!
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const shelfLife = selectedItem?.shelfLife?.trim();
  const hasShelfLife = Boolean(shelfLife);

  return (
    <div className="w-full space-y-12">
      {/* 2-Column Product Gallery + Details Buy Box */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left Gallery (sticky only on lg screens within this block) */}
        <div className="lg:col-span-6 lg:sticky lg:top-24">
          <ProductGallery
            images={galleryImages}
            productName={selectedVariant?.variantName || product.name}
            isInStock={isInStock}
          />
        </div>

        {/* Right Details */}
        <div className="lg:col-span-6 space-y-6">
          {/* Category, Brand & SKU Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {product.category && (
              <Link
                href={categoryHref(product.category)}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#8B1D1D]/10 text-[#8B1D1D] hover:bg-[#8B1D1D]/20 transition-colors"
              >
                {product.category.name}
              </Link>
            )}
            {product.brand && (
              <span className="text-xs font-medium text-stone-500 bg-stone-100 px-2.5 py-1 rounded-full">
                Brand: <strong className="text-stone-700">{product.brand.name}</strong>
              </span>
            )}
            {selectedUnitPrice?.sku && (
              <span className="text-xs font-mono text-stone-400 bg-stone-50 border border-stone-200/80 px-2.5 py-1 rounded-full">
                SKU: {selectedUnitPrice.sku}
              </span>
            )}
          </div>

          {/* Titles & Review Social Proof */}
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-stone-900 tracking-tight leading-tight">
              {product.name}
            </h1>
            {selectedVariant && (
              <p className="text-base sm:text-lg text-stone-600 font-medium mt-1">
                {selectedVariant.variantName}
              </p>
            )}

            {/* Star Rating Social Proof (Only show real rating if reviews exist) */}
            {totalReviews > 0 ? (
              <a
                href="#reviews-section"
                className="inline-flex items-center gap-2 mt-2 text-xs font-semibold text-stone-600 hover:text-[#8B1D1D] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-0.5 text-amber-500">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3.5 h-3.5 ${
                        i < Math.round(avgRating)
                          ? "fill-amber-400 text-amber-400"
                          : "fill-stone-200 text-stone-200"
                      }`}
                    />
                  ))}
                </div>
                <span className="font-bold text-stone-900">{avgRating.toFixed(1)}</span>
                <span className="text-stone-300">•</span>
                <span className="underline underline-offset-2 text-stone-500 group-hover:text-[#8B1D1D]">
                  {totalReviews} customer {totalReviews === 1 ? "review" : "reviews"}
                </span>
              </a>
            ) : (
              <a
                href="#reviews-section"
                className="inline-flex items-center gap-1.5 mt-2 text-xs text-stone-500 hover:text-[#8B1D1D] transition-colors cursor-pointer"
              >
                <span>No reviews yet</span>
                <span className="text-stone-300">•</span>
                <span className="underline underline-offset-2">Be the first to review</span>
              </a>
            )}
          </div>

          {/* Pricing Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50/50 via-stone-50 to-white border border-amber-200/40">
            {selectedUnitPrice ? (
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-3xl sm:text-4xl font-extrabold text-[#8B1D1D] tracking-tight">
                  ₹{sellingPrice.toFixed(2)}
                </span>
                {hasDiscount && (
                  <span className="text-lg sm:text-xl line-through text-stone-400">
                    ₹{basePrice.toFixed(2)}
                  </span>
                )}
                {hasDiscount && discountPercent > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <Sparkles className="w-3 h-3" />
                    Save {discountPercent}%
                  </span>
                )}
                <span className="text-xs text-stone-400 block w-full mt-1">
                  Inclusive of all taxes • Premium Quality Handcrafted
                </span>
              </div>
            ) : (
              <p className="text-sm text-stone-500 italic">
                Pricing for this item is coming soon.
              </p>
            )}
          </div>

          {/* Description */}
          {(product.description || selectedItem?.description) && (
            <div
              className="rich-text-content text-sm text-stone-600 leading-relaxed max-w-none border-b border-stone-100 pb-4"
              dangerouslySetInnerHTML={{
                __html: sanitizeRichText(product.description || selectedItem?.description || ""),
              }}
            />
          )}

          {/* Item Selection (only shown when this Product has more than one Item,
              e.g. "V Neck T-Shirt" vs "Solo T-Shirt" under Product "T-Shirt") */}
          {items.length > 1 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold tracking-wider text-stone-900 uppercase font-sans">
                  SELECT STYLE
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {items.map((item) => {
                  const isSelected = selectedItemId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectItem(item.id)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl border transition-all cursor-pointer select-none ${
                        isSelected
                          ? "border-[#7D1D20] bg-[#7D1D20] text-white shadow-xs"
                          : "border-stone-200 bg-white text-stone-800 hover:border-stone-400 hover:bg-stone-50"
                      }`}
                    >
                      {item.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Clothing Size (S/M/L, etc.) - only shown when the category+gender has a size chart.
              Tick multiple sizes to add several at once (see combo panel below). */}
          {sizeChart.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold tracking-wider text-stone-900 uppercase font-sans">
                  SIZE
                </span>
                <span className="text-[11px] text-stone-400 font-medium">Select one or more</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {sizeChart.map((size) => {
                  const isSelected = selectedSizeValueIds.has(size.id);
                  const isAvailable =
                    availableSizeValueIds.size === 0 || availableSizeValueIds.has(size.id);
                  return (
                    <button
                      key={size.id}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => {
                        if (!isAvailable) return;
                        toggleSizeChip(size.id);
                        handleSelectSize(size.id);
                      }}
                      title={!isAvailable ? `Not available in ${selectedVariant?.colorName}` : undefined}
                      className={`inline-flex items-center justify-center gap-1.5 min-w-10 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl border transition-all select-none ${
                        !isAvailable
                          ? "border-stone-100 bg-stone-50 text-stone-300 cursor-not-allowed line-through"
                          : isSelected
                            ? "border-[#7D1D20] bg-[#7D1D20] text-white shadow-xs cursor-pointer"
                            : "border-stone-200 bg-white text-stone-800 hover:border-stone-400 hover:bg-stone-50 cursor-pointer"
                      }`}
                    >
                      {isSelected && !!isAvailable && <Check className="w-3 h-3 stroke-[3]" />}
                      {size.value}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Color / Variant Selection (if multiple colors exist for this Item).
              `variants` has one row per color+size combo, so this renders off
              the deduped `colorOptions` list - one button per actual color -
              not off `variants` directly, which would show a duplicate button
              per size sharing the same color name.
              Tick multiple colors to add several at once (see combo panel below). */}
          {hasColorDimension && colorOptions.length > 1 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold tracking-wider text-stone-900 uppercase font-sans">
                  SELECT COLOR / STYLE
                </span>
                <span className="text-[11px] text-stone-400 font-medium">Select one or more</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map(({ colorName, colorHex }) => {
                  const isSelected = selectedColorNames.has(colorName);
                  return (
                    <button
                      key={colorName}
                      type="button"
                      onClick={() => {
                        toggleColorChip(colorName);
                        const preview = variants.find((v) => v.colorName === colorName);
                        if (preview) handleSelectVariant(preview.id);
                      }}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl border transition-all cursor-pointer select-none ${
                        isSelected
                          ? "border-[#7D1D20] bg-[#7D1D20] text-white shadow-xs"
                          : "border-stone-200 bg-white text-stone-800 hover:border-stone-400 hover:bg-stone-50"
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      {colorHex && (
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                          style={{ backgroundColor: colorHex }}
                        />
                      )}
                      {colorName}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Single-color products with no color dimension at all still show
              the raw variant/style picker (e.g. items differentiated only by
              variantName, not color). */}
          {!hasColorDimension && variants.length > 1 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold tracking-wider text-stone-900 uppercase font-sans">
                  SELECT STYLE
                </span>
                {selectedVariant && (
                  <span className="text-xs sm:text-sm text-[#8B1D1D] font-semibold">
                    {selectedVariant.variantName}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => {
                  const isSelected = selectedVariantId === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => handleSelectVariant(v.id)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl border transition-all cursor-pointer select-none ${
                        isSelected
                          ? "border-[#7D1D20] bg-[#7D1D20] text-white shadow-xs"
                          : "border-stone-200 bg-white text-stone-800 hover:border-stone-400 hover:bg-stone-50"
                      }`}
                    >
                      {v.variantName}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Multi-select combo panel: appears once the customer has ticked
              more than one color and/or size, listing every resulting
              variant with its own quantity so they can all be added together. */}
          {visibleCombos.length > 1 && (
            <div className="space-y-2.5 p-3.5 rounded-2xl border border-[#F0EAE1] bg-[#FAF7F2]/50">
              <span className="text-xs sm:text-sm font-bold tracking-wider text-stone-900 uppercase font-sans">
                Selected Items ({visibleCombos.length})
              </span>
              <div className="space-y-2">
                {visibleCombos.map((combo) => {
                  const unit =
                    combo.unitPrices?.find((u) => u.isDefault) || combo.unitPrices?.[0];
                  return (
                    <div
                      key={combo.id}
                      className="flex items-center justify-between gap-3 bg-white rounded-xl border border-stone-200 px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {combo.colorHex && (
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                            style={{ backgroundColor: combo.colorHex }}
                          />
                        )}
                        <span className="text-xs sm:text-sm font-semibold text-stone-800 truncate">
                          {combo.variantName}
                          {unit ? ` • ${formatMeasurementLabel(unit.measurement)}` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center border border-stone-200 rounded-lg overflow-hidden h-8">
                          <button
                            type="button"
                            onClick={() => bumpComboQty(combo.id, -1)}
                            className="w-7 h-full flex items-center justify-center text-sm font-bold text-stone-700 hover:bg-stone-100"
                            aria-label="Decrease quantity"
                          >
                            -
                          </button>
                          <span className="w-7 text-center text-xs font-semibold text-stone-900 select-none">
                            {getComboQty(combo.id)}
                          </span>
                          <button
                            type="button"
                            onClick={() => bumpComboQty(combo.id, 1)}
                            className="w-7 h-full flex items-center justify-center text-sm font-bold text-stone-700 hover:bg-stone-100"
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCombo(combo.id)}
                          className="text-stone-400 hover:text-rose-500 text-xs font-bold px-1"
                          aria-label="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Button
                type="button"
                size="lg"
                disabled={addToCart.isPending}
                onClick={handleAddCombosToCart}
                className="w-full h-11 bg-[#7D1D20] hover:bg-[#681719] text-white rounded-xl shadow-xs font-semibold text-sm transition-all active:scale-[0.99]"
              >
                <ShoppingBag className="mr-2 h-4 w-4" />
                Add {visibleCombos.length} Items to Cart
              </Button>
            </div>
          )}

          {/* Any other attribute the product's variants carry (Material, Strap,
              etc.) - Color and Size have dedicated selectors above/below, this
              covers whatever else a category was configured with. */}
          {otherAttributes.map(({ attributeName, values }) => (
            <div key={attributeName} className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold tracking-wider text-stone-900 uppercase font-sans">
                  {attributeName}
                </span>
                {selectedOtherValueIds[attributeName] && (
                  <span className="text-xs sm:text-sm text-[#8B1D1D] font-semibold">
                    {values.find((val) => val.valueId === selectedOtherValueIds[attributeName])?.value}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {values.map(({ valueId, value }) => {
                  const isSelected = selectedOtherValueIds[attributeName] === valueId;
                  const isAvailable = isOtherValueAvailable(attributeName, valueId);
                  return (
                    <button
                      key={valueId}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => {
                        if (!isAvailable) return;
                        handleSelectOtherAttribute(attributeName, valueId);
                      }}
                      title={!isAvailable ? `Not available with the current selection` : undefined}
                      className={`inline-flex items-center justify-center min-w-10 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl border transition-all select-none ${
                        !isAvailable
                          ? "border-stone-100 bg-stone-50 text-stone-300 cursor-not-allowed line-through"
                          : isSelected
                            ? "border-[#7D1D20] bg-[#7D1D20] text-white shadow-xs cursor-pointer"
                            : "border-stone-200 bg-white text-stone-800 hover:border-stone-400 hover:bg-stone-50 cursor-pointer"
                      }`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Size Selection */}
          {unitPrices.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold tracking-wider text-stone-900 uppercase font-sans">
                  SELECT SIZE
                </span>
                {selectedUnitPrice && (
                  <span className="text-xs sm:text-sm text-[#8B1D1D] font-semibold">
                    Selected: {formatMeasurementLabel(selectedUnitPrice.measurement)}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {unitPrices.map((unitPrice) => {
                  const isSelected = selectedUnitPriceId === unitPrice.id;
                  const isUnitOutOfStock = !unitPrice.inStock;
                  const measurementLabel = formatMeasurementLabel(unitPrice.measurement);
                  const price = unitPrice.sellingPrice;
                  const compare = unitPrice.basePrice;
                  const discount =
                    compare > price ? Math.round(((compare - price) / compare) * 100) : 0;

                  return (
                    <button
                      key={unitPrice.id}
                      type="button"
                      disabled={isUnitOutOfStock}
                      onClick={() => {
                        if (isUnitOutOfStock) return;
                        setSelectedUnitPriceId(unitPrice.id);
                      }}
                      className={`relative flex flex-col items-center justify-center p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border transition-all select-none ${
                        isUnitOutOfStock
                          ? "border-stone-100 bg-stone-50 text-stone-350 cursor-not-allowed opacity-60"
                          : isSelected
                            ? "border-[#7D1D20] bg-[#7D1D20] text-white shadow-sm cursor-pointer"
                            : "border-stone-200 bg-white text-stone-800 hover:border-stone-400 hover:bg-stone-50 cursor-pointer"
                      }`}
                    >
                      {discount > 0 && !isUnitOutOfStock && (
                        <span className="absolute -top-2.5 right-2 bg-[#D99A46] text-white text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded shadow-2xs">
                          SAVE {discount}%
                        </span>
                      )}
                      <div className="flex items-center gap-1 text-xs sm:text-sm font-bold">
                        {isSelected && !isUnitOutOfStock && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        <span>{measurementLabel}</span>
                      </div>
                      {isUnitOutOfStock ? (
                        <span className="text-[10px] sm:text-xs mt-0.5 text-stone-400 font-semibold uppercase">
                          Out of stock
                        </span>
                      ) : (
                        <span
                          className={`text-xs sm:text-sm mt-0.5 ${
                            isSelected ? "text-stone-200 font-normal" : "text-stone-500 font-medium"
                          }`}
                        >
                          ₹{price.toFixed(0)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Controls: Quantity + Add to Cart + Wishlist */}
          <div className="pt-2 space-y-3">
            <div className="flex items-center gap-3">
              {/* Quantity Selector */}
              <div className="flex items-center border border-stone-200 rounded-xl bg-white shadow-2xs overflow-hidden h-12">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1 || addToCart.isPending}
                  className="w-11 h-full flex items-center justify-center text-lg font-bold text-stone-700 hover:bg-stone-100 disabled:opacity-40 transition-colors"
                  aria-label="Decrease quantity"
                >
                  -
                </button>
                <span className="w-11 text-center text-sm font-semibold text-stone-900 select-none">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  disabled={addToCart.isPending}
                  className="w-11 h-full flex items-center justify-center text-lg font-bold text-stone-700 hover:bg-stone-100 disabled:opacity-40 transition-colors"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>

              {/* Add to Cart CTA */}
              <Button
                type="button"
                size="lg"
                disabled={!isInStock || !selectedUnitPrice || addToCart.isPending}
                onClick={handleAddToCart}
                className="flex-1 h-12 bg-[#7D1D20] hover:bg-[#681719] text-white rounded-xl shadow-xs font-semibold text-base transition-all active:scale-[0.99] disabled:opacity-50"
              >
                {addToCart.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Adding to Cart...
                  </>
                ) : (
                  <>
                    <ShoppingBag className="mr-2 h-5 w-5" />
                    {!selectedUnitPrice
                      ? "Unavailable"
                      : !isInStock
                        ? "Out of Stock"
                        : "Add to Cart"}
                  </>
                )}
              </Button>

              {/* Wishlist Button */}
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={(e) => handleWishlistToggle(e)}
                disabled={addToWishlist.isPending || removeFromWishlist.isPending}
                className={`h-12 w-12 rounded-xl border-stone-200 hover:border-stone-400 bg-white transition-all active:scale-95 shrink-0 ${
                  isInWishlist ? "border-rose-300 bg-rose-50/50" : ""
                }`}
                aria-label={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
              >
                {addToWishlist.isPending || removeFromWishlist.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
                ) : (
                  <Heart
                    className={`h-5 w-5 transition-transform ${
                      isInWishlist
                        ? "fill-rose-500 text-rose-500 scale-110"
                        : "text-stone-600 hover:text-rose-500"
                    }`}
                  />
                )}
              </Button>
            </div>

            {/* Stock availability indicator */}
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  !selectedUnitPrice
                    ? "bg-stone-300"
                    : isInStock
                      ? "bg-emerald-500 ring-4 ring-emerald-500/20"
                      : "bg-rose-500 ring-4 ring-rose-500/20"
                }`}
              />
              <span
                className={`text-xs font-medium ${
                  !selectedUnitPrice
                    ? "text-stone-500"
                    : isInStock
                      ? "text-emerald-700"
                      : "text-rose-600"
                }`}
              >
                {!selectedUnitPrice
                  ? "Unavailable"
                  : isInStock
                    ? "In Stock • Ready to ship (Dispatches in 24 hours via Express)"
                    : "Currently Out of Stock"}
              </span>
            </div>
          </div>

          {/* Collapsible Accordions (Render ONLY if backend ingredients or shelfLife available) */}
          {(hasIngredients || hasShelfLife) && (
            <div className="space-y-3 pt-2">
              {/* Accordion 1: Authentic Ingredients (Only if backend ingredients available) */}
              {hasIngredients && (
                <div className="rounded-2xl border border-[#F0EAE1] bg-[#FAF7F2]/40 overflow-hidden transition-all">
                  <button
                    type="button"
                    onClick={() => toggleSection("ingredients")}
                    className="w-full p-4 sm:p-4.5 flex items-center justify-between text-left hover:bg-[#FAF7F2]/80 transition-colors select-none"
                  >
                    <div className="flex items-center gap-2.5 text-[#7D1D20]">
                      <Sparkles className="w-4 h-4 stroke-[2.2]" />
                      <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#2B1B17]">
                        FABRIC & SPECIFICATIONS
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-stone-500 transition-transform duration-200 ${
                        openSections.ingredients ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {openSections.ingredients && (
                    <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-1 border-t border-[#F0EAE1]/70">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs sm:text-[13px] text-stone-600 pt-2">
                        {parsedIngredients.map((ingredient, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="text-stone-400 font-bold">•</span>
                            <span>{ingredient}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Accordion 2: Wash Care & Fit Guide */}
              {hasShelfLife && (
                <div className="rounded-2xl border border-[#F0EAE1] bg-[#FAF7F2]/40 overflow-hidden transition-all">
                  <button
                    type="button"
                    onClick={() => toggleSection("storage")}
                    className="w-full p-4 sm:p-4.5 flex items-center justify-between text-left hover:bg-[#FAF7F2]/80 transition-colors select-none"
                  >
                    <div className="flex items-center gap-2.5 text-[#7D1D20]">
                      <Clock className="w-4 h-4 stroke-[2.2]" />
                      <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#2B1B17]">
                        WASH CARE & FIT GUIDE
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-stone-500 transition-transform duration-200 ${
                        openSections.storage ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {openSections.storage && (
                    <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-1 border-t border-[#F0EAE1]/70 text-xs sm:text-[13px] text-stone-600 space-y-2.5">
                      <div className="pt-2">
                        <span className="font-bold text-stone-800">Fit Details: </span>
                        <span>{shelfLife}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="font-bold text-stone-800 block">Care Instructions:</span>
                        <ul className="space-y-1 pl-1">
                          <li className="flex items-start gap-2">
                            <span className="text-stone-400 font-bold">•</span>
                            <span>Gentle machine wash or hand wash in cold water with similar colors.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-stone-400 font-bold">•</span>
                            <span>Do not bleach or wring. Dry inside out in shade to preserve color vibrancy.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-stone-400 font-bold">•</span>
                            <span>Warm iron on reverse side. Avoid direct ironing on prints or embellishments.</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {/* End 2-Column Product Gallery + Details Buy Box */}

      {/* Full-Width Guarantees Row Below Gallery & Details (Moved Below Like Figma) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 pt-2">
        <div className="flex items-center gap-3.5 p-4 sm:p-5 rounded-2xl bg-[#FAF7F2] border border-[#F0EAE1] shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-[#8B1D1D]/10 flex items-center justify-center text-[#8B1D1D] shrink-0">
            <Truck className="w-5 h-5 stroke-[1.8]" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-[#2B1B17] uppercase tracking-wide">FREE SHIPPING</h4>
            <p className="text-xs text-stone-500 mt-0.5">Across Tamil Nadu · ₹80 other states</p>
          </div>
        </div>

        <div className="flex items-center gap-3.5 p-4 sm:p-5 rounded-2xl bg-[#FAF7F2] border border-[#F0EAE1] shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-[#8B1D1D]/10 flex items-center justify-center text-[#8B1D1D] shrink-0">
            <Clock className="w-5 h-5 stroke-[1.8]" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-[#2B1B17] uppercase tracking-wide">FAST DELIVERY</h4>
            <p className="text-xs text-stone-500 mt-0.5">Delivered in 3–7 days pan-India</p>
          </div>
        </div>

        <div className="flex items-center gap-3.5 p-4 sm:p-5 rounded-2xl bg-[#FAF7F2] border border-[#F0EAE1] shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-[#8B1D1D]/10 flex items-center justify-center text-[#8B1D1D] shrink-0">
            <ShieldCheck className="w-5 h-5 stroke-[1.8]" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-[#2B1B17] uppercase tracking-wide">100% GENUINE QUALITY</h4>
            <p className="text-xs text-stone-500 mt-0.5">Premium fabrics & fine tailoring</p>
          </div>
        </div>

        <div className="flex items-center gap-3.5 p-4 sm:p-5 rounded-2xl bg-[#FAF7F2] border border-[#F0EAE1] shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-[#8B1D1D]/10 flex items-center justify-center text-[#8B1D1D] shrink-0">
            <RotateCcw className="w-5 h-5 stroke-[1.8]" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-[#2B1B17] uppercase tracking-wide">EASY 3-DAY RETURNS</h4>
            <p className="text-xs text-stone-500 mt-0.5">Request within 3 days of delivery, with an unboxing video</p>
          </div>
        </div>
      </div>

      {/* Complete The Look - You May Also Like (Fully outside sticky container) */}
      {variants.length > 1 && (
        <div className="w-full pt-10 border-t border-[#F0EAE1]">
          <ProductVariantSelector
            variants={variants}
            selectedVariantId={selectedVariantId}
            onSelect={handleSelectVariant}
            productId={product.id}
            productName={product.name}
            categoryName={product.category?.name}
          />
        </div>
      )}

      {/* Connoisseur Feedback & Customer Reviews for Selected Variant */}
      <ProductReviewsSection
        variantId={selectedVariant?.id}
        variantName={selectedVariant?.variantName}
        productName={product.name}
        productIdOrSlug={product.id}
        selectedUnitPriceId={selectedUnitPrice?.id}
        packSizes={unitPrices}
      />
    </div>
  );
}

export { ProductDetails };
