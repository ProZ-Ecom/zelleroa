"use client";

import Link from "next/link";
import { ProductImage } from "@/components/common/ProductImage";
import { ItemQuickAdd } from "./ItemQuickAdd";
import { formatPrice } from "@/lib/utils";
import type { CustomerProductListItemDto } from "../../types/catalog.types";

export interface CustomerStyleCardProps {
  style: CustomerProductListItemDto;
}

/**
 * The storefront listing's Style card - shows the Style only (image, name,
 * short description, starting price, available color count) and offers "Add to Cart", which opens
 * the Item/Color/Size picker when there is more than one option.
 */
export function CustomerStyleCard({ style }: CustomerStyleCardProps) {
  const colorCount = style.colorCount ?? 0;
  const isOutOfStock =
    style.outOfStock ?? (style.inStock !== undefined ? !style.inStock : false);

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-theme-border bg-theme-surface shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <Link href={`/products/${style.id}`} className="flex flex-1 flex-col">
        <div className="relative aspect-[5/4] w-full overflow-hidden bg-theme-surface-alt">
          <ProductImage
            src={style.image}
            alt={style.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className={`object-cover ${isOutOfStock ? "opacity-60 grayscale-[35%]" : ""}`}
          />
          {isOutOfStock && (
            <span className="absolute inset-x-0 bottom-0 bg-theme-text-primary/75 py-1 text-center text-[10px] font-bold uppercase tracking-wider text-white pointer-events-none">
              Out of stock
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1 p-2.5 sm:p-3">
          <h3 className="text-[13px] font-semibold text-theme-text-primary line-clamp-1 sm:text-sm">{style.name}</h3>
          {style.description && (
            <p className="text-[11px] text-theme-text-subtle line-clamp-1 sm:text-xs">{style.description}</p>
          )}

          <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 min-w-0">
            <span className="text-xs sm:text-sm font-extrabold text-theme-text-primary tracking-tight break-words">
              {style.maxPrice && style.maxPrice > style.minPrice
                ? `${formatPrice(style.minPrice)} – ${formatPrice(style.maxPrice)}`
                : `From ${formatPrice(style.minPrice)}`}
            </span>
            {colorCount > 0 && (
              <span className="text-[10px] font-semibold text-theme-text-subtle sm:text-[11px] shrink-0">
                {colorCount} color{colorCount === 1 ? "" : "s"}
              </span>
            )}
          </div>

        </div>
      </Link>
      <div className="px-2.5 pb-2.5 sm:px-3 sm:pb-3">
        <ItemQuickAdd
          styleId={style.id}
          name={style.name}
          inStock={!isOutOfStock}
          outOfStock={isOutOfStock}
        />
      </div>
    </div>
  );
}

export default CustomerStyleCard;
