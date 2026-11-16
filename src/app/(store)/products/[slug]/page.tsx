import type { Metadata } from "next";
import { cache } from "react";
import { redirect } from "next/navigation";
import { catalogService } from "@/features/customers/services/catalog.service";
import { styleDefaultItemId, itemHref } from "@/features/customers/utils/style-default-item";
import { ProductDetailClient } from "./ProductDetailClient";
import {
  constructMetadata,
  getEntitySeoMetaByUuid,
} from "@/lib/seo";

interface ProductDetailPageProps {
  params: Promise<{ slug: string }>;
}

/** `slug` is the Style UUID - the Style is what the storefront lists and links to. */
const getStyleForSeo = cache(async (slug: string) => {
  try {
    return await catalogService.getStyleByUuid(slug);
  } catch {
    return null;
  }
});

export async function generateMetadata({
  params,
}: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const [style, seoMeta] = await Promise.all([
    getStyleForSeo(slug),
    getEntitySeoMetaByUuid("style", slug),
  ]);

  if (!style) {
    return constructMetadata({
      title: "Product Not Found",
      noIndex: true,
    });
  }

  // Priority: 1. SEO Table -> 2. Actual Entity Information -> 3. Global Default
  const title =
    seoMeta?.meta_title ||
    `${style.name}${style.brand ? ` by ${style.brand.name}` : ""}`;
  const description =
    seoMeta?.meta_description ||
    (style.description || style.shortDescription) ||
    `Shop ${style.name} at Zellora. ${style.category ? `Explore our ${style.category.name} collection.` : ""}`;
  const image = seoMeta?.og_image || style.image || null;

  return constructMetadata({
    title,
    description,
    image,
    canonicalUrl: `/products/${slug}`,
    keywords: seoMeta?.meta_keywords || undefined,
  });
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = await params;
  const style = await getStyleForSeo(slug);

  // A Style is never shown as a page of Items to choose between - each Item
  // has its own page, so this link opens the Style's default Item. Called
  // outside any try/catch: `redirect` works by throwing.
  const itemId = style ? styleDefaultItemId(style) : null;
  if (itemId) redirect(itemHref(itemId));

  return <ProductDetailClient slug={slug} />;
}
