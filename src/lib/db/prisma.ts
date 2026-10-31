import { PrismaClient } from "@/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const url = new URL(databaseUrl);
  const adapter = new PrismaMariaDb({
    host: url.hostname === "localhost" ? "127.0.0.1" : url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    connectionLimit: 10,
    allowPublicKeyRetrieval: true,
    timezone: "Z",
  });

  // Cart/checkout transactions run many sequential queries (stock reservation,
// pricing, totals); the 5s default expires under normal DB latency.
  return new PrismaClient({
    adapter,
    transactionOptions: { maxWait: 10_000, timeout: 30_000 },
  });
}

// Ensure stale dev client instance is refreshed when Prisma models change
if (process.env.NODE_ENV !== "production" && globalForPrisma.prisma) {
  try {
    const fields = (globalForPrisma.prisma as any)?._runtimeDataModel?.models?.Order?.fields;
    if (fields && !fields.some((f: any) => f.name === "invoice_number")) {
      globalForPrisma.prisma = undefined;
    }
  } catch {
    globalForPrisma.prisma = undefined;
  }
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

