"use client";
import { ReferralFlow } from "@/features/agents/components/ReferralFlow";

import { PageContainer } from "@/components/admin/PageContainer";
import { AdminCommissionsSection } from "@/features/agents/components/admin/AdminCommissionsSection";
import { AdminOrdersSection } from "@/features/agents/components/admin/AdminOrdersSection";

export default function AdminCommissionsPage() {
  return (
    <PageContainer
      title="Commission Management"
      description="Every commission with its rate, status and audit trail. Commissions are approved automatically once the return period ends."
      breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Commissions" }]}
    >
      <div className="flex flex-col gap-5">
        <ReferralFlow />
        <AdminCommissionsSection />
        <AdminOrdersSection />
      </div>
    </PageContainer>
  );
}
