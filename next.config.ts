import type { NextConfig } from "next";
import path from "path";

// Ensure Node memory allocation is 8GB across all Next.js worker threads
if (!process.env.NODE_OPTIONS?.includes("max-old-space-size")) {
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ""} --max-old-space-size=8192`.trim();
}

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(__dirname),
  // typescript: {
  //   ignoreBuildErrors: false,
  // },
  // Cache recently visited pages to avoid recompilation thrashing, while freeing inactive pages after 3 minutes
  onDemandEntries: {
    maxInactiveAge: 180 * 1000,
    pagesBufferLength: 6,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  serverExternalPackages: [
    "@prisma/adapter-mariadb",
    "mariadb",
    "@whiskeysockets/baileys",
    "pino",
    "razorpay",
  ],

  experimental: {
    // The webpack dev server restarts itself ("approaching the used memory
    // threshold") once the heap nears its limit, throwing away every compiled
    // route. Trading a little compile speed for lower peak memory avoids that.
    webpackMemoryOptimizations: true,
    optimizePackageImports: [
      "lucide-react",
      "@tanstack/react-table",
      "@tanstack/react-query",
    ],
  },

  // `next dev` uses Turbopack; the webpack() hook below only applies to
  // `next build --webpack`. Turbopack only watches files in the module graph,
  // so Baileys' writes to auth_baileys/ don't need an ignore rule here.
  turbopack: {},

  webpack: (config) => {
    // Baileys rewrites its session/key files under auth_baileys/ continuously
    // while a WhatsApp socket is connected. Without this, webpack's dev-server
    // watcher picks up every write and triggers a full page reload.
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ["**/node_modules/**", "**/auth_baileys/**"],
    };
    return config;
  },
};

export default nextConfig;
