import type { MetadataRoute } from "next";
import { SEO_CONSTANTS } from "@/lib/seo/seo.constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SEO_CONSTANTS.siteName} — Luxury Fashion, Watches & Lifestyle`,
    short_name: SEO_CONSTANTS.siteName,
    description: SEO_CONSTANTS.defaultDescription,
    start_url: "/",
    scope: "/",
    id: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    categories: ["shopping", "lifestyle", "fashion"],
    lang: "en",
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    shortcuts: [
      {
        name: "Shop Collections",
        short_name: "Shop",
        description: "Browse designer dresses and fashion collections",
        url: "/category",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }],
      },
      {
        name: "My Cart",
        short_name: "Cart",
        description: "View items in your shopping bag",
        url: "/cart",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }],
      },
      {
        name: "Wishlist",
        short_name: "Wishlist",
        description: "View your saved luxury items",
        url: "/wishlist",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }],
      },
      {
        name: "My Account",
        short_name: "Account",
        description: "Manage orders and account settings",
        url: "/account",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }],
      },
    ],
  };
}
