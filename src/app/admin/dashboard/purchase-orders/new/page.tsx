"use client";

import { useRouter } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { PurchaseOrderForm } from "@/features/purchases/components/PurchaseOrderForm";
import { usePurchaseMutations } from "@/features/purchases/hooks";

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const { create } = usePurchaseMutations();

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-auto">
      <AdminPageHeader
        title="New Purchase Order"
        description="Saved as a draft. Submit it for approval from the order page."
      />
      <div className="mt-6 max-w-5xl rounded-2xl bg-white p-6">
        <PurchaseOrderForm
          submitLabel="Save Draft"
          isLoading={create.isPending}
          onSubmit={async (data) => {
            const res = await create.mutateAsync({ ...data });
            router.push(`/admin/dashboard/purchase-orders/${res.data?.id ?? ""}`);
          }}
        />
      </div>
    </div>
  );
}
