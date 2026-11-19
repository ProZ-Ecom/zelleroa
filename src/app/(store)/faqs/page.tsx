import type { Metadata } from "next";
import { FaqSection } from "@/components/storefront/faq";
import { constructMetadata } from "@/lib/seo";

export const metadata: Metadata = constructMetadata({
  title: "Frequently Asked Questions",
  description:
    "Answers to common questions about delivery, size guide, fabric care, packaging, bulk corporate orders, returns and exchanges at Zellora.",
  canonicalUrl: "/faqs",
});

export default function FaqPage() {
  return <FaqSection />;
}
