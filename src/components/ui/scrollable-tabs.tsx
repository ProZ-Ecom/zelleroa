"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScrollableTabsProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Horizontal scroller that shows edge fades + arrow buttons only when
 * there is more content to scroll to in that direction.
 */
export function ScrollableTabs({ children, className }: ScrollableTabsProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);

  const scrollBy = (dir: 1 | -1) =>
    ref.current?.scrollBy({ left: dir * 240, behavior: "smooth" });

  const arrow =
    "absolute top-1/2 -translate-y-1/2 z-10 grid place-items-center h-7 w-7 rounded-full border border-cream-border-subtle bg-white text-neutral-600 shadow-sm transition hover:bg-cream-200 hover:text-secondary-800 cursor-pointer";

  return (
    <div className="relative">
      <div
        ref={ref}
        className={cn(
          "flex items-center gap-2 overflow-x-auto scrollbar-none py-1",
          className
        )}
      >
        {children}
      </div>

      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-background via-background/80 to-transparent transition-opacity",
          canLeft ? "opacity-100" : "opacity-0"
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background via-background/80 to-transparent transition-opacity",
          canRight ? "opacity-100" : "opacity-0"
        )}
      />

      {canLeft && (
        <button
          type="button"
          aria-label="Scroll left"
          onClick={() => scrollBy(-1)}
          className={cn(arrow, "left-0")}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {canRight && (
        <button
          type="button"
          aria-label="Scroll right"
          onClick={() => scrollBy(1)}
          className={cn(arrow, "right-0")}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
