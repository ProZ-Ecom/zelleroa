"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { ProductImage } from "@/components/common/ProductImage";
import { formatPrice } from "@/lib/utils";
import { ItemQuickAdd } from "./ItemQuickAdd";
import { ItemWishlistButton } from "./ItemWishlistButton";
import { itemHref } from "../../utils/style-default-item";
import type { ListingItemCardDto } from "../../types/catalog-listing.types";

const MAX_SWATCHES = 5;

/** Minimal shape needed by the compact variant (e.g. the mega menu preview). */
export interface CompactCardItem {
  id: string;
  name: string;
  image: string | null;
}

function StockBadge({ status }: { status: ListingItemCardDto["stockStatus"] }) {
  if (status === "in_stock") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-theme-status-del-fg">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        In stock
      </span>
    );
  }
  if (status === "low_stock") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-theme-status-out-fg">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        Only a few left
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-theme-status-can-fg">
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      Out of stock
    </span>
  );
}

interface ItemCardProps {
  item: ListingItemCardDto;
  variant?: "grid";
  onClick?: () => void;
}

interface CompactItemCardProps {
  item: CompactCardItem;
  variant: "compact";
  onClick?: () => void;
}

/**
 * One Item, in whichever density the surface calls for. `variant="grid"`
 * (default) is the full shopping card used by category/listing grids;
 * `variant="compact"` is the thumbnail+name row used by nav previews like
 * the mega menu. Both variants share the same image treatment, hover state,
 * and link target so the same Item looks like one design system everywhere,
 * not two unrelated ones.
 */
export function ItemCard(props: ItemCardProps | CompactItemCardProps) {
  if (props.variant === "compact") {
    const { item, onClick } = props;
    return (
      <Link
        href={itemHref(item.id)}
        onClick={onClick}
        className="group flex items-center gap-2 rounded-md p-1 -m-1 hover:bg-theme-surface-alt"
      >
        <ProductImage
          src={item.image}
          alt={item.name}
          sizes="40px"
          fallbackSize="compact"
          containerClassName="h-10 !w-10 shrink-0 rounded-md"
          className="object-cover"
        />
        <span className="truncate text-sm text-theme-text-secondary group-hover:text-theme-primary">
          {item.name}
        </span>
      </Link>
    );
  }

  const { item, onClick } = props;
  const isOut = item.stockStatus === "out_of_stock";
  const extraColours = item.colors.length - MAX_SWATCHES;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-theme-border bg-theme-surface shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
    <ItemWishlistButton itemId={item.id} className="absolute right-2 top-2 z-10" />
    <Link
      href={itemHref(item.id)}
      onClick={onClick}
      className="flex flex-1 flex-col focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-primary"
    >
      <div className="relative aspect-[5/4] w-full overflow-hidden bg-theme-surface-alt">
        <ProductImage
          src={item.image}
          alt={item.selectedColor ? `${item.name} in ${item.selectedColor.name}` : item.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className={`object-cover transition-transform duration-300 group-hover:scale-105 ${
            isOut ? "opacity-60 grayscale-[35%]" : ""
          }`}
        />

        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          {item.discountPercent > 0 && (
            <span className="rounded bg-theme-secondary px-1.5 py-0.5 text-[10px] font-extrabold text-theme-secondary-fg">
              {item.discountPercent}% OFF
            </span>
          )}
          {item.isNew && (
            <span className="rounded bg-theme-primary px-1.5 py-0.5 text-[10px] font-bold text-theme-primary-fg">
              New
            </span>
          )}
        </div>

        {isOut && (
          <span className="absolute inset-x-0 bottom-0 bg-theme-text-primary/75 py-1 text-center text-[10px] font-bold uppercase tracking-wider text-white">
            Out of stock
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-2.5 sm:p-3">
        {(item.brand || item.styleName) && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-theme-text-muted line-clamp-1">
            {item.brand?.name ?? item.styleName}
          </span>
        )}
        <h3 className="text-[13px] font-semibold text-theme-text-primary line-clamp-2 leading-snug sm:text-sm">
          {item.name}
        </h3>

        {item.rating && (
          <div className="flex items-center gap-1 text-xs text-theme-text-subtle">
            <span className="inline-flex items-center gap-0.5 rounded bg-theme-status-del-fg px-1 py-px text-[10px] font-bold text-white">
              {item.rating.average.toFixed(1)}
              <Star className="h-2.5 w-2.5 fill-current" aria-hidden />
            </span>
            <span>({item.rating.count})</span>
          </div>
        )}

        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[15px] font-extrabold text-theme-text-primary">
            {item.hasPriceRange && <span className="text-xs font-semibold text-theme-text-muted">From </span>}
            {formatPrice(item.price)}
          </span>
          {item.originalPrice !== null && (
            <span className="text-xs text-theme-text-muted line-through">
              {formatPrice(item.originalPrice)}
            </span>
          )}
        </div>

        {item.colors.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1">
              {item.colors.slice(0, MAX_SWATCHES).map((colour) => {
                const isSelected =
                  item.selectedColor?.name.toLowerCase() === colour.name.toLowerCase();
                return (
                  <span
                    key={colour.name}
                    title={colour.name}
                    className={`h-3 w-3 rounded-full border ${
                      isSelected
                        ? "border-theme-text-primary ring-1 ring-theme-text-primary ring-offset-1"
                        : "border-theme-border-input"
                    }`}
                    style={{ backgroundColor: colour.hex ?? "var(--theme-surface-alt)" }}
                  />
                );
              })}
            </div>
            <span className="text-[11px] text-theme-text-muted line-clamp-1">
              {item.selectedColor?.name ?? item.colors[0].name}
              {extraColours > 0 && ` +${extraColours}`}
            </span>
          </div>
        )}

        {item.stockStatus === "low_stock" && (
          <div className="mt-auto pt-0.5">
            <StockBadge status={item.stockStatus} />
          </div>
        )}
      </div>
    </Link>
    {!isOut && (
      <div className="px-2.5 pb-2.5 sm:px-3 sm:pb-3">
        <ItemQuickAdd itemId={item.id} />
      </div>
    )}
    </div>
  );
}

export default ItemCard;
