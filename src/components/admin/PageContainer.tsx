"use client";

import * as React from "react";
import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";
import { AdminPageHeader, AdminContent } from "@/components/admin/AdminPageHeader";

interface PageContainerProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  children: React.ReactNode;
}

function PageContainer({
  title,
  description,
  actions,
  breadcrumbs,
  children,
}: PageContainerProps) {
  return (
    <div className="flex flex-1 min-h-0 min-w-0 max-w-full flex-col space-y-4 sm:space-y-6">
      <AdminPageHeader
        breadcrumbs={breadcrumbs && breadcrumbs.length > 0 ? <AdminBreadcrumb items={breadcrumbs} /> : undefined}
        title={title}
        description={description}
        actions={actions}
      />
      <AdminContent>{children}</AdminContent>
    </div>
  );
}

export { PageContainer };
export type { PageContainerProps };
