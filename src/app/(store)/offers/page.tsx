import type { Metadata } from "next";
import { OffersClient } from "./OffersClient";
import { constructMetadata } from "@/lib/seo";

export const metadata: Metadata = constructMetadata({
  title: "Offers & Deals",
  description: "Browse all active offers, discounts, bundles, and exclusive deals at Zellora.",
  canonicalUrl: "/offers",
});

export default function OffersPage() {
  return <OffersClient />;
}
