"use client";

import { useState } from "react";
import { EMAIL_MAX_LENGTH } from "@/lib/validations/email";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { VendorResponse } from "../types";

export interface VendorFormData {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  gstin: string;
  address: string;
  notes: string;
  isActive: boolean;
}

interface VendorFormProps {
  initial?: VendorResponse | null;
  isLoading?: boolean;
  submitLabel: string;
  onSubmit: (data: VendorFormData) => Promise<void>;
}

const label = "mb-1.5 block text-sm font-medium text-neutral-700";

export function VendorForm({ initial, isLoading, submitLabel, onSubmit }: VendorFormProps) {
  const [form, setForm] = useState<VendorFormData>({
    name: initial?.name ?? "",
    contactPerson: initial?.contactPerson ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    gstin: initial?.gstin ?? "",
    address: initial?.address ?? "",
    notes: initial?.notes ?? "",
    isActive: initial?.isActive ?? true,
  });
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof VendorFormData) => (value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!form.name.trim()) {
          setError("Vendor name is required");
          return;
        }
        setError(null);
        await onSubmit(form);
      }}
    >
      <div>
        <label className={label}>Vendor name *</label>
        <Input
          value={form.name}
          onChange={(e) => set("name")(e.target.value)}
          placeholder="ABC Textiles"
          maxLength={150}
          error={error ?? undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label className={label}>Contact person</label>
          <Input value={form.contactPerson} onChange={(e) => set("contactPerson")(e.target.value)} maxLength={120} />
        </div>
        <div>
          <label className={label}>Phone</label>
          <Input value={form.phone} onChange={(e) => set("phone")(e.target.value)} maxLength={20} />
        </div>
        <div>
          <label className={label}>Email</label>
          <Input type="email" value={form.email} onChange={(e) => set("email")(e.target.value)} maxLength={EMAIL_MAX_LENGTH} />
        </div>
        <div>
          <label className={label}>GSTIN</label>
          <Input value={form.gstin} onChange={(e) => set("gstin")(e.target.value.toUpperCase())} maxLength={20} />
        </div>
      </div>

      <div>
        <label className={label}>Address</label>
        <Textarea value={form.address} onChange={(e) => set("address")(e.target.value)} maxLength={500} rows={2} />
      </div>

      <div>
        <label className={label}>Notes</label>
        <Textarea value={form.notes} onChange={(e) => set("notes")(e.target.value)} maxLength={500} rows={2} />
      </div>

      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => set("isActive")(e.target.checked)}
        />
        Active (can be used on new purchase orders)
      </label>

      <div className="flex justify-end pt-2">
        <Button
          type="submit"
          isLoading={isLoading}
          className="h-11 rounded-xl bg-gradient-to-b from-[var(--color-primary-400)] to-[var(--color-primary-600)] shadow-[0_6px_16px_-6px_rgba(37,99,235,0.45),inset_0_1px_0_rgba(255,255,255,0.18)] transition-all px-6 text-sm font-semibold text-white hover:-translate-y-px hover:shadow-[0_10px_20px_-8px_rgba(37,99,235,0.5),inset_0_1px_0_rgba(255,255,255,0.18)] active:translate-y-0"
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
