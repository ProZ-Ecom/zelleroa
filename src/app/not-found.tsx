import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page Not Found — Zellora",
  description: "The page you are looking for does not exist.",
};

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--background)] px-6">
      <div className="max-w-md w-full text-center">
        <p className="text-8xl font-bold tracking-tight text-[var(--primary-500)] font-[family-name:var(--font-hanken)]">
          404
        </p>
        <h1 className="mt-4 text-2xl font-semibold text-[var(--foreground)] font-[family-name:var(--font-hanken)]">
          Page not found
        </h1>
        <p className="mt-3 text-[var(--secondary-500)]">
          Sorry, we couldn&apos;t find the page you&apos;re looking for. It may
          have been moved, renamed, or no longer exists.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="w-full sm:w-auto rounded-lg bg-[var(--primary-500)] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-600)]"
          >
            Back to home
          </Link>
          <Link
            href="/products"
            className="w-full sm:w-auto rounded-lg border border-[var(--secondary-200)] bg-white px-6 py-3 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--secondary-100)]"
          >
            Browse products
          </Link>
        </div>
      </div>
    </main>
  );
}
