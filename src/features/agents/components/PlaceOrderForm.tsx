"use client";

import * as React from "react";
import { apiClient } from "@/lib/api/api-client";
import { errorMessage } from "../hooks/use-admin-agents";
import { fieldCls } from "./shared";

interface CustomerOption {
  id: string;
  name: string;
  customerCode: string | null;
  phone: string | null;
}
interface SavedAddress {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  line: string;
  isDefault: boolean;
}
interface CatalogRow {
  id: string;
  sku: string;
  productName: string;
  variantName: string;
  size: string | null;
  price: number;
  available: number;
}
interface Line extends CatalogRow {
  quantity: number;
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
const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function AddressFields({ value, onChange }: { value: AddressForm; onChange: (v: AddressForm) => void }) {
  const set = (k: keyof AddressForm) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <input className={fieldCls} placeholder="Receiver name" value={value.fullName} onChange={set("fullName")} />
      <input className={fieldCls} placeholder="Mobile (10 digits)" inputMode="numeric" maxLength={10} value={value.phone} onChange={set("phone")} />
      <input className={`${fieldCls} sm:col-span-2`} placeholder="Address line 1" value={value.addressLine1} onChange={set("addressLine1")} />
      <input className={`${fieldCls} sm:col-span-2`} placeholder="Address line 2 (optional)" value={value.addressLine2} onChange={set("addressLine2")} />
      <input className={fieldCls} placeholder="City" value={value.city} onChange={set("city")} />
      <input className={fieldCls} placeholder="State" value={value.state} onChange={set("state")} />
      <input className={fieldCls} placeholder="Pincode" inputMode="numeric" maxLength={6} value={value.pincode} onChange={set("pincode")} />
    </div>
  );
}

/**
 * Agent order form. The customer list only ever contains customers assigned to this agent, and the
 * API re-checks that on submit - this UI restriction is a convenience, not the security boundary.
 */
