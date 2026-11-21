import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

function createClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set in .env");
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

const prisma = createClient();

async function main() {
  console.log("=================================================");
  console.log("🧹 CLEARING PRODUCTS, MODELS (STYLES) & VARIANTS DATA");
  console.log("=================================================\n");

  const tablesToClear = [
    // 1. Orders, returns & replacements referencing variants/products
    "return_items",
    "return_requests",
    "return_request_history",
    "replacement_request_items",
    "replacement_requests",
    "replacement_request_history",
    "shipment_tracking",
    "shipments",
    "order_items",
    "order_addresses",
    "order_status_history",
    "payment_transactions",
    "payments",
    "commissions",
    "orders",

    // 2. Carts & Wishlist referencing products/variants
    "cart_items",
    "wishlist_items",
    "recently_viewed_products",
    "review_images",
    "reviews",

    // 3. Inventory & Stock referencing variants
    "stock_adjustments",
    "stock_reports",
    "inventory_transactions",
    "inventory_reservations",
    "inventories",

    // 4. Variant details & pricing
    "variant_price_history",
    "variant_unit_price_attribute_values",
    "variant_unit_prices",
    "variant_attribute_values",
    "product_variant_images",
    "product_variants",

    // 5. Models (Styles) & attributes
    "style_images",
    "style_attribute_values",
    "styles",

    // 6. Products, mappings & configs
    "product_images",
    "product_attribute_configs",
    "product_attribute_values",
    "product_tag_maps",
    "product_questions",
    "combo_product_items",
    "offer_products",
    "coupon_products",
    "products",
  ];

  // Execute in a single transaction with FK checks disabled on the same connection
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0;");

      for (const table of tablesToClear) {
        try {
          await tx.$executeRawUnsafe(`DELETE FROM \`${table}\`;`);
          console.log(`✓ Cleared table: ${table}`);
        } catch (e: any) {
          console.warn(`! Note on clearing ${table}: ${e.message}`);
        }
      }

      await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1;");
    },
    { maxWait: 20000, timeout: 60000 }
  );

  console.log("\n=================================================");
  console.log("✨ ALL PRODUCTS, MODELS & VARIANTS DATA CLEARED SUCCESSFULLY!");
  console.log("ℹ️  Categories, Brands, Attributes, Users, Roles & Settings were PRESERVED.");
  console.log("=================================================\n");
}

main()
  .catch((e) => {
    console.error("Error clearing product data:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
