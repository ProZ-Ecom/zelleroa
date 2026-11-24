"use client";

import { useState } from "react";
import { toast } from "@/components/ui/Toast";
import { EMAIL_MAX_LENGTH, getEmailError } from "@/lib/validations/email";
import { NAME_REGEX } from "@/lib/validations/name";
import {
  MOBILE_REGEX,
  STORED_MOBILE_REGEX,
  MOBILE_INVALID_MESSAGE,
} from "@/lib/validations/mobile";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { VendorResponse } from "../types";

export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

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

function validatePhone(raw: string): string | null {
  const val = raw.trim();
  if (!val) return null;
  const clean = val.replace(/[\s-]/g, "");
  if (STORED_MOBILE_REGEX.test(clean) || MOBILE_REGEX.test(clean)) {
    return null;
  }
  const digits = clean.replace(/\D/g, "");
  if (!clean.startsWith("+91") && digits.length !== 10) {
    return "Phone number must be a 10-digit mobile number";
  }
  return MOBILE_INVALID_MESSAGE;
}

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
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: keyof VendorFormData) => (value: string | boolean) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};

    const name = form.name.trim();
    if (!name) {
      errs.name = "Vendor name is required";
    } else if (name.length < 2) {
      errs.name = "Vendor name must be at least 2 characters";
    } else if (name.length > 150) {
      errs.name = "Vendor name cannot exceed 150 characters";
    }

    if (form.contactPerson.trim()) {
      if (!NAME_REGEX.test(form.contactPerson.trim())) {
        errs.contactPerson = "Contact person can only contain letters and spaces";
      } else if (form.contactPerson.trim().length > 120) {
        errs.contactPerson = "Contact person cannot exceed 120 characters";
      }
    }

    if (form.phone.trim()) {
      const phoneErr = validatePhone(form.phone);
      if (phoneErr) {
        errs.phone = phoneErr;
      }
    }

    if (form.email.trim()) {
      const emailErr = getEmailError(form.email.trim());
      if (emailErr) {
        errs.email = emailErr;
      }
    }

    if (form.gstin.trim()) {
      const gstinClean = form.gstin.trim().toUpperCase().replace(/\s+/g, "");
      if (!GSTIN_REGEX.test(gstinClean)) {
        errs.gstin = "Provide valid 15-character GSTIN (e.g. 29AAAAA0000A1Z5)";
      }
    }

    if (form.address.trim().length > 500) {
      errs.address = "Address cannot exceed 500 characters";
    }

    if (form.notes.trim().length > 500) {
      errs.notes = "Notes cannot exceed 500 characters";
    }

    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      const firstError = Object.values(validationErrors)[0];
      toast.error("Please fix the validation errors", firstError);
      return;
    }

    setErrors({});
    try {
      await onSubmit(form);
    } catch (err: any) {
      const backendErrors: Record<string, string> = {};
      if (Array.isArray(err?.errors)) {
        for (const errStr of err.errors) {
          const colonIdx = errStr.indexOf(":");
          if (colonIdx !== -1) {
            const field = errStr.slice(0, colonIdx).trim();
            const msg = errStr.slice(colonIdx + 1).trim();
            backendErrors[field] = msg;
          }
        }
      }
      if (err?.message?.includes("already exists")) {
        backendErrors.name = err.message;
      }
      if (Object.keys(backendErrors).length > 0) {
        setErrors(backendErrors);
      }
      const msg = err?.message || "Failed to save vendor";
      toast.error(msg);
    }
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      <div>
        <label className={label}>
          Vendor name <span className="text-red-500 font-bold">*</span>
        </label>
        <Input
          value={form.name}
          onChange={(e) => set("name")(e.target.value)}
          placeholder="e.g. ABC Textiles"
          maxLength={150}
          error={errors.name}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label className={label}>Contact person</label>
          <Input
            value={form.contactPerson}
            onChange={(e) => {
              const val = e.target.value.replace(/[^a-zA-Z\s]/g, "").slice(0, 120);
              set("contactPerson")(val);
            }}
            placeholder="e.g. Ramesh Kumar"
            maxLength={120}
            error={errors.contactPerson}
          />
        </div>
        <div>
          <label className={label}>Phone</label>
          <Input
            type="tel"
            inputMode="numeric"
            value={form.phone}
            onChange={(e) => {
              const val = e.target.value.replace(/[^\d+\s-]/g, "").slice(0, 15);
              set("phone")(val);
            }}
            placeholder="e.g. +91 9897567488"
            maxLength={15}
            error={errors.phone}
          />
        </div>
        <div>
          <label className={label}>Email</label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => set("email")(e.target.value)}
            placeholder="e.g. supplier@example.com"
            maxLength={EMAIL_MAX_LENGTH}
            error={errors.email}
          />
        </div>
        <div>
          <label className={label}>GSTIN</label>
          <Input
            value={form.gstin}
            onChange={(e) => set("gstin")(e.target.value.toUpperCase().slice(0, 15))}
            placeholder="e.g. 29AAAAA0000A1Z5"
            maxLength={15}
            error={errors.gstin}
          />
        </div>
      </div>

      <div>
        <label className={label}>Address</label>
        <Textarea
          value={form.address}
          onChange={(e) => set("address")(e.target.value)}
          placeholder="Vendor warehouse or office address..."
          maxLength={500}
          rows={2}
          error={errors.address}
        />
      </div>

      <div>
        <label className={label}>Notes</label>
        <Textarea
          value={form.notes}
          onChange={(e) => set("notes")(e.target.value)}
          placeholder="Additional notes or payment terms..."
          maxLength={500}
          rows={2}
          error={errors.notes}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => set("isActive")(e.target.checked)}
          className="rounded border-neutral-300 text-stone-900 focus:ring-stone-800"
        />
        Active (can be used on new purchase orders)
      </label>

      <div className="flex justify-end pt-2">
        <Button
          type="submit"
          isLoading={isLoading}
          className="h-11 rounded-xl bg-theme-primary hover:bg-theme-primary-hover px-6 text-sm font-semibold text-white transition-colors"
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
