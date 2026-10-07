import type { Metadata } from "next";
import { OfferProductsClient } from "./OfferProductsClient";

export const metadata: Metadata = {
  title: "Offer - Zellora",
  description: "Shop every product covered by this offer at Zellora.",
};

export default async function OfferPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OfferProductsClient offerId={id} />;
}
