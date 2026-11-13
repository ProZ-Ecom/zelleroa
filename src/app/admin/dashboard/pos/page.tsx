"use client";

import { useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { PosBillingScreen } from "@/features/pos/components/PosBillingScreen";
import { ShiftCloseDialog } from "@/features/pos/components/ShiftCloseDialog";
import { ShiftOpenCard } from "@/features/pos/components/ShiftOpenCard";
import { useShiftState } from "@/features/pos/hooks/use-pos";

/**
 * The counter. A cashier lands here, opens a shift, and bills until they close
 * it; no shift means no keypad, because a bill with no drawer behind it cannot
 * be reconciled to anyone at the end of the day.
 */
export default function PosPage() {
  const { data, isLoading } = useShiftState();
  const [closing, setClosing] = useState(false);

  if (isLoading || !data) {
    return (
      <div className="flex flex-1 flex-col">
        <AdminPageHeader title="Counter (POS)" description="Over-the-counter billing." />
        <AdminTableSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <AdminPageHeader
        title="Counter (POS)"
        description="Type a SKU, take the money, print the bill. Stock and GST follow automatically."
      />

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        {data.session ? (
          <PosBillingScreen
            session={data.session}
            store={data.store}
            onCloseShift={() => setClosing(true)}
          />
        ) : (
          <ShiftOpenCard store={data.store} />
        )}
      </div>

      {data.session && (
        <ShiftCloseDialog
          session={data.session}
          open={closing}
          onClose={() => setClosing(false)}
          onClosed={() => setClosing(false)}
        />
      )}
    </div>
  );
}
