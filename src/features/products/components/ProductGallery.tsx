"use client";

import { useState, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Sparkles, CheckCircle2, Plus } from "lucide-react";
import { ProductImage } from "@/components/common/ProductImage";

export interface GalleryImage {
  id: string;
  url: string;
  altText?: string | null;
}

interface ProductGalleryProps {
  images: GalleryImage[];
  productName: string;
  className?: string;
  isVeg?: boolean;
  isInStock?: boolean;
  /**
   * The food-catalog quality seal. Off for catalogs where it means nothing
   * (clothing, accessories); on by default so existing callers are unchanged.
   */
  showQualitySeal?: boolean;
  /** Buttons (e.g. like / share) stacked down the left edge of the image. */
  overlayActions?: ReactNode;
}

function ProductGallery({
  images,
  productName,
  className,
  isVeg = true,
  isInStock = true,
  showQualitySeal = true,
  overlayActions,
}: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isZooming, setIsZooming] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    });
  };

  const validImages = (images || []).filter((img) => img && img.url && img.url.trim() !== "");

  const goPrev = () =>
    setSelectedIndex((i) => (i > 0 ? i - 1 : validImages.length - 1));
  const goNext = () =>
    setSelectedIndex((i) => (i < validImages.length - 1 ? i + 1 : 0));

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };
  const handleTouchEnd = () => {
    if (validImages.length > 1) {
      const swipeThreshold = 40;
      if (touchDeltaX.current > swipeThreshold) {
        goPrev();
      } else if (touchDeltaX.current < -swipeThreshold) {
        goNext();
      }
    }
    touchStartX.current = null;
    touchDeltaX.current = 0;
  };

  if (validImages.length === 0) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-amber-200/50 bg-gradient-to-br from-[#FFFDF9] to-[#FFF5EB] shadow-xs group">
          {/* Top badges */}
          <div className="absolute top-3.5 left-3.5 z-20 flex flex-wrap gap-2">
            {isVeg && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs backdrop-blur-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-600 ring-2 ring-emerald-600/30" />
                100% Veg
              </span>
            )}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shadow-2xs backdrop-blur-xs",
                isInStock
                  ? "bg-stone-50/90 text-stone-700 border-stone-200/80"
                  : "bg-rose-50 text-rose-700 border-rose-200/80"
              )}
            >
              {isInStock ? "In Stock" : "Out of Stock"}
            </span>
          </div>

          {overlayActions && (
            <div className="absolute right-3.5 top-3.5 z-20 flex flex-col gap-2">{overlayActions}</div>
          )}

          <ProductImage
            src={null}
            alt={productName}
            fallbackText={productName}
            containerClassName="w-full h-full aspect-square"
            className="w-full h-full"
          />
        </div>
      </div>
    );
  }

  const selected = validImages[selectedIndex] || validImages[0];

  return (
    <div className={cn("space-y-4", className)}>
      <div
        className="relative aspect-square w-full overflow-hidden rounded-2xl border border-stone-200/80 bg-stone-50 shadow-xs group touch-pan-y cursor-zoom-in"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseEnter={() => setIsZooming(true)}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setIsZooming(false)}
      >
        {/* Badges */}
        <div className="absolute top-3.5 left-3.5 z-20 flex flex-wrap gap-2 pointer-events-none">
          {isVeg && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs backdrop-blur-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-600 ring-2 ring-emerald-600/30" />
              100% Veg
            </span>
          )}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shadow-2xs backdrop-blur-xs",
              isInStock
                ? "bg-white/90 text-stone-700 border-stone-200/80"
                : "bg-rose-50 text-rose-700 border-rose-200/80"
            )}
          >
            {isInStock ? "In Stock" : "Out of Stock"}
          </span>
        </div>

        {overlayActions && (
          <div className="absolute right-3.5 top-3.5 z-20 flex flex-col gap-2">{overlayActions}</div>
        )}

        {/* Quality Seal */}
        {showQualitySeal && (
          <div className="absolute top-3.5 right-3.5 z-20 pointer-events-none">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#8B1D1D]/10 text-[#8B1D1D] border border-[#8B1D1D]/20 shadow-2xs backdrop-blur-xs">
              <Sparkles className="w-3 h-3 text-[#8B1D1D]" />
              Traditional
            </span>
          </div>
        )}

        {/* Scanning Magnified Image Layer */}
        <div
          className="relative h-full w-full pointer-events-none transition-transform will-change-transform"
          style={{
            transformOrigin: `${mousePos.x}% ${mousePos.y}%`,
            transform: isZooming ? "scale(2.5)" : "scale(1)",
            transitionDuration: isZooming ? "80ms" : "300ms",
            transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <ProductImage
            key={selected.id || selected.url}
            src={selected.url}
            alt={selected.altText || productName}
            fallbackText={productName}
            priority={true}
            containerClassName="w-full h-full aspect-square"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Scanning Lens Reticle with Plus Symbol */}
        {isZooming && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 z-20 flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/90 bg-black/25 shadow-xl backdrop-blur-[1px]"
            style={{
              left: `${mousePos.x}%`,
              top: `${mousePos.y}%`,
              transition: "left 50ms linear, top 50ms linear",
            }}
          >
            <Plus className="h-6 w-6 text-white drop-shadow stroke-[2.5]" />
          </div>
        )}

        {validImages.length > 1 && (
          <>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-stone-700 shadow-md h-9 w-9 rounded-full border border-stone-200 transition-transform active:scale-95"
              onClick={goPrev}
              aria-label="Previous image"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-stone-700 shadow-md h-9 w-9 rounded-full border border-stone-200 transition-transform active:scale-95"
              onClick={goNext}
              aria-label="Next image"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>

            {/* Position dots for mobile touch feedback */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
              {validImages.map((image, index) => (
                <span
                  key={image.id || index}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    selectedIndex === index
                      ? "w-4 bg-white shadow-sm"
                      : "w-1.5 bg-white/60"
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {validImages.length > 1 && (
        <div className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin">
          {validImages.map((image, index) => (
            <button
              key={image.id || index}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className={cn(
                "relative h-18 w-18 shrink-0 overflow-hidden rounded-xl border-2 transition-all p-0.5 bg-white",
                selectedIndex === index
                  ? "border-[#8B1D1D] ring-2 ring-[#8B1D1D]/20 shadow-xs scale-102"
                  : "border-stone-200 hover:border-stone-400 opacity-70 hover:opacity-100"
              )}
            >
              <ProductImage
                src={image.url}
                alt={image.altText || `${productName} ${index + 1}`}
                containerClassName="w-full h-full rounded-lg"
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { ProductGallery };
