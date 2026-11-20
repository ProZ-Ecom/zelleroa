"use client";

import Link from "next/link";
import { Trash2, ShoppingCart, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProductImage } from "@/components/common/ProductImage";
import { formatPrice } from "@/lib/utils";
import type { CustomerWishlistItemDto } from "../types/wishlist.types";

export interface WishlistCardProps {
  item: CustomerWishlistItemDto;
  onRemove: (variantUuid: string) => void;
  onMoveToCart?: (variantUuid: string) => void;
  isRemoving?: boolean;
  isMovingToCart?: boolean;
}

export function WishlistCard({
  item,
  onRemove,
  onMoveToCart,
  isRemoving = false,
  isMovingToCart = false,
}: WishlistCardProps) {
  const hasDiscount = item.basePrice > item.price;
  const discountPercent = hasDiscount
    ? Math.round(((item.basePrice - item.price) / item.basePrice) * 100)
    : 0;

  const productUrl = item.style?.id
    ? `/styles/${item.style.id}`
    : `/products/${item.product.slug || item.product.id}`;

  return (
    <Card className="group overflow-hidden rounded-2xl border border-theme-border bg-theme-surface shadow-xs hover:shadow-md transition-shadow">
      <Link href={productUrl}>
        <div className="relative aspect-square overflow-hidden bg-theme-surface-alt">
          <ProductImage
            src={item.primaryImage}
            alt={item.styleName || item.product.name}
            fallbackText={item.styleName || item.product.name}
            containerClassName="w-full h-full aspect-square"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {hasDiscount && (
            <Badge className="absolute top-2 left-2 bg-theme-status-can-fg text-white border-0 text-xs font-semibold px-2 py-0.5 rounded-full">
              -{discountPercent}%
            </Badge>
          )}
          {!item.isAvailable && (
            <Badge variant="outline" className="absolute top-2 right-2 bg-stone-900/80 text-white border-0 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full">
              Out of stock
            </Badge>
          )}
        </div>
      </Link>

      <CardContent className="p-4 flex flex-col justify-between flex-1">
        <div>
          <Link href={productUrl}>
            <h3 className="font-semibold text-theme-text-primary text-sm line-clamp-1 hover:text-theme-primary transition-colors">
              {item.product.name}
            </h3>
          </Link>

          {item.styleName && (
            <p className="text-xs font-semibold text-theme-text-secondary mt-0.5 line-clamp-1">
              {item.styleName}
            </p>
          )}

          {item.variantName && (
            <p className="text-xs text-theme-text-subtle mt-0.5 font-medium">
              {item.variantName}
            </p>
          )}

          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-base font-bold text-theme-primary">
              {formatPrice(item.price)}
            </span>
            {hasDiscount && (
              <span className="text-xs text-theme-text-muted line-through">
                {formatPrice(item.basePrice)}
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          {onMoveToCart && (
            <Button
              size="sm"
              className="flex-1 h-9 rounded-xl text-xs font-semibold bg-theme-primary text-theme-primary-fg hover:bg-theme-primary-hover disabled:opacity-50 shadow-xs"
              onClick={() => onMoveToCart(item.variantUnitPriceId || item.variantId)}
              disabled={isRemoving || isMovingToCart || !item.isAvailable}
            >
              {!item.isAvailable ? (
                <>
                  <ShoppingBag className="mr-1.5 h-3.5 w-3.5" />
                  Out of stock
                </>
              ) : isMovingToCart ? (
                "Moving..."
              ) : (
                <>
                  <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
                  Move to Cart
                </>
              )}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-9 w-9 p-0 rounded-xl border-theme-border-input hover:bg-theme-surface-alt text-theme-status-can-fg hover:text-theme-primary-hover cursor-pointer shrink-0"
            onClick={() => onRemove(item.variantUnitPriceId || item.variantId)}
            disabled={isRemoving || isMovingToCart}
            aria-label="Remove from wishlist"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
