import type { MetadataRoute } from "next";
import { SEO_CONSTANTS } from "@/lib/seo/seo.constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/agent",
          "/agent/",
          "/cart",
          "/checkout",
          "/checkout/",
          "/account",
          "/account/",
          "/profile",
          "/orders",
          "/orders/",
          "/wishlist",
          "/invoice",
          "/invoice/",
          "/document",
          "/document/",
          "/api",
          "/api/",
          "/login",
          "/register",
          "/forgot-password",
          "/reset-password",
          "/verify-otp",
          "/verify-forgot-password-otp",
          "/verify-registration-otp",
          "/unauthorized",
          "/search",
        ],
      },
    ],
    sitemap: `${SEO_CONSTANTS.baseUrl}/sitemap.xml`,
  };
}
