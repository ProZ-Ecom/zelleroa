"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, AlertCircle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAttributesForProduct, useSetAttributesForProduct } from "@/features/attributes/hooks";
import { ApiClientError } from "@/lib/api/api-client";
import type {
  ProductAttributeUsage,
  ProductAttributeConfigOption,
  VariationLevel,
} from "@/features/attributes/types";

interface ProductAttributesPanelProps {
  productUuid: string;
}

// Stable reference so the sync effect below doesn't re-fire every render
// while the query has no data yet (a fresh `[]` literal on every render would
// change the effect's dependency each time and loop forever).
const EMPTY_ATTRIBUTES: ProductAttributeConfigOption[] = [];

interface SelectedAttribute {
  attributeId: string;
  variationLevel: VariationLevel;
}

const LEVELS: { value: VariationLevel; label: string; hint: string }[] = [
  { value: "VARIANT", label: "Variant", hint: "Own images — usually Colour" },
  { value: "SKU", label: "SKU", hint: "Splits stock — Size, Neck, Storage" },
  { value: "INFO", label: "Info", hint: "Describes only — Fabric, Fit" },
];

/**
 * Product-level "which attributes apply" configuration (e.g. T-Shirt -> Color +
 * Size). This is the definition layer Items inherit - Item creation only ever
 * offers value-selection for whatever is checked here, never a free "add
 * attribute" picker.
 *
 * Each checked attribute also carries the level it varies at, because that is what
 * decides whether it becomes its own Variant, joins the SKU identity and splits
 * stock, or is only descriptive. Marking the descriptive ones Info is what keeps the
 * SKU set manageable: four modest axes left on SKU already run to hundreds of rows.
 */
function ProductAttributesPanel({ productUuid }: ProductAttributesPanelProps) {
  const {
    data: attributes = EMPTY_ATTRIBUTES,
    isLoading,
    error,
    refetch,
  } = useAttributesForProduct(productUuid);
  const setAttributesMutation = useSetAttributesForProduct();

  const [selected, setSelected] = useState<SelectedAttribute[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [usageWarning, setUsageWarning] = useState<ProductAttributeUsage[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (isDirty) return;
    setSelected(
      attributes
        .filter((a) => a.configured)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((a) => ({ attributeId: a.id, variationLevel: a.variationLevel }))
    );
  }, [attributes, isDirty]);

  const levelOf = (attributeId: string) =>
    selected.find((s) => s.attributeId === attributeId)?.variationLevel ?? null;

  const toggle = (attributeId: string, type: ProductAttributeConfigOption["type"]) => {
    setIsDirty(true);
    setFormError(null);
    setSelected((prev) => {
      if (prev.some((s) => s.attributeId === attributeId)) {
        return prev.filter((s) => s.attributeId !== attributeId);
      }
      // A colour attribute is the one that carries images, so it defaults to Variant;
      // anything else is assumed to split stock until the admin says otherwise.
      return [
        ...prev,
        { attributeId, variationLevel: type === "color" ? "VARIANT" : "SKU" },
      ];
    });
  };

  const setLevel = (attributeId: string, variationLevel: VariationLevel) => {
    setIsDirty(true);
    setFormError(null);
    setSelected((prev) =>
      prev.map((s) => (s.attributeId === attributeId ? { ...s, variationLevel } : s))
    );
  };

  const save = async (force = false) => {
    setFormError(null);
    try {
      await setAttributesMutation.mutateAsync({ productUuid, attributes: selected, force });
      setIsDirty(false);
      setUsageWarning(null);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        const usage = (err.details as { usage?: ProductAttributeUsage[] } | undefined)?.usage;
        if (usage?.length) {
          setUsageWarning(usage);
          return;
        }
      }
      setFormError(err instanceof Error ? err.message : "Failed to save attributes");
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center text-neutral-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl border border-error-200 bg-error-50 text-error-700 text-xs flex items-start gap-2">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold">
            {error instanceof Error ? error.message : "Failed to load attributes"}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="underline font-medium hover:text-error-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-700">
          <HelpCircle className="h-3.5 w-3.5 shrink-0" />
          Pick the attributes this product varies by, then set how each one varies.
          <span className="font-medium underline decoration-dotted">Details</span>
        </summary>
        <p className="mt-2 text-xs leading-relaxed text-neutral-500">
          Items under this product only ever offer value-selection for what&apos;s checked here.{" "}
          <span className="font-semibold">Variant</span> gets its own images,{" "}
          <span className="font-semibold">SKU</span> splits stock into separate rows, and{" "}
          <span className="font-semibold">Info</span> only describes the item. Keep attributes that
          are the same across the whole item on Info — every SKU attribute multiplies the number of
          stock rows.
        </p>
      </details>

      {attributes.length === 0 ? (
        <p className="text-xs text-neutral-400 italic">
          No attributes exist yet. Add some under Catalog &gt; Attributes first.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {attributes.map((attribute) => {
            const level = levelOf(attribute.id);
            const isChecked = level !== null;
            return (
              <div
                key={attribute.id}
                className={`inline-flex items-center gap-1.5 rounded-lg border p-1 transition-colors ${
                  isChecked ? "border-secondary-200 bg-secondary-50/60" : "border-neutral-200 bg-white"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(attribute.id, attribute.type)}
                  disabled={setAttributesMutation.isPending}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer select-none disabled:opacity-50 ${
                    isChecked
                      ? "border-secondary-600 bg-secondary-600 text-white shadow-xs"
                      : "border-transparent bg-white text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  {attribute.name}
                  {attribute.type === "color" && (
                    <span
                      className={`h-2 w-2 rounded-full ${isChecked ? "bg-white/80" : "bg-secondary-400"}`}
                    />
                  )}
                </button>

                {isChecked && (
                  <div className="inline-flex rounded-md border border-neutral-200 bg-white p-0.5">
                    {LEVELS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        title={option.hint}
                        onClick={() => setLevel(attribute.id, option.value)}
                        disabled={setAttributesMutation.isPending}
                        className={`rounded px-2 py-0.5 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
                          level === option.value
                            ? "bg-theme-primary text-white"
                            : "text-neutral-500 hover:bg-neutral-100"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {formError && <p className="text-xs font-medium text-error-600">{formError}</p>}

      {isDirty && (
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => save(false)}
            disabled={setAttributesMutation.isPending}
            className="h-8 rounded-lg bg-theme-primary hover:bg-theme-primary-hover px-3.5 text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            {setAttributesMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
            ) : (
              <Save className="w-3.5 h-3.5 mr-1.5" />
            )}
            Save Attributes
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={!!usageWarning}
        onClose={() => setUsageWarning(null)}
        onConfirm={() => save(true)}
        title="Save changes to attributes already in use?"
        description={
          usageWarning
            ? usageWarning
                .map((u) => {
                  const used = [
                    u.itemCount > 0 ? `${u.itemCount} item(s)` : null,
                    u.variantCount > 0 ? `${u.variantCount} variant(s)` : null,
                    u.skuCount > 0 ? `${u.skuCount} stock row(s)` : null,
                  ]
                    .filter(Boolean)
                    .join(", ");
                  return u.change === "demoted"
                    ? `"${u.attributeName}" no longer splits stock, but ${used} still identify themselves by it.`
                    : `"${u.attributeName}" is being removed and is used by ${used}.`;
                })
                .join(" ") +
              " Those rows stay as they are and will no longer match this product's configuration."
            : ""
        }
        confirmText="Save anyway"
        variant="destructive"
        isLoading={setAttributesMutation.isPending}
      />
    </div>
  );
}

export { ProductAttributesPanel };
