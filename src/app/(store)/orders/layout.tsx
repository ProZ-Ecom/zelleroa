import type { Metadata } from "next";
import { constructMetadata } from "@/lib/seo";

export const metadata: Metadata = constructMetadata({
  title: "My Orders",
  description: "View your order history, statuses, and track deliveries.",
  canonicalUrl: "/orders",
  noIndex: true,
});

export default function OrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
