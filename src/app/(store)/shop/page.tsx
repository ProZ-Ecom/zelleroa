import { redirect } from "next/navigation";

interface ShopPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Route `/shop` to catalog listing or category page.
 * Handles queries like `/shop?category=men`, `/shop?category=women`, etc.
 */
export default async function ShopPage({ searchParams }: ShopPageProps) {
  const rawParams = await searchParams;
  const categoryParam = typeof rawParams.category === "string" ? rawParams.category.toLowerCase().trim() : null;

  if (categoryParam === "men" || categoryParam === "women" || categoryParam === "kids") {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(rawParams)) {
      if (key === "category") continue;
      if (Array.isArray(value)) value.forEach((v) => qs.append(key, v));
      else if (value !== undefined) qs.set(key, value);
    }
    const suffix = qs.toString();
    redirect(`/category/${categoryParam}${suffix ? `?${suffix}` : ""}`);
  }

  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(rawParams)) {
    if (Array.isArray(value)) value.forEach((v) => qs.append(key, v));
    else if (value !== undefined) qs.set(key, value);
  }
  const suffix = qs.toString();
  redirect(`/products${suffix ? `?${suffix}` : ""}`);
}
