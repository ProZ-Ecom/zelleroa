"use client";

import { useState } from "react";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOpenShift } from "../hooks/use-pos";
import type { PosStoreDto } from "../types";

/**
 * What a cashier sees before they can bill.
 *
 * The opening float is asked for here and nowhere else: without it the drawer
 * at close has nothing to be measured against, so the shift could never be
 * reconciled to the person who worked it.
 */
export function ShiftOpenCard({ store }: { store: PosStoreDto }) {
  const [openingCash, setOpeningCash] = useState("0");
  const openShift = useOpenShift();

  const amount = Number(openingCash);
  const valid = Number.isFinite(amount) && amount >= 0;

  return (
    <div className="mx-auto mt-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/[0.04]">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100">
          <Store className="h-5 w-5 text-neutral-600" />
        </span>
        <div>
          <h2 className="font-semibold text-neutral-900">Open your shift</h2>
          <p className="text-sm text-neutral-500">{store.name}</p>
        </div>
      </div>

      <label className="mb-1.5 block text-sm font-medium text-neutral-700">
        Cash in the drawer now
      </label>
      <Input
        type="number"
        min={0}
        step="0.01"
        inputMode="decimal"
        autoFocus
        value={openingCash}
        className="h-12 text-lg font-semibold"
        onChange={(event) => setOpeningCash(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && valid) openShift.mutate({ openingCash: amount });
        }}
      />

      <div className="mt-2 flex flex-wrap gap-2">
        {[0, 500, 1000, 2000, 5000].map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setOpeningCash(String(preset))}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium tabular-nums text-neutral-700 hover:bg-neutral-50"
          >
            {preset === 0 ? "Empty" : preset}
          </button>
        ))}
      </div>

      <p className="mt-2 text-xs text-neutral-500">
        Count the float before you start. At close, this plus your cash sales is what the
        drawer should hold.
      </p>

      <Button
        className="mt-5 h-11 w-full rounded-xl bg-stone-900 text-[#D4AF37] hover:bg-stone-800"
        disabled={!valid || openShift.isPending}
        onClick={() => openShift.mutate({ openingCash: amount })}
      >
        {openShift.isPending ? "Opening..." : "Open shift"}
      </Button>
    </div>
  );
}
