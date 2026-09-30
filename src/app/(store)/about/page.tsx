import { Metadata } from "next";
import {
  AboutHeroSection,
  AboutOurStorySection,
  AboutFounderSection,
  AboutMarquee,
} from "@/components/storefront/about";

export const metadata: Metadata = {
  title: "About Us | ZELLORA INDIA",
  description:
    "ZELLORA INDIA is an online-based fashion business bringing fashion products to customers through a convenient online shopping experience and our Sales Partner network.",
};

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
