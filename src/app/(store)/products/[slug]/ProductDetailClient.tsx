"use client";

import { StyleDetailClient } from "../../styles/[slug]/StyleDetailClient";

/**
 * `slug` is the Style UUID older cards link to; the Style's own page
 * (`/styles/:id`) is the product page, so this renders exactly that.
 */
export function ProductDetailClient({ slug }: { slug: string }) {
  return <StyleDetailClient slug={slug} notFoundMessage="Product not found" />;
}
