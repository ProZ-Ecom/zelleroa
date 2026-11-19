"use client";

import React, { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import {
  Smartphone,
  Monitor,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { FormModal } from "@/components/common/FormModal";
import { Button } from "@/components/ui/button";
import { SNACKSLOGOS } from "@/constants/storefront";
import type { StorefrontProduct } from "@/constants/storefront";
import { ProductCard } from "@/components/storefront/cards/ProductCard";
import { useVariantImages } from "../hooks";
import type { AdminVariantResponse } from "../types";

export interface VariantCustomerPreviewModalProps {
  variant: AdminVariantResponse | null;
  isOpen: boolean;
  onClose: () => void;
}

function resolveFallbackImage(name: string): string {
  const lower = (name || "").toLowerCase();
  if (lower.includes("murukku") && lower.includes("kai")) return SNACKSLOGOS.kai_murukku;
  if (lower.includes("murukku") && lower.includes("thenkuzhal")) return SNACKSLOGOS.thenkuzhal_murukku;
  if (lower.includes("murukku") || lower.includes("butter")) return SNACKSLOGOS.special_butter_murukku;
  if (lower.includes("chip")) return SNACKSLOGOS.special_spicy_chips;
  if (lower.includes("mixture") || lower.includes("namkeen")) return SNACKSLOGOS.mixture;
  if (lower.includes("laddu")) return SNACKSLOGOS.laddu;
  if (lower.includes("jalebi")) return SNACKSLOGOS.jalebi;
  if (lower.includes("palkova")) return SNACKSLOGOS.palkova;
  return SNACKSLOGOS.special_butter_murukku;
}

export function VariantCustomerPreviewModal({
  variant,
  isOpen,
  onClose,
}: VariantCustomerPreviewModalProps) {
  const [activeView, setActiveView] = useState<"catalog" | "cart">("catalog");
  const [deviceMode, setDeviceMode] = useState<"desktop" | "mobile">("desktop");
  const [simulatedQuantity, setSimulatedQuantity] = useState(1);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Fetch all images of this variant from the backend
  const { data: variantImages = [] } = useVariantImages(
    variant?.productId || null,
    variant?.id || null
  );

  // Reset active image on variant change or modal open
  useEffect(() => {
    setActiveImageIndex(0);
  }, [variant?.id, isOpen]);

  // Compile full list of image URLs (primary first, then gallery images)
  const imageList: string[] = useMemo(() => {
    if (!variant) return [];
    const urls: string[] = [];

    // Add primary image if available
    if (variant.primaryImage && typeof variant.primaryImage === "string") {
      urls.push(variant.primaryImage);
    }

    // Add images from useVariantImages query
    if (variantImages && variantImages.length > 0) {
      variantImages.forEach((img: any) => {
        const url = img?.imageUrl;
        if (url && !urls.includes(url)) {
          if (img.isPrimary) {
            urls.unshift(url);
          } else {
            urls.push(url);
          }
        }
      });
    }

    // Add any nested images from variant object if present
    const nestedImages = (variant as any).images;
    if (nestedImages && Array.isArray(nestedImages)) {
      nestedImages.forEach((img: any) => {
        const url = typeof img === "string" ? img : img?.imageUrl;
        if (url && !urls.includes(url)) {
          urls.push(url);
        }
      });
    }

    // Deduplicate array while preserving order
    const deduped = Array.from(new Set(urls.filter(Boolean)));

    // Fallback if no image found
    if (deduped.length === 0) {
      deduped.push(
        resolveFallbackImage(variant.productName || variant.variantName)
      );
    }

    return deduped;
  }, [variant, variantImages]);

  if (!variant) return null;

  const currentImage =
    imageList[activeImageIndex] ||
    imageList[0] ||
    resolveFallbackImage(variant.productName || variant.variantName);

  const basePrice = variant.basePrice ?? 0;
  const salePrice = variant.salePrice ?? basePrice;

  const discountPercent =
    basePrice > salePrice && basePrice > 0
      ? Math.round(((basePrice - salePrice) / basePrice) * 100)
      : 0;

  const measurementStr =
    variant.measurement && typeof variant.measurement === "object"
      ? `${variant.measurement.value} ${variant.measurement.unit}`
      : variant.variantName || "100g";

  const previewProduct: StorefrontProduct = {
    id: String(variant.id),
    productId: String(variant.productId ?? ""),
    name: variant.productName || variant.variantName,
    image: currentImage,
    unitPrices: [
      {
        id: String(variant.id),
        label: measurementStr,
        sku: variant.sku ?? "",
        basePrice,
        sellingPrice: salePrice,
        isDefault: true,
      },
    ],
  };

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveImageIndex(
      (prev) => (prev - 1 + imageList.length) % imageList.length
    );
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveImageIndex((prev) => (prev + 1) % imageList.length);
  };

  return (
    <FormModal
      open={isOpen}
      onClose={onClose}
      title="Storefront Customer View Preview"
      description={`Preview how users see and interact with "${variant.variantName}" on the storefront with full image slider`}
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
                  ? "bg-[var(--color-primary-500)] text-white shadow-xs"
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
                  ? "bg-[var(--color-primary-500)] text-white shadow-xs"
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

        {/* Live Simulation Container - renders the real storefront ProductCard */}
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-neutral-50/80 p-4 sm:p-8 border border-neutral-200 min-h-[420px] justify-center">
          <div
            className={`transition-all duration-300 w-full ${
              deviceMode === "mobile" ? "max-w-[180px]" : "max-w-[300px]"
            }`}
          >
            <ProductCard
              key={`${activeView}-${currentImage}`}
              product={previewProduct}
              type={activeView === "cart" ? "cart" : "product"}
              quantity={simulatedQuantity}
              isWishlisted={isWishlisted}
              onWishlistClick={
                activeView === "catalog"
                  ? () => setIsWishlisted((w) => !w)
                  : undefined
              }
              onRemove={activeView === "cart" ? () => {} : undefined}
              actions={
                activeView === "cart"
                  ? {
                      decreaseQuantity: () =>
                        setSimulatedQuantity((q) => Math.max(1, q - 1)),
                      increaseQuantity: () => setSimulatedQuantity((q) => q + 1),
                    }
                  : undefined
              }
            />
          </div>

          {/* Image switcher (admin-only helper to preview each photo on the card) */}
          {imageList.length > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevImage}
                className="w-7 h-7 rounded-full bg-black/50 hover:bg-black/75 text-white flex items-center justify-center cursor-pointer"
                title="Previous Image"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {imageList.map((thumbUrl, tIdx) => (
                  <button
                    key={tIdx}
                    type="button"
                    onClick={() => setActiveImageIndex(tIdx)}
                    className={`relative w-10 h-10 rounded-lg overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                      tIdx === activeImageIndex
                        ? "border-[var(--brown-700)] scale-105"
                        : "border-cream-border opacity-60 hover:opacity-100"
                    }`}
                  >
                    <Image src={thumbUrl} alt="Thumbnail" fill className="object-cover" />
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleNextImage}
                className="w-7 h-7 rounded-full bg-black/50 hover:bg-black/75 text-white flex items-center justify-center cursor-pointer"
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
            <span className="text-neutral-700 font-semibold block mb-0.5">
              SKU Code
            </span>
            <span className="font-mono font-bold text-neutral-900">
              {variant.sku}
            </span>
          </div>
          <div>
            <span className="text-neutral-700 font-semibold block mb-0.5">
              Active Status
            </span>
            <span
              className={`font-bold ${
                variant.isActive ? "text-emerald-700" : "text-neutral-600"
              }`}
            >
              {variant.isActive ? "Active (In Catalog)" : "Inactive (Hidden)"}
            </span>
          </div>
          <div>
            <span className="text-neutral-700 font-semibold block mb-0.5">
              Base Price / MRP
            </span>
            <span className="font-semibold text-neutral-900">
              ₹{variant.basePrice}.00
            </span>
          </div>
          <div>
            <span className="text-neutral-700 font-semibold block mb-0.5">
              Total Images
            </span>
            <span className="font-bold text-secondary-700">
              {imageList.length} photo{imageList.length > 1 ? "s" : ""} (Slider)
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200">
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-xl px-5 text-xs font-semibold"
          >
            Close Preview
          </Button>
        </div>
      </div>
    </FormModal>
  );
}

export default VariantCustomerPreviewModal;
