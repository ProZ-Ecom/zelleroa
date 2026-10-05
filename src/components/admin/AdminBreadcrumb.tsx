"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
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

  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center text-sm", className)}>
      <ol className="flex items-center gap-1">
        {allItems.map((item, index) => {
          const isLast = index === allItems.length - 1;
          return (
            <li key={index} className="flex items-center gap-1">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <span className={cn(isLast ? "font-medium text-gray-900" : "text-gray-500")}>
                  {item.label}
                </span>
              )}
              {!isLast && <ChevronRight className="h-4 w-4 text-gray-400" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export { AdminBreadcrumb };
export type { AdminBreadcrumbProps, BreadcrumbItem };
