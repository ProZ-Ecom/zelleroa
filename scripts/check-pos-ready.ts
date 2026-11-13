/**
 * Read-only check that a database can run the counter.
 *
 *   npm run db:check:pos
 *
 * Changes nothing. It exists because `npm run db:push` swallows the errors it
 * hits when adding a unique key (scripts/db-sync.cjs ignores them to stay
 * re-runnable), so a database can report a clean sync and still be missing the
 * index that stops two cashiers sharing a bill number.
 */
import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { ALL_PERMISSIONS } from "../src/lib/permissions/catalog.ts";

function createClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");
  const url = new URL(databaseUrl);
  return {
    database: url.pathname.slice(1),
    host: url.hostname,
    prisma: new PrismaClient({
      adapter: new PrismaMariaDb({
        host: url.hostname,
        port: Number(url.port || 3306),
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1),
        connectionLimit: 5,
        allowPublicKeyRetrieval: true,
      }),
    }),
  };
}

const ok = (label: string) => console.log(`  OK    ${label}`);
const bad = (label: string, fix: string) => {
  console.log(`  MISS  ${label}`);
  console.log(`        -> ${fix}`);
  return 1;
};

async function main() {
  const { prisma, database, host } = createClient();
  let problems = 0;

  try {
    console.log(`Checking \`${database}\` on ${host}\n`);

    // 1. The three POS tables.
    const tables = await prisma.$queryRaw<{ TABLE_NAME: string }[]>`
      SELECT TABLE_NAME FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('pos_stores', 'pos_sessions', 'pos_invoice_counters')
    `;
    const present = new Set(tables.map((t) => t.TABLE_NAME));
    for (const name of ["pos_stores", "pos_sessions", "pos_invoice_counters"]) {
      if (present.has(name)) ok(`table ${name}`);
      else problems += bad(`table ${name}`, "npm run db:push");
    }

    // 2. The two columns that tie an order to a counter and a shift.
    const columns = await prisma.$queryRaw<{ COLUMN_NAME: string }[]>`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'
        AND COLUMN_NAME IN ('store_id', 'pos_session_id')
    `;
    const cols = new Set(columns.map((c) => c.COLUMN_NAME));
    for (const name of ["store_id", "pos_session_id"]) {
      if (cols.has(name)) ok(`orders.${name}`);
      else problems += bad(`orders.${name}`, "npm run db:push");
    }

    // 3. POS in the order_source enum, or every counter bill is rejected.
    const source = await prisma.$queryRaw<{ COLUMN_TYPE: string }[]>`
      SELECT COLUMN_TYPE FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'
        AND COLUMN_NAME = 'order_source'
    `;
    if (source[0]?.COLUMN_TYPE?.includes("'POS'")) ok("order_source accepts POS");
    else problems += bad("order_source accepts POS", "npm run db:push");

    // 4. The unique index on the bill number. This is the one db:push can
    //    silently skip, and it does so exactly when duplicates already exist.
    const index = await prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*) AS c FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'
        AND INDEX_NAME = 'uq_orders_invoice_number'
    `;
    if (Number(index[0]?.c ?? 0) > 0) {
      ok("unique index on orders.invoice_number");
    } else {
      const dupes = await prisma.$queryRaw<{ invoice_number: string; c: bigint }[]>`
        SELECT invoice_number, COUNT(*) AS c FROM orders
        WHERE invoice_number IS NOT NULL
        GROUP BY invoice_number HAVING c > 1
      `;
      problems += bad(
        "unique index on orders.invoice_number",
        dupes.length > 0
          ? `clear ${dupes.length} duplicate invoice_number value(s) first, then npm run db:push`
          : "npm run db:push"
      );
      for (const row of dupes) {
        console.log(`        duplicate: ${row.invoice_number} x${Number(row.c)}`);
      }
    }

    // 5. The POS permission rows. Without POS_VIEW the API answers 403 and the
    //    counter screen never loads, which looks identical to a missing table.
    const posSlugs = ALL_PERMISSIONS.filter(
      (p) => p.module === "POS" || p.module === "POS_STORE"
    ).map((p) => p.slug);
    const granted = await prisma.permission.findMany({
      where: { slug: { in: posSlugs } },
      select: { slug: true },
    });
    if (granted.length === posSlugs.length) {
      ok(`${posSlugs.length} POS permissions in the permissions table`);
    } else {
      problems += bad(
        `POS permissions (${granted.length} of ${posSlugs.length} present)`,
        "npm run db:permissions:sync"
      );
    }

    // 6. Which roles can actually reach the counter.
    //
    //    `admin` is an owner slug (src/lib/permissions/server.ts), and an owner
    //    bypasses every permission check - so a missing grant there is not what
    //    keeps an admin off the screen. Any other role is checked for real, so
    //    a cashier on a STAFF role without POS_VIEW gets a 403 and a screen
    //    that never loads.
    const roles = await prisma.role.findMany({
      where: { is_active: true },
      select: {
        slug: true,
        name: true,
        rolePermissions: {
          where: { permission: { slug: "POS_VIEW" } },
          select: { id: true },
        },
      },
    });
    const owners = ["admin", "super-admin", "super_admin"];
    const billing = roles.filter((r) => !owners.includes(r.slug.toLowerCase()));
    const without = billing.filter((r) => r.rolePermissions.length === 0);

    if (roles.length === 0) {
      problems += bad("any role at all", "npm run db:seed:basic");
    } else if (billing.length === 0) {
      ok("only owner roles exist; they bypass permission checks");
    } else if (without.length === 0) {
      ok(`${billing.length} non-owner role(s) hold POS_VIEW`);
    } else {
      console.log(
        `  NOTE  ${without.length} non-owner role(s) cannot open the counter: ${without
          .map((r) => r.name)
          .join(", ")}`
      );
      console.log("        -> grant POS_VIEW under Roles, or npm run db:permissions:sync");
    }

    console.log(
      problems === 0
        ? "\nReady. Run npx prisma generate and restart the dev server if you have not."
        : `\n${problems} thing(s) to fix. Re-run this check afterwards.`
    );
    process.exitCode = problems === 0 ? 0 : 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
