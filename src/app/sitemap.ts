import type { MetadataRoute } from "next";
import { SEO_CONSTANTS } from "@/lib/seo/seo.constants";
import { db } from "@/lib/db/prisma";
import { catalogListingRepository } from "@/features/customers/repositories/catalog-listing.repository";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SEO_CONSTANTS.baseUrl;
  const now = new Date();

  // 1. Static Public Pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/products`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/offers`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/faqs`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/bulk-order`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/privacy-policy`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms-and-conditions`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/shipping-policy`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/return-refund-policy`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  // 2. Query dynamic entities in parallel with graceful error fallback
  let categoryEntries: MetadataRoute.Sitemap = [];
  let styleEntries: MetadataRoute.Sitemap = [];

  try {
    const [categoriesResult, stylesResult] = await Promise.allSettled([
      catalogListingRepository.findActiveCategories(),
      db.style.findMany({
        where: {
          isActive: true,
          deleted_at: null,
        },
        select: {
          uuid: true,
          updatedAt: true,
        },
        take: 2000,
      }),
    ]);

    if (categoriesResult.status === "fulfilled") {
      categoryEntries = categoriesResult.value
        .filter((cat) => cat.slug && cat.slug.toLowerCase() !== "all")
        .map((cat) => ({
          url: `${baseUrl}/category/${encodeURIComponent(cat.slug.toLowerCase())}`,
          lastModified: now,
          changeFrequency: "weekly" as const,
          priority: 0.8,
        }));
    }

    if (stylesResult.status === "fulfilled") {
      styleEntries = stylesResult.value.map((style) => ({
        url: `${baseUrl}/styles/${encodeURIComponent(style.uuid)}`,
        lastModified: style.updatedAt || now,
        changeFrequency: "daily" as const,
        priority: 0.7,
      }));
    }

  } catch {
    // Graceful fallback to static entries if database connection fails
  }

  return [...staticPages, ...categoryEntries, ...styleEntries];
}
