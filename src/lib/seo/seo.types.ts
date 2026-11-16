import type { Metadata } from "next";

export interface OpenGraphImageInput {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
  type?: string;
}

export interface ConstructMetadataInput {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  image?: string | OpenGraphImageInput | null;
  noIndex?: boolean;
  keywords?: string[] | string;
  type?: "website" | "article" | "book" | "profile";
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
  extraMeta?: Partial<Metadata>;
}

export interface SeoEntityMeta {
  meta_title: string | null;
  meta_description: string | null;
  og_image: string | null;
  meta_keywords: string | null;
}

export interface OrganizationJsonLdProps {
  name?: string;
  url?: string;
  logo?: string;
  contactPoint?: {
    telephone?: string;
    contactType?: string;
    areaServed?: string;
  };
  sameAs?: string[];
}

export interface WebSiteJsonLdProps {
  name?: string;
  url?: string;
  potentialAction?: {
    searchTargetUrl?: string;
  };
}

export interface ProductJsonLdProps {
  name: string;
  description?: string;
  image?: string | string[];
  sku?: string;
  brand?: string;
  category?: string;
  url?: string;
  offers?: {
    price?: number | string;
    lowPrice?: number | string;
    highPrice?: number | string;
    offerCount?: number;
    priceCurrency?: string;
    availability?: "InStock" | "OutOfStock" | "PreOrder";
    url?: string;
  };
}

export interface BreadcrumbItem {
  name: string;
  item: string;
}

export interface BreadcrumbJsonLdProps {
  items: BreadcrumbItem[];
}
