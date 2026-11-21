"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface AdminBreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

function AdminBreadcrumb({ items, className }: AdminBreadcrumbProps) {
  const allItems = React.useMemo(() => {
    if (items.length > 0 && items[0].label === "Dashboard") {
      return items;
    }
    return [{ label: "Dashboard", href: "/admin/dashboard" }, ...items];
  }, [items]);

  if (allItems.length <= 1) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center text-xs sm:text-sm font-medium", className)}>
      <ol className="flex items-center gap-1.5 flex-wrap">
        {allItems.map((item, index) => {
          const isLast = index === allItems.length - 1;
          return (
            <li key={index} className="flex items-center gap-1.5">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="text-neutral-500 hover:text-secondary-700 transition-colors font-medium hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span className={cn(isLast ? "font-semibold text-neutral-900" : "text-neutral-500")}>
                  {item.label}
                </span>
              )}
              {!isLast && <ChevronRight className="h-3.5 w-3.5 text-neutral-400 shrink-0" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export { AdminBreadcrumb };
export type { AdminBreadcrumbProps, BreadcrumbItem };
