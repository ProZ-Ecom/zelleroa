import { redirect } from "next/navigation";

interface CollectionsPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Route `/collections/:slug` to `/category/:slug` preserving filter queries.
 */
export default async function CollectionsPage({ params, searchParams }: CollectionsPageProps) {
  const [{ slug }, rawSearchParams] = await Promise.all([params, searchParams]);
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(rawSearchParams)) {
    if (Array.isArray(value)) value.forEach((v) => qs.append(key, v));
    else if (value !== undefined) qs.set(key, value);
  }
  const suffix = qs.toString();
  redirect(`/category/${encodeURIComponent(slug)}${suffix ? `?${suffix}` : ""}`);
}
