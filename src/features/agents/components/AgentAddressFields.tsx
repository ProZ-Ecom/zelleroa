"use client";

import * as React from "react";
import { usePincodeLookup } from "@/features/addresses/hooks/use-pincode-lookup";
import { fieldCls } from "./shared";
import { OrderField, type AddressValues, type FieldErrors } from "./order-field";

/**
 * Delivery address fields for the agent order forms. The pincode comes first: once 6 digits are entered
 * the post offices are fetched, city and state are filled in, and the address lines unlock.
 */
export function AgentAddressFields({
  value,
  onChange,
  errors,
  onClear,
}: {
  value: AddressValues;
  onChange: (v: AddressValues) => void;
  errors: FieldErrors;
  onClear: (name: string) => void;
}) {
  const { isLoading, lookupError, postOffices, triggerLookup, resetLookup } = usePincodeLookup();
  const [area, setArea] = React.useState("");
  const latest = React.useRef(value);
  latest.current = value;

  const pin = value.pincode;
  React.useEffect(() => {
    setArea("");
    if (!/^\d{6}$/.test(pin)) {
      resetLookup();
      return;
    }
    void triggerLookup(pin, {
      onSuccess: ({ city, state }) => {
        if (latest.current.pincode !== pin) return;
        onChange({ ...latest.current, city, state });
        onClear("city");
        onClear("state");
      },
    });
    // onChange / onClear are fresh closures each render; only a pincode change should refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  const set = (k: keyof AddressValues) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value });
  const onPincode = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
    // Editing the pincode invalidates whatever the previous one filled in.
    onChange({ ...value, pincode: digits, city: "", state: "" });
  };
  const onArea = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    setArea(next);
    const prevWasArea = !value.addressLine2.trim() || value.addressLine2 === area;
    if (next && prevWasArea) onChange({ ...value, addressLine2: next });
  };

  const f = { errors, onClear };
  const ready = /^\d{6}$/.test(pin);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <OrderField name="fullName" {...f} placeholder="Receiver name" value={value.fullName} onChange={set("fullName")} />
      <OrderField name="phone" {...f} placeholder="Mobile (10 digits)" inputMode="numeric" maxLength={10} value={value.phone} onChange={set("phone")} />

      <div className="sm:col-span-2">
        <OrderField name="pincode" {...f} placeholder="Pincode (enter this first)" inputMode="numeric" maxLength={6} value={value.pincode} onChange={onPincode} />
        {isLoading && <p className="mt-1 text-xs text-neutral-500">Checking pincode…</p>}
        {lookupError && !isLoading && <p className="mt-1 text-xs text-amber-600">{lookupError}. You can type the city and state yourself.</p>}
      </div>

      {postOffices.length > 0 && (
        <select className={`${fieldCls} sm:col-span-2`} value={area} onChange={onArea} aria-label="Post office / area">
          <option value="">Select your area / post office ({postOffices.length} found)…</option>
          {postOffices.map((po) => (
            <option key={po.value} value={po.value}>
              {po.label}
            </option>
          ))}
        </select>
      )}

      <OrderField name="state" {...f} placeholder="State" value={value.state} onChange={set("state")} disabled={!ready} />
      <OrderField name="city" {...f} placeholder="City / District" value={value.city} onChange={set("city")} disabled={!ready} />
      <OrderField name="addressLine1" {...f} className="sm:col-span-2" placeholder={ready ? "Address line 1 (house no, street)" : "Enter pincode first"} value={value.addressLine1} onChange={set("addressLine1")} disabled={!ready} />
      <OrderField name="addressLine2" {...f} className="sm:col-span-2" placeholder="Address line 2 (optional)" value={value.addressLine2} onChange={set("addressLine2")} disabled={!ready} />
    </div>
  );
}
