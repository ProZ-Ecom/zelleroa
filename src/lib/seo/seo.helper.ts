import { cache } from "react";
import { db } from "@/lib/db/prisma";
import { SEO_CONSTANTS } from "./seo.constants";
import type {
  BreadcrumbJsonLdProps,
  OrganizationJsonLdProps,
  ProductJsonLdProps,
  SeoEntityMeta,
  WebSiteJsonLdProps,
} from "./seo.types";

/**
 * Normalizes a path or URL into an absolute canonical URL, stripping query parameters
 * and hash fragments to prevent duplicate indexing issues.
 */
export function resolveCanonicalUrl(pathOrUrl?: string): string {
  if (!pathOrUrl) {
    return SEO_CONSTANTS.baseUrl;
  }

  // If already absolute URL, parse and strip search/hash
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    try {
      const url = new URL(pathOrUrl);
      return `${url.origin}${url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "")}`;
    } catch {
      return pathOrUrl;
    }
  }

  // Relative path: clean query params and trailing slashes
  const cleanPath = pathOrUrl.split("?")[0].split("#")[0].trim();
  const normalizedPath = cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`;
  const trimmedPath = normalizedPath === "/" ? "" : normalizedPath.replace(/\/+$/, "");

  return `${SEO_CONSTANTS.baseUrl}${trimmedPath}`;
}

/**
 * Strips HTML tags, collapses whitespace, and limits length to avoid truncation in SERPs.
 */
export function cleanSeoDescription(
  text?: string | null,
  maxLength = 160
): string {
  if (!text) return SEO_CONSTANTS.defaultDescription;

  // Strip HTML tags if any
  const withoutHtml = text.replace(/<[^>]*>/g, " ");
  // Collapse duplicate whitespace and newlines
  const singleLine = withoutHtml.replace(/\s+/g, " ").trim();

  if (singleLine.length <= maxLength) {
    return singleLine;
  }

  // Truncate at word boundary
  const truncated = singleLine.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return lastSpace > 100 ? `${truncated.slice(0, lastSpace)}...` : `${truncated}...`;
}

/**
 * Safely serializes JSON-LD structured data to prevent script injection (XSS).
 * Escapes characters such as `<` and `>` so `</script>` cannot prematurely close tags.
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * Builds Schema.org Organization structured data.
 */
export function buildOrganizationJsonLd(props?: OrganizationJsonLdProps) {
  const url = props?.url ? resolveCanonicalUrl(props.url) : SEO_CONSTANTS.baseUrl;
  const logo = props?.logo || `${SEO_CONSTANTS.baseUrl}${SEO_CONSTANTS.defaultOgImage}`;

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: props?.name || SEO_CONSTANTS.siteName,
    url,
    logo,
    ...(props?.contactPoint && {
      contactPoint: {
        "@type": "ContactPoint",
        telephone: props.contactPoint.telephone,
        contactType: props.contactPoint.contactType || "customer support",
        areaServed: props.contactPoint.areaServed || "IN",
      },
    }),
    ...(props?.sameAs && props.sameAs.length > 0 && { sameAs: props.sameAs }),
  };
}

/**
 * Builds Schema.org WebSite structured data with SearchAction.
 */
export function buildWebSiteJsonLd(props?: WebSiteJsonLdProps) {
  const url = props?.url ? resolveCanonicalUrl(props.url) : SEO_CONSTANTS.baseUrl;
  const searchTarget =
    props?.potentialAction?.searchTargetUrl ||
    `${SEO_CONSTANTS.baseUrl}/products?search={search_term_string}`;

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: props?.name || SEO_CONSTANTS.siteName,
    url,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: searchTarget,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * Builds Schema.org Product structured data from actual product information.
 * Does not emit false ratings or unsupported attributes.
 */
export function buildProductJsonLd(props: ProductJsonLdProps) {
  const images = Array.isArray(props.image)
    ? props.image.filter(Boolean)
    : props.image
      ? [props.image]
      : undefined;

  let offers: Record<string, unknown> | undefined;

  if (props.offers) {
    const currency = props.offers.priceCurrency || SEO_CONSTANTS.currency;
    const availabilityUrl =
      props.offers.availability === "OutOfStock"
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock";

    if (
      props.offers.lowPrice !== undefined &&
      props.offers.highPrice !== undefined
    ) {
      offers = {
        "@type": "AggregateOffer",
        priceCurrency: currency,
        lowPrice: Number(props.offers.lowPrice),
        highPrice: Number(props.offers.highPrice),
        offerCount: props.offers.offerCount || 1,
        availability: availabilityUrl,
        ...(props.offers.url && { url: resolveCanonicalUrl(props.offers.url) }),
      };
    } else if (props.offers.price !== undefined) {
      offers = {
        "@type": "Offer",
        priceCurrency: currency,
        price: Number(props.offers.price),
        availability: availabilityUrl,
        ...(props.offers.url && { url: resolveCanonicalUrl(props.offers.url) }),
      };
    }
  }

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: props.name,
    ...(props.description && {
      description: cleanSeoDescription(props.description, 300),
    }),
    ...(images && images.length > 0 && { image: images }),
    ...(props.sku && { sku: props.sku }),
    ...(props.brand && {
      brand: {
        "@type": "Brand",
        name: props.brand,
      },
    }),
    ...(props.category && { category: props.category }),
    ...(props.url && { url: resolveCanonicalUrl(props.url) }),
    ...(offers && { offers }),
  };
}

/**
 * Builds Schema.org BreadcrumbList structured data.
 */
export function buildBreadcrumbJsonLd(props: BreadcrumbJsonLdProps) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: props.items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: resolveCanonicalUrl(item.item),
    })),
  };
}

/**
 * Looks up existing page-specific SEO overrides from the `seo_meta` table if available.
 * Cached per request using React cache() to avoid duplicate database lookups.
 */
export const getEntitySeoMetaByUuid = cache(
  async (
    entityType: "item" | "style" | "category" | "product",
    uuid: string
  ): Promise<SeoEntityMeta | null> => {
    try {
      let internalId: bigint | null = null;
      if (entityType === "item") {
        const row = await db.item.findFirst({
          where: { uuid, deleted_at: null },
          select: { id: true },
        });
        internalId = row?.id ?? null;
      } else if (entityType === "style") {
        const row = await db.style.findFirst({
          where: { uuid, deleted_at: null },
          select: { id: true },
        });
        internalId = row?.id ?? null;
      } else if (entityType === "category") {
        const row = await db.productCategory.findFirst({
          where: {
            OR: [{ uuid }, { slug: uuid }],
            deleted_at: null,
          },
          select: { id: true },
        });
        internalId = row?.id ?? null;
      } else if (entityType === "product") {
        const row = await db.product.findFirst({
          where: { uuid },
          select: { id: true },
        });
        internalId = row?.id ?? null;
      }

      if (!internalId) return null;

      const record = await db.seo_meta.findFirst({
        where: {
          entity_type: entityType,
          entity_id: internalId,
          is_active: true,
        },
        select: {
          meta_title: true,
          meta_description: true,
          og_image: true,
          meta_keywords: true,
        },
      });

      return record;
    } catch {
      return null;
    }
  }
);
