"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
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
  const [isZooming, setIsZooming] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    });
  };

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-theme-border bg-theme-surface shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <Link href={`/products/${style.id}`} className="flex flex-1 flex-col">
        <div
          className="relative aspect-[5/4] w-full overflow-hidden bg-theme-surface-alt cursor-zoom-in"
          onMouseEnter={() => setIsZooming(true)}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setIsZooming(false)}
        >
          {/* Scanning Magnified Image Layer */}
          <div
            className="relative h-full w-full pointer-events-none transition-transform will-change-transform"
            style={{
              transformOrigin: `${mousePos.x}% ${mousePos.y}%`,
              transform: isZooming ? "scale(2.2)" : "scale(1)",
              transitionDuration: isZooming ? "80ms" : "300ms",
              transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <ProductImage
              src={style.image}
              alt={style.name}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover"
            />
          </div>

          {/* Scanning Lens Reticle with Plus Symbol */}
          {isZooming && (
            <div
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/90 bg-black/25 shadow-lg backdrop-blur-[1px]"
              style={{
                left: `${mousePos.x}%`,
                top: `${mousePos.y}%`,
                transition: "left 50ms linear, top 50ms linear",
              }}
            >
              <Plus className="h-5 w-5 text-white drop-shadow stroke-[2.5]" />
            </div>
          )}
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
