"use client";

import { useState } from "react";
import { Copy, Check, Link2 } from "lucide-react";

interface ReferralLinkCardProps {
  referralCode: string;
  referralLink: string;
}

export function ReferralLinkCard({ referralCode, referralLink }: ReferralLinkCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (e.g. insecure context) - nothing to fall back to.
    }
  };

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-700 p-5 text-white shadow-sm sm:p-6">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" aria-hidden />
      <div className="pointer-events-none absolute -bottom-14 right-16 h-32 w-32 rounded-full bg-white/5" aria-hidden />
      <div className="relative flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15">
              <Link2 className="h-4 w-4" />
            </span>
            <h2 className="text-base font-bold">Your referral link</h2>
          </div>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs">
            Code <span className="ml-1 font-mono font-semibold tracking-wider">{referralCode}</span>
          </span>
        </div>
        <p className="text-sm text-neutral-300">Share this link — every customer who signs up through it is assigned to you.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={referralLink}
            className="h-11 w-full min-w-0 truncate rounded-xl border border-white/20 bg-white/10 px-3 text-sm text-white outline-none focus:border-white/50"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-100"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      </div>
    </section>
  );
}
