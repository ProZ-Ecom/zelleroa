import type { Metadata } from "next";
import { cache } from "react";
import { redirect } from "next/navigation";
import { catalogService } from "@/features/customers/services/catalog.service";
import { styleDefaultItemId, itemHref } from "@/features/customers/utils/style-default-item";
import { StyleDetailClient } from "./StyleDetailClient";
import {
  constructMetadata,
  getEntitySeoMetaByUuid,
} from "@/lib/seo";

interface StyleDetailPageProps {
  params: Promise<{ slug: string }>;
}

const getStyleForSeo = cache(async (slug: string) => {
  try {
    return await catalogService.getStyleByUuid(slug);
  } catch {
    return null;
  }
});

export async function generateMetadata({
  params,
}: StyleDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const [style, seoMeta] = await Promise.all([
    getStyleForSeo(slug),
    getEntitySeoMetaByUuid("style", slug),
  ]);

  if (!style) {
    return constructMetadata({
      title: "Style Not Found",
      noIndex: true,
    });
  }

  // Priority: 1. SEO Table -> 2. Actual Entity Information -> 3. Global Default
  const title =
    seoMeta?.meta_title ||
    `${style.name}${style.brand ? ` by ${style.brand.name}` : ""}`;
  const description =
    seoMeta?.meta_description ||
    style.shortDescription ||
    style.description ||
    `Shop ${style.name} at Zellora.`;
  const image = seoMeta?.og_image || style.image || null;

  return constructMetadata({
    title,
    description,
    image,
    canonicalUrl: `/styles/${slug}`,
    keywords: seoMeta?.meta_keywords || undefined,
  });
}

export default async function StyleDetailPage({ params }: StyleDetailPageProps) {
  const { slug } = await params;
  const style = await getStyleForSeo(slug);

  // A Style has no page of its own to pick Items on - it opens its default
  // Item. Called outside any try/catch: `redirect` works by throwing.
  const itemId = style ? styleDefaultItemId(style) : null;
  if (itemId) redirect(itemHref(itemId));

  return <StyleDetailClient slug={slug} />;
}
