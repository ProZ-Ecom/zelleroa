"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { AccountShell } from "@/features/customers/components/account";
import { LoadingState } from "@/components/ui/loading-state";

function AccountPageSkeleton() {
  return (
    <div className="min-h-screen bg-theme-bg pb-16 animate-pulse">
      {/* Top Banner Skeleton */}
      <div className="bg-theme-primary py-5 sm:py-7 px-4 sm:px-8">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between">
          <div className="h-8 w-48 rounded-xl bg-white/20 skeleton-shimmer" />
          <div className="h-4 w-60 rounded-md bg-white/15 skeleton-shimmer hidden sm:block" />
        </div>
      </div>

      {/* Main Layout Shell */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 py-5 sm:py-7 flex flex-col md:grid md:grid-cols-[260px_1fr] lg:grid-cols-[280px_1fr] gap-5 lg:gap-7 items-start">
        {/* Sidebar Skeleton */}
        <div className="w-full bg-theme-surface border border-theme-border rounded-2xl p-5 space-y-4 shadow-2xs">
          <div className="flex items-center gap-3 pb-4 border-b border-theme-border-subtle">
            <div className="w-12 h-12 rounded-full skeleton-shimmer shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-28 rounded skeleton-shimmer" />
              <div className="h-3 w-20 rounded skeleton-shimmer" />
            </div>
          </div>
          <div className="space-y-2 pt-1">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-10 w-full rounded-xl skeleton-shimmer" />
            ))}
          </div>
        </div>

        {/* Content Area Skeleton */}
        <div className="w-full space-y-5">
          <div className="h-36 rounded-2xl skeleton-shimmer" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 rounded-2xl skeleton-shimmer" />
            ))}
          </div>
          <div className="h-64 rounded-2xl skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  const currentTab = searchParams.get("tab") || "dashboard";

  if (status === "loading") {
    return <AccountPageSkeleton />;
  }

  if (status === "unauthenticated" || !session) {
    router.push("/login?callbackUrl=/account/dashboard");
    return null;
  }

  const handleTabChange = (newTab: string) => {
    router.push(`/account/dashboard?tab=${newTab}`, { scroll: false });
  };

  return (
    <AccountShell
      activeTab={currentTab}
      onTabChange={handleTabChange}
    />
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<AccountPageSkeleton />}>
      <ProfileContent />
    </Suspense>
  );
}
