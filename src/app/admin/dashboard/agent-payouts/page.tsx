"use client";

import { PageContainer } from "@/components/admin/PageContainer";
import { AdminPayoutsSection } from "@/features/agents/components/admin/AdminPayoutsSection";

export default function AdminAgentPayoutsPage() {
  return (
    <PageContainer
      title="Payout Management"
      description="Review payout requests: approve, transfer the money, then mark as paid with the transaction reference. Reject with a reason to return the commissions to the agent."
      breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Payouts" }]}
    >
      <AdminPayoutsSection />
    </PageContainer>
  );
}
