import type { Metadata } from "next";
import { constructMetadata } from "@/lib/seo";

export const metadata: Metadata = constructMetadata({
  title: "All Products",
  description:
    "Explore our complete collection of designer dresses, luxury timepieces, handcrafted leather bags, and contemporary fashion.",
  canonicalUrl: "/products",
});

export default function ProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
