import type { Metadata } from "next";
import { cache, Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { catalogListingRepository } from "@/features/customers/repositories/catalog-listing.repository";
import { CategoryListingView } from "@/features/customers/components/catalog/listing/CategoryListingView";
import {
  constructMetadata,
  getEntitySeoMetaByUuid,
  buildBreadcrumbJsonLd,
  safeJsonLd,
  SEO_CONSTANTS,
} from "@/lib/seo";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function decodeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug).trim();
  } catch {
    return slug.trim();
  }
}

/**
 * `all`, a category slug in any case (`mens_clothing`, `MENS-CLOTHING`) or a
 * category UUID (older links). Returns the canonical URL key alongside, so
 * the page can redirect non-canonical forms. Cached per request so metadata
 * and the page share one lookup.
 */
const resolveCategory = cache(async (slug: string) => {
  const key = decodeSlug(slug);
  if (key.toLowerCase() === "all") {
    return {
      canonicalKey: "all",
      name: "All Products",
      description: null,
      image: null,
      uuid: null,
    };
  }
  const categories = await catalogListingRepository.findActiveCategories();
  const row = catalogListingRepository.resolveCategoryKey(categories, key);
  if (!row) return null;
  return {
    canonicalKey: row.slug.toLowerCase(),
    name: row.name,
    description: row.description,
    image: row.image,
    uuid: row.uuid,
  };
});

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await resolveCategory(slug);

  if (!category) {
    return constructMetadata({
      title: "Category Not Found",
      noIndex: true,
    });
  }

  const seoMeta = category.uuid
    ? await getEntitySeoMetaByUuid("category", category.uuid)
    : null;

  const isAll = category.canonicalKey === "all";

  // Priority: 1. SEO Table -> 2. Actual Entity Information -> 3. Global Default
  const title =
    seoMeta?.meta_title ||
    (isAll ? "Shop All Products" : category.name);
  const description =
    seoMeta?.meta_description ||
    category.description ||
    (isAll
      ? `Browse the full ${SEO_CONSTANTS.siteName} luxury collection.`
      : `Shop the ${category.name} collection at ${SEO_CONSTANTS.siteName}.`);
  const image = seoMeta?.og_image || category.image || null;

  // Filtered views all canonicalise to the unfiltered category page.
  return constructMetadata({
    title,
    description,
    image,
    canonicalUrl: `/category/${category.canonicalKey}`,
    keywords: seoMeta?.meta_keywords || undefined,
  });
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const [{ slug }, rawSearchParams] = await Promise.all([params, searchParams]);
  const category = await resolveCategory(slug);
  if (!category) notFound();

  if (decodeSlug(slug) !== category.canonicalKey) {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(rawSearchParams)) {
      if (Array.isArray(value)) value.forEach((v) => qs.append(key, v));
      else if (value !== undefined) qs.set(key, value);
    }
    const suffix = qs.toString();
    redirect(`/category/${category.canonicalKey}${suffix ? `?${suffix}` : ""}`);
  }

  const isAll = category.canonicalKey === "all";

  const collectionJsonLd = isAll
    ? null
    : {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: category.name,
        url: `${SEO_CONSTANTS.baseUrl}/category/${category.canonicalKey}`,
        isPartOf: {
          "@type": "WebSite",
          name: SEO_CONSTANTS.siteName,
          url: SEO_CONSTANTS.baseUrl,
        },
      };

  const breadcrumbsJsonLd = isAll
    ? null
    : buildBreadcrumbJsonLd({
        items: [
          { name: "Home", item: "/" },
          { name: "Categories", item: "/products" },
          { name: category.name, item: `/category/${category.canonicalKey}` },
        ],
      });

  return (
    <>
      {collectionJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(collectionJsonLd) }}
        />
      )}
      {breadcrumbsJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbsJsonLd) }}
        />
      )}
      {/* useSearchParams in the view needs a Suspense boundary. */}
      <Suspense fallback={<div className="min-h-screen bg-theme-bg" />}>
        <CategoryListingView categoryKey={category.canonicalKey} initialTitle={category.name} />
      </Suspense>
    </>
  );
}
