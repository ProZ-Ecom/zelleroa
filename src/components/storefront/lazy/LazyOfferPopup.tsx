"use client";

import dynamic from "next/dynamic";

/**
 * OfferPopup renders nothing until its delayed timer fires and only ever
 * portals into document.body, so it carries no layout footprint and needs no
 * skeleton or SSR pass - deferring it to the client keeps it out of the
 * initial bundle entirely.
 */
const OfferPopup = dynamic(() => import("../OfferPopup"), { ssr: false });

export function LazyOfferPopup() {
  return <OfferPopup />;
}

export default LazyOfferPopup;
