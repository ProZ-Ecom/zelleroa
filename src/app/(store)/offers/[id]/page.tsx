import type { Metadata } from "next";
import { cache } from "react";
import { offerService } from "@/features/offers/services/offer.service";
import { OfferProductsClient } from "./OfferProductsClient";
import { constructMetadata } from "@/lib/seo";

interface OfferPageProps {
  params: Promise<{ id: string }>;
}

const getOfferForSeo = cache(async (id: string) => {
  try {
    return await offerService.getOffer(id);
  } catch {
    return null;
  }
});

export async function generateMetadata({
  params,
}: OfferPageProps): Promise<Metadata> {
  const { id } = await params;
  const offer = await getOfferForSeo(id);

  if (!offer) {
    return constructMetadata({
      title: "Offer Not Found",
      noIndex: true,
    });
  }

  const title = `${offer.name}`;
  const description = offer.code
    ? `Use offer code ${offer.code} to enjoy exclusive discounts on selected styles at Zellora.`
    : `Shop exclusive discounts with ${offer.name} at Zellora. Limited time luxury deals.`;
  const image = offer.bannerImage || null;

  return constructMetadata({
    title,
    description,
    image,
    canonicalUrl: `/offers/${id}`,
  });
}

export default async function OfferPage({ params }: OfferPageProps) {
  const { id } = await params;
  return <OfferProductsClient offerId={id} />;
}
