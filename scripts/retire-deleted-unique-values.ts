import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { retireUniqueValue } from "../src/lib/utils/retire-unique-value.ts";

/**
 * One-off backfill for rows that were soft-deleted BEFORE the repositories
 * started releasing their unique values on delete.
 *
 * Slug/SKU/code columns carry a global UNIQUE index that ignores deleted_at, so
 * each of those archived rows still reserves its value: the admin screens pass
 * their own duplicate check (which skips deleted rows) and the insert then dies
 * on a P2002 - "A record with the same value already exists". Renaming the
 * archived values here clears the backlog; new deletes handle themselves.
 *
 * Safe to re-run: values that already carry the marker are skipped.
 *
 *   node --experimental-strip-types scripts/retire-deleted-unique-values.ts
 *
 * Pass --dry to print what would change without writing.
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

function retired(value: string) {
  return value.includes("-deleted-") || value.startsWith("~");
}

async function run() {
  let total = 0;

  type ArchivedRow = { id: bigint } & Record<string, unknown>;

  async function retire(
    label: string,
    rows: ArchivedRow[],
    fields: { name: string; max: number }[],
    update: (id: bigint, data: Record<string, string>) => Promise<unknown>
  ) {
    let touched = 0;

    for (const row of rows) {
      const data: Record<string, string> = {};

      for (const field of fields) {
        const current = row[field.name];
        if (typeof current !== "string" || retired(current)) continue;
        data[field.name] = retireUniqueValue(current, row.id, field.max);
      }

      if (Object.keys(data).length === 0) continue;
      touched += 1;
      if (DRY) {
        console.log(`  ${label} #${row.id}:`, data);
      } else {
        await update(row.id, data);
      }
    }

    total += touched;
    console.log(`${label}: ${touched} of ${rows.length} archived row(s) released`);
  }

  const deleted = { deleted_at: { not: null } };
  const inactive = { is_active: false };

  await retire(
    "products",
    await db.product.findMany({ where: deleted, select: { id: true, slug: true } }),
    [{ name: "slug", max: 220 }],
    (id, data) => db.product.update({ where: { id }, data })
  );

  await retire(
    "styles",
    await db.style.findMany({ where: deleted, select: { id: true, slug: true, sku: true } }),
    [
      { name: "slug", max: 220 },
      { name: "sku", max: 100 },
    ],
    (id, data) => db.style.update({ where: { id }, data })
  );

  await retire(
    "items",
    await db.item.findMany({ where: deleted, select: { id: true, slug: true, sku: true } }),
    [
      { name: "slug", max: 220 },
      { name: "sku", max: 100 },
    ],
    (id, data) => db.item.update({ where: { id }, data })
  );

  await retire(
    "product_variants",
    await db.productVariant.findMany({ where: deleted, select: { id: true, slug: true } }),
    [{ name: "slug", max: 255 }],
    (id, data) => db.productVariant.update({ where: { id }, data })
  );

  await retire(
    "variant_unit_prices",
    await db.variantUnitPrice.findMany({ where: deleted, select: { id: true, sku: true } }),
    [{ name: "sku", max: 100 }],
    (id, data) => db.variantUnitPrice.update({ where: { id }, data })
  );

  await retire(
    "product_categories",
    await db.productCategory.findMany({ where: deleted, select: { id: true, slug: true } }),
    [{ name: "slug", max: 170 }],
    (id, data) => db.productCategory.update({ where: { id }, data })
  );

  await retire(
    "product_brands",
    await db.productBrand.findMany({ where: deleted, select: { id: true, slug: true } }),
    [{ name: "slug", max: 170 }],
    (id, data) => db.productBrand.update({ where: { id }, data })
  );

  await retire(
    "product_attributes",
    await db.productAttribute.findMany({ where: inactive, select: { id: true, slug: true } }),
    [{ name: "slug", max: 120 }],
    (id, data) => db.productAttribute.update({ where: { id }, data })
  );

  await retire(
    "product_units",
    await db.product_units.findMany({ where: inactive, select: { id: true, code: true } }),
    [{ name: "code", max: 10 }],
    (id, data) => db.product_units.update({ where: { id }, data })
  );

  await retire(
    "product_hsn_codes",
    await db.product_hsn_codes.findMany({ where: inactive, select: { id: true, code: true } }),
    [{ name: "code", max: 20 }],
    (id, data) => db.product_hsn_codes.update({ where: { id }, data })
  );

  console.log(
    DRY
      ? `\nDry run: ${total} row(s) would be updated. Re-run without --dry to apply.`
      : `\nDone: ${total} row(s) updated.`
  );
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
