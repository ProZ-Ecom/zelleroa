import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/providers";
import { NumberInputZeroSelect } from "@/components/ui/number-input-zero-select";
import {
  SEO_CONSTANTS,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  safeJsonLd,
} from "@/lib/seo";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const hanken = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-hanken",
});

export const metadata: Metadata = {
  metadataBase: new URL(SEO_CONSTANTS.baseUrl),
  title: {
    default: SEO_CONSTANTS.defaultTitle,
    template: SEO_CONSTANTS.titleTemplate,
  },
  description: SEO_CONSTANTS.defaultDescription,
  applicationName: SEO_CONSTANTS.siteName,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: {
      default: SEO_CONSTANTS.defaultTitle,
      template: SEO_CONSTANTS.titleTemplate,
    },
    description: SEO_CONSTANTS.defaultDescription,
    url: SEO_CONSTANTS.baseUrl,
    siteName: SEO_CONSTANTS.siteName,
    locale: SEO_CONSTANTS.locale,
    type: "website",
    images: [
      {
        url: `${SEO_CONSTANTS.baseUrl}${SEO_CONSTANTS.defaultOgImage}`,
        width: 1200,
        height: 630,
        alt: SEO_CONSTANTS.siteName,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: {
      default: SEO_CONSTANTS.defaultTitle,
      template: SEO_CONSTANTS.titleTemplate,
    },
    description: SEO_CONSTANTS.defaultDescription,
    images: [`${SEO_CONSTANTS.baseUrl}${SEO_CONSTANTS.defaultOgImage}`],
    creator: SEO_CONSTANTS.twitterHandle,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const organizationJsonLd = buildOrganizationJsonLd();
  const webSiteJsonLd = buildWebSiteJsonLd();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(webSiteJsonLd) }}
        />
      </head>
      <body
        suppressHydrationWarning
        className={`${inter.className} ${inter.variable} ${hanken.variable}`}
      >
        <NumberInputZeroSelect />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
