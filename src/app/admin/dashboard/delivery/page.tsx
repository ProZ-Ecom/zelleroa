"use client";

import {
  AdminPageHeader,
  AdminContent,
} from "@/components/admin/AdminPageHeader";
import { StaffDeliveryListTable } from "@/features/delivery/components/StaffDeliveryListTable";

export default function DeliveryPage() {
  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <AdminPageHeader
        title="Deliveries"
        description="View and update your assigned delivery milestones"
      />
      <AdminContent className="mt-3 flex-1 min-h-0">
        <StaffDeliveryListTable />
      </AdminContent>
    </div>
  );
}