export function PlaceOrderForm() {
  const [mode, setMode] = React.useState<"existing" | "manual">("existing");
  const [customers, setCustomers] = React.useState<CustomerOption[]>([]);
  const [customerId, setCustomerId] = React.useState("");
  const [addresses, setAddresses] = React.useState<SavedAddress[]>([]);
  const [addressChoice, setAddressChoice] = React.useState(""); // saved address id, or "new"
  const [address, setAddress] = React.useState<AddressForm>(EMPTY_ADDRESS);
  const [manual, setManual] = React.useState({ name: "", phone: "", email: "" });
  const [search, setSearch] = React.useState("");
  const [results, setResults] = React.useState<CatalogRow[]>([]);
  const [lines, setLines] = React.useState<Line[]>([]);
  const [delivery, setDelivery] = React.useState<"standard" | "express">("standard");
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

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

  React.useEffect(() => {
    if (search.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      apiClient
        .get<CatalogRow[]>("/api/agent/order-catalog", { params: { search: search.trim() } })
        .then((res) => setResults(res.data ?? []))
        .catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  function addLine(r: CatalogRow) {
    setLines((cur) => {
      const found = cur.find((l) => l.id === r.id);
      if (found) return cur.map((l) => (l.id === r.id ? { ...l, quantity: Math.min(r.available, l.quantity + 1) } : l));
      return [...cur, { ...r, quantity: 1 }];
    });
  }
  const setQty = (id: string, q: number) =>
    setLines((cur) => cur.map((l) => (l.id === id ? { ...l, quantity: Math.max(1, Math.min(l.available, Math.floor(q) || 1)) } : l)));
  const subtotal = lines.reduce((n, l) => n + l.price * l.quantity, 0);

  const useSaved = mode === "existing" && addressChoice && addressChoice !== "new";

  async function submit() {
    setMsg(null);
    if (lines.length === 0) return setMsg({ ok: false, text: "Add at least one product." });
    if (mode === "existing" && !customerId) return setMsg({ ok: false, text: "Select a customer." });
    if (mode === "manual" && (!manual.name.trim() || !manual.phone.trim())) return setMsg({ ok: false, text: "Enter the customer's name and mobile." });
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        items: lines.map((l) => ({ variantUnitPriceId: l.id, quantity: l.quantity })),
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
      setMsg({ ok: true, text: `Order ${res.data?.orderNumber ?? ""} placed.` });
      setLines([]);
      setNotes("");
      setAddress(EMPTY_ADDRESS);
      setManual({ name: "", phone: "", email: "" });
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  const card = "rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5 space-y-3";
  return (
    <div className="space-y-4">
      <section className={card}>
        <h2 className="text-sm font-semibold text-neutral-900">1. Customer</h2>
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
            <select className={fieldCls} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select one of your assigned customers…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.customerCode ? ` (${c.customerCode})` : ""}
                  {c.phone ? ` · ${c.phone}` : ""}
                </option>
              ))}
            </select>
            {customers.length === 0 && <p className="text-xs text-neutral-500">No customers are assigned to you yet.</p>}
            <p className="text-xs text-neutral-500">The customer&apos;s profile is never changed. Phone and address below apply to this order only.</p>
          </>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <input className={fieldCls} placeholder="Customer name" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} />
              <input className={fieldCls} placeholder="Mobile (10 digits)" inputMode="numeric" maxLength={10} value={manual.phone} onChange={(e) => setManual({ ...manual, phone: e.target.value })} />
              <input className={fieldCls} placeholder="Email (optional)" value={manual.email} onChange={(e) => setManual({ ...manual, email: e.target.value })} />
            </div>
            <p className="text-xs text-neutral-500">No customer account is created. These details are saved with the order only.</p>
          </>
        )}
      </section>

      <section className={card}>
        <h2 className="text-sm font-semibold text-neutral-900">2. Delivery address &amp; phone</h2>
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
        {!useSaved && <AddressFields value={address} onChange={setAddress} />}
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={delivery === "standard"} onChange={() => setDelivery("standard")} /> Standard
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={delivery === "express"} onChange={() => setDelivery("express")} /> Express
          </label>
        </div>
      </section>

      <section className={card}>
        <h2 className="text-sm font-semibold text-neutral-900">3. Products</h2>
        <input className={fieldCls} placeholder="Search product name or SKU (min 2 letters)" value={search} onChange={(e) => setSearch(e.target.value)} />
        {results.length > 0 && (
          <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
            {results.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{r.productName} · {r.variantName}{r.size ? ` · ${r.size}` : ""}</span>
                  <span className="text-xs text-neutral-500">{r.sku} · {inr(r.price)} · {r.available} in stock</span>
                </span>
                <button type="button" onClick={() => addLine(r)} className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1 text-xs font-semibold">
                  Add
                </button>
              </li>
            ))}
          </ul>
        )}
        {lines.length > 0 && (
          <div className="space-y-2">
            {lines.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-neutral-50 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{l.productName} · {l.variantName}{l.size ? ` · ${l.size}` : ""}</span>
                <input
                  type="number"
                  min={1}
                  max={l.available}
                  value={l.quantity}
                  onChange={(e) => setQty(l.id, Number(e.target.value))}
                  className="w-20 rounded-lg border border-neutral-300 px-2 py-1"
                />
                <span className="w-24 text-right font-medium">{inr(l.price * l.quantity)}</span>
                <button type="button" onClick={() => setLines((c) => c.filter((x) => x.id !== l.id))} className="text-xs text-red-600">
                  Remove
                </button>
              </div>
            ))}
            <p className="text-right text-sm">
              Subtotal <strong>{inr(subtotal)}</strong> <span className="text-xs text-neutral-500">(offers and delivery are applied when the order is placed)</span>
            </p>
          </div>
        )}
        <input className={fieldCls} placeholder="Order notes (optional)" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </section>

      {msg && <p className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={submit}
        className="w-full rounded-xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
      >
        {busy ? "Placing order…" : "Place order (Cash on delivery)"}
      </button>
    </div>
  );
}
