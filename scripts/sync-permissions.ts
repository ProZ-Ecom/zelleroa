/**
 * Writes the permission catalog (src/lib/permissions/catalog.ts) into the `permissions`
 * table and grants every permission to the owner ADMIN role.
 *
 *   node --experimental-strip-types scripts/sync-permissions.ts
 *
 * Safe to re-run: it only inserts what is missing and never deletes or revokes, so roles
 * an admin configured on the Roles screen keep exactly the permissions they were given.
 * Run it after adding actions to the catalog (the full seed does the same thing).
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { ALL_PERMISSIONS } from "../src/lib/permissions/catalog.ts";

function createClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");
  const url = new URL(databaseUrl);
  return new PrismaClient({
    adapter: new PrismaMariaDb({
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.slice(1),
      connectionLimit: 5,
      allowPublicKeyRetrieval: true,
    }),
  });
}

async function main() {
  const prisma = createClient();

  try {
    const existing = await prisma.permission.findMany({ select: { id: true, slug: true } });
    const bySlug = new Map(existing.map((p) => [p.slug, p.id]));

    let created = 0;
    for (const permission of ALL_PERMISSIONS) {
      if (bySlug.has(permission.slug)) continue;
      const row = await prisma.permission.create({
        data: { name: permission.name, slug: permission.slug, module: permission.module },
        select: { id: true, slug: true },
      });
      bySlug.set(row.slug, row.id);
      created += 1;
    }

    const ownerRole = await prisma.role.findFirst({ where: { slug: "admin" }, select: { id: true } });
    let granted = 0;
    if (ownerRole) {
      const held = await prisma.rolePermission.findMany({
        where: { roleId: ownerRole.id },
        select: { permissionId: true },
      });
      const heldIds = new Set(held.map((rp) => String(rp.permissionId)));
      const missing = [...bySlug.values()].filter((id) => !heldIds.has(String(id)));
      if (missing.length > 0) {
        await prisma.rolePermission.createMany({
          data: missing.map((permissionId) => ({ roleId: ownerRole.id, permissionId })),
          skipDuplicates: true,
        });
        granted = missing.length;
      }
    }

    // The built-in STAFF role predates permissions: it used to reach every admin screen
    // because routes only checked the role name. On a database where it has never been
    // given any, grant it everything once so nothing stops working, then let the admin
    // trim it on the Roles screen.
    const staffRole = await prisma.role.findFirst({ where: { slug: "staff" }, select: { id: true } });
    let staffGranted = 0;
    if (staffRole) {
      const staffCount = await prisma.rolePermission.count({ where: { roleId: staffRole.id } });
      if (staffCount === 0) {
        await prisma.rolePermission.createMany({
          data: [...bySlug.values()].map((permissionId) => ({ roleId: staffRole.id, permissionId })),
          skipDuplicates: true,
        });
        staffGranted = bySlug.size;
      }
    }

    console.log(
      `Permissions in catalog: ${ALL_PERMISSIONS.length}; created: ${created}; granted to owner ADMIN role: ${granted}`
    );
    if (staffGranted > 0) {
      console.log(`STAFF role had no permissions; granted all ${staffGranted} (trim them under Roles)`);
    }
    if (!ownerRole) {
      console.warn('No role with slug "admin" found — nothing was granted.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
