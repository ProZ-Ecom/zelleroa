import { db } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/api-error";

/** Deepest sensible category nesting; the loop stops here rather than spinning on a cycle. */
const MAX_CATEGORY_DEPTH = 6;

/**
 * Filtering by a category means "this category and everything under it" — a
 * product sits in one leaf category, so picking "Men" has to reach its children
 * too. Product has no Prisma relation to ProductCategory, so the ids are
 * resolved here and matched against the scalar `categoryId`.
 */
export async function categoryFilterIds(slug: string): Promise<bigint[]> {
  const root = await db.productCategory.findFirst({ where: { slug }, select: { id: true } });
  if (!root) throw ApiError.notFound("Category not found");

  const all = [root.id];
  let frontier = [root.id];
  for (let depth = 0; depth < MAX_CATEGORY_DEPTH && frontier.length > 0; depth++) {
    const children = await db.productCategory.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    });
    frontier = children.map((c) => c.id).filter((id) => !all.includes(id));
    all.push(...frontier);
  }
  return all;
}
