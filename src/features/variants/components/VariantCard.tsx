"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Package,
  PackageX,
  Pencil,
  Trash2,
  Eye,
  ImageIcon,
  Power,
  PowerOff,
  Sparkles,
  ExternalLink,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SNACKSLOGOS } from "@/constants/storefront";
import type { AdminVariantResponse } from "../types";

export interface VariantCardProps {
  variant: AdminVariantResponse;
  productUuid?: string;
  onEdit?: (variant: AdminVariantResponse) => void;
  onManageImages?: (variant: AdminVariantResponse) => void;
  onDelete?: (variant: AdminVariantResponse) => void;
  onToggleStatus?: (variant: AdminVariantResponse, nextActive: boolean) => void;
  onToggleStock?: (variant: AdminVariantResponse, nextOutOfStock: boolean) => void;
  onPreview?: (variant: AdminVariantResponse) => void;
  showAdminActions?: boolean;
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

export function VariantCard({
  variant,
  productUuid,
  onEdit,
  onManageImages,
  onDelete,
  onToggleStatus,
  onToggleStock,
  onPreview,
  showAdminActions = true,
}: VariantCardProps) {
  const [imageError, setImageError] = useState(false);

  const effectiveProductUuid = productUuid || variant.productId;

  const basePrice = variant.basePrice ?? 0;
  const salePrice = variant.salePrice ?? basePrice;

  const discountPercent =
    basePrice > salePrice && basePrice > 0
      ? Math.round(((basePrice - salePrice) / basePrice) * 100)
      : 0;

  const measurementStr =
    variant.measurement && typeof variant.measurement === "object"
      ? `${variant.measurement.value} ${variant.measurement.unit}`
      : variant.variantName || "Standard";

  const measurementType =
    variant.measurement && typeof variant.measurement === "object"
      ? variant.measurement.type
      : undefined;

  const typeBadgeStyles =
    measurementType === "weight"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : measurementType === "volume"
      ? "bg-blue-50 text-blue-800 border-blue-200"
      : "bg-emerald-50 text-emerald-800 border-emerald-200";

  const displayImage = !imageError && variant.primaryImage
    ? variant.primaryImage
    : resolveFallbackImage(variant.productName || variant.variantName);

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-[var(--color-neutral-200)] bg-white p-3 sm:p-4 shadow-xs transition-all duration-300 hover:border-[var(--color-primary-500)] hover:shadow-xl hover:-translate-y-1">
      {/* Top Media Container */}
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-cream-100 border border-cream-border">
        {displayImage ? (
          <Image
            src={displayImage}
            alt={variant.variantName || "Variant image"}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center text-[var(--color-neutral-400)]">
            <Package className="h-10 w-10 opacity-50" />
            <span className="mt-1 text-[10px] font-medium">No Image</span>
          </div>
        )}

        {/* Storefront Discount Badge */}
        {discountPercent > 0 && (
          <div className="absolute top-2 left-2 rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs tracking-wider">
            {discountPercent}% OFF
          </div>
        )}

        {/* Admin Status Pill */}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {variant.isFeatured && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-xs bg-amber-500/90 text-white backdrop-blur-md">
              Featured
            </span>
          )}
          {variant.outOfStock && (
            onToggleStock ? (
              <button
                type="button"
                onClick={() => onToggleStock(variant, false)}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-xs bg-rose-600 text-white backdrop-blur-md hover:bg-rose-700 transition-colors cursor-pointer"
                title="Click to mark In Stock"
              >
                Out of Stock
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-xs bg-rose-600 text-white backdrop-blur-md">
                Out of Stock
              </span>
            )
          )}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-xs backdrop-blur-md ${
              variant.isActive
                ? "bg-emerald-500/90 text-white"
                : "bg-neutral-800/80 text-neutral-200"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                variant.isActive ? "bg-white animate-pulse" : "bg-neutral-400"
              }`}
            />
            {variant.isActive ? "Active" : "Inactive"}
          </span>
        </div>

        {/* Hover Quick Action Toolbar Overlay for Admin */}
        {showAdminActions && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-2.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            {effectiveProductUuid && (
              <Link
                href={`/admin/dashboard/variants/${encodeURIComponent(
                  variant.id
                )}?productId=${encodeURIComponent(effectiveProductUuid)}`}
                className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-white/90 text-neutral-800 hover:bg-white shadow-xs transition-colors"
                title="View Variant Details"
              >
                <Eye className="h-4 w-4" />
              </Link>
            )}

            {onEdit && (
              <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8 rounded-lg bg-white/90 text-neutral-800 hover:bg-white shadow-xs"
                onClick={() => onEdit(variant)}
                title="Edit Variant"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}

            {onManageImages && (
              <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8 rounded-lg bg-white/90 text-neutral-800 hover:bg-white shadow-xs"
                onClick={() => onManageImages(variant)}
                title="Manage Images"
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
            )}

            {onPreview && (
              <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8 rounded-lg bg-white/90 text-neutral-800 hover:bg-white shadow-xs"
                onClick={() => onPreview(variant)}
                title="Storefront Customer Preview"
              >
                <Sparkles className="h-4 w-4 text-[var(--color-primary-500)]" />
              </Button>
            )}

            {onToggleStatus && (
              <Button
                variant="secondary"
                size="icon"
                className={`h-8 w-8 rounded-lg shadow-xs ${
                  variant.isActive
                    ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                    : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                }`}
                onClick={() => onToggleStatus(variant, !variant.isActive)}
                title={variant.isActive ? "Make Inactive" : "Make Active"}
              >
                {variant.isActive ? (
                  <PowerOff className="h-4 w-4" />
                ) : (
                  <Power className="h-4 w-4" />
                )}
              </Button>
            )}

            {onToggleStock && (
              <Button
                variant="secondary"
                size="icon"
                className={`h-8 w-8 rounded-lg shadow-xs ${
                  variant.outOfStock
                    ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                    : "bg-rose-100 text-rose-800 hover:bg-rose-200"
                }`}
                onClick={() => onToggleStock(variant, !variant.outOfStock)}
                title={variant.outOfStock ? "Mark In Stock" : "Mark Out of Stock"}
              >
                {variant.outOfStock ? (
                  <Package className="h-4 w-4" />
                ) : (
                  <PackageX className="h-4 w-4" />
                )}
              </Button>
            )}

            {onDelete && (
              <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 shadow-xs"
                onClick={() => onDelete(variant)}
                title="Delete Variant"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Card Content (Accurate Customer Storefront Presentation) */}
      <div className="mt-3 flex flex-1 flex-col justify-between">
        <div>
          {/* Product Super-title & SKU */}
          <div className="flex items-center justify-between gap-1.5 text-[11px] text-[var(--color-neutral-500)] mb-1">
            <span className="truncate font-medium text-[var(--color-neutral-600)]" title={variant.productName}>
              {variant.productName || "Product"}
            </span>
            <span className="font-mono text-[10px] bg-cream-200 px-1.5 py-0.5 rounded border border-cream-border shrink-0">
              {variant.sku}
            </span>
          </div>

          {/* Variant Name */}
          {effectiveProductUuid ? (
            <Link
              href={`/admin/dashboard/variants/${encodeURIComponent(
                variant.id
              )}?productId=${encodeURIComponent(effectiveProductUuid)}`}
              className="block group/link cursor-pointer"
              title="View Variant Details"
            >
              <h3
                className="text-xs sm:text-sm font-bold text-[var(--brown-900)] leading-snug line-clamp-2 uppercase group-hover/link:text-[var(--color-primary-600)] transition-colors"
                title={variant.variantName}
              >
                {variant.variantName}
              </h3>
            </Link>
          ) : (
            <h3
              className="text-xs sm:text-sm font-bold text-[var(--brown-900)] leading-snug line-clamp-2 uppercase group-hover:text-[var(--color-primary-600)] transition-colors"
              title={variant.variantName}
            >
              {variant.variantName}
            </h3>
          )}

          {/* Measurement Pill & Type */}
          <div className="mt-2 flex items-center justify-between gap-1.5 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-[var(--color-secondary-50)] text-[var(--color-secondary-800)] border border-[var(--color-secondary-200)]">
              {measurementStr}
            </span>

            {measurementType && (
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase border ${typeBadgeStyles}`}>
                {measurementType}
              </span>
            )}
          </div>
        </div>

        {/* Pricing Area */}
        <div className="mt-3 pt-2.5 border-t border-[var(--color-neutral-100)] flex items-end justify-between gap-2">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-neutral-400)]">
              Store Price
            </div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-base sm:text-lg font-bold text-[var(--brown-900)]">
                ₹{salePrice.toLocaleString("en-IN")}.00
              </span>
              {basePrice > salePrice && (
                <span className="text-xs text-[var(--color-neutral-400)] line-through">
                  ₹{basePrice.toLocaleString("en-IN")}.00
                </span>
              )}
            </div>
          </div>

          {/* Customer View Simulated Add Button / Action */}
          <button
            type="button"
            onClick={() => onPreview ? onPreview(variant) : undefined}
            className="rounded-lg bg-[var(--color-primary-500)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-2xs transition-transform duration-200 hover:bg-[var(--color-primary-600)] active:scale-95 flex items-center gap-1 cursor-pointer"
            title="Preview Customer View"
          >
            <Sparkles className="h-3 w-3" />
            <span>Preview</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default VariantCard;
