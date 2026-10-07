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
    <div className="group flex flex-col overflow-hidden rounded-xl border border-theme-border bg-theme-surface shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
    <Link href={`/products/${style.id}`} className="flex flex-1 flex-col">
      <div className="relative aspect-[5/4] w-full overflow-hidden bg-theme-surface-alt">
        <ProductImage
          src={style.image}
          alt={style.name}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      <div className="flex flex-1 flex-col gap-1 p-2.5 sm:p-3">
        <h3 className="text-[13px] font-semibold text-theme-text-primary line-clamp-1 sm:text-sm">{style.name}</h3>
        {style.description && (
          <p className="text-[11px] text-theme-text-subtle line-clamp-1 sm:text-xs">{style.description}</p>
        )}

        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="text-[13px] font-extrabold text-theme-text-primary sm:text-sm">
            From {formatPrice(style.minPrice)}
          </span>
          {colorCount > 0 && (
            <span className="text-[10px] font-semibold text-theme-text-subtle sm:text-[11px]">
              {colorCount} color{colorCount === 1 ? "" : "s"}
            </span>
          )}
        </div>

      </div>
    </Link>
    <div className="px-2.5 pb-2.5 sm:px-3 sm:pb-3">
      <ItemQuickAdd styleId={style.id} name={style.name} />
    </div>
    </div>
  );
}

export default CustomerStyleCard;
