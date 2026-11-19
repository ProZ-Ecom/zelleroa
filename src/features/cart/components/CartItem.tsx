"use client";

import React from "react";
import { Trash2, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProductImage } from "@/components/common/ProductImage";
import { QuantitySelector } from "./QuantitySelector";
import { formatPrice } from "@/lib/utils";

interface CartItemProps {
  item: any;
  onUpdateQuantity: (itemId: any, quantity: number) => void;
  onRemove: (itemId: any) => void;
  isUpdating?: boolean;
  isRemoving?: boolean;
}

function CartItem({
  item,
  onUpdateQuantity,
  onRemove,
  isUpdating = false,
  isRemoving = false,
}: CartItemProps) {
  const quantity = Math.max(1, Number(item.quantity || 1));

  // Ultra-robust price resolution across all API response shapes
  const effectivePrice = Number(
    item.price ??
      item.currentPrice ??
      item.priceAtAdd ??
      item.salePrice ??
      item.basePrice ??
      item.variant?.sale_price ??
      item.variant?.base_price ??
      item.variant?.price ??
      item.product?.sale_price ??
      item.product?.base_price ??
      item.product?.price ??
      (item.itemTotal && quantity > 0 ? Number(item.itemTotal) / quantity : 0)
  );

  const basePrice = Number(
    item.basePrice ??
      item.variant?.base_price ??
      item.variant?.price ??
      item.product?.base_price ??
      item.product?.price ??
      effectivePrice
  );

  const itemTotal = Number(item.itemTotal ?? effectivePrice * quantity);

  const discountPercent = Number(
    item.discountPercent ??
      item.product?.discountPercent ??
      (basePrice > effectivePrice && basePrice > 0
        ? Math.round(((basePrice - effectivePrice) / basePrice) * 100)
        : 0)
  );

  // A line is bought under a Style, so that is what it is named and linked by;
  // the Item name sits beneath it when the Style has more than one Item.
  const productName =
    typeof item.styleName === "string"
      ? item.styleName
      : typeof item.productName === "string"
      ? item.productName
      : typeof item.product?.name === "string"
      ? item.product.name
      : "Fashion Item";

  const styleName = typeof item.styleName === "string" ? item.styleName : "";

  // The exact combination this line sells - stored per cart row, so Red/M and
  // Red/L show as separate lines with their own colour, size and price.
  const colorName = typeof item.colorName === "string" ? item.colorName : "";
  const colorHex = typeof item.colorHex === "string" ? item.colorHex : "";
  const sizeLabel = typeof item.sizeLabel === "string" ? item.sizeLabel : "";

  const variantName =
    typeof item.variantName === "string"
      ? item.variantName
      : typeof item.variant?.name === "string"
      ? item.variant.name
      : "";

  const rawMeasurement = item.measurement || item.variant?.measurement;
  const measurement =
    typeof rawMeasurement === "string"
      ? rawMeasurement
      : rawMeasurement && typeof rawMeasurement === "object" && rawMeasurement.value
      ? `${rawMeasurement.value} ${rawMeasurement.unit || ""}`.trim()
      : "";

  // The Style detail page is keyed by the Style UUID, which is what the
  // storefront listing links to as well.
  const productSlug =
    typeof item.styleId === "string"
      ? item.styleId
      : typeof item.product?.slug === "string"
      ? item.product.slug
      : typeof item.slug === "string"
      ? item.slug
      : "";

  const sku =
    typeof item.sku === "string"
      ? item.sku
      : typeof item.product?.sku === "string"
      ? item.product.sku
      : typeof item.variant?.sku === "string"
      ? item.variant.sku
      : "";


  const primaryImageUrl =
    typeof item.primaryImage === "string"
      ? item.primaryImage
      : item.primaryImage?.url ||
        item.product?.images?.[0]?.url ||
        (typeof item.product?.images?.[0] === "string"
          ? item.product.images[0]
          : null);

  const stockQuantity = Number(
    item.variant?.stockQuantity ??
      item.variant?.stock_quantity ??
      item.product?.stockQuantity ??
      99
  );

  const itemId = item.variantId || item.variantUuid || item.id;

  return (
    <div
      className={`group relative rounded-2xl border border-theme-border bg-theme-surface p-4 sm:p-5 shadow-xs transition-all duration-200 hover:shadow-md hover:border-theme-border-accent ${
        isRemoving ? "opacity-50 pointer-events-none scale-98" : ""
      }`}
    >
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 items-start sm:items-center">
        {/* Product Image */}
        <div className="relative shrink-0">
          {productSlug ? (
            <Link
              href={`/products/${productSlug}`}
              className="block overflow-hidden rounded-xl border border-theme-border-subtle bg-theme-surface-alt h-20 w-20 sm:h-24 sm:w-24 transition-transform group-hover:scale-102"
            >
              <ProductImage
                src={primaryImageUrl}
                alt={productName}
                fallbackText={productName}
                containerClassName="w-full h-full rounded-xl"
                className="w-full h-full object-cover"
              />
            </Link>
          ) : (
            <div className="overflow-hidden rounded-xl border border-theme-border-subtle bg-theme-surface-alt h-20 w-20 sm:h-24 sm:w-24 flex flex-col items-center justify-center text-xs font-medium text-theme-text-subtle">
              <ProductImage
                src={primaryImageUrl}
                alt={productName}
                fallbackText={productName}
                containerClassName="w-full h-full rounded-xl"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {discountPercent > 0 && (
            <span className="absolute -top-1.5 -left-1.5 rounded-full bg-theme-primary px-1.5 py-0.5 text-xs font-bold text-theme-primary-fg shadow-xs">
              -{discountPercent}%
            </span>
          )}
        </div>

        {/* Product Details */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {productSlug ? (
              <Link
                href={`/products/${productSlug}`}
                className="font-bold text-base sm:text-lg text-theme-text-primary hover:text-theme-primary transition-colors line-clamp-1"
              >
                {productName}
              </Link>
            ) : (
              <span className="font-bold text-base sm:text-lg text-theme-text-primary line-clamp-1">
                {productName}
              </span>
            )}
          </div>

          {styleName && styleName !== productName && (
            <p className="mt-0.5 text-xs font-semibold text-theme-text-subtle line-clamp-1">
              {styleName}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 text-xs text-theme-text-subtle mt-1">
            {colorName ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-theme-surface-alt border border-theme-border text-theme-primary font-semibold">
                <span
                  className="h-2.5 w-2.5 rounded-full border border-theme-border"
                  style={{ backgroundColor: colorHex || "#e5e5e5" }}
                />
                {colorName}
              </span>
            ) : (
              variantName && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-theme-surface-alt border border-theme-border text-theme-primary font-semibold">
                  {variantName}
                </span>
              )
            )}
            {(sizeLabel || measurement) && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-theme-status-out-bg text-theme-status-out-fg font-medium">
                Size: {sizeLabel || measurement}
              </span>
            )}
            {sku && <span className="text-theme-text-muted">SKU: {sku}</span>}
          </div>

          {/* Unit Price indicator */}
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xs font-medium text-theme-text-muted">
              Unit Price:
            </span>
            <span className="text-sm font-semibold text-theme-primary">
              {formatPrice(effectivePrice)}
            </span>
            {discountPercent > 0 && basePrice > effectivePrice && (
              <span className="text-xs text-theme-text-muted line-through">
                {formatPrice(basePrice)}
              </span>
            )}
          </div>
        </div>

        {/* Quantity Controls & Line Total */}
        <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-theme-border-subtle gap-3">
          <div className="text-right sm:text-right">
            <div className="text-lg sm:text-xl font-bold text-theme-text-primary">
              {formatPrice(itemTotal)}
            </div>
            <div className="text-xs text-theme-text-muted">
              {quantity} × {formatPrice(effectivePrice)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <QuantitySelector
              value={quantity}
              onChange={(newQty) => onUpdateQuantity(itemId, newQty)}
              min={1}
              max={stockQuantity}
              disabled={isUpdating || isRemoving}
              size="sm"
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-theme-text-muted hover:text-theme-status-can-fg hover:bg-theme-status-can-bg transition-colors cursor-pointer"
              onClick={() => onRemove(itemId)}
              disabled={isUpdating || isRemoving}
              title="Remove item"
            >
              {isRemoving ? (
                <Loader2 className="h-4 w-4 animate-spin text-theme-status-can-fg" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { CartItem };

