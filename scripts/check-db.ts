import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

function createClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");
  const url = new URL(databaseUrl);
  const adapter = new PrismaMariaDb({
    host: url.hostname === "localhost" ? "127.0.0.1" : url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    connectionLimit: 2,
    allowPublicKeyRetrieval: true,
  });
  return new PrismaClient({ adapter });
}

const prisma = createClient();

async function main() {
  const [products, styles, items] = await Promise.all([
    prisma.product.findMany({ select: { id: true, uuid: true, name: true, deleted_at: true, isActive: true } }),
    prisma.style.findMany({ select: { id: true, uuid: true, name: true, productId: true, deleted_at: true, isActive: true } }),
    prisma.item.findMany({ select: { id: true, uuid: true, name: true, styleId: true, deleted_at: true, isActive: true } }),
  ]);
  console.log("DB State:", JSON.stringify({ products, styles, items }, (_, v) => typeof v === "bigint" ? v.toString() : v, 2));
}

main().finally(() => prisma.$disconnect());
