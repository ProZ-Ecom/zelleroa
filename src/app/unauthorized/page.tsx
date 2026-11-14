import type { Metadata } from "next";
import Link from "next/link";
import { constructMetadata } from "@/lib/seo";

export const metadata: Metadata = constructMetadata({
  title: "Unauthorized Access",
  noIndex: true,
});

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Unauthorized</h1>
        <p className="text-muted-foreground mb-6">
          You don&apos;t have permission to access this page.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
