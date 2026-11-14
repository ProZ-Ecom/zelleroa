import type { Metadata } from "next";
import {
  AboutHeroSection,
  AboutOurStorySection,
  AboutFounderSection,
  AboutMarquee,
} from "@/components/storefront/about";
import { constructMetadata } from "@/lib/seo";

export const metadata: Metadata = constructMetadata({
  title: "About Us",
  description:
    "ZELLORA INDIA is an online-based fashion business bringing fashion products to customers through a convenient online shopping experience and our Sales Partner network.",
  canonicalUrl: "/about",
});

export default function AboutPage() {
  return (
    <div className="w-full">
      {/* 1. Hero: Welcome to ZELLORA INDIA */}
      <AboutHeroSection />

      {/* Highlights ribbon */}
      <AboutMarquee />

      {/* 2. Our Business: Sales Partner model */}
      <AboutOurStorySection />

      {/* 3. Our Commitment + Thank You */}
      <AboutFounderSection />
    </div>
  );
}
