"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
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
  const { data, isLoading, error } = useShiftState();
  const [closing, setClosing] = useState(false);

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col">
        <AdminPageHeader title="Counter (POS)" description="Over-the-counter billing." />
        <AdminTableSkeleton />
      </div>
    );
  }

  // The counter cannot open without this call, and a skeleton that never
  // resolves reads as a blank screen - which is exactly how a missing
  // migration or an ungranted POS permission used to present itself. Say what
  // actually failed instead.
  if (error || !data) {
    const message = error instanceof Error ? error.message : "The counter could not be loaded.";
    return (
      <div className="flex flex-1 flex-col">
        <AdminPageHeader title="Counter (POS)" description="Over-the-counter billing." />
        <div className="mx-auto mt-10 w-full max-w-lg rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-black/[0.04]">
          <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-red-50">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </span>
          <h2 className="font-semibold text-neutral-900">The counter is not ready</h2>
          <p className="mt-1.5 text-sm text-neutral-600">{message}</p>
          <p className="mt-4 rounded-lg bg-neutral-50 p-3 text-left text-xs leading-relaxed text-neutral-500">
            On a fresh checkout the POS tables and permissions have to be created once:
            <br />
            <code className="text-neutral-700">npm run db:push</code> (or apply
            <code className="text-neutral-700"> prisma/migrations/20261113120000_pos_counter_sales</code>),
            then <code className="text-neutral-700">npm run db:permissions:sync</code>, then
            <code className="text-neutral-700"> npx prisma generate</code> and restart the dev server.
          </p>
        </div>
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
