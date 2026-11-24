"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Download, X, Share } from "lucide-react";
import { usePwaInstall } from "./usePwaInstall";

const DISMISS_KEY = "zellora_pwa_dismissed_at";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function PwaInstallPrompt() {
  const { isInstallable, isInstalled, isIos, isStandalone, installApp } = usePwaInstall();
  const [dismissed, setDismissed] = useState(true);
  const [showIosInstructions, setShowIosInstructions] = useState(false);

  useEffect(() => {
    // Check if prompt was dismissed recently
    try {
      const dismissedAt = localStorage.getItem(DISMISS_KEY);
      if (dismissedAt) {
        const timePassed = Date.now() - parseInt(dismissedAt, 10);
        if (timePassed < DISMISS_DURATION_MS) {
          setDismissed(true);
          return;
        }
      }
    } catch {
      // LocalStorage error fallback
    }

    // Only show if not installed and (installable OR iOS Safari)
    if (!isInstalled && !isStandalone && (isInstallable || isIos)) {
      setDismissed(false);
    }
  }, [isInstallable, isInstalled, isIos, isStandalone]);

  const handleDismiss = () => {
    setDismissed(true);
    setShowIosInstructions(false);
    try {
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    } catch {
      // ignore
    }
  };

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosInstructions((prev) => !prev);
      return;
    }

    const success = await installApp();
    if (success) {
      setDismissed(true);
    }
  };

  if (dismissed || isInstalled || isStandalone) {
    return null;
  }

  return (
    <aside
      role="region"
      aria-label="Install App"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-5 duration-300"
    >
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-slate-200/80 dark:border-slate-800 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-primary-50 dark:bg-slate-800 flex-shrink-0 border border-slate-200 dark:border-slate-750 flex items-center justify-center">
            <Image
              src="/icons/icon-192x192.png"
              alt="Zellora Icon"
              width={48}
              height={48}
              className="object-contain p-1"
            />
          </div>

          <div className="flex-1 min-w-0 pr-1">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
              Install Zellora App
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug line-clamp-2">
              Enjoy a faster shopping experience with offline access right from your home screen.
            </p>
          </div>

          <button
            onClick={handleDismiss}
            aria-label="Close install prompt"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 -mr-1 -mt-1 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* iOS Step-by-Step Instructions */}
        {showIosInstructions && isIos && (
          <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl text-xs text-slate-600 dark:text-slate-300 space-y-1.5 border border-slate-200 dark:border-slate-700">
            <div className="font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>To install on iOS:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 pl-1">
              <li className="flex items-center gap-1.5">
                <span>1. Tap the Share button</span>
                <Share className="w-3.5 h-3.5 text-blue-600 inline flex-shrink-0" />
                <span>in Safari</span>
              </li>
              <li>2. Scroll down and tap &ldquo;Add to Home Screen&rdquo;</li>
              <li>3. Tap &ldquo;Add&rdquo; in the top-right corner</li>
            </ol>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleInstallClick}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isIos ? (showIosInstructions ? "Hide Instructions" : "Install on iOS") : "Install App"}</span>
          </button>

          <button
            onClick={handleDismiss}
            className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            Not Now
          </button>
        </div>
      </div>
    </aside>
  );
}
