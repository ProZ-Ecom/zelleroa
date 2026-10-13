"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Link2, Share2, MessageCircle, Send, Mail } from "lucide-react";

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

  const shareTitle = "Shop with Zellora";
  const shareText = "Check out Zellora and shop through my referral link:";
  const encodedLink = encodeURIComponent(referralLink);
  const encodedMessage = encodeURIComponent(`${shareText} ${referralLink}`);
  // Detected after mount so server and client markup match during hydration.
  const [canNativeShare, setCanNativeShare] = useState(false);
  useEffect(() => {
    setCanNativeShare(typeof navigator.share === "function");
  }, []);
  const shareBtn =
    "inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-white/20";

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title: shareTitle, text: shareText, url: referralLink });
    } catch {
      // User dismissed the share sheet - nothing to do.
    }
  };

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-950 via-neutral-900 to-emerald-950 p-5 text-white shadow-lg ring-1 ring-white/10 sm:p-6">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" aria-hidden />
      <div className="pointer-events-none absolute -bottom-14 right-16 h-32 w-32 rounded-full bg-white/5" aria-hidden />
      <div className="relative flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-400/20 text-emerald-200">
              <Link2 className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-bold leading-tight">Your referral link</h2>
              <p className="text-[11px] text-emerald-200/80">Earn commission on every order placed with your code</p>
            </div>
          </div>
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100">
            Code <span className="ml-1 font-mono font-semibold tracking-wider">{referralCode}</span>
          </span>
        </div>
        <p className="text-sm text-neutral-300">Share this link — every customer who signs up through it is assigned to you.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={referralLink}
            className="h-11 w-full min-w-0 truncate rounded-xl border border-white/15 bg-black/25 px-3 font-mono text-sm text-white outline-none focus:border-emerald-300/60"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-neutral-900 shadow-sm transition-colors hover:bg-emerald-50 active:scale-[0.98]"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-neutral-400">Share via</span>
          {canNativeShare && (
            <button type="button" onClick={handleNativeShare} className={shareBtn}>
              <Share2 className="h-4 w-4" />
              Share
            </button>
          )}
          <a href={`https://wa.me/?text=${encodedMessage}`} target="_blank" rel="noopener noreferrer" className={shareBtn}>
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </a>
          <a
            href={`https://t.me/share/url?url=${encodedLink}&text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={shareBtn}
          >
            <Send className="h-4 w-4" />
            Telegram
          </a>
          <a
            href={`mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodedMessage}`}
            className={shareBtn}
          >
            <Mail className="h-4 w-4" />
            Email
          </a>
        </div>
      </div>
    </section>
  );
}
