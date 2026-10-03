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
  console.log("🧹 CLEARING STORE CATALOG, PRODUCTS & SEED DATA");
  console.log("=================================================\n");

  // Disable FK checks during clear to prevent foreign key constraint violations
  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0;");

  const tablesToClear = [
    // 1. Orders & Returns (if any test orders exist referencing products)
    "return_items",
    "return_requests",
    "shipment_tracking",
    "shipments",
    "order_items",
    "order_addresses",
    "order_status_history",
    "payment_transactions",
    "payments",
    "orders",

    // 2. Reviews & Carts & Wishlist
    "review_images",
    "reviews",
    "cart_items",
    "carts",
    "wishlist_items",

    // 3. Inventory & Stock
    "stock_adjustments",
    "stock_reports",
    "inventory_transactions",
    "inventory_reservations",
    "inventories",

    // 4. Variants, Items, Styles & Unit Prices
    "variant_price_history",
    "variant_attribute_values",
    "item_attribute_values",
    "variant_unit_prices",
    "product_variant_images",
    "product_variants",
    "items",
    "style_images",
    "styles",

    // 5. Products & Configs
    "product_images",
    "product_attribute_configs",
    "product_attribute_values",
    "product_tag_maps",
    "combo_product_items",
    "offer_products",
    "coupon_products",
    "products",
    "size_charts",

    // 6. Categories & Header Menu
    "header_menu_item_categories",
    "header_menu_items",
    "category_attributes",
    "product_category_images",
    "product_categories",

    // 7. Attributes, Colors & Values
    "attribute_value_dependencies",
    "attribute_values",
    "product_attributes",

    // 8. Brands & Units
    "produt_brand_images",
    "product_brands",
    "product_units",

    // 9. Banners & Offers & Coupons
    "banners",
    "banner_positions",
    "coupons",
    "offers",
  ];

  for (const table of tablesToClear) {
    try {
      if (table === "product_units") {
        await prisma.$executeRawUnsafe("UPDATE `product_units` SET `base_unit_id` = NULL;");
      }
      if (table === "product_categories") {
        await prisma.$executeRawUnsafe("UPDATE `product_categories` SET `parent_id` = NULL;");
      }
      await prisma.$executeRawUnsafe(`DELETE FROM \`${table}\`;`);
      console.log(`✓ Cleared table: ${table}`);
    } catch (e: any) {
      console.warn(`! Note on clearing ${table}: ${e.message}`);
    }
  }

  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1;");

  console.log("\n=================================================");
  console.log("✨ ALL CATALOG, PRODUCT, CATEGORY & MENU DATA CLEARED!");
  console.log("ℹ️  User accounts, roles, and permissions were preserved.");
  console.log("=================================================\n");
}

main()
  .catch((e) => {
    console.error("Error clearing database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
