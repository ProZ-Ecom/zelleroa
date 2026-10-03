import { redirect } from "next/navigation";

// Legacy URL; the customer account now lives at /account/dashboard.
export default async function LegacyProfileRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { tab } = await searchParams;
  redirect(tab ? `/account/dashboard?tab=${encodeURIComponent(tab)}` : "/account/dashboard");
}
