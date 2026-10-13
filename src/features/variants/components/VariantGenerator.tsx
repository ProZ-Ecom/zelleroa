"use client";

import React, { useMemo, useState } from "react";
import { Loader2, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useConfiguredAttributesForProduct } from "@/features/attributes/hooks/use-attributes";
import { useUnits } from "@/features/units/hooks";
import { useGenerateVariants } from "../hooks";
import type { AdminUnitResponse } from "@/features/units/types";
import type { GenerateVariantsResponse } from "../types";

interface VariantGeneratorProps {
  productUuid: string;
  onGenerated?: (result: GenerateVariantsResponse) => void;
  /** Which Item to generate Colors/Sizes under; defaults to the Product's default Item when omitted. */
  itemUuid?: string;
}

/**
 * Bulk-creates one Item (ProductVariant) + default unit price per combination
 * of the selected option values - e.g. Color {Black, White} x Size {S, M, L}
 * creates 6 Items in a single request, instead of the admin repeating the
 * single-item wizard six times. Options come from the Product's own
 * configured attributes (Catalog > Products > Attributes), never a category.
 */
function VariantGenerator({ productUuid, onGenerated, itemUuid }: VariantGeneratorProps) {
  const { data: productAttributes = [], isLoading: isLoadingAttributes } =
    useConfiguredAttributesForProduct(productUuid);
  const { data: unitsData } = useUnits({ pageSize: 100 });
  const units = unitsData?.data ?? [];

  const [selectedValues, setSelectedValues] = useState<Record<string, string[]>>({});
  const [unitId, setUnitId] = useState("");
  const [defaultPrice, setDefaultPrice] = useState("");
  const [defaultStock, setDefaultStock] = useState("0");
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateVariantsResponse | null>(null);

  const generateMutation = useGenerateVariants();

  const toggleValue = (attributeId: string, valueId: string) => {
    setResult(null);
    setSelectedValues((prev) => {
      const current = prev[attributeId] || [];
      const next = current.includes(valueId)
        ? current.filter((id) => id !== valueId)
        : [...current, valueId];
      return { ...prev, [attributeId]: next };
    });
  };

  const activeOptions = useMemo(
    () =>
      productAttributes
        .map((attr) => ({ attribute: attr, valueIds: selectedValues[attr.id] || [] }))
        .filter((o) => o.valueIds.length > 0),
    [productAttributes, selectedValues]
  );

  const combinationCount = useMemo(
    () => activeOptions.reduce((total, o) => total * o.valueIds.length, activeOptions.length > 0 ? 1 : 0),
    [activeOptions]
  );

  const handleGenerate = async () => {
    setFormError(null);
    setResult(null);

    if (activeOptions.length === 0) {
      setFormError("Select at least one value for a variation option (e.g. pick some Colors)");
      return;
    }
    if (!unitId) {
      setFormError("Please select a unit");
      return;
    }
    const trimmedPrice = defaultPrice.trim();
    if (trimmedPrice !== "" && (Number.isNaN(Number(trimmedPrice)) || Number(trimmedPrice) < 0)) {
      setFormError("Price cannot be negative");
      return;
    }
    const stock = Number(defaultStock);
    if (Number.isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
      setFormError("Stock must be a non-negative whole number");
      return;
    }

    try {
      const response = await generateMutation.mutateAsync({
        productUuid,
        itemUuid,
        data: {
          options: activeOptions.map((o) => ({ attributeId: o.attribute.id, valueIds: o.valueIds })),
          unitId,
          ...(trimmedPrice !== "" ? { defaultPrice: Number(trimmedPrice) } : {}),
          defaultStock: stock,
          activate: true,
        },
      });
      const data = (response as { data?: GenerateVariantsResponse }).data ?? response;
      setResult(data as GenerateVariantsResponse);
      onGenerated?.(data as GenerateVariantsResponse);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to generate variants");
    }
  };

  if (isLoadingAttributes) {
    return (
      <div className="p-6 flex items-center justify-center text-neutral-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  const attributesWithValues = productAttributes.filter((a) => a.values.length > 0);

  if (attributesWithValues.length === 0) {
    return (
      <p className="text-xs text-neutral-500 italic p-4">
        No attributes are configured for this product yet. Configure Color, Size, etc. under the
        product&apos;s Attributes section first.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-neutral-500">
        Pick the values you want to sell for each option. Every combination of the values you
        select will become its own Item, each with its own price, stock, SKU and images.
      </p>

      <div className="space-y-4">
        {attributesWithValues.map((attribute) => (
          <div key={attribute.id}>
            <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
              {attribute.name}
            </label>
            <div className="flex flex-wrap gap-2">
              {attribute.values.map((value) => {
                const isChecked = (selectedValues[attribute.id] || []).includes(value.id);
                return (
                  <button
                    key={value.id}
                    type="button"
                    onClick={() => toggleValue(attribute.id, value.id)}
                    disabled={generateMutation.isPending}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer select-none disabled:opacity-50 ${
                      isChecked
                        ? "border-secondary-600 bg-secondary-600 text-white shadow-xs"
                        : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50"
                    }`}
                  >
                    {attribute.type === "color" && value.colorHex && (
                      <span
                        className="h-3 w-3 rounded-full border border-white/60"
                        style={{ backgroundColor: value.colorHex }}
                      />
                    )}
                    {value.value}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div
        className={`rounded-xl border px-4 py-3 text-sm font-semibold flex items-center gap-2 ${
          combinationCount > 0
            ? "border-secondary-200 bg-secondary-50 text-secondary-800"
            : "border-neutral-200 bg-neutral-50 text-neutral-400"
        }`}
      >
        <Sparkles className="w-4 h-4 shrink-0" />
        {combinationCount > 0
          ? `${combinationCount} variant${combinationCount === 1 ? "" : "s"} will be generated`
          : "Select values above to see how many variants will be generated"}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
            Unit <span className="text-red-500">*</span>
          </label>
          <Select
            value={unitId}
            onValueChange={(val) => setUnitId(val)}
            disabled={generateMutation.isPending}
            placeholder="Select unit"
            options={[
              { value: "", label: "Select unit" },
              ...units.map((u: AdminUnitResponse) => ({
                value: u.id,
                label: `${u.name} (${u.code})`,
              })),
            ]}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
            Default price (₹)
          </label>
          <input
            type="number"
            step="any"
            min="0"
            value={defaultPrice}
            onChange={(e) => setDefaultPrice(e.target.value)}
            disabled={generateMutation.isPending}
            placeholder="e.g. 799"
            className="w-full h-10 px-3 rounded-lg border border-neutral-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-secondary-600/20 focus:border-secondary-600 disabled:opacity-60"
          />
          <p className="text-[11px] text-neutral-400 mt-1">
            Applied to every generated variant. Leave blank to use the product&apos;s base price
            plus each value&apos;s price add-on. Edit any variant&apos;s price individually
            afterwards.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
            Default stock
          </label>
          <input
            type="number"
            step="1"
            min="0"
            value={defaultStock}
            onChange={(e) => setDefaultStock(e.target.value)}
            disabled={generateMutation.isPending}
            className="w-full h-10 px-3 rounded-lg border border-neutral-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-secondary-600/20 focus:border-secondary-600 disabled:opacity-60"
          />
        </div>
      </div>

      {formError && (
        <p className="text-xs text-red-500 font-medium flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" /> {formError}
        </p>
      )}

      {result && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 text-xs flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">
              {result.created} variant{result.created === 1 ? "" : "s"} created
            </p>
            {result.skipped > 0 && (
              <p className="mt-0.5">
                {result.skipped} combination{result.skipped === 1 ? "" : "s"} already existed and
                were skipped.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end pt-1">
        <Button
          type="button"
          onClick={handleGenerate}
          disabled={generateMutation.isPending || combinationCount === 0}
          className="h-10 rounded-xl bg-gradient-to-b from-[var(--color-primary-400)] to-[var(--color-primary-600)] shadow-[0_6px_16px_-6px_rgba(37,99,235,0.45),inset_0_1px_0_rgba(255,255,255,0.18)] transition-all px-5 text-sm font-semibold text-white hover:-translate-y-px hover:shadow-[0_10px_20px_-8px_rgba(37,99,235,0.5),inset_0_1px_0_rgba(255,255,255,0.18)] active:translate-y-0 cursor-pointer"
        >
          {generateMutation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
          )}
          Generate Variants
        </Button>
      </div>
    </div>
  );
}

export { VariantGenerator };
