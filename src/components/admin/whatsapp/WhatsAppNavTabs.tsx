"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Send, Tag, BarChart3, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const TABS = [
  {
    label: "Overview & Connect",
    href: "/admin/dashboard/whatsapp",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: "Campaigns",
    href: "/admin/dashboard/whatsapp/campaigns",
    icon: Send,
    exact: false,
  },
  {
    label: "Templates",
    href: "/admin/dashboard/whatsapp/templates",
    icon: Tag,
    exact: true,
  },
  {
    label: "Reports",
    href: "/admin/dashboard/whatsapp/reports",
    icon: BarChart3,
    exact: true,
  },
];

export function WhatsAppNavTabs({
  showCreateButton = true,
  active,
}: {
  showCreateButton?: boolean;
  active?: string;
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200/80 pb-3 mb-6">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active
            ? tab.href.toLowerCase().includes(active.toLowerCase()) ||
              tab.label.toLowerCase().includes(active.toLowerCase())
            : tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap",
                isActive
                  ? "bg-secondary-600 text-white shadow-xs"
                  : "bg-white text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 border border-neutral-200/80"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </Link>
          );
        })}
      </div>

      {showCreateButton && (
        <Link href="/admin/dashboard/whatsapp/campaigns/create">
          <Button
            size="sm"
            className="gap-2 bg-theme-primary hover:bg-theme-primary-hover text-white font-semibold text-xs h-9 transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            Create Campaign
          </Button>
        </Link>
      )}
    </div>
  );
}
