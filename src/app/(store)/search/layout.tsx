import type { Metadata } from "next";
import { constructMetadata } from "@/lib/seo";

export const metadata: Metadata = constructMetadata({
  title: "Search Products",
  description: "Search luxury dresses, fashion items, and accessories across Zellora.",
  canonicalUrl: "/search",
  noIndex: true,
});

export default function SearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
