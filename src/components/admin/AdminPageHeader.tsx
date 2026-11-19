"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AdminBreadcrumb, type BreadcrumbItem } from "./AdminBreadcrumb";

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  breadcrumbs?: React.ReactNode | BreadcrumbItem[];
  children?: React.ReactNode;
  className?: string;
}

function AdminPageHeader({
  title,
  description,
  subtitle,
  actions,
  breadcrumbs,
  children,
  className,
}: AdminPageHeaderProps) {
  const renderedBreadcrumbs = Array.isArray(breadcrumbs) ? (
    <AdminBreadcrumb items={breadcrumbs} />
  ) : (
    breadcrumbs
  );
  const displayDescription = description || subtitle;

  return (
    <div className={cn("space-y-4 flex-shrink-0", className)}>
      {renderedBreadcrumbs}
        <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{title}</h1>
            {displayDescription && (
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500">{displayDescription}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
        {children}
      </div>
      );
}

      interface AdminContentProps {
        children: React.ReactNode;
      className?: string;
}

      function AdminContent({children, className}: AdminContentProps) {
  return (
      <div className={cn("mt-6 flex-1 min-h-0 flex flex-col", className)}>
        {children}
      </div>
      );
}

      export {AdminPageHeader, AdminContent};
      export type {AdminPageHeaderProps, AdminContentProps};
