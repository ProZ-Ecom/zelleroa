"use client";

import * as React from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/api-client";
import { formatPrice } from "@/lib/utils";
import { getShippingCharge } from "@/features/orders/shipping";
import type { CartItemResponse } from "@/features/cart/types/cart.types";
import { customerCartApi } from "@/features/customers/api/customer-cart.api";
import { errorMessage } from "../hooks/use-admin-agents";
import { fieldCls } from "./shared";
import { AgentAddressFields } from "./AgentAddressFields";
import { OrderField, focusFirstError, validateAddress, validateManualCustomer, type FieldErrors } from "./order-field";

interface CustomerOption {
  id: string;
  name: string;
  customerCode: string | null;
  phone: string | null;
}
interface SavedAddress {
  id: string;
  fullName: string;
  phone: string;
  line: string;
  isDefault: boolean;
  state?: string;
}
interface AddressForm {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
}

const EMPTY_ADDRESS: AddressForm = { fullName: "", phone: "", addressLine1: "", addressLine2: "", city: "", state: "", pincode: "" };

/**
 * Storefront checkout, agent flow, "Customer" choice: places the agent's cart as an order for one of
 * THEIR assigned customers (or a walk-in buyer). Prices, stock and assignment are re-checked by
 * /api/agent/place-order; the cart is only the list of lines.
 */
