"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Star, Loader2, Tag, Boxes } from "lucide-react";
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
  /** attributeId -> valueId, one entry per SKU axis this product splits stock on. */
  attributeValues: Record<string, string>;
  unitId: string;
  unitValue: string;
  sku: string;
  isDefault: boolean;
  isActive: boolean;
}

const emptyRow: UnitPriceRowFormState = {
  attributeValues: {},
  unitId: "",
  unitValue: "",
  sku: "",
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
 * independent Color+Size combination with its own SKU and active status; its
 * price and stock are shown here but belong to Inventory, which is the only
 * place either can be changed. Different Colors are free to carry different sets
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

  // The axes this Product splits stock on, in the admin's own order - taken from the
  // product's configuration rather than from an attribute called "Size", because a
  // catalog can hold several attributes by that name and a product can split stock on
  // more than one axis (Size AND Neck AND Sleeve).
  const { data: productAttributes = [] } = useConfiguredAttributesForProduct(productUuid);
  const { data: sizeChart = [] } = useSizeChart(categoryUuid, productGender);
  const skuAttributes = useMemo(
    () =>
      productAttributes.filter((a) => a.variationLevel === "SKU" && a.values.length > 0),
    [productAttributes]
  );
  // A size chart curates the first axis only - it exists to limit which sizes a
  // category/gender sells, and says nothing about a second axis like Neck.
  const primaryAttribute = skuAttributes[0] ?? null;
  const optionsFor = (attributeId: string) =>
    attributeId === primaryAttribute?.id && sizeChart.length > 0
      ? sizeChart
      : (skuAttributes.find((a) => a.id === attributeId)?.values ?? []);
  const hasDynamicSizes = skuAttributes.length > 0;

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


  const selectedUnit = units.find((u: AdminUnitResponse) => u.id === form.unitId);
  const fieldConfig = getMeasurementFieldConfig(selectedUnit ?? null);

  // Sizes already used by another row for this Color, excluded from the "add"
  // dropdown so the same Size can't be picked twice (the server also rejects
  // this, but filtering here keeps the picker honest about what's left).
  // Keyed on the whole combination: with more than one axis, "M" is not taken just
  // because some row uses it - only "M + Round" is.
  const signatureOf = (valueIds: string[]) => [...valueIds].sort().join("|");
  const usedSignatures = useMemo(
    () =>
      new Set(
        unitPrices
          .filter((u) => (editingId ? u.id !== editingId : true))
          .map((u) => signatureOf(u.attributeValues.map((av) => av.valueId)))
      ),
    [unitPrices, editingId]
  );
  const currentSignature = signatureOf(Object.values(form.attributeValues).filter(Boolean));
  const isCombinationTaken =
    currentSignature !== "" && usedSignatures.has(currentSignature);

  // Nothing left to add once every combination of the axes already has a row.
  const totalCombinations = hasDynamicSizes
    ? skuAttributes.reduce((total, a) => total * optionsFor(a.id).length, 1)
    : 0;
  const allCombinationsUsed =
    hasDynamicSizes && totalCombinations > 0 && usedSignatures.size >= totalCombinations;

  const resetForm = () => {
    setForm(emptyRow);
    setFormError(null);
    setIsAdding(false);
    setEditingId(null);
  };

  const startAdd = () => {
    setForm({ ...emptyRow });
    setFormError(null);
    setEditingId(null);
    setIsAdding(true);
  };

  const startEdit = (item: VariantUnitPriceResponse) => {
    setForm({
      attributeValues: Object.fromEntries(
        item.attributeValues.map((av) => [av.attributeId, av.valueId])
      ),
      unitId: item.unitId,
      unitValue: String(item.unitValue ?? ""),
      sku: item.sku,
      isDefault: item.isDefault,
      isActive: item.isActive,
    });
    setFormError(null);
    setIsAdding(false);
    setEditingId(item.id);
  };

  const isBusy = createMutation.isPending || updateMutation.isPending;

  const handleSave = async () => {
    setFormError(null);

    let unitId = form.unitId;
    let unitValue = Number(form.unitValue);

    if (hasDynamicSizes) {
      // Every axis has to be answered, or the row would describe a combination the
      // product does not actually sell.
      const unanswered = skuAttributes.find((a) => !form.attributeValues[a.id]);
      if (unanswered) {
        setFormError(`Please select a ${unanswered.name}`);
        return;
      }
      if (!editingId && isCombinationTaken) {
        setFormError("This combination already has a row");
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
    const payload = {
      unitId,
      unitValue,
      ...(hasDynamicSizes
        ? {
            attributeValueIds: skuAttributes
              .map((a) => form.attributeValues[a.id])
              .filter(Boolean),
          }
        : {}),
      sku: form.sku.trim(),
      // No price or stock here on purpose: the catalog says what a thing is,
      // Inventory says what it sells for and how many there are. Omitting the
      // price leaves an existing one untouched and starts a new row from the
      // Item's price; stock only moves through a purchase or an adjustment.
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
            disabled={isBusy || allCombinationsUsed}
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
                      {/* The whole combination, not just the first axis - with more
                          than one axis two rows would otherwise both read "M". */}
                      {item.attributeValues.length > 0
                        ? item.attributeValues.map((av) => av.value).join(" / ")
                        : item.sizeValue ||
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

          {showForm && (
            <div className="p-6 bg-cream-50/60 space-y-4">
              <p className="text-xs text-neutral-500 -mt-1">
                {hasDynamicSizes
                  ? "Add one row for every Size you sell this color in — e.g. S, M, L and XL — each with its own SKU. Price and stock are set in Inventory."
                  : "Add one row for every option you sell this item in — e.g. 250 Grams, 500 Grams and 1 Kilogram — each with its own SKU. Price and stock are set in Inventory."}
              </p>

              {hasDynamicSizes ? (
                <div className="space-y-3">
                  {skuAttributes.map((attribute, index) => {
                    const options = optionsFor(attribute.id);
                    const selectedValueId = form.attributeValues[attribute.id] ?? "";
                    return (
                      <div key={attribute.id}>
                        <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                          {attribute.name} <span className="text-red-500">*</span>
                        </label>
                        {/* Chips on the first axis only - with several axes the row is
                            built one dropdown at a time, and a chip grid per axis would
                            take over the form. */}
                        {index === 0 && !editingId && options.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {options.map((option) => {
                              const isSelected = selectedValueId === option.id;
                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  onClick={() => {
                                    const code = option.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                                    const baseVariantSlug = (variant?.slug || "VAR")
                                      .toUpperCase()
                                      .replace(/[^A-Z0-9_]/g, "_");
                                    setForm((f) => ({
                                      ...f,
                                      attributeValues: {
                                        ...f.attributeValues,
                                        [attribute.id]: option.id,
                                      },
                                      sku: f.sku || `${baseVariantSlug}_${code}`,
                                    }));
                                  }}
                                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer select-none ${
                                    isSelected
                                      ? "bg-secondary-600 text-white border-secondary-600 shadow-xs"
                                      : "bg-white text-neutral-700 border-neutral-200 hover:border-secondary-500 hover:bg-secondary-50"
                                  }`}
                                >
                                  + {option.value}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        <Select
                          value={selectedValueId}
                          onValueChange={(valId) =>
                            setForm((f) => ({
                              ...f,
                              attributeValues: { ...f.attributeValues, [attribute.id]: valId },
                            }))
                          }
                          disabled={isBusy || Boolean(editingId)}
                          placeholder={`Select ${attribute.name.toLowerCase()}`}
                          options={[
                            { value: "", label: `Select ${attribute.name.toLowerCase()}` },
                            ...options.map((option) => ({ value: option.id, label: option.value })),
                          ]}
                        />
                      </div>
                    );
                  })}

                  {editingId && (
                    <p className="text-[11px] text-neutral-400">
                      The combination can&apos;t be changed after creation — delete this row and
                      add a new one instead.
                    </p>
                  )}
                  {!editingId && isCombinationTaken && (
                    <p className="text-[11px] text-red-500 font-medium">
                      This combination already has a row.
                    </p>
                  )}
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
                  <div className="flex h-10 items-center rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm font-mono text-neutral-600">
                    {editingId
                      ? `₹${(unitPrices.find((u) => u.id === editingId)?.basePrice ?? 0).toLocaleString("en-IN")}`
                      : "Set after saving"}
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    Prices are set in{" "}
                    <Link
                      href="/admin/dashboard/inventory/pricing"
                      className="font-medium text-[var(--color-primary-600)] hover:underline"
                    >
                      Inventory &rsaquo; Pricing
                    </Link>
                    , where cost and margin are shown alongside and every change is recorded.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                    Stock
                  </label>
                  <div className="flex h-10 items-center rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-600">
                    {editingId
                      ? `${unitPrices.find((u) => u.id === editingId)?.stock ?? 0} in stock`
                      : "Starts at 0"}
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    Stock arrives through{" "}
                    <Link
                      href="/admin/dashboard/purchase-orders/import"
                      className="font-medium text-[var(--color-primary-600)] hover:underline"
                    >
                      a purchase
                    </Link>{" "}
                    or an{" "}
                    <Link
                      href="/admin/dashboard/inventory/adjustment"
                      className="font-medium text-[var(--color-primary-600)] hover:underline"
                    >
                      inventory adjustment
                    </Link>
                    , so every level is backed by a ledger movement.
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
                  className="bg-theme-primary hover:bg-theme-primary-hover text-white transition-colors"
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
        description={`Are you sure you want to delete "${
          deleteTarget?.attributeValues.length
            ? deleteTarget.attributeValues.map((av) => av.value).join(" / ")
            : deleteTarget?.sizeValue || deleteTarget?.sku
        }"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

export { VariantUnitPriceList };
