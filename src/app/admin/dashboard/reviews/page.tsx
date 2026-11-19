"use client";

import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";
import { AdminPageHeader, AdminContent } from "@/components/admin/AdminPageHeader";
import { AdminReviewListTable } from "@/features/reviews/components/AdminReviewListTable";

export default function ReviewsPage() {
  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <AdminBreadcrumb
        items={[
          { label: "Catalog", href: "/admin/dashboard/products" },
          { label: "Reviews" },
        ]}
      />

      <AdminPageHeader
        title="Product Reviews"
        description="Monitor, approve, reject, and manage customer feedback and ratings"
      />

      <AdminContent className="flex-1 min-h-0">
        <AdminReviewListTable />
      </AdminContent>
    </div>
  );
}
