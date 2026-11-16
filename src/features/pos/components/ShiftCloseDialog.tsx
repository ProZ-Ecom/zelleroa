"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatPrice } from "@/lib/utils";
import { useCloseShift, useShiftSummary } from "../hooks/use-pos";
import type { PosSessionDto } from "../types";

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

/**
 * Counting the drawer.
 *
 * Expected cash is shown only after the cashier has typed what they counted,
 * so the number they enter is a count and not a copy. The variance the server
 * stores is recomputed there; this is the preview.
 */
export function ShiftCloseDialog({
  session,
  open,
  onClose,
  onClosed,
}: {
  session: PosSessionDto;
  open: boolean;
  onClose: () => void;
  onClosed: () => void;
}) {
  const [counted, setCounted] = useState("");
  const [reason, setReason] = useState("");
  const summary = useShiftSummary(open ? session.uuid : null);
  const closeShift = useCloseShift();

  const countedValue = Number(counted);
  const hasCount = counted.trim() !== "" && Number.isFinite(countedValue) && countedValue >= 0;

  const variance = useMemo(() => {
    if (!hasCount || !summary.data) return null;
    return round2(countedValue - summary.data.expectedCash);
  }, [hasCount, countedValue, summary.data]);

  const needsReason = variance !== null && variance !== 0;
  const canClose = hasCount && !!summary.data && (!needsReason || reason.trim().length > 0);

  const submit = async () => {
    await closeShift.mutateAsync({
      sessionUuid: session.uuid,
      countedCash: countedValue,
      varianceReason: reason.trim() || undefined,
    });
    onClosed();
  };

  const totals = summary.data;

  return (
    <Modal open={open} onClose={onClose} title="Close shift">
      <div className="space-y-5">
        {totals ? (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Figure label="Bills" value={String(totals.billCount)} />
            <Figure label="Voided" value={String(totals.voidedCount)} />
            <Figure label="Net sales" value={formatPrice(totals.netSales)} />
            <Figure label="Cash sales" value={formatPrice(totals.cash)} />
            <Figure label="UPI" value={formatPrice(totals.upi)} />
            <Figure label="Card" value={formatPrice(totals.card)} />
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Adding up this shift...</p>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-700">
            Cash counted in the drawer
          </label>
          <Input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            autoFocus
            value={counted}
            onChange={(event) => setCounted(event.target.value)}
            placeholder="Count the notes and coins"
          />
        </div>

        {hasCount && totals && (
          <div className="rounded-xl bg-neutral-50 p-4 text-sm">
            <Row label="Opening float" value={formatPrice(session.openingCash)} />
            <Row label="Cash sales" value={formatPrice(totals.cash)} />
            <Row label="Expected" value={formatPrice(totals.expectedCash)} strong />
            <Row label="Counted" value={formatPrice(countedValue)} />
            <Row
              label={variance === 0 ? "Balanced" : variance! < 0 ? "Short" : "Over"}
              value={formatPrice(Math.abs(variance ?? 0))}
              tone={variance === 0 ? "ok" : "warn"}
              strong
            />
          </div>
        )}

        {needsReason && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              Why does it not match? *
            </label>
            <Textarea
              rows={2}
              maxLength={255}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. gave change from own pocket, note miscount"
            />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-stone-900 text-[#D4AF37] hover:bg-stone-800"
            disabled={!canClose || closeShift.isPending}
            onClick={submit}
          >
            {closeShift.isPending ? "Closing..." : "Close shift"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 p-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="font-semibold tabular-nums text-neutral-900">{value}</p>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className={tone === "warn" ? "text-amber-700" : "text-neutral-600"}>{label}</span>
      <span
        className={[
          "tabular-nums",
          strong ? "font-semibold" : "",
          tone === "warn" ? "text-amber-700" : tone === "ok" ? "text-emerald-700" : "",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}
