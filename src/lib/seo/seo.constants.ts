/**
 * Centralized SEO Configuration Constants for Zellora.
 */

export const SEO_CONSTANTS = {
  siteName: "Zellora",
  defaultTitle: "Zellora — Luxury Fashion, Watches & Lifestyle",
  titleTemplate: "%s | Zellora",
  defaultDescription:
    "Discover designer dresses, luxury timepieces, handcrafted leather bags, and contemporary fashion at Zellora. Timeless elegance delivered to your doorstep.",
  defaultOgImage: "/logo.png",
  twitterHandle: "@zellora",
  baseUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  locale: "en_IN",
  currency: "INR",
} as const;
