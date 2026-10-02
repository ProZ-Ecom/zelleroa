"use client";

import * as React from "react";
import { EMAIL_MAX_LENGTH, emailField } from "@/lib/validations/email";
import Link from "next/link";
import { Bell, ArrowRight, Loader2 } from "lucide-react";
import { useNewsletterSubscribe } from "@/features/newsletter/hooks/use-newsletter-subscribe";
import { contacts } from "@/constants/storefront";

export function Newsletter() {
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const subscribe = useNewsletterSubscribe();

  const whatsapp = contacts.find((c) => c.title === "WhatsApp");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = emailField.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    subscribe.mutate(
      { email: parsed.data },
      {
        onSuccess: () => setEmail(""),
        onError: (err) => setError(err instanceof Error ? err.message : "Something went wrong"),
      }
    );
  };

  return (
    <section className="w-full bg-white">
      <div className="w-full max-w-[1400px] 2xl:max-w-[1600px] 3xl:max-w-[1800px] mx-auto px-4 sm:px-6 md:px-8 py-8 sm:py-10">
        <div className="rounded-2xl bg-theme-primary-light/60 px-6 py-10 sm:py-14 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-theme-primary text-white">
            <Bell className="h-5 w-5" />
          </div>

          <h2 className="mt-5 text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-theme-text-primary">
            Get the Latest from Zellora
          </h2>
          <p className="mt-2 max-w-md mx-auto text-sm text-theme-text-subtle">
            Be the first to know about new arrivals, exclusive member offers, and upcoming
            category launches.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto"
          >
            <input
              type="email"
              maxLength={EMAIL_MAX_LENGTH}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              className="w-full h-12 px-4 rounded-md border border-theme-border bg-white text-sm text-theme-text-primary placeholder:text-theme-text-subtle outline-none focus:border-theme-primary transition-colors"
            />
            <button
              type="submit"
              disabled={subscribe.isPending}
              className="w-full sm:w-auto h-12 shrink-0 px-6 rounded-md bg-theme-primary hover:bg-theme-primary-hover text-white text-sm font-bold uppercase tracking-wide transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {subscribe.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {subscribe.isSuccess ? "Subscribed" : "Subscribe"}
            </button>
          </form>

          {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
          {subscribe.isSuccess && !error && (
            <p className="mt-2 text-xs font-medium text-emerald-600">
              You&apos;re on the list! Watch your inbox for updates.
            </p>
          )}

          {whatsapp && (
            <Link
              href={whatsapp.link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-theme-text-primary shadow-xs hover:shadow-sm transition-shadow"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Get instant updates &amp; order tracking on WhatsApp
              <ArrowRight className="h-3.5 w-3.5 text-theme-primary" />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

export default Newsletter;
