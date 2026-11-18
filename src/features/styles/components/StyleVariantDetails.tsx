"use client";

import { Palette, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AdminVariantResponse } from "@/features/variants/types";
import { formatPrice } from "@/lib/utils";

interface StyleVariantDetailsProps {
  styleName: string;
  variants: AdminVariantResponse[];
  colorLabel: string;
  sizeLabel: string;
  /** Opens the one panel where this Style's colors, images, sizes and prices are managed. */
  onManageColors: () => void;
}

/**
 * Read-only overview of what this Style currently sells. Every edit affordance
 * funnels into a single "Manage colors" panel on purpose - images, sizes and
 * prices used to be reachable from three different places, which is what made
 * the flow hard to follow.
 */
function StyleVariantDetails({
  styleName,
  variants,
  colorLabel,
  sizeLabel,
  onManageColors,
}: StyleVariantDetailsProps) {
  const allPrices = variants.flatMap((variant) => variant.unitPrices ?? []);
  const prices = allPrices.map((price) => price.basePrice);
  const totalStock = allPrices.reduce((sum, price) => sum + (price.stock ?? 0), 0);
  const colorCount = new Set(variants.map((variant) => variant.colorName || variant.id)).size;

  return (
    <section className="overflow-hidden rounded-lg border border-cream-border bg-white">
      <div className="flex flex-col gap-3 border-b border-cream-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-neutral-900">Colors &amp; Sizes</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Everything &ldquo;{styleName}&rdquo; is sold in. Open &ldquo;Manage colors&rdquo; to
            add colors, upload their images and set sizes, prices and stock.
          </p>
        </div>
        <span className="rounded-full bg-secondary-50 px-2.5 py-1 text-xs font-semibold text-secondary-700">
          {variants.length} {colorLabel.toLowerCase()}
          {variants.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-px border-b border-cream-border bg-cream-border sm:grid-cols-4">
        {[
          [`Total ${sizeLabel}`, String(allPrices.length)],
          [
            "Price Range",
            prices.length
              ? `${formatPrice(Math.min(...prices))} – ${formatPrice(Math.max(...prices))}`
              : "—",
          ],
          ["Total Stock", String(totalStock)],
          [colorLabel, String(colorCount)],
        ].map(([label, value]) => (
          <div key={label} className="bg-white px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">
              {label}
            </p>
            <p className="mt-0.5 text-sm font-bold text-neutral-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap justify-end gap-1.5">
          <Button
            size="sm"
            onClick={onManageColors}
            className="bg-secondary-600 text-white hover:bg-secondary-700"
          >
            <Palette className="mr-1.5 h-3.5 w-3.5" /> Manage colors
          </Button>
        </div>

        {variants.length ? (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {variants.map((variant) => {
                const label = variant.colorName || variant.variantName || "Color";
                const sizeCount = (variant.unitPrices ?? []).length;
                return (
                  <span
                    key={variant.id}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      variant.isActive
                        ? "border-secondary-200 bg-white text-neutral-800"
                        : "border-neutral-200 bg-neutral-100 text-neutral-400"
                    }`}
                  >
                    {variant.primaryImage ? (
                      <img
                        src={variant.primaryImage}
                        alt=""
                        className="h-4 w-4 rounded-full border border-white object-cover"
                      />
                    ) : (
                      <span
                        className="h-3 w-3 rounded-full border border-neutral-300"
                        style={
                          variant.colorHex ? { backgroundColor: variant.colorHex } : undefined
                        }
                      />
                    )}
                    {label}
                    <span className="font-normal text-neutral-400">
                      {sizeCount} {sizeLabel.toLowerCase()}
                      {sizeCount === 1 ? "" : "s"}
                    </span>
                  </span>
                );
              })}
            </div>
            <p className="text-[11px] text-neutral-500">{totalStock} in stock</p>
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-dashed border-neutral-200 bg-white px-4 py-5 text-center">
            <p className="text-sm font-semibold text-neutral-700">
              No {colorLabel.toLowerCase()}s yet
            </p>
            <Button
              size="sm"
              onClick={onManageColors}
              className="mt-2 bg-secondary-600 text-white hover:bg-secondary-700"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add colors
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

export { StyleVariantDetails };
