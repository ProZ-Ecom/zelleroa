import type { Metadata } from "next";
import { OffersClient } from "./OffersClient";

export const metadata: Metadata = {
  title: "Offers & Deals - Zellora",
  description:
    "Browse all active offers, discounts and deals at Zellora.",
};

export default function OffersPage() {
  return <OffersClient />;
}
