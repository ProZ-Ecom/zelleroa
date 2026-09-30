"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api/api-client";
import { toast } from "@/components/ui/Toast";
import { PageContainer } from "@/components/admin/PageContainer";
import { errorMessage, useAdminObject } from "@/features/agents/hooks/use-admin-agents";
import { Panel, SimpleTable, StatusBadge, TableSkeleton, dateOnly, fieldCls } from "@/features/agents/components/shared";

interface RateRow {
  id: string;
  scope: "global" | "category" | "product";
  categoryName: string | null;
  productName: string | null;
  percentage: number;
  isActive: boolean;
  updatedAt: string;
}

interface Targets {
  categories: { id: string; name: string }[];
  products: { id: string; name: string }[];
}

export default function CommissionRatesPage() {
  const qc = useQueryClient();
  const rates = useAdminObject<RateRow[]>("rates", "/api/admin/commission-rates");
  const targets = useAdminObject<Targets>("rate-targets", "/api/admin/commission-rates/targets");
  const settings = useAdminObject<{ returnPeriodDays: number }>("commission-settings", "/api/admin/commission-settings");

  const [scope, setScope] = useState<"global" | "category" | "product">("category");
  const [targetId, setTargetId] = useState("");
  const [percentage, setPercentage] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [days, setDays] = useState<string>("");
  const [savingDays, setSavingDays] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["agents-admin"] });

  const saveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const pct = Number(percentage);
    if (percentage.trim() === "" || !Number.isFinite(pct) || pct < 0 || pct > 100) {
      setFormError("Enter a percentage between 0 and 100");
      return;
    }
    if (scope !== "global" && !targetId) {
      setFormError(scope === "category" ? "Select a category" : "Select a product");
      return;
    }
    setSaving(true);
    try {
      await apiClient.put("/api/admin/commission-rates", {
        scope,
        percentage: pct,
        ...(scope === "category" ? { categoryId: targetId } : {}),
        ...(scope === "product" ? { productId: targetId } : {}),
      });
      toast.success("Commission rate saved", "Existing commissions are not changed.");
      setPercentage("");
      await refresh();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const removeRate = async (r: RateRow) => {
    if (!window.confirm("Remove this commission rate? Existing commissions are not affected.")) return;
    try {
      await apiClient.delete(`/api/admin/commission-rates`, { params: { id: r.id } });
      toast.success("Rate removed");
      await refresh();
    } catch (err) {
      toast.error("Could not remove the rate", errorMessage(err));
    }
  };

  const saveDays = async () => {
    setSavingDays(true);
    try {
      const res = await apiClient.put("/api/admin/commission-settings", { days: Number(days) });
      toast.success(res.message ?? "Saved");
      await refresh();
    } catch (err) {
      toast.error("Could not save", errorMessage(err));
    } finally {
      setSavingDays(false);
    }
  };

  const currentDays = days === "" ? String(settings.data?.returnPeriodDays ?? "") : days;

  return (
    <PageContainer
      title="Commission Configuration"
      description="Set commission percentages. A product rate overrides its category rate, which overrides the global default."
      breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Commission rates" }]}
    >
      <div className="flex flex-col gap-5">
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="Add or update a rate">
            <form onSubmit={saveRate} className="flex flex-col gap-3 p-4 sm:p-5" noValidate>
              {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
              <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
                Applies to
                <select
                  className={fieldCls}
                  value={scope}
                  onChange={(e) => {
                    setScope(e.target.value as typeof scope);
                    setTargetId("");
                  }}
                >
                  <option value="category">A category</option>
                  <option value="product">A single product</option>
                  <option value="global">Everything (default rate)</option>
                </select>
              </label>
              {scope !== "global" && (
                <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
                  {scope === "category" ? "Category" : "Product"}
                  <select className={fieldCls} value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                    <option value="">Select…</option>
                    {(scope === "category" ? targets.data?.categories : targets.data?.products)?.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
                Commission %
                <input className={fieldCls} inputMode="decimal" value={percentage} onChange={(e) => setPercentage(e.target.value)} placeholder="e.g. 5" />
              </label>
              <div>
                <button type="submit" disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-xl bg-neutral-900 px-5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save rate
                </button>
              </div>
            </form>
          </Panel>

          <Panel title="Return period">
            <div className="flex flex-col gap-3 p-4 sm:p-5">
              <p className="text-sm text-neutral-600">
                Days after delivery before an agent’s commission is approved for payout. Applies to orders delivered from now on.
              </p>
              <div className="flex items-end gap-3">
                <label className="flex w-32 flex-col gap-1 text-xs font-medium text-neutral-600">
                  Days
                  <input className={fieldCls} inputMode="numeric" value={currentDays} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} />
                </label>
                <button
                  type="button"
                  disabled={savingDays || currentDays === "" || Number(currentDays) === settings.data?.returnPeriodDays}
                  onClick={saveDays}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-neutral-900 px-5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
                >
                  {savingDays && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save
                </button>
              </div>
            </div>
          </Panel>
        </div>

        <Panel title="Configured rates">
          {rates.isLoading ? (
            <TableSkeleton />
          ) : rates.error ? (
            <p className="px-5 py-10 text-center text-sm text-red-600">{errorMessage(rates.error)}</p>
          ) : (
            <SimpleTable
              rows={rates.data ?? []}
              rowKey={(r) => r.id}
              empty="No commission rates configured yet. Until you add one, orders earn no commission."
              columns={[
                { header: "Level", cell: (r) => <span className="capitalize">{r.scope === "global" ? "Default" : r.scope}</span> },
                { header: "Applies to", cell: (r) => r.categoryName ?? r.productName ?? "All products" },
                { header: "Commission %", cell: (r) => <strong>{r.percentage}%</strong> },
                { header: "Status", cell: (r) => <StatusBadge status={r.isActive ? "active" : "inactive"} /> },
                { header: "Updated", cell: (r) => dateOnly(r.updatedAt) },
                {
                  header: "",
                  cell: (r) => (
                    <button type="button" onClick={() => removeRate(r)} className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline">
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </button>
                  ),
                },
              ]}
            />
          )}
        </Panel>
      </div>
    </PageContainer>
  );
}
