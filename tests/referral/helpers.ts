import crypto from "node:crypto";
import { db } from "@/lib/db/prisma";

export class Rollback extends Error {}

/** Runs `fn` in a transaction that is ALWAYS rolled back, so tests leave the dev DB untouched. */
export async function inRollback(fn: (tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<void>) {
  try {
    await db.$transaction(
      async (tx) => {
        await fn(tx);
        throw new Rollback();
      },
      { timeout: 30_000 }
    );
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
}

export async function makeUser(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  roleSlug: "agent" | "customer",
  extra: Record<string, unknown> = {}
) {
  const role = await tx.role.findFirstOrThrow({ where: { slug: roleSlug }, select: { id: true } });
  const tag = crypto.randomBytes(5).toString("hex");
  return tx.user.create({
    data: {
      uuid: crypto.randomUUID(),
      name: `T ${roleSlug} ${tag}`,
      email: `t-${tag}@example.test`,
      password_hash: "x",
      roleId: role.id,
      status: "active",
      ...extra,
    },
  });
}
