"use client";

import dynamic from "next/dynamic";

/**
 * OfferReels is a fixed-position floating overlay (not part of page flow) that
 * depends on browser-only APIs (matchMedia). It has no layout footprint, so it
 * needs no skeleton and can skip SSR entirely.
 */
const OfferReels = dynamic(() => import("../OfferReels"), { ssr: false });

export function LazyOfferReels() {
  return <OfferReels />;
}

export default LazyOfferReels;
