import { db } from "@/lib/db/prisma";

/**
 * Resolves an agent reference (uuid, agent code such as AGT001, or numeric id) to
 * users.id for use as a report filter. Returns null when no agent was asked for, and
 * BigInt(0) for an unknown one so the filter matches nothing instead of everything.
 */
export async function resolveAgentFilter(ref?: string | null): Promise<bigint | null> {
  if (!ref) return null;
  const agent = await db.user.findFirst({
    where: {
      role: { slug: "agent" },
      OR: [
        { uuid: ref },
        { agent_profile: { agent_code: ref } },
        ...(/^\d+$/.test(ref) ? [{ id: BigInt(ref) }] : []),
      ],
    },
    select: { id: true },
  });
  return agent?.id ?? BigInt(0);
}

/**
 * Resolves a category reference (uuid, slug or numeric id) to product_categories.id.
 * Same unknown-matches-nothing rule as `resolveAgentFilter`.
 */
export async function resolveCategoryFilter(ref?: string | null): Promise<bigint | null> {
  if (!ref) return null;
  const row = await db.productCategory.findFirst({
    where: { OR: [{ uuid: ref }, { slug: ref }, ...(/^\d+$/.test(ref) ? [{ id: BigInt(ref) }] : [])] },
    select: { id: true },
  });
  return row?.id ?? BigInt(0);
}

/** Resolves a brand reference (uuid, slug or numeric id) to product_brands.id. */
export async function resolveBrandFilter(ref?: string | null): Promise<bigint | null> {
  if (!ref) return null;
  const row = await db.productBrand.findFirst({
    where: { OR: [{ uuid: ref }, { slug: ref }, ...(/^\d+$/.test(ref) ? [{ id: BigInt(ref) }] : [])] },
    select: { id: true },
  });
  return row?.id ?? BigInt(0);
}
