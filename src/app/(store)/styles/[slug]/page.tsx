import type { Metadata } from "next";
import { cache } from "react";
import { catalogService } from "@/features/customers/services/catalog.service";
import { StyleDetailClient } from "./StyleDetailClient";
import {
  constructMetadata,
  getEntitySeoMetaByUuid,
  buildProductJsonLd,
  buildBreadcrumbJsonLd,
  safeJsonLd,
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

  // Every Colour's every Size is separately priced and stocked, so the Style is
  // described to crawlers as an aggregate offer over those rows.
  const sizes = style?.colors.flatMap((color) => color.unitPrices) ?? [];

  const productJsonLd = style
    ? buildProductJsonLd({
        name: style.name,
        description: style.shortDescription || style.description || undefined,
        image: style.image ? [style.image] : undefined,
        brand: style.brand?.name,
        category: style.category?.name,
        sku: sizes[0]?.sku,
        url: `/styles/${slug}`,
        offers:
          sizes.length > 0
            ? {
                priceCurrency: "INR",
                lowPrice: Math.min(...sizes.map((s) => s.sellingPrice)),
                highPrice: Math.max(...sizes.map((s) => s.sellingPrice)),
                offerCount: sizes.length,
                availability: sizes.some((s) => s.inStock) ? "InStock" : "OutOfStock",
                url: `/styles/${slug}`,
              }
            : undefined,
      })
    : null;

  const breadcrumbsJsonLd = style
    ? buildBreadcrumbJsonLd({
        items: [
          { name: "Home", item: "/" },
          { name: "Products", item: "/products" },
          ...(style.category
            ? [
                {
                  name: style.category.name,
                  item: `/category/${style.category.id}`,
                },
              ]
            : []),
          { name: style.name, item: `/styles/${slug}` },
        ],
      })
    : null;

  return (
    <>
      {productJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(productJsonLd) }}
        />
      )}
      {breadcrumbsJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbsJsonLd) }}
        />
      )}
      <StyleDetailClient slug={slug} />
    </>
  );
}
