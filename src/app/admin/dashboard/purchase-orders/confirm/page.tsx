"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { PurchaseOrderForm } from "@/features/purchases/components/PurchaseOrderForm";
import { usePurchaseMutations } from "@/features/purchases/hooks";

export default function CreatePurchasePage() {
  const router = useRouter();
  const { confirm } = usePurchaseMutations();
  // One key per opened form: a double click or retry re-sends the same key, so stock is added once.
  const idempotencyKey = useRef(crypto.randomUUID());

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-auto">
      <AdminPageHeader
        title="Create Purchase"
        description="Enter what you bought from the vendor. Confirming adds the quantities to stock right away."
      />
      <div className="mt-6 max-w-5xl rounded-2xl bg-white p-6">
        <PurchaseOrderForm
          mode="confirm"
          submitLabel="Confirm Purchase"
          isLoading={confirm.isPending}
          onSubmit={async (data) => {
            const res = await confirm.mutateAsync({ ...data, idempotencyKey: idempotencyKey.current });
            router.push(`/admin/dashboard/purchase-orders/${res.data?.id ?? ""}`);
          }}
        />
      </div>
    </div>
  );
}
