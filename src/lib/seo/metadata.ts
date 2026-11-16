import type { Metadata } from "next";
import { SEO_CONSTANTS } from "./seo.constants";
import { cleanSeoDescription, resolveCanonicalUrl } from "./seo.helper";
import type { ConstructMetadataInput, OpenGraphImageInput } from "./seo.types";

/**
 * Centralized metadata generator for Next.js App Router.
 * Produces complete, consistent, and validated Metadata objects across all pages.
 */
export function constructMetadata({
  title,
  description,
  canonicalUrl,
  image,
  noIndex = false,
  keywords,
  type = "website",
  publishedTime,
  modifiedTime,
  authors,
  extraMeta = {},
}: ConstructMetadataInput = {}): Metadata {
  const metaDescription = cleanSeoDescription(
    description,
    160
  );

  const resolvedCanonical = canonicalUrl ? resolveCanonicalUrl(canonicalUrl) : undefined;

  // Resolve OpenGraph image
  let ogImage: OpenGraphImageInput;
  if (!image) {
    ogImage = {
      url: `${SEO_CONSTANTS.baseUrl}${SEO_CONSTANTS.defaultOgImage}`,
      width: 1200,
      height: 630,
      alt: title || SEO_CONSTANTS.siteName,
    };
  } else if (typeof image === "string") {
    const isAbsolute = image.startsWith("http://") || image.startsWith("https://");
    ogImage = {
      url: isAbsolute ? image : `${SEO_CONSTANTS.baseUrl}${image.startsWith("/") ? "" : "/"}${image}`,
      width: 1200,
      height: 630,
      alt: title || SEO_CONSTANTS.siteName,
    };
  } else {
    const isAbsolute =
      image.url.startsWith("http://") || image.url.startsWith("https://");
    ogImage = {
      ...image,
      url: isAbsolute
        ? image.url
        : `${SEO_CONSTANTS.baseUrl}${image.url.startsWith("/") ? "" : "/"}${image.url}`,
    };
  }

  const baseMetadata: Metadata = {
    title: title ? title : SEO_CONSTANTS.defaultTitle,
    description: metaDescription,
    applicationName: SEO_CONSTANTS.siteName,
    ...(keywords && {
      keywords: Array.isArray(keywords) ? keywords : keywords.split(",").map((k) => k.trim()),
    }),
    ...(resolvedCanonical && {
      alternates: {
        canonical: resolvedCanonical,
      },
    }),
    openGraph: {
      title: title ? `${title} | ${SEO_CONSTANTS.siteName}` : SEO_CONSTANTS.defaultTitle,
      description: metaDescription,
      url: resolvedCanonical || SEO_CONSTANTS.baseUrl,
      siteName: SEO_CONSTANTS.siteName,
      locale: SEO_CONSTANTS.locale,
      type,
      images: [ogImage],
      ...(publishedTime && { publishedTime }),
      ...(modifiedTime && { modifiedTime }),
      ...(authors && { authors }),
    },
    twitter: {
      card: "summary_large_image",
      title: title ? `${title} | ${SEO_CONSTANTS.siteName}` : SEO_CONSTANTS.defaultTitle,
      description: metaDescription,
      images: [ogImage.url],
      creator: SEO_CONSTANTS.twitterHandle,
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
          nocache: true,
          googleBot: {
            index: false,
            follow: false,
            noimageindex: true,
          },
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1,
          },
        },
    ...extraMeta,
  };

  return baseMetadata;
}
