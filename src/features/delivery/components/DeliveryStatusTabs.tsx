"use client";

import { cn } from "@/lib/utils";
import { ScrollableTabs } from "@/components/ui/scrollable-tabs";

export interface DeliveryTabItem {
  id: string;
  label: string;
  count?: number;
}

interface DeliveryStatusTabsProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  counts?: Record<string, number>;
}

export const DELIVERY_TABS: { id: string; label: string }[] = [
  { id: "all", label: "All Deliveries" },
  { id: "pending", label: "Pending Acceptance" },
  { id: "in_transit", label: "In Transit" },
  { id: "out_for_delivery", label: "Out for Delivery" },
  { id: "delivered", label: "Delivered" },
  { id: "failed", label: "Failed" },
];

export function DeliveryStatusTabs({
  activeTab,
  onTabChange,
  counts = {},
}: DeliveryStatusTabsProps) {
  return (
    <ScrollableTabs>
      {DELIVERY_TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const count = counts[tab.id];

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all border cursor-pointer",
              isActive
                ? "bg-secondary-600 text-cream-white border-secondary-600 shadow-xs"
                : "bg-white text-neutral-500 border-cream-border-subtle hover:bg-cream-200 hover:text-secondary-800 hover:border-cream-border-hover"
            )}
          >
            <span>{tab.label}</span>
            {count !== undefined && count > 0 && (
              <span
                className={cn(
                  "grid place-items-center h-4 min-w-[16px] px-1 rounded-full text-[10px] font-bold tabular-nums",
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-cream-300 text-secondary-600"
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </ScrollableTabs>
  );
}
