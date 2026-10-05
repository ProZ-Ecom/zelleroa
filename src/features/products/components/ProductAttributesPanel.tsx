"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAttributesForProduct, useSetAttributesForProduct } from "@/features/attributes/hooks";
import { ApiClientError } from "@/lib/api/api-client";
import type { ProductAttributeUsage, ProductAttributeConfigOption } from "@/features/attributes/types";

interface ProductAttributesPanelProps {
  productUuid: string;
}

// Stable reference so the sync effect below doesn't re-fire every render
// while the query has no data yet (a fresh `[]` literal on every render would
// change the effect's dependency each time and loop forever).
const EMPTY_ATTRIBUTES: ProductAttributeConfigOption[] = [];

/**
 * Product-level "which attributes apply" configuration (e.g. T-Shirt -> Color +
 * Size). This is the definition layer Items inherit - Item creation only ever
 * offers value-selection for whatever is checked here, never a free "add
 * attribute" picker.
 */
function ProductAttributesPanel({ productUuid }: ProductAttributesPanelProps) {
  const {
    data: attributes = EMPTY_ATTRIBUTES,
    isLoading,
    error,
    refetch,
  } = useAttributesForProduct(productUuid);
  const setAttributesMutation = useSetAttributesForProduct();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isDirty, setIsDirty] = useState(false);
  const [usageWarning, setUsageWarning] = useState<ProductAttributeUsage[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (isDirty) return;
    setSelected(new Set(attributes.filter((a) => a.configured).map((a) => a.id)));
  }, [attributes, isDirty]);

  const toggle = (attributeId: string) => {
    setIsDirty(true);
    setFormError(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(attributeId)) next.delete(attributeId);
      else next.add(attributeId);
      return next;
    });
  };

  const save = async (force = false) => {
    setFormError(null);
    try {
      await setAttributesMutation.mutateAsync({
        productUuid,
        attributeIds: [...selected],
        force,
      });
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
    <div className="space-y-4">
      <p className="text-xs text-neutral-500">
        Choose which attributes apply to this product (e.g. Color, Size, Material). Items under
        this product will only ever offer value-selection for what&apos;s checked here.
      </p>

      {attributes.length === 0 ? (
        <p className="text-xs text-neutral-400 italic">
          No attributes exist yet. Add some under Catalog &gt; Attributes first.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {attributes.map((attribute) => {
            const isChecked = selected.has(attribute.id);
            return (
              <button
                key={attribute.id}
                type="button"
                onClick={() => toggle(attribute.id)}
                disabled={setAttributesMutation.isPending}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer select-none disabled:opacity-50 ${
                  isChecked
                    ? "border-secondary-600 bg-secondary-600 text-white shadow-xs"
                    : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50"
                }`}
              >
                {attribute.name}
                {attribute.type === "color" && (
                  <span
                    className={`h-2 w-2 rounded-full ${isChecked ? "bg-white/80" : "bg-secondary-400"}`}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {formError && <p className="text-xs font-medium text-error-600">{formError}</p>}

      <div className="flex justify-end pt-1">
        <Button
          type="button"
          onClick={() => save(false)}
          disabled={!isDirty || setAttributesMutation.isPending}
          className="h-10 rounded-xl bg-[var(--color-primary-500)] px-5 text-sm font-semibold text-white hover:bg-[var(--color-primary-600)] cursor-pointer"
        >
          {setAttributesMutation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
          ) : (
            <Save className="w-3.5 h-3.5 mr-1.5" />
          )}
          Save Attributes
        </Button>
      </div>

      <ConfirmDialog
        open={!!usageWarning}
        onClose={() => setUsageWarning(null)}
        onConfirm={() => save(true)}
        title="Remove attributes already in use?"
        description={
          usageWarning
            ? usageWarning
                .map(
                  (u) =>
                    `"${u.attributeName}" is currently used by ${u.itemCount} item(s) and ${u.variantCount} variant(s).`
                )
                .join(" ") + " Removing them from this product will affect the existing item configuration."
            : ""
        }
        confirmText="Remove anyway"
        variant="destructive"
        isLoading={setAttributesMutation.isPending}
      />
    </div>
  );
}

export { ProductAttributesPanel };
