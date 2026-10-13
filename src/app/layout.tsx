import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/providers";
import { NumberInputZeroSelect } from "@/components/ui/number-input-zero-select";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const hanken = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-hanken",
});

export const metadata: Metadata = {
  title: "Zellora — Luxury Fashion, Watches & Lifestyle",
  description: "Discover designer dresses, luxury timepieces, handcrafted leather bags, and contemporary fashion at Zellora. Timeless elegance delivered to your doorstep.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
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

