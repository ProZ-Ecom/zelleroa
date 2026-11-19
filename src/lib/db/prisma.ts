import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaModelFingerprint: string | undefined;
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

/**
 * The dev client is cached on `globalThis` so HMR reloads reuse one connection
 * pool - but that also keeps a client whose data model predates the last
 * `prisma generate`, and every query touching a new column then fails with a
 * confusing "Unknown argument". Fingerprinting every model's field list (this
 * module is re-imported after a regenerate, so `Prisma.dmmf` is always the
 * fresh one) drops the cached client whenever the schema moved, instead of
 * watching one hand-picked field.
 */
function modelFingerprint(): string {
  return Prisma.dmmf.datamodel.models
    .map((m) => `${m.name}:${m.fields.map((f) => f.name).join(",")}`)
    .join("|");
}

if (process.env.NODE_ENV !== "production" && globalForPrisma.prisma) {
  try {
    const fresh = modelFingerprint();
    if (globalForPrisma.prismaModelFingerprint !== fresh) {
      void globalForPrisma.prisma.$disconnect().catch(() => {});
      globalForPrisma.prisma = undefined;
    }
  } catch {
    globalForPrisma.prisma = undefined;
  }
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
  try {
    globalForPrisma.prismaModelFingerprint = modelFingerprint();
  } catch {
    globalForPrisma.prismaModelFingerprint = undefined;
  }
}

