import type { Metadata } from "next";
import { constructMetadata } from "@/lib/seo";

export const metadata: Metadata = constructMetadata({
  title: "My Account",
  description: "Manage your personal profile, addresses, and orders at Zellora.",
  canonicalUrl: "/account/dashboard",
  noIndex: true,
});

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
