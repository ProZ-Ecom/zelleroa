"use client";

import React, { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Star, Loader2, Tag, PackagePlus, PackageMinus, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useUnits } from "@/features/units/hooks";
import { useConfiguredAttributesForProduct } from "@/features/attributes/hooks/use-attributes";
import { useSizeChart } from "@/features/size-charts/hooks/use-size-chart";
import type { SizeChartGender } from "@/features/size-charts/types";
import type { AdminUnitResponse } from "@/features/units/types";
import { getMeasurementFieldConfig } from "../utils/measurement.util";
import {
  useVariant,
  useVariantUnitPrices,
  useCreateVariantUnitPrice,
  useUpdateVariantUnitPrice,
  useDeleteVariantUnitPrice,
} from "../hooks";
import type { VariantUnitPriceResponse, AdminVariantResponse } from "../types";

interface UnitPriceRowFormState {
  sizeValueId: string;
  unitId: string;
  unitValue: string;
  sku: string;
  basePrice: string;
  /** Sell this size at the Item's price (the default) instead of its own. */
  useItemPrice: boolean;
  stock: string;
  isDefault: boolean;
  isActive: boolean;
}

const emptyRow: UnitPriceRowFormState = {
  sizeValueId: "",
  unitId: "",
  unitValue: "",
  sku: "",
  basePrice: "",
  useItemPrice: true,
  stock: "0",
  isDefault: false,
  isActive: true,
};

interface VariantUnitPriceListProps {
  productUuid: string;
  variantUuid: string;
  /** The product's category - used to look up its dynamic "Size" attribute (or curated size chart), never hardcoded. When omitted, falls back to the legacy pack-size/unit flow (grocery-style items). */
  categoryUuid?: string | null;
  productGender?: SizeChartGender | null;
}

/**
 * Manages the Size leaf level for one Color variant - each row is an
 * independent Color+Size combination with its own price, stock, SKU and
 * active status. Different Colors are free to carry entirely different sets
 * of Sizes; nothing here assumes symmetry across Colors.
 *
 * The Size options offered are read from the category's dynamically
 * configured "Size" attribute (or its curated size chart, when the category
 * has one) - never a hardcoded list. Categories with no Size attribute at all
 * fall back to the legacy pack-size/unit flow (grams/kg/ml), for grocery-style
 * catalogs that still use this same table for pack sizes instead of clothing
 * sizes.
 */
