import * as React from "react";
import { mobileRegex, pincodeRegex } from "../validations/agent-profile.schema";
import { fieldCls } from "./shared";

export interface AddressValues {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
}

export type FieldErrors = Record<string, string>;

/** Mirrors addressSchema in agent-order.schema.ts, so the agent sees the problem next to the field. */
export function validateAddress(a: AddressValues, prefix = ""): FieldErrors {
  const e: FieldErrors = {};
  const k = (name: string) => `${prefix}${name}`;
  if (a.fullName.trim().length < 2) e[k("fullName")] = "Enter the receiver's name (at least 2 letters)";
  if (!mobileRegex.test(a.phone.trim())) e[k("phone")] = "Enter a valid 10-digit mobile number";
  if (a.addressLine1.trim().length < 3) e[k("addressLine1")] = "Enter the house / street address";
  if (a.city.trim().length < 2) e[k("city")] = "Enter the city";
  if (a.state.trim().length < 2) e[k("state")] = "Enter the state";
  if (!pincodeRegex.test(a.pincode.trim())) e[k("pincode")] = "Enter a valid 6-digit pincode";
  return e;
}

export function validateManualCustomer(m: { name: string; phone: string; email: string }): FieldErrors {
  const e: FieldErrors = {};
  if (m.name.trim().length < 2) e.manualName = "Enter the customer's name (at least 2 letters)";
  if (!mobileRegex.test(m.phone.trim())) e.manualPhone = "Enter a valid 10-digit mobile number";
  if (m.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email.trim())) e.manualEmail = "Enter a valid email or leave it empty";
  return e;
}

/** An input with its own inline error. Clears the error as soon as the agent edits the field. */
export function OrderField({
  name,
  errors,
  onClear,
  className = "",
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  errors: FieldErrors;
  onClear: (name: string) => void;
}) {
  const error = errors[name];
  return (
    <div className={className}>
      <input
        {...input}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        className={`${fieldCls} ${error ? "!border-red-500 focus:!ring-red-100" : ""}`}
        onChange={(e) => {
          if (error) onClear(name);
          input.onChange?.(e);
        }}
      />
      {error && (
        <p id={`${name}-error`} role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/** Scrolls to and focuses the first invalid field, so the agent is not left hunting for it. */
export function focusFirstError(errors: FieldErrors) {
  const first = Object.keys(errors)[0];
  if (!first) return;
  const el = document.querySelector<HTMLElement>(`[name="${first}"]`);
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
  el?.focus({ preventScroll: true });
}
