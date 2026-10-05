import "dotenv/config";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

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

const prisma = createClient();

async function main() {
  console.log("=================================================");
  console.log("🚀 STARTING COMPLETE ZELLORA STORE DATABASE SEED");
  console.log("=================================================\n");

  // Disable FK checks during clear
  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0;");

  const tablesToClear = [
    "return_items",
    "return_requests",
    "shipment_tracking",
    "shipments",
    "review_images",
    "reviews",
    "order_items",
    "order_addresses",
    "order_status_history",
    "payment_transactions",
    "payments",
    "orders",
    "cart_items",
    "carts",
    "wishlist_items",
    "stock_adjustments",
    "stock_reports",
    "inventory_transactions",
    "inventory_reservations",
    "inventories",
    "variant_price_history",
    "variant_attribute_values",
    "item_attribute_values",
    "variant_unit_prices",
    "product_variant_images",
    "product_variants",
    "items",
    "style_images",
    "styles",
    "product_images",
    "product_attribute_configs",
    "product_attribute_values",
    "product_tag_maps",
    "combo_product_items",
    "offer_products",
    "coupon_products",
    "products",
    "size_charts",
    "category_attributes",
    "product_category_images",
    "header_menu_item_categories",
    "header_menu_items",
    "product_categories",
    "produt_brand_images",
    "product_brands",
    "attribute_value_dependencies",
    "attribute_values",
    "product_attributes",
    "product_units",
    "banners",
    "banner_positions",
    "coupons",
    "offers",
    "customer_addresses",
    "companies",
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
      console.warn(`! Warning on clearing ${table}: ${e.message}`);
    }
  }

  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1;");
  console.log("\nDatabase cleared successfully.\n");

  // 1. ROLES & USERS
  console.log("1. SEEDING ROLES, PERMISSIONS & USERS...");
  const adminPassword = await bcrypt.hash("admin123", 12);
  const customerPassword = await bcrypt.hash("customer123", 12);

  const getOrCreateRole = async (name: string, slug: string, description: string) => {
    let role = await prisma.role.findFirst({ where: { slug } });
    if (!role) {
      role = await prisma.role.create({
        data: { name, slug, description },
      });
    }
    return role;
  };

  const adminRole = await getOrCreateRole("ADMIN", "admin", "Administrator with full store access");
  const staffRole = await getOrCreateRole("STAFF", "staff", "Staff member with store management access");
  const customerRole = await getOrCreateRole("CUSTOMER", "customer", "Registered customer");
  const agentRole = await getOrCreateRole("AGENT", "agent", "Referral agent");

  const permissions = [
    { name: "PRODUCT_VIEW", slug: "product-view", module: "PRODUCT" },
    { name: "PRODUCT_CREATE", slug: "product-create", module: "PRODUCT" },
    { name: "PRODUCT_UPDATE", slug: "product-update", module: "PRODUCT" },
    { name: "PRODUCT_DELETE", slug: "product-delete", module: "PRODUCT" },
    { name: "CATEGORY_VIEW", slug: "category-view", module: "CATEGORY" },
    { name: "CATEGORY_CREATE", slug: "category-create", module: "CATEGORY" },
    { name: "CATEGORY_UPDATE", slug: "category-update", module: "CATEGORY" },
    { name: "CATEGORY_DELETE", slug: "category-delete", module: "CATEGORY" },
    { name: "ORDER_VIEW", slug: "order-view", module: "ORDER" },
    { name: "ORDER_UPDATE", slug: "order-update", module: "ORDER" },
    { name: "USER_VIEW", slug: "user-view", module: "USER" },
    { name: "USER_UPDATE", slug: "user-update", module: "USER" },
    { name: "INVENTORY_VIEW", slug: "inventory-view", module: "INVENTORY" },
    { name: "INVENTORY_UPDATE", slug: "inventory-update", module: "INVENTORY" },
  ];

  for (const perm of permissions) {
    let created = await prisma.permission.findFirst({ where: { slug: perm.slug } });
    if (!created) {
      created = await prisma.permission.create({ data: perm });
    }
    const existingRp = await prisma.rolePermission.findFirst({
      where: { roleId: adminRole.id, permissionId: created.id },
    });
    if (!existingRp) {
      await prisma.rolePermission.create({
        data: { roleId: adminRole.id, permissionId: created.id },
      });
    }
  }

  // Admin user
  let adminUser = await prisma.user.findFirst({ where: { email: "admin@zellora.com" } });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        uuid: crypto.randomUUID(),
        name: "Zellora Admin",
        email: "admin@zellora.com",
        password_hash: adminPassword,
        roleId: adminRole.id,
        status: "active",
        email_verified_at: new Date(),
      },
    });
  }

  // Legacy Admin user (for convenience)
  let legacyAdmin = await prisma.user.findFirst({ where: { email: "admin@rithusnacks.com" } });
  if (!legacyAdmin) {
    legacyAdmin = await prisma.user.create({
      data: {
        uuid: crypto.randomUUID(),
        name: "Admin",
        email: "admin@rithusnacks.com",
        password_hash: adminPassword,
        roleId: adminRole.id,
        status: "active",
        email_verified_at: new Date(),
      },
    });
  }

  // Staff user
  let staffUser = await prisma.user.findFirst({ where: { email: "staff@zellora.com" } });
  if (!staffUser) {
    staffUser = await prisma.user.create({
      data: {
        uuid: crypto.randomUUID(),
        name: "Staff Member",
        email: "staff@zellora.com",
        password_hash: adminPassword,
        roleId: staffRole.id,
        status: "active",
        email_verified_at: new Date(),
      },
    });
  }

  // Customers
  let customer1 = await prisma.user.findFirst({ where: { email: "customer@zellora.com" } });
  if (!customer1) {
    customer1 = await prisma.user.create({
      data: {
        uuid: crypto.randomUUID(),
        name: "Priya Sharma",
        email: "customer@zellora.com",
        phone: "9876543210",
        password_hash: customerPassword,
        roleId: customerRole.id,
        status: "active",
        email_verified_at: new Date(),
      },
    });
  }

  let customer2 = await prisma.user.findFirst({ where: { email: "customer@example.com" } });
  if (!customer2) {
    customer2 = await prisma.user.create({
      data: {
        uuid: crypto.randomUUID(),
        name: "Aarav Patel",
        email: "customer@example.com",
        phone: "9876500000",
        password_hash: customerPassword,
        roleId: customerRole.id,
        status: "active",
        email_verified_at: new Date(),
      },
    });
  }

  let customer3 = await prisma.user.findFirst({ where: { email: "customer1@example.com" } });
  if (!customer3) {
    customer3 = await prisma.user.create({
      data: {
        uuid: crypto.randomUUID(),
        name: "Neha Verma",
        email: "customer1@example.com",
        phone: "9876511111",
        password_hash: customerPassword,
        roleId: customerRole.id,
        status: "active",
        email_verified_at: new Date(),
      },
    });
  }

  console.log(`✓ Admin User: admin@zellora.com / admin123`);
  console.log(`✓ Admin User (alt): admin@rithusnacks.com / admin123`);
  console.log(`✓ Staff User: staff@zellora.com / admin123`);
  console.log(`✓ Customer User: customer@zellora.com / customer123`);
  console.log(`✓ Customer User: customer@example.com / customer123`);
  console.log(`✓ Customer User: customer1@example.com / customer123\n`);

  // 2. CUSTOMER ADDRESSES
  console.log("2. SEEDING CUSTOMER ADDRESSES...");
  await prisma.customerAddress.create({
    data: {
      uuid: crypto.randomUUID(),
      userId: customer1.id,
      label: "Home",
      addressType: "shipping",
      full_name: "Priya Sharma",
      phone: "9876543210",
      address_line1: "Flat 402, Prestige Royale, 12th Main Road",
      address_line2: "Indiranagar",
      landmark: "Near Metro Station",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560038",
      country: "India",
      isDefault: true,
      status: true,
      is_active: true,
    },
  });

  await prisma.customerAddress.create({
    data: {
      uuid: crypto.randomUUID(),
      userId: customer2.id,
      label: "Apartment",
      addressType: "shipping",
      full_name: "Aarav Patel",
      phone: "9876500000",
      address_line1: "Villa 18, Palm Meadows, Whitefield",
      address_line2: "EPIP Zone",
      landmark: "Opposite Tech Park",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560066",
      country: "India",
      isDefault: true,
      status: true,
      is_active: true,
    },
  });

  await prisma.customerAddress.create({
    data: {
      uuid: crypto.randomUUID(),
      userId: customer3.id,
      label: "Studio",
      addressType: "shipping",
      full_name: "Neha Verma",
      phone: "9876511111",
      address_line1: "B-204, Lodha Bellissimo, NM Joshi Marg",
      address_line2: "Lower Parel",
      landmark: "Near Palladium Mall",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400013",
      country: "India",
      isDefault: true,
      status: true,
      is_active: true,
    },
  });
  console.log(`✓ Created 3 customer addresses\n`);

  // 3. COMPANY PROFILE
  console.log("3. SEEDING COMPANY PROFILE...");
  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO \`companies\` (
        \`uuid\`, \`company_name\`, \`email\`, \`phone\`, \`address\`, \`city\`, \`state\`, \`country\`, \`pincode\`,
        \`gst_number\`, \`pan_number\`, \`website\`, \`is_active\`, \`created_at\`, \`updated_at\`
      ) VALUES (
        UUID(), 'Zellora Couture & Lifestyle', 'support@zellora.com', '+91 9876543210',
        '104, Boutique Boulevard, 100 Feet Road, Indiranagar', 'Bengaluru', 'Karnataka', 'India', '560038',
        '29AAAAA0000A1Z5', 'AAAAA0000A', 'https://zellora.com', 1, NOW(), NOW()
      );
    `);
    console.log(`✓ Created Zellora company profile\n`);
  } catch (e: any) {
    console.warn(`! Company notice: ${e.message}\n`);
  }

  // 4. PRODUCT UNITS
  console.log("4. SEEDING PRODUCT UNITS...");
  const createUnit = async (name: string, code: string, type: "count" | "weight" | "volume" = "count") => {
    return prisma.product_units.create({
      data: {
        uuid: crypto.randomUUID(),
        name,
        code,
        type,
        conversion_factor: 1,
        is_active: true,
        status: true,
      },
    });
  };

  const unitPiece = await createUnit("Piece", "pc", "count");
  const unitOneSize = await createUnit("One Size", "Standard", "count");
  const unitXS = await createUnit("Extra Small", "XS", "count");
  const unitS = await createUnit("Small", "S", "count");
  const unitM = await createUnit("Medium", "M", "count");
  const unitL = await createUnit("Large", "L", "count");
  const unitXL = await createUnit("Extra Large", "XL", "count");
  const unitXXL = await createUnit("Double XL", "XXL", "count");
  const unit30 = await createUnit("Waist 30", "30", "count");
  const unit32 = await createUnit("Waist 32", "32", "count");
  const unit34 = await createUnit("Waist 34", "34", "count");
  const unit36 = await createUnit("Waist 36", "36", "count");
  console.log(`✓ Created apparel & accessory size units\n`);

  // 5. BRANDS
  console.log("5. SEEDING BRANDS...");
  const brandCouture = await prisma.productBrand.create({
    data: {
      uuid: crypto.randomUUID(),
      name: "Zellora Couture",
      slug: "zellora-couture",
      description: "Signature designer dresses, gowns, and ethnic couture crafted with handpicked fabrics.",
      isActive: true,
      status: true,
    },
  });

  const brandMen = await prisma.productBrand.create({
    data: {
      uuid: crypto.randomUUID(),
      name: "Zellora Men",
      slug: "zellora-men",
      description: "Tailored Italian linen shirts, selvedge denim, and contemporary gentleman essentials.",
      isActive: true,
      status: true,
    },
  });

  const brandChrono = await prisma.productBrand.create({
    data: {
      uuid: crypto.randomUUID(),
      name: "Zellora Chrono",
      slug: "zellora-chrono",
      description: "Precision engineered luxury timepieces, automatic watches, and minimalist chronographs.",
      isActive: true,
      status: true,
    },
  });

  const brandAtelier = await prisma.productBrand.create({
    data: {
      uuid: crypto.randomUUID(),
      name: "Zellora Atelier",
      slug: "zellora-atelier",
      description: "Artisan handcrafted full-grain leather bags, clutches, and premium everyday accessories.",
      isActive: true,
      status: true,
    },
  });

  const brandFootwear = await prisma.productBrand.create({
    data: {
      uuid: crypto.randomUUID(),
      name: "Zellora Footwear",
      slug: "zellora-footwear",
      description: "Italian handcrafted leather loafers, designer stilettos, and luxury white sneakers.",
      isActive: true,
      status: true,
    },
  });

  const brandJewels = await prisma.productBrand.create({
    data: {
      uuid: crypto.randomUUID(),
      name: "Zellora Jewels",
      slug: "zellora-jewels",
      description: "18K gold-plated demi-fine jewellery, cultured pearls, and delicate diamond constellation necklaces.",
      isActive: true,
      status: true,
    },
  });
  console.log(`✓ Created 6 Zellora brands\n`);

  // 6. ATTRIBUTES & ATTRIBUTE VALUES
  console.log("6. SEEDING PRODUCT ATTRIBUTES & VALUES...");
  const attrColor = await prisma.productAttribute.create({
    data: {
      uuid: crypto.randomUUID(),
      name: "Color",
      slug: "color",
      type: "color",
      multiple_selection: true,
      is_active: true,
    },
  });

  const attrSize = await prisma.productAttribute.create({
    data: {
      uuid: crypto.randomUUID(),
      name: "Size",
      slug: "size",
      type: "text",
      multiple_selection: true,
      is_active: true,
    },
  });

  const createAttrVal = async (attrId: bigint, val: string, hex?: string) => {
    return prisma.attributeValue.create({
      data: {
        uuid: crypto.randomUUID(),
        attributeId: attrId,
        value: val,
        color_hex: hex || null,
        is_active: true,
      },
    });
  };

  const valEmerald = await createAttrVal(attrColor.id, "Emerald Green", "#097969");
  const valMidnight = await createAttrVal(attrColor.id, "Midnight Navy", "#000080");
  const valRoseGold = await createAttrVal(attrColor.id, "Rose Gold", "#B76E79");
  const valBlack = await createAttrVal(attrColor.id, "Classic Black", "#111111");
  const valWhite = await createAttrVal(attrColor.id, "Pure White", "#FFFFFF");
  const valTan = await createAttrVal(attrColor.id, "Sienna Tan", "#C19A6B");
  const valMustard = await createAttrVal(attrColor.id, "Mustard Gold", "#FFDB58");
  const valBlush = await createAttrVal(attrColor.id, "Blush Pink", "#FFB6C1");

  const valXS = await createAttrVal(attrSize.id, "XS");
  const valS = await createAttrVal(attrSize.id, "S");
  const valM = await createAttrVal(attrSize.id, "M");
  const valL = await createAttrVal(attrSize.id, "L");
  const valXL = await createAttrVal(attrSize.id, "XL");
  const valXXL = await createAttrVal(attrSize.id, "XXL");
  const val30 = await createAttrVal(attrSize.id, "30");
  const val32 = await createAttrVal(attrSize.id, "32");
  const val34 = await createAttrVal(attrSize.id, "34");
  const val36 = await createAttrVal(attrSize.id, "36");
  const valOneSize = await createAttrVal(attrSize.id, "One Size");

  console.log(`✓ Seeded Colors and Sizes attribute values\n`);

  // 7. TAXONOMY (CATEGORIES)
  console.log("7. SEEDING 11-ROOT ZELLORA CATEGORY TAXONOMY...");

  interface CategoryNode {
    name: string;
    slug: string;
    description?: string;
    image?: string;
    children?: CategoryNode[];
  }

  const TAXONOMY: CategoryNode[] = [
    {
      name: "Women",
      slug: "women",
      description: "Designer women's fashion, ethnic couture, dresses, footwear, bags, and luxury accessories.",
      image: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=800&q=80",
      children: [
        {
          name: "Clothing",
          slug: "women-clothing",
          description: "Elevated women's apparel from dresses to handloom ethnic wear.",
          children: [
            { name: "Dresses", slug: "women-dresses" },
            { name: "Tops", slug: "women-tops" },
            { name: "T-Shirts", slug: "women-t-shirts" },
            { name: "Shirts", slug: "women-shirts" },
            { name: "Jeans", slug: "women-jeans" },
            { name: "Trousers", slug: "women-trousers" },
            { name: "Skirts", slug: "women-skirts" },
            { name: "Kurtis", slug: "women-kurtis" },
            { name: "Ethnic Wear", slug: "women-ethnic-wear" },
            { name: "Sarees", slug: "women-sarees" },
            { name: "Co-ords", slug: "women-co-ords" },
          ],
        },
        {
          name: "Footwear",
          slug: "women-footwear",
          children: [
            { name: "Heels", slug: "women-heels" },
            { name: "Flats", slug: "women-flats" },
            { name: "Sneakers", slug: "women-sneakers" },
            { name: "Sandals", slug: "women-sandals" },
          ],
        },
        {
          name: "Bags",
          slug: "women-bags",
          children: [
            { name: "Handbags", slug: "women-handbags" },
            { name: "Shoulder Bags", slug: "women-shoulder-bags" },
            { name: "Sling Bags", slug: "women-sling-bags" },
            { name: "Tote Bags", slug: "women-tote-bags" },
          ],
        },
        {
          name: "Accessories",
          slug: "women-accessories",
          children: [
            { name: "Jewellery", slug: "women-jewellery" },
            { name: "Sunglasses", slug: "women-sunglasses" },
            { name: "Watches", slug: "women-watches" },
            { name: "Scarves", slug: "women-scarves" },
          ],
        },
      ],
    },
    {
      name: "Men",
      slug: "men",
      description: "Refined men's tailoring, linen shirts, casual luxury, and timepieces.",
      image: "https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=800&q=80",
      children: [
        {
          name: "Clothing",
          slug: "men-clothing",
          children: [
            { name: "Shirts", slug: "men-shirts" },
            { name: "T-Shirts", slug: "men-t-shirts" },
            { name: "Jeans", slug: "men-jeans" },
            { name: "Trousers", slug: "men-trousers" },
            { name: "Chinos", slug: "men-chinos" },
            { name: "Suits & Blazers", slug: "men-suits-blazers" },
          ],
        },
        {
          name: "Footwear",
          slug: "men-footwear",
          children: [
            { name: "Loafers", slug: "men-loafers" },
            { name: "Sneakers", slug: "men-sneakers" },
            { name: "Formal Shoes", slug: "men-formal-shoes" },
          ],
        },
        {
          name: "Accessories",
          slug: "men-accessories",
          children: [
            { name: "Watches", slug: "men-watches" },
            { name: "Belts", slug: "men-belts" },
            { name: "Wallets", slug: "men-wallets" },
            { name: "Sunglasses", slug: "men-sunglasses" },
          ],
        },
      ],
    },
    {
      name: "Kids",
      slug: "kids",
      description: "Adorable, comfortable, and festive outfits for boys, girls, and infants.",
      image: "https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?auto=format&fit=crop&w=800&q=80",
      children: [
        { name: "Boys Clothing", slug: "kids-boys" },
        { name: "Girls Clothing", slug: "kids-girls" },
        { name: "Infants & Baby", slug: "kids-baby" },
      ],
    },
    {
      name: "Luxury Watches",
      slug: "luxury-watches",
      description: "Sapphire glass automatics, minimalist rose gold chronographs, and precision dials.",
      image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80",
      children: [
        { name: "Automatic Watches", slug: "watches-automatic" },
        { name: "Chronographs", slug: "watches-chronographs" },
        { name: "Minimalist Watches", slug: "watches-minimalist" },
      ],
    },
    {
      name: "Bags & Leather",
      slug: "bags-leather",
      description: "Full-grain leather totes, lambskin crossbody bags, and travel duffles.",
      image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80",
      children: [
        { name: "Leather Totes", slug: "bags-totes" },
        { name: "Crossbody Bags", slug: "bags-crossbody" },
        { name: "Travel Duffles", slug: "bags-duffles" },
        { name: "Wallets & Clutches", slug: "bags-wallets" },
      ],
    },
    {
      name: "Fine Jewellery",
      slug: "fine-jewellery",
      description: "18K gold-plated earrings, Baroque pearl drops, and diamond constellation necklaces.",
      image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80",
      children: [
        { name: "Earrings", slug: "jewellery-earrings" },
        { name: "Necklaces & Pendants", slug: "jewellery-necklaces" },
        { name: "Bracelets & Bangles", slug: "jewellery-bracelets" },
        { name: "Rings", slug: "jewellery-rings" },
      ],
    },
  ];

  const categoryMap = new Map<string, any>();

  async function seedCategoryTree(nodes: CategoryNode[], parentId: bigint | null = null) {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const created = await prisma.productCategory.create({
        data: {
          uuid: crypto.randomUUID(),
          name: node.name,
          slug: node.slug,
          description: node.description || `${node.name} collection at Zellora.`,
          icon: node.image || null,
          parentId: parentId,
          sortOrder: i,
          isActive: true,
          status: true,
        },
      });

      if (node.image) {
        try {
          await prisma.$executeRawUnsafe(
            `INSERT INTO \`product_category_images\` (\`category_id\`, \`image_url\`, \`is_primary\`, \`sort_order\`, \`created_at\`, \`updated_at\`)
             VALUES (?, ?, 1, 0, NOW(), NOW())`,
            created.id,
            node.image
          );
        } catch (e: any) {}
      }

      categoryMap.set(node.slug, created);

      if (node.children && node.children.length > 0) {
        await seedCategoryTree(node.children, created.id);
      }
    }
  }

  await seedCategoryTree(TAXONOMY);
  console.log(`✓ Seeded complete categories hierarchy (${categoryMap.size} categories created)\n`);

  // 8. BANNER POSITIONS & PROMOTIONAL BANNERS
  console.log("8. SEEDING BANNER POSITIONS & HERO SLIDERS...");

  const posHero = await prisma.banner_positions.create({
    data: {
      uuid: crypto.randomUUID(),
      name: "Home Hero Intro",
      slug: "home-hero-intro",
      page: "home",
      is_active: true,
    },
  });

  const posHomeTop = await prisma.banner_positions.create({
    data: {
      uuid: crypto.randomUUID(),
      name: "Home Top Banner",
      slug: "home_top",
      page: "home",
      is_active: true,
    },
  });

  const posHomeMiddle = await prisma.banner_positions.create({
    data: {
      uuid: crypto.randomUUID(),
      name: "Home Middle Promo",
      slug: "home_middle",
      page: "home",
      is_active: true,
    },
  });

  const posHomeBottom = await prisma.banner_positions.create({
    data: {
      uuid: crypto.randomUUID(),
      name: "Home Bottom Deals",
      slug: "home_bottom",
      page: "home",
      is_active: true,
    },
  });

  const posSidebar = await prisma.banner_positions.create({
    data: {
      uuid: crypto.randomUUID(),
      name: "Sidebar Promo",
      slug: "sidebar",
      page: "catalog",
      is_active: true,
    },
  });

  const heroBanners = [
    {
      positionId: posHero.id,
      title: "Spring Summer 2026 Collection",
      subtitle: "Bespoke silks, pure French linen, and handcrafted everyday luxury.",
      badgeLabel: "NEW SEASON",
      priceText: "From ₹1,499",
      imageUrl: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1600&q=80",
      linkUrl: "/products",
      sortOrder: 0,
    },
    {
      positionId: posHero.id,
      title: "Festive Grandeur & Heritage Kurtas",
      subtitle: "Handwoven Chanderi, authentic Ajrakh prints, and antique zari borders.",
      badgeLabel: "FESTIVE EDIT",
      priceText: "Up to 30% Off",
      imageUrl: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1600&q=80",
      linkUrl: "/products?category=women-ethnic-wear",
      sortOrder: 1,
    },
    {
      positionId: posHero.id,
      title: "Precision Horology & Leather Atelier",
      subtitle: "Sapphire glass automatic chronographs and full-grain Italian leather bags.",
      badgeLabel: "TIMELESS LUXURY",
      priceText: "Complimentary Shipping",
      imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1600&q=80",
      linkUrl: "/products?category=luxury-watches",
      sortOrder: 2,
    },
  ];

  for (const b of heroBanners) {
    await prisma.banner.create({
      data: {
        uuid: crypto.randomUUID(),
        banner_position_id: b.positionId,
        title: b.title,
        subtitle: b.subtitle,
        badge_label: b.badgeLabel,
        price_text: b.priceText,
        image_url: b.imageUrl,
        link_url: b.linkUrl,
        sortOrder: b.sortOrder,
        isActive: true,
      },
    });
  }

  // Promotional Banner for Mid-page
  await prisma.banner.create({
    data: {
      uuid: crypto.randomUUID(),
      banner_position_id: posHomeMiddle.id,
      title: "Handcrafted Luxury, Delivered With Care",
      subtitle: "48-Hour Dispatch • 100% Quality Verified • 15-Day Hassle-Free Returns",
      badge_label: "EXCLUSIVE CURATION",
      image_url: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1600&q=80",
      link_url: "/products",
      sortOrder: 0,
      isActive: true,
    },
  });

  console.log(`✓ Seeded banner positions & hero intro slides\n`);

  // 9. HEADER MENU ITEMS
  console.log("9. SEEDING HEADER MENU ITEMS...");

  const headerItemsData = [
    { label: "Women", categorySlug: "women", sortOrder: 0 },
    { label: "Men", categorySlug: "men", sortOrder: 1 },
    { label: "Kids", categorySlug: "kids", sortOrder: 2 },
    { label: "Watches", categorySlug: "luxury-watches", sortOrder: 3 },
    { label: "Bags & Leather", categorySlug: "bags-leather", sortOrder: 4 },
    { label: "Jewellery", categorySlug: "fine-jewellery", sortOrder: 5 },
    { label: "Sale", link: "/products?sortBy=discount", sortOrder: 6 },
  ];

  for (const item of headerItemsData) {
    const cat = item.categorySlug ? categoryMap.get(item.categorySlug) : null;
    await prisma.headerMenuItem.create({
      data: {
        uuid: crypto.randomUUID(),
        label: item.label,
        link: item.link || null,
        sortOrder: item.sortOrder,
        isActive: true,
        ...(cat
          ? {
              categories: {
                create: [{ categoryId: cat.id, sortOrder: 0 }],
              },
            }
          : {}),
      },
    });
  }
  console.log(`✓ Seeded ${headerItemsData.length} header navigation menu items\n`);

  // 10. PRODUCTS, STYLES, ITEMS, VARIANTS, UNIT PRICES & INVENTORY
  console.log("10. SEEDING PRODUCTS, STYLES, ITEMS, VARIANTS & INVENTORIES...");

  interface SeedStyleDef {
    name: string;
    slug: string;
    productName: string;
    productSlug: string;
    categorySlug: string;
    brand: any;
    gender?: "men" | "women" | "unisex" | "kids";
    primaryImage: string;
    galleryImages: string[];
    shortDescription: string;
    description: string;
    basePrice: number;
    colorName: string;
    colorHex: string;
    sizes: Array<{
      unit: any;
      unitValue: number;
      price: number;
      salePrice?: number;
      sku: string;
      isDefault: boolean;
    }>;
  }

  const STYLES_CATALOG: SeedStyleDef[] = [
    // --- Category: Women Dresses ---
    {
      name: "Emerald Silk Satin Maxi Dress",
      slug: "emerald-silk-satin-maxi-dress",
      productName: "Silk Evening Gowns & Maxi Dresses",
      productSlug: "silk-evening-gowns-maxi-dresses",
      categorySlug: "women-dresses",
      brand: brandCouture,
      gender: "women",
      primaryImage: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&auto=format&fit=crop&q=80",
      galleryImages: [
        "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&auto=format&fit=crop&q=80",
      ],
      shortDescription: "Draped in fluid emerald silk satin with a cowl neckline and graceful floor-length silhouette.",
      description: "Draped in fluid emerald green silk satin with a cowl neckline and graceful floor-length silhouette. Tailored with French seams and an adjustable criss-cross back closure. Ideal for evening soirees, galas, and celebrations.",
      basePrice: 2499,
      colorName: "Emerald Green",
      colorHex: "#097969",
      sizes: [
        { unit: unitXS, unitValue: 1, price: 2499, sku: "ZEL-DRS-01-XS", isDefault: false },
        { unit: unitS, unitValue: 1, price: 2499, sku: "ZEL-DRS-01-S", isDefault: false },
        { unit: unitM, unitValue: 1, price: 2499, sku: "ZEL-DRS-01-M", isDefault: true },
        { unit: unitL, unitValue: 1, price: 2499, sku: "ZEL-DRS-01-L", isDefault: false },
        { unit: unitXL, unitValue: 1, price: 2599, sku: "ZEL-DRS-01-XL", isDefault: false },
      ],
    },
    {
      name: "Midnight Velvet Off-Shoulder Evening Gown",
      slug: "midnight-velvet-evening-gown",
      productName: "Velvet Cocktail & Evening Gowns",
      productSlug: "velvet-cocktail-evening-gowns",
      categorySlug: "women-dresses",
      brand: brandCouture,
      gender: "women",
      primaryImage: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800&auto=format&fit=crop&q=80",
      galleryImages: [
        "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&auto=format&fit=crop&q=80",
      ],
      shortDescription: "Luxurious deep navy velvet tailored with an off-shoulder neckline and side slit.",
      description: "Luxurious deep navy velvet tailored with an off-shoulder neckline and side slit, delivering effortless red-carpet sophistication with soft stretch lining.",
      basePrice: 3899,
      colorName: "Midnight Navy",
      colorHex: "#000080",
      sizes: [
        { unit: unitS, unitValue: 1, price: 3899, sku: "ZEL-DRS-02-S", isDefault: false },
        { unit: unitM, unitValue: 1, price: 3899, sku: "ZEL-DRS-02-M", isDefault: true },
        { unit: unitL, unitValue: 1, price: 3899, sku: "ZEL-DRS-02-L", isDefault: false },
        { unit: unitXL, unitValue: 1, price: 3999, sku: "ZEL-DRS-02-XL", isDefault: false },
      ],
    },
    {
      name: "Blush Rose Pleated Georgette Cocktail Dress",
      slug: "blush-rose-pleated-cocktail-dress",
      productName: "Pleated Midi & Cocktail Dresses",
      productSlug: "pleated-midi-cocktail-dresses",
      categorySlug: "women-dresses",
      brand: brandCouture,
      gender: "women",
      primaryImage: "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&auto=format&fit=crop&q=80",
      galleryImages: [],
      shortDescription: "Delicate micro-pleated georgette cocktail dress with an empire waistline.",
      description: "Delicate micro-pleated georgette cocktail dress with an empire waistline and tie-back closure. Light, breezy, and timeless for brunches and garden parties.",
      basePrice: 2199,
      colorName: "Blush Pink",
      colorHex: "#FFB6C1",
      sizes: [
        { unit: unitXS, unitValue: 1, price: 2199, sku: "ZEL-DRS-03-XS", isDefault: false },
        { unit: unitS, unitValue: 1, price: 2199, sku: "ZEL-DRS-03-S", isDefault: false },
        { unit: unitM, unitValue: 1, price: 2199, sku: "ZEL-DRS-03-M", isDefault: true },
        { unit: unitL, unitValue: 1, price: 2199, sku: "ZEL-DRS-03-L", isDefault: false },
      ],
    },
    {
      name: "Floral Tiered Chiffon Sundress",
      slug: "floral-tiered-chiffon-sundress",
      productName: "Chiffon Sundresses",
      productSlug: "chiffon-sundresses",
      categorySlug: "women-dresses",
      brand: brandCouture,
      gender: "women",
      primaryImage: "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=800&auto=format&fit=crop&q=80",
      galleryImages: [],
      shortDescription: "Pastel botanic floral prints blooming over a tiered lightweight chiffon silhouette.",
      description: "Pastel botanic floral prints blooming over a tiered lightweight chiffon silhouette. Finished with ruffled cap sleeves and breathable inner cotton lining.",
      basePrice: 1899,
      colorName: "Pure White",
      colorHex: "#FFFFFF",
      sizes: [
        { unit: unitS, unitValue: 1, price: 1899, sku: "ZEL-DRS-04-S", isDefault: false },
        { unit: unitM, unitValue: 1, price: 1899, sku: "ZEL-DRS-04-M", isDefault: true },
        { unit: unitL, unitValue: 1, price: 1899, sku: "ZEL-DRS-04-L", isDefault: false },
        { unit: unitXL, unitValue: 1, price: 1999, sku: "ZEL-DRS-04-XL", isDefault: false },
      ],
    },

    // --- Category: Women Kurtis & Ethnic Wear ---
    {
      name: "Chanderi Silk Embroidered Anarkali Set",
      slug: "chanderi-silk-embroidered-anarkali-set",
      productName: "Festive Anarkali Sets",
      productSlug: "festive-anarkali-sets",
      categorySlug: "women-ethnic-wear",
      brand: brandCouture,
      gender: "women",
      primaryImage: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&auto=format&fit=crop&q=80",
      galleryImages: [
        "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=800&auto=format&fit=crop&q=80",
      ],
      shortDescription: "Opulent Chanderi silk flared Anarkali paired with matching pants and organza dupatta.",
      description: "Opulent Chanderi silk flared Anarkali paired with matching pants and an organza dupatta featuring exquisite golden zari embroidery and handmade potli buttons.",
      basePrice: 3499,
      colorName: "Mustard Gold",
      colorHex: "#FFDB58",
      sizes: [
        { unit: unitS, unitValue: 1, price: 3499, sku: "ZEL-ETH-01-S", isDefault: false },
        { unit: unitM, unitValue: 1, price: 3499, sku: "ZEL-ETH-01-M", isDefault: true },
        { unit: unitL, unitValue: 1, price: 3499, sku: "ZEL-ETH-01-L", isDefault: false },
        { unit: unitXL, unitValue: 1, price: 3599, sku: "ZEL-ETH-01-XL", isDefault: false },
        { unit: unitXXL, unitValue: 1, price: 3699, sku: "ZEL-ETH-01-XXL", isDefault: false },
      ],
    },
    {
      name: "Handloom Cotton Straight Kurti with Trousers",
      slug: "handloom-cotton-straight-kurti",
      productName: "Handloom Daily Kurtis",
      productSlug: "handloom-daily-kurtis",
      categorySlug: "women-kurtis",
      brand: brandCouture,
      gender: "women",
      primaryImage: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=800&auto=format&fit=crop&q=80",
      galleryImages: [],
      shortDescription: "Pure breathable handspun cotton straight-fit kurti in earthy beige with button details.",
      description: "Pure breathable handspun cotton straight-fit kurti in earthy beige with button details, matched with tapered cropped trousers and deep pockets.",
      basePrice: 1499,
      colorName: "Pure White",
      colorHex: "#FFFFFF",
      sizes: [
        { unit: unitS, unitValue: 1, price: 1499, sku: "ZEL-ETH-02-S", isDefault: false },
        { unit: unitM, unitValue: 1, price: 1499, sku: "ZEL-ETH-02-M", isDefault: true },
        { unit: unitL, unitValue: 1, price: 1499, sku: "ZEL-ETH-02-L", isDefault: false },
        { unit: unitXL, unitValue: 1, price: 1549, sku: "ZEL-ETH-02-XL", isDefault: false },
      ],
    },
    {
      name: "Royal Indigo Ajrakh Block-Print Kurta",
      slug: "royal-indigo-ajrakh-print-kurta",
      productName: "Ajrakh Artisanal Kurtas",
      productSlug: "ajrakh-artisanal-kurtas",
      categorySlug: "women-kurtis",
      brand: brandCouture,
      gender: "women",
      primaryImage: "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=800&auto=format&fit=crop&q=80",
      galleryImages: [],
      shortDescription: "Authentic artisanal Ajrakh mud-resist hand block print dyed in organic indigo.",
      description: "Authentic artisanal Ajrakh mud-resist hand block print dyed in organic indigo. Features a round neck with subtle kantha hand stitching.",
      basePrice: 1799,
      colorName: "Midnight Navy",
      colorHex: "#000080",
      sizes: [
        { unit: unitM, unitValue: 1, price: 1799, sku: "ZEL-ETH-03-M", isDefault: true },
        { unit: unitL, unitValue: 1, price: 1799, sku: "ZEL-ETH-03-L", isDefault: false },
        { unit: unitXL, unitValue: 1, price: 1899, sku: "ZEL-ETH-03-XL", isDefault: false },
        { unit: unitXXL, unitValue: 1, price: 1999, sku: "ZEL-ETH-03-XXL", isDefault: false },
      ],
    },

    // --- Category: Men Shirts & Tops ---
    {
      name: "Pure French Linen Relaxed Shirt",
      slug: "pure-french-linen-relaxed-shirt",
      productName: "Pure Linen Shirts",
      productSlug: "pure-linen-shirts",
      categorySlug: "men-shirts",
      brand: brandMen,
      gender: "men",
      primaryImage: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800&auto=format&fit=crop&q=80",
      galleryImages: [
        "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&auto=format&fit=crop&q=80",
      ],
      shortDescription: "Pre-washed 100% Normandy flax linen shirt with mother-of-pearl buttons.",
      description: "Pre-washed 100% Normandy flax linen shirt with mother-of-pearl buttons. Unrivaled breathability, natural drape, and timeless effortless charm.",
      basePrice: 1999,
      colorName: "Pure White",
      colorHex: "#FFFFFF",
      sizes: [
        { unit: unitS, unitValue: 1, price: 1999, sku: "ZEL-SHR-01-S", isDefault: false },
        { unit: unitM, unitValue: 1, price: 1999, sku: "ZEL-SHR-01-M", isDefault: true },
        { unit: unitL, unitValue: 1, price: 1999, sku: "ZEL-SHR-01-L", isDefault: false },
        { unit: unitXL, unitValue: 1, price: 2099, sku: "ZEL-SHR-01-XL", isDefault: false },
      ],
    },
    {
      name: "Oxford Classic Slim-Fit Cotton Shirt",
      slug: "oxford-classic-slim-fit-cotton-shirt",
      productName: "Classic Oxford Shirts",
      productSlug: "classic-oxford-shirts",
      categorySlug: "men-shirts",
      brand: brandMen,
      gender: "men",
      primaryImage: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&auto=format&fit=crop&q=80",
      galleryImages: [],
      shortDescription: "Woven from 2-ply combed organic cotton with a button-down collar.",
      description: "Woven from 2-ply combed organic cotton with a button-down collar. The quintessential wardrobe cornerstone from desk to dinner.",
      basePrice: 1699,
      colorName: "Midnight Navy",
      colorHex: "#000080",
      sizes: [
        { unit: unitS, unitValue: 1, price: 1699, sku: "ZEL-SHR-02-S", isDefault: false },
        { unit: unitM, unitValue: 1, price: 1699, sku: "ZEL-SHR-02-M", isDefault: true },
        { unit: unitL, unitValue: 1, price: 1699, sku: "ZEL-SHR-02-L", isDefault: false },
        { unit: unitXL, unitValue: 1, price: 1799, sku: "ZEL-SHR-02-XL", isDefault: false },
      ],
    },
    {
      name: "Textured Cuban Collar Resort Shirt",
      slug: "textured-cuban-collar-resort-shirt",
      productName: "Cuban Collar Resort Shirts",
      productSlug: "cuban-collar-resort-shirts",
      categorySlug: "men-shirts",
      brand: brandMen,
      gender: "men",
      primaryImage: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=800&auto=format&fit=crop&q=80",
      galleryImages: [],
      shortDescription: "Airy waffle-knit cotton blend with an open camp collar.",
      description: "Airy waffle-knit cotton blend with an open camp collar and relaxed shoulder fit. Perfectly styled for warm vacations and sunset evenings.",
      basePrice: 1599,
      colorName: "Sienna Tan",
      colorHex: "#C19A6B",
      sizes: [
        { unit: unitM, unitValue: 1, price: 1599, sku: "ZEL-SHR-03-M", isDefault: true },
        { unit: unitL, unitValue: 1, price: 1599, sku: "ZEL-SHR-03-L", isDefault: false },
        { unit: unitXL, unitValue: 1, price: 1699, sku: "ZEL-SHR-03-XL", isDefault: false },
      ],
    },

    // --- Category: Men Jeans & Trousers ---
    {
      name: "Tailored Italian Stretch Cotton Chinos",
      slug: "tailored-italian-stretch-cotton-chinos",
      productName: "Italian Chinos & Trousers",
      productSlug: "italian-chinos-trousers",
      categorySlug: "men-chinos",
      brand: brandMen,
      gender: "men",
      primaryImage: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&auto=format&fit=crop&q=80",
      galleryImages: [],
      shortDescription: "Slim-tapered silhouette woven from 98% mercerized cotton and 2% elastane.",
      description: "Slim-tapered silhouette woven from 98% mercerized cotton and 2% elastane for effortless comfort, movement, and crisp tailored lines.",
      basePrice: 2199,
      colorName: "Sienna Tan",
      colorHex: "#C19A6B",
      sizes: [
        { unit: unit30, unitValue: 30, price: 2199, sku: "ZEL-TRS-01-30", isDefault: false },
        { unit: unit32, unitValue: 32, price: 2199, sku: "ZEL-TRS-01-32", isDefault: true },
        { unit: unit34, unitValue: 34, price: 2199, sku: "ZEL-TRS-01-34", isDefault: false },
        { unit: unit36, unitValue: 36, price: 2299, sku: "ZEL-TRS-01-36", isDefault: false },
      ],
    },
    {
      name: "Vintage Indigo Selvedge Denim Jeans",
      slug: "vintage-indigo-selvedge-denim-jeans",
      productName: "Selvedge Denim Jeans",
      productSlug: "selvedge-denim-jeans",
      categorySlug: "men-jeans",
      brand: brandMen,
      gender: "men",
      primaryImage: "https://images.unsplash.com/photo-1542272604-780c96856592?w=800&auto=format&fit=crop&q=80",
      galleryImages: [],
      shortDescription: "13.5oz shuttle-loom woven Japanese selvedge denim.",
      description: "13.5oz shuttle-loom woven Japanese selvedge denim. Finished with red ID ticker, solid copper rivets, and a classic regular-straight cut.",
      basePrice: 2799,
      colorName: "Midnight Navy",
      colorHex: "#000080",
      sizes: [
        { unit: unit30, unitValue: 30, price: 2799, sku: "ZEL-TRS-02-30", isDefault: false },
        { unit: unit32, unitValue: 32, price: 2799, sku: "ZEL-TRS-02-32", isDefault: true },
        { unit: unit34, unitValue: 34, price: 2799, sku: "ZEL-TRS-02-34", isDefault: false },
        { unit: unit36, unitValue: 36, price: 2899, sku: "ZEL-TRS-02-36", isDefault: false },
      ],
    },

    // --- Category: Luxury Watches ---
    {
      name: "AeroChrono Classic Tachymeter Watch",
      slug: "aerochrono-classic-tachymeter-watch",
      productName: "Analog Chronograph Watches",
      productSlug: "analog-chronograph-watches",
      categorySlug: "watches-chronographs",
      brand: brandChrono,
      gender: "unisex",
      primaryImage: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80",
      galleryImages: [
        "https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800&auto=format&fit=crop&q=80",
      ],
      shortDescription: "Surgical-grade 316L stainless steel case, scratch-resistant sapphire crystal.",
      description: "Surgical-grade 316L stainless steel case, scratch-resistant sapphire crystal, Japanese quartz chronograph movement, and 50M water resistance.",
      basePrice: 6499,
      colorName: "Classic Black",
      colorHex: "#111111",
      sizes: [
        { unit: unitOneSize, unitValue: 1, price: 6499, sku: "ZEL-WTC-01-STD", isDefault: true },
      ],
    },
    {
      name: "Aura Rose Gold Minimalist Women's Watch",
      slug: "aura-rose-gold-minimalist-watch",
      productName: "Minimalist Mesh Strap Watches",
      productSlug: "minimalist-mesh-strap-watches",
      categorySlug: "watches-minimalist",
      brand: brandChrono,
      gender: "women",
      primaryImage: "https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800&auto=format&fit=crop&q=80",
      galleryImages: [],
      shortDescription: "Ultra-slim 6mm case with genuine mother-of-pearl dial and rose gold mesh strap.",
      description: "Ultra-slim 6mm case with a genuine mother-of-pearl dial and adjustable stainless steel rose gold mesh strap. Subtle, radiant luxury.",
      basePrice: 4999,
      colorName: "Rose Gold",
      colorHex: "#B76E79",
      sizes: [
        { unit: unitOneSize, unitValue: 1, price: 4999, sku: "ZEL-WTC-02-STD", isDefault: true },
      ],
    },
    {
      name: "Heritage Automatic Skeleton Leather Watch",
      slug: "heritage-automatic-skeleton-leather-watch",
      productName: "Automatic Skeleton Watches",
      productSlug: "automatic-skeleton-watches",
      categorySlug: "watches-automatic",
      brand: brandChrono,
      gender: "men",
      primaryImage: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&auto=format&fit=crop&q=80",
      galleryImages: [],
      shortDescription: "Exhibition caseback showing intricate 21-jewel self-winding mechanical movement.",
      description: "Exhibition caseback showing an intricate 21-jewel self-winding mechanical movement paired with hand-stitched Italian calfskin leather strap.",
      basePrice: 8999,
      colorName: "Classic Black",
      colorHex: "#111111",
      sizes: [
        { unit: unitOneSize, unitValue: 1, price: 8999, sku: "ZEL-WTC-03-STD", isDefault: true },
      ],
    },

    // --- Category: Bags & Leather ---
    {
      name: "Sienna Full-Grain Leather Everyday Tote",
      slug: "sienna-full-grain-leather-tote",
      productName: "Leather Handbags & Totes",
      productSlug: "leather-handbags-totes",
      categorySlug: "bags-totes",
      brand: brandAtelier,
      gender: "unisex",
      primaryImage: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&auto=format&fit=crop&q=80",
      galleryImages: [
        "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80",
      ],
      shortDescription: "Spacious handcrafted vegetable-tanned leather tote with padded laptop sleeve.",
      description: "Spacious handcrafted vegetable-tanned leather tote with padded laptop sleeve, interior organizer pockets, and solid antique brass hardware.",
      basePrice: 3999,
      colorName: "Sienna Tan",
      colorHex: "#C19A6B",
      sizes: [
        { unit: unitOneSize, unitValue: 1, price: 3999, sku: "ZEL-BAG-01-STD", isDefault: true },
      ],
    },
    {
      name: "Capri Quilted Crossbody Chain Bag",
      slug: "capri-quilted-crossbody-chain-bag",
      productName: "Quilted Crossbody Bags",
      productSlug: "quilted-crossbody-bags",
      categorySlug: "bags-crossbody",
      brand: brandAtelier,
      gender: "women",
      primaryImage: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80",
      galleryImages: [],
      shortDescription: "Iconic diamond quilt stitching on supple lambskin leather with sliding gold chain.",
      description: "Iconic diamond quilt stitching on supple lambskin leather with a polished gold-finish sliding chain strap. Versatile crossbody or shoulder bag.",
      basePrice: 2899,
      colorName: "Classic Black",
      colorHex: "#111111",
      sizes: [
        { unit: unitOneSize, unitValue: 1, price: 2899, sku: "ZEL-BAG-02-STD", isDefault: true },
      ],
    },

    // --- Category: Footwear ---
    {
      name: "Verona Pointed Toe Stiletto Heels",
      slug: "verona-pointed-toe-stiletto-heels",
      productName: "Designer Stiletto Heels",
      productSlug: "designer-stiletto-heels",
      categorySlug: "women-heels",
      brand: brandFootwear,
      gender: "women",
      primaryImage: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&auto=format&fit=crop&q=80",
      galleryImages: [],
      shortDescription: "Crafted in patent gloss leather with an 85mm stiletto heel and cushioned arch.",
      description: "Crafted in patent gloss leather with an 85mm stiletto heel, memory foam cushioned footbed, and non-slip Italian resin sole.",
      basePrice: 3299,
      colorName: "Classic Black",
      colorHex: "#111111",
      sizes: [
        { unit: unitPiece, unitValue: 1, price: 3299, sku: "ZEL-SHO-01-37", isDefault: false },
        { unit: unitPiece, unitValue: 1, price: 3299, sku: "ZEL-SHO-01-38", isDefault: true },
        { unit: unitPiece, unitValue: 1, price: 3299, sku: "ZEL-SHO-01-39", isDefault: false },
      ],
    },
    {
      name: "Amalfi Handcrafted Calfskin Penny Loafers",
      slug: "amalfi-calfskin-penny-loafers",
      productName: "Calfskin Penny Loafers",
      productSlug: "calfskin-penny-loafers",
      categorySlug: "men-loafers",
      brand: brandFootwear,
      gender: "men",
      primaryImage: "https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?w=800&auto=format&fit=crop&q=80",
      galleryImages: [],
      shortDescription: "Hand-burnished Italian calfskin leather loafers with Blake stitched sole.",
      description: "Hand-burnished Italian calfskin leather loafers with Blake stitched sole, leather lining, and timeless penny saddle detail.",
      basePrice: 4499,
      colorName: "Sienna Tan",
      colorHex: "#C19A6B",
      sizes: [
        { unit: unitPiece, unitValue: 1, price: 4499, sku: "ZEL-SHO-02-41", isDefault: false },
        { unit: unitPiece, unitValue: 1, price: 4499, sku: "ZEL-SHO-02-42", isDefault: true },
        { unit: unitPiece, unitValue: 1, price: 4499, sku: "ZEL-SHO-02-43", isDefault: false },
      ],
    },

    // --- Category: Fine Jewellery ---
    {
      name: "18K Gold Plated Baroque Pearl Drop Earrings",
      slug: "baroque-pearl-drop-earrings",
      productName: "Baroque Pearl Earrings",
      productSlug: "baroque-pearl-earrings",
      categorySlug: "jewellery-earrings",
      brand: brandJewels,
      gender: "women",
      primaryImage: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&auto=format&fit=crop&q=80",
      galleryImages: [],
      shortDescription: "Cultured organic baroque pearls suspended from textured 18K gold-vermeil huggies.",
      description: "Cultured organic freshwater baroque pearls suspended from textured 18K gold-vermeil huggies. Hypoallergenic, lightweight, and iridescent.",
      basePrice: 1699,
      colorName: "Rose Gold",
      colorHex: "#B76E79",
      sizes: [
        { unit: unitOneSize, unitValue: 1, price: 1699, sku: "ZEL-JWL-01-STD", isDefault: true },
      ],
    },
    {
      name: "Celestial Diamond Pavé Constellation Necklace",
      slug: "celestial-diamond-pave-constellation-necklace",
      productName: "Constellation Necklaces",
      productSlug: "constellation-necklaces",
      categorySlug: "jewellery-necklaces",
      brand: brandJewels,
      gender: "women",
      primaryImage: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800&auto=format&fit=crop&q=80",
      galleryImages: [],
      shortDescription: "Dainty 18K gold chain featuring cubic zirconia micro-pavé constellation stars.",
      description: "Dainty 18K gold vermeil chain featuring brilliant micro-pavé constellation stars with adjustable 16-18 inch extender.",
      basePrice: 2299,
      colorName: "Rose Gold",
      colorHex: "#B76E79",
      sizes: [
        { unit: unitOneSize, unitValue: 1, price: 2299, sku: "ZEL-JWL-02-STD", isDefault: true },
      ],
    },
  ];

  let totalProducts = 0;
  let totalStyles = 0;
  let totalVariants = 0;
  let totalUnitPrices = 0;

  const seededProducts: any[] = [];
  const seededStyles: any[] = [];
  const seededVariants: any[] = [];
  const seededUnitPrices: any[] = [];

  for (const itemDef of STYLES_CATALOG) {
    const category = categoryMap.get(itemDef.categorySlug) || categoryMap.get("women-dresses") || Array.from(categoryMap.values())[0];

    // 1. Create or Find Parent Product
    let product = await prisma.product.findFirst({ where: { slug: itemDef.productSlug } });
    if (!product) {
      product = await prisma.product.create({
        data: {
          uuid: crypto.randomUUID(),
          name: itemDef.productName,
          slug: itemDef.productSlug,
          categoryId: category.id,
          gender: (itemDef.gender as any) || "women",
          brandId: itemDef.brand.id,
          isActive: true,
          status: true,
        },
      });
      totalProducts++;
      seededProducts.push(product);
    }

    // 2. Create Style
    const style = await prisma.style.create({
      data: {
        uuid: crypto.randomUUID(),
        productId: product.id,
        brandId: itemDef.brand.id,
        name: itemDef.name,
        slug: itemDef.slug,
        sku: `STY-${itemDef.slug.slice(0, 15).toUpperCase()}`,
        short_description: itemDef.shortDescription,
        description: itemDef.description,
        base_price: itemDef.basePrice,
        is_featured: true,
        is_default: true,
        isActive: true,
        out_of_stock: false,
      },
    });
    totalStyles++;
    seededStyles.push(style);

    // 3. Create Style Images
    await prisma.styleImage.create({
      data: {
        uuid: crypto.randomUUID(),
        styleId: style.id,
        image_url: itemDef.primaryImage,
        alt_text: itemDef.name,
        is_primary: true,
        sort_order: 0,
        is_active: true,
      },
    });

    for (let gIdx = 0; gIdx < itemDef.galleryImages.length; gIdx++) {
      await prisma.styleImage.create({
        data: {
          uuid: crypto.randomUUID(),
          styleId: style.id,
          image_url: itemDef.galleryImages[gIdx],
          alt_text: `${itemDef.name} view ${gIdx + 2}`,
          is_primary: false,
          sort_order: gIdx + 1,
          is_active: true,
        },
      });
    }

    // 4. Create Item (Sub-variant / Fit)
    const item = await prisma.item.create({
      data: {
        uuid: crypto.randomUUID(),
        styleId: style.id,
        name: "Standard Fit",
        slug: `${itemDef.slug}-standard-fit`,
        sku: `ITM-${itemDef.slug.slice(0, 15).toUpperCase()}`,
        short_description: itemDef.shortDescription,
        description: itemDef.description,
        base_price: itemDef.basePrice,
        is_default: true,
        isActive: true,
        out_of_stock: false,
      },
    });

    // 5. Create ProductVariant (Color)
    const variant = await prisma.productVariant.create({
      data: {
        uuid: crypto.randomUUID(),
        itemId: item.id,
        variant_name: itemDef.colorName,
        slug: `${itemDef.slug}-${itemDef.colorName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        color_name: itemDef.colorName,
        color_hex: itemDef.colorHex,
        price_adjustment: 0,
        is_default: true,
        is_featured: true,
        isActive: true,
        out_of_stock: false,
      },
    });
    totalVariants++;
    seededVariants.push(variant);

    // Add Product Variant Image
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO \`product_variant_images\` (\`uuid\`, \`variant_id\`, \`image_url\`, \`is_primary\`, \`sort_order\`, \`created_at\`, \`updated_at\`)
         VALUES (UUID(), ?, ?, 1, 0, NOW(), NOW())`,
        variant.id,
        itemDef.primaryImage
      );
    } catch (e: any) {}

    // 6. Create VariantUnitPrices (Sizes & SKUs) & Inventories
    for (const size of itemDef.sizes) {
      const unitPrice = await prisma.variantUnitPrice.create({
        data: {
          uuid: crypto.randomUUID(),
          variant_id: variant.id,
          unit_id: size.unit.id,
          unit_value: size.unitValue,
          sku: size.sku,
          base_price: size.price,
          is_default: size.isDefault,
          isActive: true,
        },
      });
      seededUnitPrices.push(unitPrice);
      totalUnitPrices++;

      // Create Inventory (100 in stock)
      await prisma.inventory.create({
        data: {
          variantUnitPriceId: unitPrice.id,
          quantity_available: 100,
          quantity_reserved: 0,
          reorderLevel: 10,
          warehouse_location: "Bengaluru Main Hub",
          is_active: true,
        },
      });
    }

    console.log(`✓ Style #${totalStyles}: ${itemDef.name} (₹${itemDef.basePrice}, ${itemDef.sizes.length} sizes in stock)`);
  }

  // 11. COUPONS & PROMOTIONS
  console.log("\n11. SEEDING COUPONS & PROMOTIONAL OFFERS...");

  await prisma.coupon.create({
    data: {
      uuid: crypto.randomUUID(),
      code: "WELCOME10",
      type: "percentage",
      value: 10,
      minOrderAmount: 999,
      max_discount_amount: 500,
      usageLimit: 1000,
      usage_limit_per_user: 1,
      valid_from: new Date(),
      valid_to: new Date(Date.now() + 86400000 * 365),
      isActive: true,
    },
  });

  await prisma.coupon.create({
    data: {
      uuid: crypto.randomUUID(),
      code: "ZELLORA500",
      type: "flat",
      value: 500,
      minOrderAmount: 2999,
      max_discount_amount: 500,
      usageLimit: 500,
      usage_limit_per_user: 1,
      valid_from: new Date(),
      valid_to: new Date(Date.now() + 86400000 * 365),
      isActive: true,
    },
  });

  await prisma.coupon.create({
    data: {
      uuid: crypto.randomUUID(),
      code: "FESTIVE20",
      type: "percentage",
      value: 20,
      minOrderAmount: 1999,
      max_discount_amount: 1000,
      usageLimit: 500,
      usage_limit_per_user: 2,
      valid_from: new Date(),
      valid_to: new Date(Date.now() + 86400000 * 365),
      isActive: true,
    },
  });

  console.log(`✓ Seeded coupons: WELCOME10, ZELLORA500, FESTIVE20`);

  // 12. SAMPLE ORDERS & PAYMENTS
  console.log("\n12. SEEDING REALISTIC CLIENT DEMO ORDERS...");

  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO \`payment_methods\` (\`id\`, \`name\`, \`code\`, \`is_active\`, \`created_at\`, \`updated_at\`)
      VALUES (1, 'Razorpay', 'razorpay', 1, NOW(), NOW())
      ON DUPLICATE KEY UPDATE \`name\` = 'Razorpay', \`is_active\` = 1
    `);
  } catch (e: any) {}

  const sampleOrderConfigs = [
    {
      orderNumber: "ZEL-2026-1001",
      status: "delivered",
      paymentStatus: "paid",
      styleIdx: 0, // Emerald Silk Satin Maxi Dress
      qty: 1,
      totalAmount: 2499,
      notes: "Please deliver in luxury gift packaging box",
    },
    {
      orderNumber: "ZEL-2026-1002",
      status: "shipped",
      paymentStatus: "paid",
      styleIdx: 8, // AeroChrono Watch
      qty: 1,
      totalAmount: 6499,
      notes: "Express air delivery requested",
    },
    {
      orderNumber: "ZEL-2026-1003",
      status: "confirmed",
      paymentStatus: "paid",
      styleIdx: 5, // Pure French Linen Shirt
      qty: 2,
      totalAmount: 3998,
      notes: "Delivery after 4 PM",
    },
    {
      orderNumber: "ZEL-2026-1004",
      status: "processing",
      paymentStatus: "paid",
      styleIdx: 11, // Sienna Leather Tote
      qty: 1,
      totalAmount: 3999,
      notes: "Fragile packaging",
    },
    {
      orderNumber: "ZEL-2026-1005",
      status: "pending",
      paymentStatus: "pending",
      styleIdx: 4, // Chanderi Silk Anarkali
      qty: 1,
      totalAmount: 3499,
      notes: "Standard doorstep delivery",
    },
  ];

  for (const ord of sampleOrderConfigs) {
    const style = seededStyles[ord.styleIdx];
    const product = seededProducts.find((p) => p.id === style.productId) || seededProducts[0];
    const variant = seededVariants.find((v) => v.itemId !== undefined) || seededVariants[0];
    const unitPrice = seededUnitPrices.find((up) => up.variant_id === variant.id && up.is_default) || seededUnitPrices[0];

    const createdOrder = await prisma.order.create({
      data: {
        uuid: crypto.randomUUID(),
        orderNumber: ord.orderNumber,
        userId: customer1.id,
        order_status: ord.status as any,
        payment_status: ord.paymentStatus as any,
        subtotal: ord.totalAmount,
        discountAmount: 0,
        taxAmount: 0,
        shipping_charge: 0,
        totalAmount: ord.totalAmount,
        notes: ord.notes,
        placed_at: new Date(Date.now() - 86400000 * 2),
      },
    });

    // Order Address
    await prisma.orderAddress.create({
      data: {
        uuid: crypto.randomUUID(),
        orderId: createdOrder.id,
        type: "shipping",
        full_name: "Priya Sharma",
        phone: "9876543210",
        address_line1: "Flat 402, Prestige Royale, 12th Main Road",
        address_line2: "Indiranagar",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560038",
        country: "India",
      },
    });

    // Order Item with accurate hierarchy snapshot
    await prisma.orderItem.create({
      data: {
        uuid: crypto.randomUUID(),
        orderId: createdOrder.id,
        productId: product.id,
        styleId: style.id,
        variantId: variant.id,
        variantUnitPriceId: unitPrice?.id ?? null,
        product_name_snapshot: product.name,
        item_name_snapshot: style.name,
        variant_snapshot: variant.variant_name,
        sku_snapshot: unitPrice.sku,
        quantity: ord.qty,
        unit_price: Number(style.base_price),
        total_price: ord.totalAmount,
      },
    });

    // Payment Record
    if (ord.paymentStatus === "paid") {
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO \`payments\` (
            \`order_id\`, \`payment_method_id\`, \`amount\`, \`currency\`, \`status\`, \`gateway\`, \`gateway_payment_id\`, \`created_at\`, \`updated_at\`
          ) VALUES (
            ?, 1, ?, 'INR', 'success', 'razorpay', 'pay_sample_${ord.orderNumber}', NOW(), NOW()
          )`,
          createdOrder.id,
          ord.totalAmount
        );
      } catch (e: any) {}
    }

    console.log(`✓ Order #${ord.orderNumber}: ₹${ord.totalAmount} (${ord.status.toUpperCase()})`);
  }

  // 13. VERIFIED REVIEWS
  console.log("\n13. SEEDING VERIFIED CUSTOMER REVIEWS...");

  const reviewsData = [
    {
      styleIdx: 0,
      title: "Breath-taking drape and luxury feel",
      comment: "The emerald color is even more vibrant in person! The silk quality feels exceptional, and the fit around the waist is so flattering. Received endless compliments at the wedding reception.",
      rating: 5,
    },
    {
      styleIdx: 4,
      title: "Finest Anarkali I have ever owned",
      comment: "The zari embroidery has such delicate craftsmanship. Soft Chanderi silk that is comfortable to wear for hours. Perfect for family celebrations. Highly recommended!",
      rating: 5,
    },
    {
      styleIdx: 5,
      title: "Incredible linen quality",
      comment: "Pure French Normandy linen with zero scratchiness. Breathable in 35-degree heat and looks sharp even after multiple washes.",
      rating: 5,
    },
    {
      styleIdx: 8,
      title: "Exquisite chronograph watch",
      comment: "Solid weight, sapphire crystal clarity, and very smooth second hand. Looks like a timepiece thrice the price. Beautiful presentation box too.",
      rating: 5,
    },
    {
      styleIdx: 11,
      title: "Supple leather and very spacious",
      comment: "Easily fits my 15-inch laptop, planner, and daily essentials. The vegetable-tanned leather smells amazing and gets richer with every use.",
      rating: 5,
    },
    {
      styleIdx: 15,
      title: "Dainty and sparkling",
      comment: "The constellation necklace is so delicate and catches the light beautifully. Great clasp and quality 18K gold finish that has not tarnished at all.",
      rating: 5,
    },
  ];

  for (const rev of reviewsData) {
    const style = seededStyles[rev.styleIdx];
    const product = seededProducts.find((p) => p.id === style.productId) || seededProducts[0];
    try {
      await prisma.review.create({
        data: {
          uuid: crypto.randomUUID(),
          productId: product.id,
          userId: customer1.id,
          title: rev.title,
          comment: rev.comment,
          rating: rev.rating,
          isApproved: true,
          is_active: true,
        },
      });
      console.log(`✓ Review on ${style.name}: "${rev.title}" (${rev.rating}★)`);
    } catch (e: any) {
      console.warn(`! review notice: ${e.message}`);
    }
  }

  console.log("\n=================================================");
  console.log("🎉 ZELLORA MASTER DATABASE SEEDED SUCCESSFULLY!");
  console.log("=================================================");
  console.log(`📦 Categories:        ${categoryMap.size} (Full 11-root hierarchy)`);
  console.log(`🏷️ Products:          ${totalProducts}`);
  console.log(`✨ Styles:            ${totalStyles}`);
  console.log(`🎨 Color Variants:    ${totalVariants}`);
  console.log(`📐 Size Unit Prices:  ${totalUnitPrices} (All In Stock: 100 units each)`);
  console.log(`🖼️ Banners:           ${heroBanners.length + 1} across 5 positions`);
  console.log(`🧭 Header Nav Items:  ${headerItemsData.length}`);
  console.log(`💳 Demo Orders:       ${sampleOrderConfigs.length}`);
  console.log(`⭐ Verified Reviews:  ${reviewsData.length}`);
  console.log(`👤 Admin Users:       admin@zellora.com / admin123, admin@rithusnacks.com / admin123`);
  console.log(`🛍️ Customer Users:    customer@zellora.com / customer123, customer@example.com / customer123`);
  console.log("=================================================\n");
}

main()
  .catch((e) => {
    console.error("FATAL ERROR IN MASTER SEED:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