function VariantUnitPriceList({
  productUuid,
  variantUuid,
  categoryUuid = null,
  productGender = null,
}: VariantUnitPriceListProps) {
  const { data: unitPrices = [], isLoading } = useVariantUnitPrices(productUuid, variantUuid);
  const { data: unitsData } = useUnits({ pageSize: 100 });
  const units = unitsData?.data ?? [];
  const { data: variantResponse } = useVariant(productUuid, variantUuid);
  const variant: AdminVariantResponse | null =
    (variantResponse as { data?: AdminVariantResponse } | undefined)?.data ??
    (variantResponse as unknown as AdminVariantResponse) ??
    null;

  // Dynamic Size options for this Color, from the Product's configured Size
  // attribute (curated by a size chart when one exists for the category+gender).
  const { data: productAttributes = [] } = useConfiguredAttributesForProduct(productUuid);
  const { data: sizeChart = [] } = useSizeChart(categoryUuid, productGender);
  const sizeAttribute = productAttributes.find(
    (a) => a.name.trim().toLowerCase() === "size"
  );
  const sizeOptions = sizeChart.length > 0 ? sizeChart : (sizeAttribute?.values ?? []);
  const hasDynamicSizes = sizeOptions.length > 0;

  // When Sizes are dynamic, the underlying unit/pack-size dimension is not
  // shown to the admin at all - silently default to the first active "count"
  // unit (e.g. "Nos") so every row still satisfies the schema's required
  // unit_id/unit_value without asking the admin to think about grams/kg.
  const fallbackUnit =
    units.find((u: AdminUnitResponse) => u.type === "count" && u.isActive) ??
    units.find((u: AdminUnitResponse) => u.isActive) ??
    null;

  // The Item's price is the one price entered for the whole Item; a size only
  // carries a price of its own when it genuinely costs more or less.
  const itemPrice = variant?.itemPrice && variant.itemPrice > 0 ? variant.itemPrice : null;

  const createMutation = useCreateVariantUnitPrice();
  const updateMutation = useUpdateVariantUnitPrice();
  const deleteMutation = useDeleteVariantUnitPrice();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UnitPriceRowFormState>(emptyRow);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VariantUnitPriceResponse | null>(null);

  // Quick stock in/out adjustment (separate from the add/edit form)
  const [stockAdjustId, setStockAdjustId] = useState<string | null>(null);
  const [stockAdjustMode, setStockAdjustMode] = useState<"in" | "out">("in");
  const [stockAdjustQty, setStockAdjustQty] = useState("");
  const [stockAdjustError, setStockAdjustError] = useState<string | null>(null);

  const selectedUnit = units.find((u: AdminUnitResponse) => u.id === form.unitId);
  const fieldConfig = getMeasurementFieldConfig(selectedUnit ?? null);

  // Sizes already used by another row for this Color, excluded from the "add"
  // dropdown so the same Size can't be picked twice (the server also rejects
  // this, but filtering here keeps the picker honest about what's left).
  const usedSizeValueIds = useMemo(
    () =>
      new Set(
        unitPrices
          .filter((u) => (editingId ? u.id !== editingId : true))
          .map((u) => u.sizeValueId)
          .filter((id): id is string => Boolean(id))
      ),
    [unitPrices, editingId]
  );
  const availableSizeOptions = sizeOptions.filter(
    (s) => !usedSizeValueIds.has(s.id) || s.id === form.sizeValueId
  );

  const resetForm = () => {
    setForm(emptyRow);
    setFormError(null);
    setIsAdding(false);
    setEditingId(null);
  };

  const startAdd = () => {
    setForm({ ...emptyRow, useItemPrice: itemPrice !== null });
    setFormError(null);
    setEditingId(null);
    setIsAdding(true);
  };

  const startEdit = (item: VariantUnitPriceResponse) => {
    setForm({
      sizeValueId: item.sizeValueId || "",
      unitId: item.unitId,
      unitValue: String(item.unitValue ?? ""),
      sku: item.sku,
      basePrice: String(item.basePrice ?? ""),
      useItemPrice: itemPrice !== null && item.basePrice === itemPrice,
      stock: String(item.stock ?? 0),
      isDefault: item.isDefault,
      isActive: item.isActive,
    });
    setFormError(null);
    setIsAdding(false);
    setEditingId(item.id);
  };

  const startStockAdjust = (item: VariantUnitPriceResponse, mode: "in" | "out") => {
    setStockAdjustId(item.id);
    setStockAdjustMode(mode);
    setStockAdjustQty("");
    setStockAdjustError(null);
  };

  const cancelStockAdjust = () => {
    setStockAdjustId(null);
    setStockAdjustQty("");
    setStockAdjustError(null);
  };

  const handleStockAdjustSave = async (item: VariantUnitPriceResponse) => {
    const qty = Number(stockAdjustQty);
    if (!qty || qty <= 0 || !Number.isInteger(qty)) {
      setStockAdjustError("Enter a whole number greater than 0");
      return;
    }

    const currentStock = item.stock ?? 0;
    const delta = stockAdjustMode === "in" ? qty : -qty;
    const nextStock = currentStock + delta;

    if (nextStock < 0) {
      setStockAdjustError(`Only ${currentStock} in stock — cannot remove ${qty}`);
      return;
    }

    try {
      await updateMutation.mutateAsync({
        productUuid,
        variantUuid,
        unitPriceUuid: item.id,
        data: { stock: nextStock },
      });
      cancelStockAdjust();
    } catch (err: unknown) {
      setStockAdjustError(err instanceof Error ? err.message : "Failed to update stock");
    }
  };

  const isBusy = createMutation.isPending || updateMutation.isPending;

  const handleSave = async () => {
    setFormError(null);

    let unitId = form.unitId;
    let unitValue = Number(form.unitValue);

    if (hasDynamicSizes) {
      if (!form.sizeValueId) {
        setFormError("Please select a Size");
        return;
      }
      if (!fallbackUnit) {
        setFormError("No active unit configured to attach this Size to - add one under Catalog > Units first");
        return;
      }
      unitId = fallbackUnit.id;
      unitValue = 1;
    } else {
      if (!unitId) {
        setFormError("Please select a unit");
        return;
      }
      if (!unitValue || unitValue <= 0) {
        setFormError(fieldConfig.validationMessage);
        return;
      }
    }

    if (!form.sku.trim()) {
      setFormError("SKU is required");
      return;
    }
    let basePrice: number;
    if (form.useItemPrice && itemPrice !== null) {
      basePrice = itemPrice;
    } else {
      basePrice = Number(form.basePrice.trim());
      if (form.basePrice.trim() === "" || Number.isNaN(basePrice) || basePrice <= 0) {
        setFormError("Enter the price for this size");
        return;
      }
    }
    const stock = Number(form.stock);
    if (Number.isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
      setFormError("Stock must be a non-negative whole number");
      return;
    }

    const payload = {
      unitId,
      unitValue,
      ...(hasDynamicSizes ? { sizeValueId: form.sizeValueId } : {}),
      sku: form.sku.trim(),
      basePrice,
      stock,
      isDefault: form.isDefault,
      isActive: form.isActive,
    };

    try {
      if (editingId) {
        await updateMutation.mutateAsync({
          productUuid,
          variantUuid,
          unitPriceUuid: editingId,
          data: payload,
        });
      } else {
        await createMutation.mutateAsync({
          productUuid,
          variantUuid,
          data: payload,
        });
      }
      resetForm();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save unit price";
      setFormError(message);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync({
        productUuid,
        variantUuid,
        unitPriceUuid: deleteTarget.id,
      });
      setDeleteTarget(null);
    } catch (err) {
      console.error("Failed to delete unit price", err);
    }
  };

  const showForm = isAdding || Boolean(editingId);

  return (
    <div className="bg-white border border-cream-border rounded-2xl overflow-hidden shadow-xs">
      <div className="px-6 py-4.5 border-b border-cream-border flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-neutral-900 tracking-tight flex items-center gap-2">
          <Tag className="w-4 h-4 text-secondary-600" />
          <span>{hasDynamicSizes ? "Sizes & Pricing" : "Units & Pricing"}</span>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-cream-200 text-neutral-600 border border-cream-border">
            {unitPrices.length}
          </span>
        </h2>

        {!showForm && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={startAdd}
            disabled={isBusy || (hasDynamicSizes && availableSizeOptions.length === 0)}
            className="h-8 text-xs font-semibold text-secondary-700 hover:text-secondary-900 hover:bg-secondary-50 cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            <span>{hasDynamicSizes ? "Add size + price" : "Add unit + price"}</span>
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="p-6 flex items-center justify-center text-neutral-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : (
        <div className="divide-y divide-cream-border-subtle">
          {unitPrices.length === 0 && !showForm && (
            <div className="py-7 px-6 text-center space-y-2">
              <p className="text-xs font-medium text-neutral-600">
                {hasDynamicSizes
                  ? "No sizes yet. Add one to make this color purchasable."
                  : "No unit / price combinations yet. Add one to make this item purchasable."}
              </p>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200/80 rounded-lg py-1.5 px-3 max-w-md mx-auto">
                <span>⚠️ If price details are not entered, this item remains in the <strong>Inactive list</strong> and hidden from customers.</span>
              </div>
            </div>
          )}

          {unitPrices.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 px-6 py-3.5 hover:bg-cream-50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-neutral-900">
                      {item.sizeValue ||
                        `${item.measurement?.value} ${item.unitCode || item.measurement?.unit}`}
                    </span>
                    {item.isDefault && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold">
                        <Star className="w-3 h-3" /> Default
                      </span>
                    )}
                    {!item.isActive && (
                      <span className="inline-flex px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 text-[10px] font-bold border border-neutral-200">
                        Inactive
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-neutral-500 font-mono truncate">
                    SKU: {item.sku}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="flex flex-col items-end leading-tight">
                  <span className="text-sm font-bold text-secondary-900 font-mono">
                    ₹{item.basePrice.toLocaleString("en-IN")}
                  </span>
                  {itemPrice !== null && (
                    <span
                      className={`text-[10px] font-semibold ${
                        item.basePrice === itemPrice ? "text-neutral-400" : "text-amber-700"
                      }`}
                    >
                      {item.basePrice === itemPrice ? "Item price" : "Own price"}
                    </span>
                  )}
                </span>

                <span
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border ${
                    (item.stock ?? 0) > 0
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-red-50 text-red-700 border-red-200"
                  }`}
                  title="Current stock"
                >
                  <Boxes className="w-3 h-3" />
                  {item.stock ?? 0}
                </span>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => startStockAdjust(item, "in")}
                    disabled={isBusy}
                    className="h-8 w-8 text-neutral-500 hover:text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
                    title="Stock in (add stock)"
                  >
                    <PackagePlus className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => startStockAdjust(item, "out")}
                    disabled={isBusy}
                    className="h-8 w-8 text-neutral-500 hover:text-amber-700 hover:bg-amber-50 disabled:opacity-40"
                    title="Stock out (remove stock)"
                  >
                    <PackageMinus className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => startEdit(item)}
                    disabled={isBusy}
                    className="h-8 w-8 text-neutral-500 hover:text-secondary-700 hover:bg-secondary-50 disabled:opacity-40"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteTarget(item)}
                    disabled={isBusy}
                    className="h-8 w-8 text-neutral-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-40"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {unitPrices.map(
            (item) =>
              stockAdjustId === item.id && (
                <div
                  key={`stock-adjust-${item.id}`}
                  className="px-6 py-4 bg-cream-50/60 border-t border-cream-border-subtle space-y-3"
                >
                  <p className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
                    {stockAdjustMode === "in" ? (
                      <>
                        <PackagePlus className="w-3.5 h-3.5 text-emerald-600" /> Stock in for{" "}
                        {item.sizeValue || `${item.measurement?.value} ${item.unitCode || item.measurement?.unit}`}{" "}
                        — currently {item.stock ?? 0}
                      </>
                    ) : (
                      <>
                        <PackageMinus className="w-3.5 h-3.5 text-amber-600" /> Stock out for{" "}
                        {item.sizeValue || `${item.measurement?.value} ${item.unitCode || item.measurement?.unit}`}{" "}
                        — currently {item.stock ?? 0}
                      </>
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      autoFocus
                      value={stockAdjustQty}
                      onChange={(e) => setStockAdjustQty(e.target.value)}
                      placeholder="Quantity"
                      disabled={updateMutation.isPending}
                      className="w-32 h-9 px-3 rounded-lg border border-neutral-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-secondary-600/20 focus:border-secondary-600 disabled:opacity-60"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleStockAdjustSave(item)}
                      disabled={updateMutation.isPending}
                      className={
                        stockAdjustMode === "in"
                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                          : "bg-amber-600 text-white hover:bg-amber-700"
                      }
                    >
                      {updateMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      ) : null}
                      {stockAdjustMode === "in" ? "Add Stock" : "Remove Stock"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={cancelStockAdjust}
                      disabled={updateMutation.isPending}
                    >
                      Cancel
                    </Button>
                  </div>
                  {stockAdjustError && (
                    <p className="text-xs text-red-500 font-medium">{stockAdjustError}</p>
                  )}
                </div>
              )
          )}

          {showForm && (
            <div className="p-6 bg-cream-50/60 space-y-4">
              <p className="text-xs text-neutral-500 -mt-1">
                {hasDynamicSizes
                  ? "Add one row for every Size you sell this color in — e.g. S, M, L and XL — with its SKU and stock. Each size sells at the Item's price unless you give it its own."
                  : "Add one row for every option you sell this item in — e.g. 250 Grams, 500 Grams and 1 Kilogram — each with its own price, SKU and stock."}
              </p>

              {hasDynamicSizes ? (
                <div className="space-y-3">
                  {/* Quick Pick Size Chips */}
                  {!editingId && availableSizeOptions.length > 0 && (
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                        Quick Pick Size:
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {availableSizeOptions.map((s) => {
                          const isSelected = form.sizeValueId === s.id;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                const sizeCode = s.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                                const baseVariantSlug = (variant?.slug || "VAR").toUpperCase().replace(/[^A-Z0-9_]/g, "_");
                                const autoSku = `${baseVariantSlug}_${sizeCode}`;
                                setForm((f) => ({
                                  ...f,
                                  sizeValueId: s.id,
                                  sku: f.sku || autoSku,
                                  stock: f.stock && f.stock !== "0" ? f.stock : "50",
                                }));
                              }}
                              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer select-none ${
                                isSelected
                                  ? "bg-secondary-600 text-white border-secondary-600 shadow-xs"
                                  : "bg-white text-neutral-700 border-neutral-200 hover:border-secondary-500 hover:bg-secondary-50"
                              }`}
                            >
                              + {s.value}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                      Size <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={form.sizeValueId}
                      onValueChange={(valId) => {
                        const sObj = availableSizeOptions.find((s) => s.id === valId);
                        const sizeCode = sObj ? sObj.value.toUpperCase().replace(/[^A-Z0-9]/g, "") : "";
                        const baseVariantSlug = (variant?.slug || "VAR").toUpperCase().replace(/[^A-Z0-9_]/g, "_");
                        const autoSku = sizeCode ? `${baseVariantSlug}_${sizeCode}` : "";
                        setForm((f) => ({
                          ...f,
                          sizeValueId: valId,
                          sku: f.sku || autoSku,
                        }));
                      }}
                      disabled={isBusy || Boolean(editingId)}
                      placeholder="Select size"
                      options={[
                        { value: "", label: "Select size" },
                        ...availableSizeOptions.map((s) => ({
                          value: s.id,
                          label: s.value,
                        })),
                      ]}
                    />
                    {editingId && (
                      <p className="text-[11px] text-neutral-400 mt-1">
                        Size can&apos;t be changed after creation — delete this row and add a new one instead.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                      Unit <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={form.unitId}
                      onValueChange={(nextUnitId) => {
                        const nextUnit = units.find((u: AdminUnitResponse) => u.id === nextUnitId);
                        setForm((f) => ({
                          ...f,
                          unitId: nextUnitId,
                          unitValue:
                            nextUnit?.type === "size" && !f.unitValue ? "1" : f.unitValue,
                        }));
                      }}
                      disabled={isBusy}
                      placeholder="Select unit"
                      options={[
                        { value: "", label: "Select unit" },
                        ...units.map((u: AdminUnitResponse) => ({
                          value: u.id,
                          label: `${u.name} (${u.code})`,
                        })),
                      ]}
                    />
                    <p className="text-[11px] text-neutral-400 mt-1">
                      What is it measured in — Grams, Kilograms, Millilitres, or just a count.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                      {fieldConfig.type === "size" ? "Size value" : "Pack Size"}{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={form.unitValue}
                      onChange={(e) => setForm((f) => ({ ...f, unitValue: e.target.value }))}
                      disabled={isBusy}
                      placeholder={fieldConfig.type === "size" ? "1" : "e.g. 500"}
                      className="w-full h-10 px-3 rounded-lg border border-neutral-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-secondary-600/20 focus:border-secondary-600 disabled:opacity-60 disabled:bg-neutral-100"
                    />
                    <p className="text-[11px] text-neutral-400 mt-1">
                      {fieldConfig.type === "size"
                        ? fieldConfig.helperText
                        : "How much is in one pack — e.g. 500 for a 500 Gram pack."}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                    SKU {hasDynamicSizes ? "" : "(pack code)"} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.sku}
                    onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                    disabled={isBusy}
                    placeholder={hasDynamicSizes ? "e.g. TSHIRT-RED-M" : "e.g. MIXTURE-500G"}
                    className="w-full h-10 px-3 rounded-lg border border-neutral-200 text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-secondary-600/20 focus:border-secondary-600 disabled:opacity-60 disabled:bg-neutral-100"
                  />
                  <p className="text-[11px] text-neutral-400 mt-1">
                    A unique code just for this {hasDynamicSizes ? "color + size" : "pack size"}.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                    Price {hasDynamicSizes ? "" : "per pack"} (₹)
                  </label>
                  {itemPrice !== null && (
                    <label className="mb-2 inline-flex items-center gap-2 text-xs font-medium text-neutral-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.useItemPrice}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            useItemPrice: e.target.checked,
                            basePrice: e.target.checked ? "" : f.basePrice || String(itemPrice),
                          }))
                        }
                        disabled={isBusy}
                        className="w-4 h-4 accent-secondary-600"
                      />
                      Same as item price (₹{itemPrice.toLocaleString("en-IN")})
                    </label>
                  )}
                  {(itemPrice === null || !form.useItemPrice) && (
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={form.basePrice}
                      onChange={(e) => setForm((f) => ({ ...f, basePrice: e.target.value }))}
                      disabled={isBusy}
                      placeholder="e.g. 649"
                      className="w-full h-10 px-3 rounded-lg border border-neutral-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-secondary-600/20 focus:border-secondary-600 disabled:opacity-60 disabled:bg-neutral-100"
                    />
                  )}
                  <p className="text-[11px] text-neutral-400 mt-1">
                    {itemPrice === null
                      ? "What the customer pays for this option."
                      : form.useItemPrice
                        ? "Follows the Item's price - change it there and this size moves with it."
                        : "Only for a size that costs more or less than the rest, e.g. XXL."}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                    Stock {editingId ? "" : <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={form.stock}
                    onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                    disabled={isBusy}
                    placeholder="e.g. 50"
                    className="w-full h-10 px-3 rounded-lg border border-neutral-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-secondary-600/20 focus:border-secondary-600 disabled:opacity-60 disabled:bg-neutral-100"
                  />
                  <p className="text-[11px] text-neutral-400 mt-1">
                    {editingId
                      ? "Sets the stock quantity directly. Use the stock in/out buttons on the row for quick adjustments instead."
                      : "How many units of this pack are available right now. 0 means only this Color + Size is out of stock — every other size stays unaffected."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                    disabled={isBusy}
                    className="rounded border-neutral-300"
                  />
                  Show this size first (default)
                </label>

                <label className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                    disabled={isBusy}
                    className="rounded border-neutral-300"
                  />
                  Active (customers can buy this size)
                </label>
              </div>

              {formError && (
                <p className="text-xs text-red-500 font-medium">{formError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={resetForm} disabled={isBusy}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isBusy}
                  className="bg-[var(--color-primary-500)] text-white hover:bg-[var(--color-primary-600)]"
                >
                  {isBusy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : null}
                  {editingId ? "Save Changes" : "Add"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Size"
        description={`Are you sure you want to delete "${deleteTarget?.sizeValue || deleteTarget?.sku}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

export { VariantUnitPriceList };
