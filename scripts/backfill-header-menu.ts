import "dotenv/config";
import crypto from "crypto";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

/**
 * One-off seed for the curated Header Menu (see HeaderMenuItem /
 * HeaderMenuItemCategory in prisma/schema.prisma): the storefront nav used to
 * be "every root category", so right after this migration the admin-curated
 * list starts empty and the header would go blank. This inserts one
 * single-category item per current root category plus the
 * previously-hardcoded "Sale" link, matching today's on-screen order, so the
 * storefront keeps working until an admin edits it from
 * /admin/dashboard/header-menu.
 *
 * Safe to re-run: skips categories that already have a header menu item.
 *
 *   node --experimental-strip-types scripts/backfill-header-menu.ts
 *
 * Pass --dry to print what would be inserted without writing.
 */

const DRY = process.argv.includes("--dry");

function createClient() {
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
    connectionLimit: 5,
    allowPublicKeyRetrieval: true,
  });
  return new PrismaClient({ adapter });
}

const db = createClient();

async function run() {
  const rootCategories = await db.productCategory.findMany({
    where: { parentId: null, isActive: true, deleted_at: null },
    select: { id: true, name: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  });

  const existing = await db.headerMenuItem.findMany({
    where: { deleted_at: null },
    select: { link: true, categories: { select: { categoryId: true } } },
  });
  const existingCategoryIds = new Set(
    existing.flatMap((e) => e.categories.map((c) => c.categoryId.toString()))
  );
  const hasSaleLink = existing.some((e) => e.link === "/products?sortBy=discount");

  let inserted = 0;

  for (const category of rootCategories) {
    if (existingCategoryIds.has(category.id.toString())) continue;

    if (DRY) {
      console.log(`  would insert category item: ${category.name} (sortOrder ${category.sortOrder})`);
    } else {
      await db.headerMenuItem.create({
        data: {
          uuid: crypto.randomUUID(),
          label: category.name,
          sortOrder: category.sortOrder,
          isActive: true,
          categories: { create: [{ categoryId: category.id, sortOrder: 0 }] },
        },
      });
    }
    inserted += 1;
  }

  if (!hasSaleLink) {
    if (DRY) {
      console.log(`  would insert custom link item: Sale (/products?sortBy=discount)`);
    } else {
      await db.headerMenuItem.create({
        data: {
          uuid: crypto.randomUUID(),
          label: "Sale",
          link: "/products?sortBy=discount",
          sortOrder: rootCategories.length,
          isActive: true,
        },
      });
    }
    inserted += 1;
  }

  console.log(
    DRY
      ? `\nDry run: ${inserted} header menu item(s) would be inserted. Re-run without --dry to apply.`
      : `\nDone: ${inserted} header menu item(s) inserted.`
  );
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
