"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import {
  Smartphone,
  Monitor,
  ShoppingBag,
  Star,
  Heart,
  Trash2,
  PackageX,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { FormModal } from "@/components/common/FormModal";
import { Button } from "@/components/ui/button";
import { ProductImage } from "@/components/common/ProductImage";
import { QuantitySelector } from "@/features/cart/components/QuantitySelector";
import { formatPrice, toTitleCase } from "@/lib/utils";
import { formatMeasurementLabel } from "@/features/variants/utils/measurement.util";
import type { AdminVariantResponse } from "@/features/variants/types";

export interface ModelCustomerPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  style: any;
  variants: AdminVariantResponse[];
}

export function ModelCustomerPreviewModal({
  isOpen,
  onClose,
  style,
  variants,
}: ModelCustomerPreviewModalProps) {
  const [activeView, setActiveView] = useState<"catalog" | "cart">("catalog");
  const [deviceMode, setDeviceMode] = useState<"desktop" | "mobile">("desktop");
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [selectedUnitPriceId, setSelectedUnitPriceId] = useState<string>("");
  const [simulatedQuantity, setSimulatedQuantity] = useState(1);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Active variant resolution
  const activeVariant: AdminVariantResponse | null = useMemo(() => {
    if (!variants || variants.length === 0) return null;
    const found = variants.find((v) => v.id === selectedVariantId);
    return found || variants[0];
  }, [variants, selectedVariantId]);

  // Unit prices for active variant
  const unitPrices = useMemo(() => {
    return activeVariant?.unitPrices ?? [];
  }, [activeVariant]);

  const activeUnitPrice = useMemo(() => {
    if (unitPrices.length === 0) return null;
    return unitPrices.find((up) => up.id === selectedUnitPriceId) || unitPrices[0];
  }, [unitPrices, selectedUnitPriceId]);

  // Compile image list for active variant
  const imageList: string[] = useMemo(() => {
    const urls: string[] = [];
    if (activeVariant?.primaryImage) urls.push(activeVariant.primaryImage);
    if ((activeVariant as any)?.images) {
      const imgs = (activeVariant as any).images;
      if (Array.isArray(imgs)) {
        imgs.forEach((img: any) => {
          const u = typeof img === "string" ? img : img?.imageUrl;
          if (u && !urls.includes(u)) urls.push(u);
        });
      }
    }
    // Also check other variants if active has no image
    if (urls.length === 0) {
      for (const v of variants) {
        if (v.primaryImage && !urls.includes(v.primaryImage)) urls.push(v.primaryImage);
      }
    }
    return urls;
  }, [activeVariant, variants]);

  if (!style) return null;

  const currentImage = imageList[activeImageIndex] || imageList[0] || null;

  const displayName = toTitleCase(style.name || style.productName || "Product");
  const subtitle = style.brandName || style.productName || "Zellora Men";
  const activeColor = activeVariant?.colorName || activeVariant?.variantName || "";
  const activeColorHex = activeVariant?.colorHex || "#333333";

  const basePrice = Number(activeUnitPrice?.basePrice ?? activeVariant?.basePrice ?? style.basePrice ?? 0);
  const salePrice = Number((activeUnitPrice as any)?.salePrice ?? activeVariant?.salePrice ?? basePrice);
  const discountPercent =
    basePrice > salePrice && basePrice > 0
      ? Math.round(((basePrice - salePrice) / basePrice) * 100)
      : 0;

  const isOutOfStock = Boolean(
    style.outOfStock || activeVariant?.outOfStock || (activeUnitPrice && activeUnitPrice.stock === 0)
  );

  const activeSizeLabel =
    activeUnitPrice?.sizeValue ||
    (activeUnitPrice?.measurement ? formatMeasurementLabel(activeUnitPrice.measurement) : "") ||
    "30";

  const activeSku = activeUnitPrice?.sku || activeVariant?.sku || style.sku || "";

  // Check if style has multiple prices
  const allPrices = variants.flatMap((v) => v.unitPrices ?? []).map((p) => Number(p.basePrice));
  const hasPriceRange =
    allPrices.length > 1 && Math.min(...allPrices) !== Math.max(...allPrices);

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (imageList.length > 0) {
      setActiveImageIndex((prev) => (prev - 1 + imageList.length) % imageList.length);
    }
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (imageList.length > 0) {
      setActiveImageIndex((prev) => (prev + 1) % imageList.length);
    }
  };

  return (
    <FormModal
      open={isOpen}
      onClose={onClose}
      title="Storefront Customer View Preview"
      description={`Preview how "${style.name}" appears to customers on the storefront catalog and in the cart`}
      size="xl"
    >
      <div className="space-y-6">
        {/* Controls Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl bg-cream-100 p-3 border border-cream-border">
          {/* View Mode Selector */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-cream-border shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveView("catalog")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeView === "catalog"
                  ? "bg-secondary-600 text-white shadow-xs"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>Catalog Card View</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView("cart")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeView === "cart"
                  ? "bg-secondary-600 text-white shadow-xs"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>Cart Item View</span>
            </button>
          </div>

          {/* Device Simulator Toggle */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-cream-border shadow-2xs">
            <button
              type="button"
              onClick={() => setDeviceMode("desktop")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                deviceMode === "desktop"
                  ? "bg-cream-200 text-neutral-900 font-bold"
                  : "text-neutral-500 hover:text-neutral-800"
              }`}
              title="Desktop Viewport"
            >
              <Monitor className="h-3.5 w-3.5" />
              <span>Desktop</span>
            </button>
            <button
              type="button"
              onClick={() => setDeviceMode("mobile")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                deviceMode === "mobile"
                  ? "bg-cream-200 text-neutral-900 font-bold"
                  : "text-neutral-500 hover:text-neutral-800"
              }`}
              title="Mobile Viewport"
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>Mobile</span>
            </button>
          </div>
        </div>

        {/* Variations Selector: Quick-switch color and size inside modal */}
        {variants.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-neutral-700">Preview Color:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {variants.map((v) => {
                  const isCur = (activeVariant?.id || variants[0]?.id) === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setSelectedVariantId(v.id);
                        setActiveImageIndex(0);
                        if (v.unitPrices && v.unitPrices.length > 0) {
                          setSelectedUnitPriceId(v.unitPrices[0].id);
                        }
                      }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                        isCur
                          ? "bg-secondary-600 text-white border-secondary-600 shadow-2xs"
                          : "bg-white text-neutral-700 border-neutral-200 hover:border-neutral-300"
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-black/10 shrink-0"
                        style={{ backgroundColor: v.colorHex || "#ccc" }}
                      />
                      <span>{v.colorName || v.variantName || "Color"}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Size selector if viewing cart */}
            {activeView === "cart" && unitPrices.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-neutral-700">Size:</span>
                <div className="flex items-center gap-1 flex-wrap">
                  {unitPrices.map((up) => {
                    const label =
                      up.sizeValue ||
                      (up.measurement ? formatMeasurementLabel(up.measurement) : "") ||
                      "Size";
                    const isCur = (activeUnitPrice?.id || unitPrices[0]?.id) === up.id;
                    return (
                      <button
                        key={up.id}
                        type="button"
                        onClick={() => setSelectedUnitPriceId(up.id)}
                        className={`px-2 py-0.5 rounded text-xs font-semibold transition-all cursor-pointer border ${
                          isCur
                            ? "bg-neutral-900 text-white border-neutral-900"
                            : "bg-white text-neutral-700 border-neutral-200 hover:border-neutral-300"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Live Simulation Container */}
        <div className="w-full flex flex-col items-center gap-4 rounded-2xl bg-neutral-100/70 p-4 sm:p-8 border border-neutral-200 min-h-[440px] justify-center">
          {/* 1. CATALOG CARD VIEW (Exact replica of Storefront StyleCard) */}
          {activeView === "catalog" && (
            <div
              className={`transition-all duration-300 w-full ${
                deviceMode === "mobile" ? "max-w-[190px]" : "max-w-[280px]"
              }`}
            >
              <div className="group relative flex flex-col overflow-hidden rounded-xl border border-theme-border bg-theme-surface shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                {/* Wishlist Button */}
                <button
                  type="button"
                  onClick={() => setIsWishlisted(!isWishlisted)}
                  className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-theme-surface/85 backdrop-blur-xs text-theme-text-muted hover:text-theme-status-can-fg shadow-2xs transition-colors cursor-pointer"
                  title="Wishlist"
                >
                  <Heart
                    className={`h-4 w-4 ${isWishlisted ? "fill-red-500 text-red-500" : ""}`}
                  />
                </button>

                {/* Product Image */}
                <div className="relative aspect-[5/4] w-full overflow-hidden bg-theme-surface-alt">
                  <ProductImage
                    src={currentImage}
                    alt={activeColor ? `${displayName} in ${activeColor}` : displayName}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className={`object-cover ${isOutOfStock ? "opacity-60 grayscale-[35%]" : ""}`}
                  />

                  {/* Badges */}
                  <div className="absolute left-2 top-2 z-10 flex flex-col items-start gap-1 pointer-events-none">
                    {discountPercent > 0 && (
                      <span className="rounded bg-theme-secondary px-1.5 py-0.5 text-[10px] font-extrabold text-theme-secondary-fg">
                        {discountPercent}% OFF
                      </span>
                    )}
                    {style.isNewArrival && (
                      <span className="rounded bg-theme-primary px-1.5 py-0.5 text-[10px] font-bold text-theme-primary-fg">
                        New
                      </span>
                    )}
                  </div>

                  {isOutOfStock && (
                    <span className="absolute inset-x-0 bottom-0 bg-theme-text-primary/75 py-1 text-center text-[10px] font-bold uppercase tracking-wider text-white pointer-events-none">
                      Out of stock
                    </span>
                  )}
                </div>

                {/* Card Info */}
                <div className="flex flex-1 flex-col gap-1 p-2.5 sm:p-3">
                  {subtitle && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-theme-text-muted line-clamp-1">
                      {subtitle}
                    </span>
                  )}
                  <h3 className="text-[13px] font-semibold text-theme-text-primary line-clamp-2 leading-snug sm:text-sm capitalize">
                    {displayName}
                  </h3>

                  {/* Rating */}
                  <div className="flex items-center gap-1 text-xs text-theme-text-subtle">
                    <span className="inline-flex items-center gap-0.5 rounded bg-theme-status-del-fg px-1 py-px text-[10px] font-bold text-white">
                      4.8
                      <Star className="h-2.5 w-2.5 fill-current" aria-hidden />
                    </span>
                    <span>(24)</span>
                  </div>

                  {/* Price */}
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-[15px] font-extrabold text-theme-text-primary">
                      {hasPriceRange && (
                        <span className="text-xs font-semibold text-theme-text-muted">From </span>
                      )}
                      {formatPrice(basePrice)}
                    </span>
                    {salePrice < basePrice && (
                      <span className="text-xs text-theme-text-muted line-through">
                        {formatPrice(salePrice)}
                      </span>
                    )}
                  </div>

                  {/* Color swatches */}
                  {variants.length > 0 && (
                    <div className="flex items-center gap-1.5 pt-1">
                      <div className="flex items-center gap-1">
                        {variants.slice(0, 5).map((v) => {
                          const isSelected = (activeVariant?.id || variants[0]?.id) === v.id;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => {
                                setSelectedVariantId(v.id);
                                setActiveImageIndex(0);
                              }}
                              title={v.colorName || v.variantName}
                              className={`h-3 w-3 rounded-full border cursor-pointer transition-transform ${
                                isSelected
                                  ? "border-theme-text-primary ring-1 ring-theme-text-primary ring-offset-1 scale-110"
                                  : "border-theme-border-input hover:scale-105"
                              }`}
                              style={{ backgroundColor: v.colorHex || "#e5e5e5" }}
                            />
                          );
                        })}
                      </div>
                      <span className="text-[11px] text-theme-text-muted line-clamp-1">
                        {activeColor || variants[0]?.colorName || "Color"}
                        {variants.length > 5 && ` +${variants.length - 5}`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Bottom Action Button */}
                <div className="px-2.5 pb-2.5 sm:px-3 sm:pb-3">
                  {isOutOfStock ? (
                    <button
                      type="button"
                      disabled
                      className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-theme-border bg-theme-surface-alt text-xs font-semibold text-theme-text-muted cursor-not-allowed"
                    >
                      <PackageX className="h-3.5 w-3.5" />
                      Out of Stock
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-theme-primary hover:bg-theme-primary-hover text-xs font-bold text-theme-primary-fg shadow-2xs transition-colors cursor-pointer"
                    >
                      <ShoppingBag className="h-3.5 w-3.5" />
                      Add to Cart
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 2. CART ITEM VIEW (Exact replica of Storefront CartItem, fully responsive) */}
          {activeView === "cart" && (
            <div
              className={`transition-all duration-300 w-full ${
                deviceMode === "mobile" ? "max-w-[360px]" : "max-w-2xl"
              }`}
            >
              <div className="group relative rounded-2xl border border-theme-border bg-theme-surface p-4 sm:p-5 shadow-xs transition-all duration-200 hover:shadow-md hover:border-theme-border-accent w-full">
                {/* Top Section: Image + Details + (Desktop Controls) */}
                <div className="flex items-start sm:items-center gap-3.5 sm:gap-5 w-full">
                  {/* Product Image */}
                  <div className="relative shrink-0">
                    <div className="overflow-hidden rounded-xl border border-theme-border-subtle bg-theme-surface-alt h-20 w-20 sm:h-24 sm:w-24">
                      <ProductImage
                        src={currentImage}
                        alt={displayName}
                        fallbackText={displayName}
                        containerClassName="w-full h-full rounded-xl"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {discountPercent > 0 && (
                      <span className="absolute -top-1.5 -left-1.5 rounded-full bg-theme-primary px-1.5 py-0.5 text-[10px] sm:text-xs font-bold text-theme-primary-fg shadow-xs">
                        -{discountPercent}%
                      </span>
                    )}
                  </div>

                  {/* Product Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-sm sm:text-base text-theme-text-primary line-clamp-2 leading-snug">
                        {displayName}
                      </span>
                    </div>

                    {subtitle && (
                      <p className="text-xs font-medium text-theme-text-subtle line-clamp-1 mb-1">
                        {subtitle}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-theme-text-subtle mt-1">
                      {activeColor && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-theme-surface-alt border border-theme-border text-theme-primary font-medium text-[11px] sm:text-xs">
                          <span
                            className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full border border-theme-border shrink-0"
                            style={{ backgroundColor: activeColorHex || "#e5e5e5" }}
                          />
                          <span className="truncate max-w-[120px]">{activeColor}</span>
                        </span>
                      )}
                      {activeSizeLabel && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-theme-status-out-bg text-theme-status-out-fg font-medium text-[11px] sm:text-xs whitespace-nowrap">
                          Size: {activeSizeLabel}
                        </span>
                      )}
                    </div>

                    {/* Unit Price indicator */}
                    <div className="mt-1.5 flex items-baseline gap-1.5">
                      <span className="text-[11px] sm:text-xs font-medium text-theme-text-muted">
                        Unit Price:
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-theme-primary">
                        {formatPrice(basePrice)}
                      </span>
                      {salePrice < basePrice && (
                        <span className="text-[11px] text-theme-text-muted line-through">
                          {formatPrice(salePrice)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Desktop Controls (Hidden in mobile deviceMode OR on mobile screen) */}
                  <div
                    className={`${
                      deviceMode === "mobile" ? "hidden" : "hidden sm:flex"
                    } flex-col items-end gap-3 shrink-0`}
                  >
                    <div className="text-right">
                      <div className="text-base sm:text-lg font-bold text-theme-text-primary">
                        {formatPrice(basePrice * simulatedQuantity)}
                      </div>
                      <div className="text-[11px] text-theme-text-muted">
                        {simulatedQuantity} × {formatPrice(basePrice)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <QuantitySelector
                        value={simulatedQuantity}
                        onChange={(newQty) => setSimulatedQuantity(Math.max(1, newQty))}
                        min={1}
                        max={99}
                        size="sm"
                      />

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-theme-text-muted hover:text-theme-status-can-fg hover:bg-theme-status-can-bg transition-colors cursor-pointer"
                        title="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Mobile Controls Row (Visible in mobile deviceMode OR on mobile screen) */}
                <div
                  className={`${
                    deviceMode === "mobile" ? "flex" : "flex sm:hidden"
                  } items-center justify-between pt-3 mt-3 border-t border-theme-border-subtle w-full`}
                >
                  <div className="flex items-center gap-2">
                    <QuantitySelector
                      value={simulatedQuantity}
                      onChange={(newQty) => setSimulatedQuantity(Math.max(1, newQty))}
                      min={1}
                      max={99}
                      size="sm"
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg text-theme-text-muted hover:text-theme-status-can-fg hover:bg-theme-status-can-bg transition-colors cursor-pointer"
                      title="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="text-right">
                    <div className="text-base font-bold text-theme-text-primary">
                      {formatPrice(basePrice * simulatedQuantity)}
                    </div>
                    <div className="text-[11px] text-theme-text-muted">
                      {simulatedQuantity} × {formatPrice(basePrice)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Image carousel switcher */}
          {imageList.length > 1 && (
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={handlePrevImage}
                className="w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer transition-colors"
                title="Previous Image"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                {imageList.map((thumbUrl, tIdx) => (
                  <button
                    key={tIdx}
                    type="button"
                    onClick={() => setActiveImageIndex(tIdx)}
                    className={`relative w-10 h-10 rounded-lg overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                      tIdx === activeImageIndex
                        ? "border-secondary-600 scale-105 shadow-xs"
                        : "border-neutral-200 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <Image src={thumbUrl} alt="Thumbnail" fill className="object-cover" />
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleNextImage}
                className="w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer transition-colors"
                title="Next Image"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Technical Variant Metadata Summary Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-cream-50 border border-cream-border text-xs">
          <div>
            <span className="text-neutral-700 font-semibold block mb-0.5">Active Color</span>
            <span className="font-semibold text-neutral-900 flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full border border-black/10 inline-block"
                style={{ backgroundColor: activeColorHex }}
              />
              {activeColor || "None"}
            </span>
          </div>
          <div>
            <span className="text-neutral-700 font-semibold block mb-0.5">Available Sizes</span>
            <span className="font-bold text-neutral-900">
              {unitPrices.length > 0
                ? unitPrices
                    .map(
                      (u) =>
                        u.sizeValue ||
                        (u.measurement ? formatMeasurementLabel(u.measurement) : "")
                    )
                    .filter(Boolean)
                    .join(", ")
                : "None"}
            </span>
          </div>
          <div>
            <span className="text-neutral-700 font-semibold block mb-0.5">Base Price</span>
            <span className="font-bold text-neutral-900 font-mono">{formatPrice(basePrice)}</span>
          </div>
          <div>
            <span className="text-neutral-700 font-semibold block mb-0.5">Stock Status</span>
            <span
              className={`font-bold ${
                isOutOfStock ? "text-rose-600" : "text-emerald-700"
              }`}
            >
              {isOutOfStock ? "Out of Stock" : "In Stock (Available)"}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200">
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-xl px-5 text-xs font-semibold cursor-pointer"
          >
            Close Preview
          </Button>
        </div>
      </div>
    </FormModal>
  );
}

export default ModelCustomerPreviewModal;
