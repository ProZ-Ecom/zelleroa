"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";
import { ProductImage } from "@/components/common/ProductImage";
import {
  useCustomerWishlist,
  useRemoveCustomerWishlist,
  useMoveCustomerWishlistToCart,
} from "../../hooks/use-customer-wishlist";
import type { CustomerWishlistItemDto } from "@/features/wishlist/types/wishlist.types";

export function WishlistTab() {
  const { data: wishlist, isLoading, error, refetch } = useCustomerWishlist();
  const removeMutation = useRemoveCustomerWishlist();
  const moveMutation = useMoveCustomerWishlistToCart();
  const [movingId, setMovingId] = useState<string | null>(null);

  const items: CustomerWishlistItemDto[] = wishlist?.items ?? [];

  const handleMoveToCart = (variantUuid: string) => {
    setMovingId(variantUuid);
    moveMutation.mutate(variantUuid, {
      onSettled: () => {
        setMovingId(null);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className="bg-theme-surface border border-theme-border rounded-xl p-4 animate-pulse space-y-3 overflow-hidden"
          >
            <div className="h-32 rounded-xl skeleton-shimmer" />
            <div className="h-4 rounded w-3/4 skeleton-shimmer" />
            <div className="h-4 rounded w-1/2 skeleton-shimmer" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-theme-surface border border-theme-border rounded-2xl p-8 text-center space-y-4">
        <p className="text-sm text-theme-text-muted">Failed to load your wishlist.</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="bg-theme-primary text-theme-primary-fg px-5 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-bold uppercase tracking-wide text-theme-text-secondary">
          Wishlist {items.length > 0 && `(${items.length})`}
        </h2>
      </div>

      {items.length === 0 ? (
        <div className="bg-theme-surface border border-theme-border rounded-2xl p-12 text-center shadow-2xs">
          <div className="w-16 h-16 mx-auto mb-4 rotate-45 border-2 border-theme-border-accent rounded-xl bg-theme-surface-alt flex items-center justify-center">
            <span className="-rotate-45 text-theme-primary text-xl font-bold">♥</span>
          </div>
          <h3 className="text-base font-bold uppercase tracking-wide text-theme-text-secondary">
            Your Wishlist is Empty
          </h3>
          <p className="text-xs text-theme-text-muted max-w-xs mx-auto mt-2 mb-6">
            Save your favorite styles and outfits here to order whenever you&apos;re ready.
          </p>
          <Link href="/products">
            <button
              type="button"
              className="bg-theme-secondary hover:bg-theme-secondary-hover text-theme-secondary-fg text-xs font-semibold uppercase tracking-wider py-3 px-6 rounded-lg transition-colors cursor-pointer min-h-[44px]"
            >
              Explore Collections
            </button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-theme-surface border border-theme-border rounded-xl overflow-hidden shadow-2xs flex flex-col justify-between"
            >
              <div className="h-32 sm:h-36 overflow-hidden relative">
                <ProductImage
                  src={item.primaryImage || (item as any).image || null}
                  alt={item.styleName || item.product?.name || item.variantName || "Fashion Item"}
                  fallbackText={item.styleName || item.product?.name || item.variantName || "Fashion Item"}
                  containerClassName="w-full h-full"
                  className="w-full h-full object-cover"
                />
                {!item.isAvailable && (
                  <span className="absolute top-2 right-2 bg-stone-900/80 text-white border-0 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold">
                    Out of stock
                  </span>
                )}
              </div>

              <div className="p-3.5 sm:p-4 flex flex-col justify-between flex-1 gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase text-theme-text-primary line-clamp-1">
                    {item.product?.name || item.variantName || "Fashion Item"}
                  </div>
                  {item.styleName && (
                    <div className="text-xs font-semibold text-theme-text-secondary mt-0.5 line-clamp-1">
                      {item.styleName}
                    </div>
                  )}
                  {item.variantName && (
                    <div className="text-[11px] text-theme-text-muted mt-0.5">
                      {item.variantName}
                    </div>
                  )}
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-xs sm:text-sm font-semibold text-theme-primary">
                      {formatPrice(item.salePrice ?? item.price ?? item.basePrice ?? 0)}
                    </span>
                    {item.basePrice && (item.salePrice ? item.basePrice > item.salePrice : item.basePrice > item.price) && (
                      <span className="text-[11px] text-theme-text-muted line-through">
                        {formatPrice(item.basePrice)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleMoveToCart(item.variantUnitPriceId || item.variantId || item.id)}
                    disabled={movingId === (item.variantUnitPriceId || item.variantId || item.id) || !item.isAvailable}
                    className="w-full bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg text-xs font-semibold uppercase tracking-wider py-2.5 rounded-md transition-colors min-h-[40px] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {!item.isAvailable
                      ? "Out of stock"
                      : movingId === (item.variantUnitPriceId || item.variantId || item.id)
                      ? "Moving to Cart..."
                      : "Move to Cart"}
                  </button>

                  <button
                    type="button"
                    onClick={() => removeMutation.mutate(item.variantUnitPriceId || item.variantId || item.id)}
                    className="text-[11px] font-medium text-theme-text-muted hover:text-red-700 text-center py-1 transition-colors cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
