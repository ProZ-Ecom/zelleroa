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

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-theme-border bg-theme-surface shadow-2xs transition-shadow hover:shadow-md">
    <Link href={`/products/${style.id}`} className="flex flex-1 flex-col">
      <div className="relative aspect-square w-full overflow-hidden bg-theme-surface-alt">
        <ProductImage
          src={style.image}
          alt={style.name}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <h3 className="text-sm font-bold text-theme-text-primary line-clamp-1">{style.name}</h3>
        {style.description && (
          <p className="text-xs text-theme-text-subtle line-clamp-2">{style.description}</p>
        )}

        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-theme-text-primary">
            From {formatPrice(style.minPrice)}
          </span>
          {colorCount > 0 && (
            <span className="text-[11px] font-semibold text-theme-text-subtle">
              {colorCount} color{colorCount === 1 ? "" : "s"}
            </span>
          )}
        </div>

      </div>
    </Link>
    <div className="px-3.5 pb-3.5">
      <ItemQuickAdd styleId={style.id} name={style.name} />
    </div>
    </div>
  );
}

export default CustomerStyleCard;
