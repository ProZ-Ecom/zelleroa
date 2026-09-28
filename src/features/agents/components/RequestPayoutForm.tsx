"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { apiClient, ApiClientError } from "@/lib/api/api-client";
import { toast } from "@/components/ui/Toast";
import { money } from "./shared";

interface Props {
  amount: number;
  commissionCount: number;
  hasUpi: boolean;
  hasBank: boolean;
  preferredMethod: "upi" | "bank_transfer" | null;
  upiId: string | null;
  bankSummary: string | null;
}

export function RequestPayoutForm({ amount, commissionCount, hasUpi, hasBank, preferredMethod, upiId, bankSummary }: Props) {
  const router = useRouter();
  const firstAvailable = preferredMethod === "bank_transfer" && hasBank ? "bank_transfer" : hasUpi ? "upi" : hasBank ? "bank_transfer" : null;
  const [method, setMethod] = useState<"upi" | "bank_transfer" | null>(firstAvailable);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!method) return;
    setError(null);
    setSubmitting(true);
    try {
      await apiClient.post("/api/agent/payouts", { method });
      toast.success("Payout requested", "The admin will review it shortly.");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not request payout. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const noDetails = !hasUpi && !hasBank;

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Available for payout</p>
          <p className="text-3xl font-bold text-neutral-900">{money(amount)}</p>
          <p className="text-xs text-neutral-500">{commissionCount} approved commission(s) past their return period</p>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {noDetails ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Add your UPI or bank details first.{" "}
          <Link href="/agent/profile" className="font-semibold underline">
            Go to Profile &amp; Payment
          </Link>
        </div>
      ) : (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs font-medium text-neutral-600">Pay me via</legend>
          {hasUpi && (
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-neutral-200 px-3 py-2 text-sm has-[:checked]:border-neutral-900">
              <input type="radio" name="method" checked={method === "upi"} onChange={() => setMethod("upi")} />
              <span>
                <span className="font-medium">UPI</span> <span className="text-neutral-500">· {upiId}</span>
              </span>
            </label>
          )}
          {hasBank && (
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-neutral-200 px-3 py-2 text-sm has-[:checked]:border-neutral-900">
              <input type="radio" name="method" checked={method === "bank_transfer"} onChange={() => setMethod("bank_transfer")} />
              <span>
                <span className="font-medium">Bank transfer</span> <span className="text-neutral-500">· {bankSummary}</span>
              </span>
            </label>
          )}
        </fieldset>
      )}

      <div>
        <button
          type="button"
          onClick={submit}
          disabled={submitting || amount <= 0 || !method}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-neutral-900 px-5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? "Requesting…" : `Request payout of ${money(amount)}`}
        </button>
        {amount <= 0 && !noDetails && (
          <p className="mt-2 text-xs text-neutral-500">Nothing to pay out yet. Commission becomes available after the return period.</p>
        )}
      </div>
    </div>
  );
}
