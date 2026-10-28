"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useCustomerBanners } from "@/features/banners/hooks";
import { useSlider } from "@/hooks/useSlider";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80";

const AUTOPLAY_INTERVAL_MS = 5000;

export function HeroIntro() {
  const { data: banners, isPending } = useCustomerBanners({ position: "home-hero-intro" });
  const [paused, setPaused] = React.useState(false);

  const slides = banners && banners.length > 0
    ? banners
    : [
      {
        id: "fallback",
        imageUrl: FALLBACK_IMAGE,
        title: null,
        linkUrl: null,
        badgeLabel: null,
        subtitle: null,
        priceText: null,
      },
    ];

  const isSlider = slides.length > 1;
  const { currentIndex, next, previous, goTo } = useSlider(slides.length);

  // Restarting on currentIndex gives each slide a full interval after manual nav.
  React.useEffect(() => {
    if (!isSlider || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setTimeout(next, AUTOPLAY_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [isSlider, paused, next, currentIndex]);

  const banner = slides[currentIndex];
  const isFallback = !banners || banners.length === 0;

  const imageAlt = banner?.title || "Shopper carrying bags from the new season collection";
  const linkUrl = banner?.linkUrl || "/products";
  const badgeLabel = banner?.badgeLabel ?? (isFallback ? "Trending" : null);
  const subtitle = banner?.subtitle ?? (isFallback ? "Curated" : null);
  const cardTitle = banner?.title || "The Weekend Edit";
  const priceText = banner?.priceText ?? (isFallback ? "Starting ₹899" : null);

  return (
    <section className="w-full bg-white">
      <div className="w-full max-w-[1400px] 2xl:max-w-[1600px] 3xl:max-w-[1800px] mx-auto px-4 sm:px-6 md:px-8 py-10 sm:py-14 lg:py-20 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        {/* Left: copy */}
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-theme-primary-light px-3 py-1 text-xs font-semibold uppercase tracking-wide text-theme-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-theme-primary" />
            New Season 2026 Collection
          </span>

          <h1 className="mt-5 text-4xl sm:text-5xl xl:text-6xl font-extrabold uppercase leading-[1.05] tracking-tight text-theme-text-primary">
            Everyday Style.
            <br />
            <span className="text-theme-primary">Made For You.</span>
          </h1>

          <p className="mt-5 max-w-md text-sm sm:text-base text-theme-text-subtle">
            Discover products you&apos;ll love at prices you&apos;ll appreciate. Built for
            modern lifestyles with uncompromising comfort and sharp aesthetics.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3 sm:gap-4">
            <Link
              href="/products?gender=men"
              className="rounded-md bg-theme-primary hover:bg-theme-primary-hover px-6 py-3 text-sm font-bold uppercase tracking-wide text-theme-primary-fg transition-colors"
            >
              Shop Men
            </Link>
            <Link
              href="/products?gender=women"
              className="rounded-md bg-theme-primary hover:bg-theme-primary-hover px-6 py-3 text-sm font-bold uppercase tracking-wide text-theme-primary-fg transition-colors"
            >
              Shop Women
            </Link>
            <Link
              href="/products"
              className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-theme-primary hover:text-theme-primary-hover transition-colors"
            >
              Explore Lifestyle
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Right: image + banner inside content */}
        <div
          className="relative group"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 shadow-lg">
            {isPending ? (
              <div className="absolute inset-0 animate-pulse bg-slate-200" />
            ) : (
              slides.map((slide, index) => (
                <Image
                  key={slide.id}
                  src={slide.imageUrl || FALLBACK_IMAGE}
                  alt={index === currentIndex ? imageAlt : ""}
                  aria-hidden={index !== currentIndex}
                  fill
                  priority={index === 0}
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className={`object-cover transition-opacity duration-700 ease-in-out ${index === currentIndex ? "opacity-100" : "opacity-0"
                    }`}
                />
              ))
            )}

            {isSlider && (
              <>
                <button
                  type="button"
                  onClick={previous}
                  aria-label="Previous slide"
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex cursor-pointer h-9 w-9 items-center justify-center rounded-full bg-white/85 text-theme-text-primary opacity-0 shadow-md backdrop-blur-xs transition-opacity hover:bg-white group-hover:opacity-100"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={next}
                  aria-label="Next slide"
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex cursor-pointer h-9 w-9 items-center justify-center rounded-full bg-white/85 text-theme-text-primary opacity-0 shadow-md backdrop-blur-xs transition-opacity hover:bg-white group-hover:opacity-100"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>

                {/* Slider dots indicators positioned top-right inside banner */}
                <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-white/20">
                  {slides.map((slide, index) => (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() => goTo(index)}
                      aria-label={`Go to slide ${index + 1}`}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${index === currentIndex ? "w-5 bg-white" : "w-1.5 bg-white/60 hover:bg-white/80"
                        }`}
                    />
                  ))}
                </div>
              </>
            )}

            {/* In-Banner Content Card: cleanly aligned inside banner image */}
            {!isPending && (
              <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:left-5 sm:bottom-5 sm:w-[420px] z-10 flex items-center gap-3.5 rounded-xl border border-white/90 bg-white/95 p-3.5 shadow-xl backdrop-blur-md">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-theme-primary-light text-theme-primary">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  {badgeLabel && (
                    <div className="mb-1">
                      <span className="inline-block whitespace-nowrap rounded-full bg-orange-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-600">
                        {badgeLabel}
                      </span>
                    </div>
                  )}
                  <p className="text-sm font-bold text-theme-text-primary whitespace-nowrap truncate">
                    {cardTitle}
                  </p>
                  {priceText && (
                    <p className="text-xs font-bold text-theme-primary whitespace-nowrap truncate mt-0.5">
                      {priceText}
                    </p>
                  )}
                  {subtitle && (
                    <p className="text-[11px] text-theme-text-subtle whitespace-nowrap truncate mt-0.5">
                      {subtitle}
                    </p>
                  )}
                </div>
                <Link
                  href={linkUrl}
                  aria-label={`Shop ${cardTitle}`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-theme-primary-light text-theme-primary hover:bg-theme-primary hover:text-white transition-colors"
                >
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroIntro;
