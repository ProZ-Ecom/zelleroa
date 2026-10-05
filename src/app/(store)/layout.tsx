import { Suspense } from "react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getPageSessionUser } from "@/lib/auth/require-auth";
import { db } from "@/lib/db/prisma";

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Covers both auth mechanisms (NextAuth session and the HttpOnly access_token
  // cookie), so the header doesn't show "Login" when only the cookie exists.
  const sessionUser = await getPageSessionUser();
  // The cookie carries no display name, and the client profile query waits for
  // the NextAuth session, so resolve it here for the avatar initials.
  let name: string | undefined;
  if (sessionUser?.id) {
    const row = await db.user
      .findFirst({
        where: {
          OR: [
            { uuid: sessionUser.id },
            ...(/^\d+$/.test(sessionUser.id) ? [{ id: BigInt(sessionUser.id) }] : []),
          ],
        },
        select: { name: true },
      })
      .catch(() => null);
    name = row?.name;
  }
  const initialUser = sessionUser
    ? { role: sessionUser.role, email: sessionUser.email, name }
    : null;

  return (
    <div className="flex min-h-screen flex-col">
      <Suspense fallback={null}>
        <Header initialUser={initialUser} />
      </Suspense>
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