export function AgentCartCustomerOrder({ items, subtotal }: { items: CartItemResponse[]; subtotal: number }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = React.useState<"existing" | "manual">("existing");
  const [customers, setCustomers] = React.useState<CustomerOption[]>([]);
  const [customerId, setCustomerId] = React.useState("");
  const [addresses, setAddresses] = React.useState<SavedAddress[]>([]);
  const [addressChoice, setAddressChoice] = React.useState("");
  const [address, setAddress] = React.useState<AddressForm>(EMPTY_ADDRESS);
  const [manual, setManual] = React.useState({ name: "", phone: "", email: "" });
  const [delivery, setDelivery] = React.useState<"standard" | "express">("standard");
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const clearError = (name: string) => setErrors((cur) => ({ ...cur, [name]: "" }));
  const [placed, setPlaced] = React.useState<string | null>(null);

  React.useEffect(() => {
    apiClient
      .get<CustomerOption[]>("/api/agent/customers", { params: { limit: 100, status: "active" } })
      .then((res) => setCustomers(res.data ?? []))
      .catch(() => setCustomers([]));
  }, []);

  React.useEffect(() => {
    setAddresses([]);
    setAddressChoice("");
    if (!customerId) return;
    apiClient
      .get<SavedAddress[]>(`/api/agent/customers/${encodeURIComponent(customerId)}/addresses`)
      .then((res) => {
        const list = res.data ?? [];
        setAddresses(list);
        setAddressChoice(list.find((a) => a.isDefault)?.id ?? list[0]?.id ?? "new");
      })
      .catch(() => setAddressChoice("new"));
  }, [customerId]);

  const useSaved = mode === "existing" && addressChoice && addressChoice !== "new";
  const state = useSaved ? undefined : address.state;
  const shippingEstimate = state ? getShippingCharge(state, delivery) : null;

  async function submit() {
    setMsg(null);
    const found: FieldErrors = {
      ...(mode === "existing" && !customerId ? { customerId: "Select a customer" } : {}),
      ...(mode === "manual" ? validateManualCustomer(manual) : {}),
      ...(useSaved ? {} : validateAddress(address)),
    };
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setMsg({ ok: false, text: "Please fix the highlighted fields." });
      return focusFirstError(found);
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        items: items.map((i) => ({ variantUnitPriceId: i.variantUnitPriceId, quantity: i.quantity })),
        deliveryMethod: delivery,
        notes: notes.trim() || undefined,
      };
      if (mode === "existing") {
        body.customerId = customerId;
        if (useSaved) body.shippingAddressId = addressChoice;
        else body.shippingAddress = address;
      } else {
        body.manualCustomer = { name: manual.name, phone: manual.phone, email: manual.email || undefined };
        body.shippingAddress = address;
      }
      const res = await apiClient.post<{ orderNumber?: string }>("/api/agent/place-order", body);
      // The lines now belong to the placed order; empty the agent's cart so they are not ordered twice.
      await customerCartApi.clearCart().catch(() => undefined);
      queryClient.invalidateQueries({ queryKey: ["customer", "cart"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["cart"], refetchType: "all" });
      setPlaced(res.data?.orderNumber ?? "");
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  const card = "rounded-2xl border border-theme-border bg-theme-surface shadow-xs p-5 sm:p-6 space-y-3";

  if (placed !== null) {
    return (
      <div className={card}>
        <h2 className="text-lg font-bold text-theme-text-primary">Order {placed} placed</h2>
        <p className="text-sm text-theme-text-subtle">The order was placed for your customer (Cash on delivery). Commission is recorded on it.</p>
        <Link href="/agent/orders" className="inline-block text-sm font-semibold underline">
          View my orders
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className={card}>
        <h2 className="text-base font-bold text-theme-text-primary">Customer</h2>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={mode === "existing"} onChange={() => setMode("existing")} /> Select existing customer
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={mode === "manual"} onChange={() => setMode("manual")} /> Enter customer details
          </label>
        </div>
        {mode === "existing" ? (
          <>
            <select name="customerId" className={`${fieldCls} ${errors.customerId ? "!border-red-500" : ""}`} value={customerId} onChange={(e) => { setCustomerId(e.target.value); clearError("customerId"); }}>
              <option value="">Select one of your assigned customers…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.customerCode ? ` (${c.customerCode})` : ""}
                  {c.phone ? ` · ${c.phone}` : ""}
                </option>
              ))}
            </select>
            {errors.customerId && <p role="alert" className="text-xs text-red-600">{errors.customerId}</p>}
            {customers.length === 0 && <p className="text-xs text-neutral-500">No customers are assigned to you yet.</p>}
          </>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <OrderField name="manualName" errors={errors} onClear={clearError} placeholder="Customer name" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} />
            <OrderField name="manualPhone" errors={errors} onClear={clearError} placeholder="Mobile (10 digits)" inputMode="numeric" maxLength={10} value={manual.phone} onChange={(e) => setManual({ ...manual, phone: e.target.value })} />
            <OrderField name="manualEmail" errors={errors} onClear={clearError} placeholder="Email (optional)" value={manual.email} onChange={(e) => setManual({ ...manual, email: e.target.value })} />
          </div>
        )}
      </section>

      <section className={card}>
        <h2 className="text-base font-bold text-theme-text-primary">Delivery address &amp; method</h2>
        {mode === "existing" && addresses.length > 0 && (
          <select className={fieldCls} value={addressChoice} onChange={(e) => setAddressChoice(e.target.value)}>
            {addresses.map((a) => (
              <option key={a.id} value={a.id}>
                {a.fullName} · {a.phone} · {a.line}
              </option>
            ))}
            <option value="new">Use a different address / phone for this order</option>
          </select>
        )}
        {!useSaved && (
          <AgentAddressFields value={address} onChange={setAddress} errors={errors} onClear={clearError} />
        )}
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={delivery === "standard"} onChange={() => setDelivery("standard")} /> Standard
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={delivery === "express"} onChange={() => setDelivery("express")} /> Express
          </label>
        </div>
        <input className={fieldCls} placeholder="Order notes (optional)" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </section>

      <section className={card}>
        <h2 className="text-base font-bold text-theme-text-primary">Order summary</h2>
        <p className="text-sm">
          {items.length} item{items.length === 1 ? "" : "s"} · Subtotal <strong>{formatPrice(subtotal)}</strong>
          {shippingEstimate !== null && <> · Delivery {formatPrice(shippingEstimate)}</>}
        </p>
        <p className="text-xs text-neutral-500">Offers and delivery are applied when the order is placed. Payment is Cash on delivery.</p>
        {msg && <p className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>}
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="w-full rounded-xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
        >
          {busy ? "Placing order…" : "Place order for customer (Cash on delivery)"}
        </button>
      </section>
    </div>
  );
}
