import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/prisma";
import { apiSuccess, apiValidationError, apiError } from "@/lib/api/api-response";
import { withApiRoles } from "@/lib/api/api-handler";

const resetDatabaseSchema = z.object({
  excludeTables: z.array(z.string()).optional().default([]),
});

const ADMIN_ROLE_ID = 1;

// Tables that must never be wiped by this endpoint, regardless of input.
const ALWAYS_KEEP = new Set(["_prisma_migrations"]);

async function handlePOST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = resetDatabaseSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return apiValidationError(
      parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    );
  }

  const excludeTables = new Set(parsed.data.excludeTables.map((t) => t.toLowerCase()));

  try {
    const tables = await db.$queryRawUnsafe<Record<string, string>[]>(
      `SELECT table_name AS table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'`
    );

    const allTableNames = tables
      .map((t) => t.table_name ?? t.TABLE_NAME)
      .filter((name): name is string => Boolean(name));
    const truncated: string[] = [];
    const skipped: string[] = [];
    let usersDeletedCount = 0;

    // Run every raw statement on the same pinned connection — the pool hands
    // out a different connection per call otherwise, so SET FOREIGN_KEY_CHECKS
    // on one connection has no effect on a TRUNCATE issued on another.
    await db.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");

        try {
          for (const tableName of allTableNames) {
            if (ALWAYS_KEEP.has(tableName)) {
              skipped.push(tableName);
              continue;
            }

            if (excludeTables.has(tableName.toLowerCase())) {
              skipped.push(tableName);
              continue;
            }

            if (tableName === "users") {
              const result = await tx.$executeRawUnsafe(
                `DELETE FROM \`users\` WHERE role_id != ?`,
                ADMIN_ROLE_ID
              );
              usersDeletedCount = Number(result);
              continue;
            }

            await tx.$executeRawUnsafe(`TRUNCATE TABLE \`${tableName}\``);
            truncated.push(tableName);
          }
        } finally {
          await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1");
        }
      },
      { timeout: 120_000, maxWait: 120_000 }
    );

    return apiSuccess(
      {
        truncatedTables: truncated,
        skippedTables: skipped,
        usersDeleted: usersDeletedCount,
      },
      "Database reset completed"
    );
  } catch (error) {
    console.error("Reset database error:", error);
    return apiError("Failed to reset database", 500);
  }
}

export const POST = withApiRoles(["ADMIN"], handlePOST);
