import type { Metadata } from "next";
import { constructMetadata } from "@/lib/seo";

export const metadata: Metadata = constructMetadata({
  title: "My Wishlist",
  description: "View and manage your saved luxury fashion items and styles.",
  canonicalUrl: "/wishlist",
  noIndex: true,
});

export default function WishlistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
