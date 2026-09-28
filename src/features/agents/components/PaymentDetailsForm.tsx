"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { apiClient, ApiClientError } from "@/lib/api/api-client";
import { toast } from "@/components/ui/Toast";
import { paymentDetailsSchema } from "../validations/agent.schema";
import { fieldCls } from "./shared";

interface Props {
  payment: {
    preferredMethod: "upi" | "bank_transfer" | null;
    upiId: string | null;
    accountHolderName: string | null;
    bankName: string | null;
    accountNumberMasked: string | null;
    ifsc: string | null;
  };
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
      {label}
      {children}
      {hint && !error && <span className="font-normal text-neutral-400">{hint}</span>}
      {error && <span className="font-normal text-red-600">{error}</span>}
    </label>
  );
}

export function PaymentDetailsForm({ payment }: Props) {
  const router = useRouter();
  const [method, setMethod] = useState<"upi" | "bank_transfer">(payment.preferredMethod ?? "upi");
  const [upiId, setUpiId] = useState(payment.upiId ?? "");
  const [holder, setHolder] = useState(payment.accountHolderName ?? "");
  const [bankName, setBankName] = useState(payment.bankName ?? "");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState(payment.ifsc ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);

    const payload =
      method === "upi"
        ? { method, upiId }
        : { method, accountHolderName: holder, bankName, accountNumber, ifsc };

    const parsed = paymentDetailsSchema.safeParse(payload);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});

    setSaving(true);
    try {
      await apiClient.put("/api/agent/profile", parsed.data);
      toast.success("Payment details saved");
      setAccountNumber("");
      router.refresh();
    } catch (err) {
      setBanner(err instanceof ApiClientError ? [err.message, ...(err.errors ?? [])].join(" · ") : "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 p-4 sm:p-5" noValidate>
      {banner && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{banner}</div>}

      <div className="inline-flex w-full rounded-xl bg-neutral-100 p-1 sm:w-auto">
        {(["upi", "bank_transfer"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            className={`min-h-[40px] flex-1 rounded-lg px-4 text-sm font-medium transition-colors sm:flex-none ${
              method === m ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"
            }`}
          >
            {m === "upi" ? "UPI" : "Bank transfer"}
          </button>
        ))}
      </div>

      {method === "upi" ? (
        <Field error={errors.upiId} label="UPI ID" hint="e.g. name@okbank">
          <input className={fieldCls} value={upiId} onChange={(e) => setUpiId(e.target.value)} autoComplete="off" />
        </Field>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field error={errors.accountHolderName} label="Account holder name">
            <input className={fieldCls} value={holder} onChange={(e) => setHolder(e.target.value)} autoComplete="off" />
          </Field>
          <Field error={errors.bankName} label="Bank name">
            <input className={fieldCls} value={bankName} onChange={(e) => setBankName(e.target.value)} autoComplete="off" />
          </Field>
          <Field
            error={errors.accountNumber}
            label="Account number"
            hint={payment.accountNumberMasked ? `Saved: ${payment.accountNumberMasked}. Re-enter the full number to change it.` : "9-18 digits"}
          >
            <input
              className={fieldCls}
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              autoComplete="off"
              type="password"
            />
          </Field>
          <Field error={errors.ifsc} label="IFSC code" hint="e.g. HDFC0001234">
            <input className={`${fieldCls} uppercase`} value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} autoComplete="off" maxLength={11} />
          </Field>
        </div>
      )}

      <div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-neutral-900 px-5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Saving…" : "Save payment details"}
        </button>
      </div>
    </form>
  );
}
