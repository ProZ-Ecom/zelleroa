"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export interface ProductImageProps {
  src?: string | null;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
  className?: string;
  containerClassName?: string;
  aspectRatio?: "square" | "video" | "4/3" | "auto";
  badge?: React.ReactNode;
  fallbackText?: string;
  /** "compact" drops the text and padding so the fallback fits small thumbnails. */
  fallbackSize?: "default" | "compact";
}

function FashionMonogramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-theme-primary", className)}
    >
      {/* Luxury Coat Hanger / Garment Silhouette */}
      <path
        d="M32 14C30 14 28 15.5 28 17.5C28 19.5 30 21 32 23V25"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M32 25L14 34C11 35.5 12 40 15.5 40H48.5C52 40 53 35.5 50 34L32 25Z"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* Central Diamond / Crest */}
      <path
        d="M32 30L35 34L32 38L29 34L32 30Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* Delicate horizontal bottom strut */}
      <path
        d="M16 40H48"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Subtle sparkle accents */}
      <path
        d="M48 18L49 21L52 22L49 23L48 26L47 23L44 22L47 21L48 18Z"
        fill="#C97A1E"
      />
      <path
        d="M16 22L16.5 23.5L18 24L16.5 24.5L16 26L15.5 24.5L14 24L15.5 23.5L16 22Z"
        fill="#C97A1E"
      />
    </svg>
  );
}

/**
 * Premium Zellora Fashion & Lifestyle SVG fallback illustration
 */
export function ProductFallbackIllustration({
  className,
  title,
  size = "default",
}: {
  className?: string;
  title?: string;
  size?: "default" | "compact";
}) {
  if (size === "compact") {
    return (
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden select-none bg-gradient-to-br from-theme-surface via-theme-surface-alt to-theme-border/40 text-theme-primary",
          className
        )}
        role="img"
        aria-label={title || "Zellora Collection"}
      >
        <FashionMonogramIcon className="h-3/5 w-3/5" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden select-none bg-gradient-to-br from-[#FAF8F5] via-[#F4EFEA] to-[#EBE4DC] text-theme-primary p-4 text-center",
        className
      )}
      aria-label={title || "Zellora Collection"}
    >
      {/* Decorative background subtle pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#8B1D1D_0.6px,transparent_0.6px)] opacity-[0.05] [background-size:14px_14px]" />

      {/* Decorative corner accents */}
      <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-theme-primary/25 rounded-tl-sm pointer-events-none" />
      <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-theme-primary/25 rounded-tr-sm pointer-events-none" />
      <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-theme-primary/25 rounded-bl-sm pointer-events-none" />
      <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-theme-primary/25 rounded-br-sm pointer-events-none" />

      {/* Center Illustration */}
      <div className="relative z-10 flex flex-col items-center justify-center max-w-[85%]">
        <div className="w-16 h-16 md:w-20 md:h-20 mb-3 rounded-2xl bg-white/90 shadow-sm border border-theme-primary/15 flex items-center justify-center p-3 backdrop-blur-xs">
          <FashionMonogramIcon className="w-full h-full" />
        </div>

        {/* Brand signature & label */}
        <span className="font-serif font-bold text-sm md:text-base tracking-wide text-theme-primary">
          Zellora
        </span>
        <span className="text-[11px] md:text-xs text-theme-text-muted font-medium mt-0.5 line-clamp-1">
          {title || "Fashion & Lifestyle"}
        </span>
      </div>
    </div>
  );
}

// Backward compatibility alias for any existing callers
export const SnackFallbackIllustration = ProductFallbackIllustration;

// Global cache of URLs that failed to load, preventing repeated slow network timeouts across cards
const FAILED_IMAGE_URLS = new Set<string>();

function isUnresolvableImageSrc(src?: string | null): boolean {
  if (!src) return true;
  const trimmed = src.trim();
  if (
    trimmed === "" ||
    trimmed === "null" ||
    trimmed === "undefined" ||
    trimmed === "/images/placeholder.png" ||
    (trimmed.startsWith("/logos/") && trimmed.endsWith(".png"))
  ) {
    return true;
  }
  return FAILED_IMAGE_URLS.has(trimmed);
}

export function ProductImage({
  src,
  alt,
  fill = true,
  width,
  height,
  sizes = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw",
  priority = false,
  className,
  containerClassName,
  aspectRatio = "square",
  badge,
  fallbackText,
  fallbackSize = "default",
}: ProductImageProps) {
  const isInvalidSrc = isUnresolvableImageSrc(src);
  const [hasError, setHasError] = useState(isInvalidSrc);
  const [isLoading, setIsLoading] = useState(!isInvalidSrc);

  const isMountedRef = useRef(false);
  const hasLoadedBeforeMountRef = useRef(false);
  const prevSrcRef = useRef(src);

  useEffect(() => {
    isMountedRef.current = true;
    if (hasLoadedBeforeMountRef.current) {
      setIsLoading(false);
    }
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (prevSrcRef.current !== src) {
      prevSrcRef.current = src;
      const invalid = isUnresolvableImageSrc(src);
      setHasError(invalid);
      setIsLoading(!invalid);
      hasLoadedBeforeMountRef.current = false;
    }
  }, [src]);

  const aspectClass =
    aspectRatio === "square"
      ? "aspect-square"
      : aspectRatio === "video"
      ? "aspect-video"
      : aspectRatio === "4/3"
      ? "aspect-4/3"
      : "";

  const handleImageLoad = () => {
    if (isMountedRef.current) {
      setIsLoading(false);
    } else {
      hasLoadedBeforeMountRef.current = true;
    }
  };

  const handleImageError = () => {
    if (src) {
      FAILED_IMAGE_URLS.add(src.trim());
    }
    if (isMountedRef.current) {
      setHasError(true);
      setIsLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden bg-stone-50",
        aspectClass,
        containerClassName
      )}
    >
      {badge && <div className="absolute top-3 left-3 z-20 pointer-events-none">{badge}</div>}

      {isInvalidSrc || hasError ? (
        <SnackFallbackIllustration
          className={cn("w-full h-full", className)}
          title={fallbackText || alt}
          size={fallbackSize}
        />
      ) : (
        <>
          {isLoading && (
            <div className="absolute inset-0 z-10 animate-pulse bg-gradient-to-br from-stone-100 via-amber-50/40 to-stone-100" />
          )}

          {fill ? (
            <Image
              src={src!}
              alt={alt || "Zellora Product"}
              fill
              sizes={sizes}
              priority={priority}
              onLoad={handleImageLoad}
              onError={handleImageError}
              className={cn(
                "object-cover transition-opacity duration-300",
                isLoading ? "opacity-0" : "opacity-100",
                className
              )}
            />
          ) : (
            <Image
              src={src!}
              alt={alt || "Zellora Product"}
              width={width || 400}
              height={height || 400}
              sizes={sizes}
              priority={priority}
              onLoad={handleImageLoad}
              onError={handleImageError}
              className={cn(
                "object-cover transition-opacity duration-300",
                isLoading ? "opacity-0" : "opacity-100",
                className
              )}
            />
          )}
        </>
      )}
    </div>
  );
}
