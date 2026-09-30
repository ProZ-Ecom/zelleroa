"use client";

import { useParams, useRouter } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { ErrorState } from "@/components/ui/error-state";
import { PurchaseOrderForm } from "@/features/purchases/components/PurchaseOrderForm";
import { usePurchaseOrder, usePurchaseMutations } from "@/features/purchases/hooks";

export default function EditPurchaseOrderPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const router = useRouter();
  const { data: po, isLoading, error, refetch } = usePurchaseOrder(uuid);
  const { update } = usePurchaseMutations();

  if (isLoading) return <AdminTableSkeleton />;
  if (error || !po) return <ErrorState message="Failed to load purchase order" onRetry={() => refetch()} />;

  if (po.status !== "DRAFT" && po.status !== "REJECTED") {
    return (
      <ErrorState
        message="Only draft or rejected purchase orders can be edited"
        onRetry={() => router.push(`/admin/dashboard/purchase-orders/${uuid}`)}
      />
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-auto">
      <AdminPageHeader title={`Edit ${po.poNumber}`} description="Changes are saved to the same draft." />
      <div className="mt-6 max-w-5xl rounded-2xl bg-white p-6">
        <PurchaseOrderForm
          initial={po}
          submitLabel="Save Changes"
          isLoading={update.isPending}
          onSubmit={async (data) => {
            await update.mutateAsync({ uuid, data: { ...data } });
            router.push(`/admin/dashboard/purchase-orders/${uuid}`);
          }}
        />
      </div>
    </div>
  );
}
