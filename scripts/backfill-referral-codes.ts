import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { backfillAgentReferralCodes } from "../src/lib/referral/backfill";

// Usage: npm run db:backfill-referral-codes [-- --dry-run]
const url = new URL(process.env.DATABASE_URL ?? "");
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: url.hostname === "localhost" ? "127.0.0.1" : url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    connectionLimit: 2,
    allowPublicKeyRetrieval: true,
  }),
});

const dryRun = process.argv.includes("--dry-run");

const result = await backfillAgentReferralCodes(
  {
    async agents(afterId, limit) {
      const rows = await prisma.user.findMany({
        where: { id: { gt: afterId }, role: { slug: "agent" } },
        orderBy: { id: "asc" },
        take: limit,
        select: { id: true, referral_code: true },
      });
      return rows.map((r) => ({ id: r.id, referralCode: r.referral_code }));
    },
    async codeExists(code) {
      return (await prisma.user.count({ where: { referral_code: code } })) > 0;
    },
    async setCode(agentId, newCode, previousCode) {
      const res = await prisma.user.updateMany({
        where: { id: agentId, referral_code: previousCode },
        data: { referral_code: newCode },
      });
      return res.count === 1;
    },
  },
  { dryRun }
);

console.log(`${dryRun ? "[dry run] " : ""}agents scanned: ${result.scanned}, ${dryRun ? "would update" : "updated"}: ${result.updated}, already had a code: ${result.skipped}`);
await prisma.$disconnect();
