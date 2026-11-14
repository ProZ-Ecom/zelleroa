import type { Metadata } from "next";
import { cache } from "react";
import { catalogService } from "@/features/customers/services/catalog.service";
import { ItemDetailClient } from "./ItemDetailClient";
import {
  constructMetadata,
  getEntitySeoMetaByUuid,
  buildProductJsonLd,
  buildBreadcrumbJsonLd,
  safeJsonLd,
} from "@/lib/seo";

interface ItemDetailPageProps {
  params: Promise<{ id: string }>;
}

const getItemForSeo = cache(async (id: string) => {
  try {
    return await catalogService.getItemByUuid(id);
  } catch {
    return null;
  }
});

export async function generateMetadata({
  params,
}: ItemDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const [item, seoMeta] = await Promise.all([
    getItemForSeo(id),
    getEntitySeoMetaByUuid("item", id),
  ]);

  if (!item) {
    return constructMetadata({
      title: "Product Not Found",
      noIndex: true,
    });
  }

  // Priority: 1. SEO Table -> 2. Actual Entity Information -> 3. Global Default
  const title =
    seoMeta?.meta_title ||
    `${item.name}${item.brand ? ` by ${item.brand.name}` : ""}`;
  const description =
    seoMeta?.meta_description ||
    item.shortDescription ||
    item.description ||
    `Shop ${item.name} at Zellora.`;
  const image = seoMeta?.og_image || item.image || null;

  return constructMetadata({
    title,
    description,
    image,
    canonicalUrl: `/items/${id}`,
    keywords: seoMeta?.meta_keywords || undefined,
  });
}

export default async function ItemDetailPage({ params }: ItemDetailPageProps) {
  const { id } = await params;
  const item = await getItemForSeo(id);

  // Every Colour's every Size is separately priced and stocked, so the Item is
  // described to crawlers as an aggregate offer over those rows.
  const sizes = item?.colors.flatMap((color) => color.unitPrices) ?? [];

  const productJsonLd = item
    ? buildProductJsonLd({
        name: item.name,
        description: item.shortDescription || item.description || undefined,
        image: item.image ? [item.image] : undefined,
        brand: item.brand?.name,
        category: item.category?.name,
        sku: sizes[0]?.sku,
        url: `/items/${id}`,
        offers:
          sizes.length > 0
            ? {
                priceCurrency: "INR",
                lowPrice: Math.min(...sizes.map((s) => s.sellingPrice)),
                highPrice: Math.max(...sizes.map((s) => s.sellingPrice)),
                offerCount: sizes.length,
                availability: sizes.some((s) => s.inStock) ? "InStock" : "OutOfStock",
                url: `/items/${id}`,
              }
            : undefined,
      })
    : null;

  const breadcrumbsJsonLd = item
    ? buildBreadcrumbJsonLd({
        items: [
          { name: "Home", item: "/" },
          { name: "Products", item: "/products" },
          ...(item.category
            ? [
                {
                  name: item.category.name,
                  item: `/category/${item.category.slug || item.category.id}`,
                },
              ]
            : []),
          { name: item.name, item: `/items/${id}` },
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
      <ItemDetailClient itemId={id} />
    </>
  );
}
