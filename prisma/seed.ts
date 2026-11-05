import "dotenv/config";
import crypto from "crypto";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcryptjs";
import { ALL_PERMISSIONS } from "../src/lib/permissions/catalog.ts";

function createClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  const url = new URL(databaseUrl);
  const adapter = new PrismaMariaDb({
  host: url.hostname,
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
  console.log("Seeding database...");

  const adminPassword = await bcrypt.hash("admin123", 12);
  const customerPassword = await bcrypt.hash("customer123", 12);

  // Helper to upsert role by slug
  // `scope` decides which area a role signs in to (/admin, /agent, /account); it is what
  // middleware and the server guards check, so a role created later gets access from this
  // field alone and never from its name.
  const getOrCreateRole = async (
    name: string,
    slug: string,
    description: string,
    scope: "ADMIN" | "AGENT" | "CUSTOMER"
  ) => {
    const role = await prisma.role.findFirst({ where: { slug } });
    if (!role) {
      return prisma.role.create({ data: { name, slug, description, scope } });
    }
    if (role.scope !== scope) {
      return prisma.role.update({ where: { id: role.id }, data: { scope } });
    }
    return role;
  };

  const adminRole = await getOrCreateRole("ADMIN", "admin", "Administrator with full access", "ADMIN");
  const staffRole = await getOrCreateRole("STAFF", "staff", "Staff member with limited access", "ADMIN");
  const customerRole = await getOrCreateRole("CUSTOMER", "customer", "Regular customer", "CUSTOMER");
  const agentRole = await getOrCreateRole(
    "AGENT",
    "agent",
    "Referral agent credited for attributed signups and orders",
    "AGENT"
  );

  console.log("Roles created");

  // The catalog in src/lib/permissions/catalog.ts is the source of truth; every entry gets
  // a permissions row, and the owner ADMIN role is granted all of them.
  const permissions = ALL_PERMISSIONS.map((permission) => ({
    name: permission.name,
    slug: permission.slug,
    module: permission.module,
  }));

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

  // The built-in STAFF role predates permissions: before this, anyone with it could reach
  // every admin screen because routes only checked the role name. So on a database that has
  // never had permissions assigned to it, give it everything once — nothing a staff member
  // could do yesterday stops working — and let the admin trim it on the Roles screen.
  const staffPermissionCount = await prisma.rolePermission.count({ where: { roleId: staffRole.id } });
  if (staffPermissionCount === 0) {
    const all = await prisma.permission.findMany({ select: { id: true } });
    await prisma.rolePermission.createMany({
      data: all.map((permission) => ({ roleId: staffRole.id, permissionId: permission.id })),
      skipDuplicates: true,
    });
    console.log(`STAFF role had no permissions; granted all ${all.length} (trim under Roles)`);
  }

  console.log("Permissions created and assigned to admin role");

  let adminUser = await prisma.user.findFirst({ where: { email: "admin@rithusnacks.com" } });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        uuid: crypto.randomUUID(),
        name: "Admin",
        email: "admin@rithusnacks.com",
        password_hash: adminPassword,
        role: { connect: { id: adminRole.id } },
        status: "active",
        email_verified_at: new Date(),
      },
    });
  } else if (!adminUser.uuid) {
    await prisma.user.update({
      where: { id: adminUser.id },
      data: { uuid: crypto.randomUUID() },
    });
  }

  let customerUser = await prisma.user.findFirst({ where: { email: "customer@example.com" } });
  if (!customerUser) {
    customerUser = await prisma.user.create({
      data: {
        uuid: crypto.randomUUID(),
        name: "John Customer",
        email: "customer@example.com",
        password_hash: customerPassword,
        role: { connect: { id: customerRole.id } },
        status: "active",
        email_verified_at: new Date(),
      },
    });
  } else if (!customerUser.uuid) {
    await prisma.user.update({
      where: { id: customerUser.id },
      data: { uuid: crypto.randomUUID() },
    });
  }

  console.log("Users created/updated with UUIDs");

  const defaultBannerPositions = [
    { name: "Home Hero Banner", slug: "home-hero", page: "home" },
    { name: "Home Intro Image", slug: "home-hero-intro", page: "home" },
    { name: "Home Offer Banner", slug: "home-offer", page: "home" },
    { name: "Home Popup Offer", slug: "home-popup-offer", page: "home" },
    { name: "Home Reels", slug: "home-reels", page: "home" },
  ];

  for (const position of defaultBannerPositions) {
    const existing = await prisma.banner_positions.findFirst({
      where: { slug: position.slug },
    });
    if (!existing) {
      await prisma.banner_positions.create({
        data: {
          uuid: crypto.randomUUID(),
          name: position.name,
          slug: position.slug,
          page: position.page,
          created_by: adminUser.id,
          updated_by: adminUser.id,
        },
      });
    }
  }
  console.log("Default banner positions created/verified");

  console.log("\n--- Seed Complete ---");
  console.log("Admin Login: admin@rithusnacks.com / admin123");
  console.log("Customer Login: customer@example.com / customer123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
