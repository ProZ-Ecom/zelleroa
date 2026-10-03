"use client";

import * as React from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Layers, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/Alert";
import { FormInput } from "@/components/forms/form-input";
import { FormSelect } from "@/components/forms/form-select";
import { FormTextarea } from "@/components/forms/form-textarea";
import { FormSwitch } from "@/components/forms/FormSwitch";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import { Label } from "@/components/forms/label";
import { cn } from "@/lib/utils";
import {
  createOfferSchema,
  type CreateOfferSchemaInput,
} from "../validations/offer.schema";
import {
  OFFER_TYPE_OPTIONS,
  offerValueFieldLabel,
} from "../constants/offer-options";
import { OfferTargetPicker } from "./OfferTargetPicker";
import { OfferPreview } from "./OfferPreview";
import { useOfferItemTargets } from "../hooks";
import type { OfferItemTarget, OfferLevel, OfferListItem, OfferType } from "../types";

export interface OfferFormProps {
  initialData?: OfferListItem | null;
  isLoading?: boolean;
  submitLabel?: string;
  serverError?: string | null;
  onCancel: () => void;
  onSubmit: (data: CreateOfferSchemaInput) => void | Promise<void>;
}

/** `<input type="date">` needs `yyyy-MM-dd`, not an ISO timestamp. */
function toDateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildDefaults(offer?: OfferListItem | null): CreateOfferSchemaInput {
  if (!offer) {
    return {
      name: "",
      code: "",
      level: "product",
      type: "percentage",
      value: "" as unknown as number,
      buyQuantity: null,
      getQuantity: null,
      minQuantity: 1,
      maxQuantity: null,
      minCartValue: null,
      maxDiscountAmount: null,
      priority: 0,
      terms: "",
      startsAt: todayInputValue(),
      endsAt: todayInputValue(),
      isActive: true,
      productIds: [],
      itemIds: [],
    };
  }

  return {
    name: offer.name,
    code: offer.code ?? "",
    level: offer.level,
    type: offer.type,
    value: offer.value,
    buyQuantity: offer.buyQuantity,
    getQuantity: offer.getQuantity,
    minQuantity: offer.minQuantity,
    maxQuantity: offer.maxQuantity,
    minCartValue: offer.minCartValue,
    maxDiscountAmount: offer.maxDiscountAmount,
    priority: offer.priority,
    terms: offer.terms ?? "",
    startsAt: toDateInputValue(offer.startsAt) || todayInputValue(),
    endsAt: toDateInputValue(offer.endsAt) || todayInputValue(),
    isActive: offer.isActive,
    productIds: offer.products.map((p) => p.id),
    itemIds: offer.items.map((i) => i.id),
  };
}

export function OfferForm({
  initialData,
  isLoading,
  submitLabel = "Save Offer",
  serverError,
  onCancel,
  onSubmit,
}: OfferFormProps) {
  const methods = useForm<CreateOfferSchemaInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createOfferSchema) as any,
    defaultValues: buildDefaults(initialData),
    mode: "onBlur",
    reValidateMode: "onBlur",
  });

  const { control, setValue, formState } = methods;

  const level = (useWatch({ control, name: "level" }) ?? "product") as OfferLevel;
  const type = (useWatch({ control, name: "type" }) ?? "percentage") as OfferType;
  const watchedProductIds = useWatch({ control, name: "productIds" });
  const watchedItemIds = useWatch({ control, name: "itemIds" });
  // Memoised so the `?? []` fallback does not hand downstream hooks a fresh
  // array identity on every render.
  const productIds = React.useMemo(
    () => (watchedProductIds ?? []) as string[],
    [watchedProductIds]
  );
  const itemIds = React.useMemo(
    () => (watchedItemIds ?? []) as string[],
    [watchedItemIds]
  );
  const value = Number(useWatch({ control, name: "value" }) ?? 0);
  const minQuantity = Number(useWatch({ control, name: "minQuantity" }) ?? 1);
  const maxQuantity = useWatch({ control, name: "maxQuantity" }) as number | null;
  const maxDiscountAmount = useWatch({ control, name: "maxDiscountAmount" }) as number | null;
  const buyQuantity = useWatch({ control, name: "buyQuantity" }) as number | null;
  const getQuantity = useWatch({ control, name: "getQuantity" }) as number | null;
  const startsAt = (useWatch({ control, name: "startsAt" }) ?? "") as string;
  const endsAt = (useWatch({ control, name: "endsAt" }) ?? "") as string;
  const isActive = Boolean(useWatch({ control, name: "isActive" }));

  // The picker's own Category/Product dropdowns are navigation, not offer
  // data, so they are local state rather than form fields.
  const [categoryId, setCategoryId] = React.useState("");
  const [productFilterId, setProductFilterId] = React.useState("");

  // Sample pack sizes for the preview: the exact items for an item-wise
  // offer, or the pack sizes under the first selected product otherwise.
  const { data: previewItemsForProduct = [] } = useOfferItemTargets({
    productId: level === "product" ? productIds[0] : undefined,
    enabled: level === "product" && productIds.length > 0,
  });

  const { data: itemsForSelection = [] } = useOfferItemTargets({
    productId: productFilterId || undefined,
    enabled: level === "item",
  });

  const selectedItemDetails = React.useMemo<OfferItemTarget[]>(() => {
    const byId = new Map<string, OfferItemTarget>();
    for (const item of [...(initialData?.items ?? []), ...itemsForSelection]) {
      byId.set(item.id, item);
    }
    return itemIds
      .map((id) => byId.get(id))
      .filter((item): item is OfferItemTarget => Boolean(item));
  }, [itemIds, itemsForSelection, initialData]);

  const previewItems =
    level === "item" ? selectedItemDetails : previewItemsForProduct;

  const setLevel = (next: OfferLevel) => {
    setValue("level", next, { shouldValidate: false });
    // The other level's selection is cleared, so an offer can never carry a
    // hidden target list from the tab the admin switched away from.
    if (next === "product") {
      setValue("itemIds", [], { shouldValidate: false });
    } else {
      setValue("productIds", [], { shouldValidate: false });
    }
  };

  const showValueField = type !== "bxgy";
  const showBxgyFields = type === "bxgy";
  const showMaxDiscount = type === "percentage" || type === "flat";

  const targetError =
    formState.isSubmitted
      ? level === "product"
        ? (formState.errors.productIds?.message as string | undefined)
        : (formState.errors.itemIds?.message as string | undefined)
      : undefined;

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(onSubmit)}
        className="space-y-6"
        noValidate
      >
        {serverError && <Alert variant="error">{serverError}</Alert>}

        {/* Offer level ------------------------------------------------- */}
        <section className="space-y-2">
          <Label>
            Offer Level<span className="text-error-600 font-bold ml-1">*</span>
          </Label>
          <div
            role="tablist"
            aria-label="Offer level"
            className="inline-flex w-full rounded-xl border border-neutral-200 bg-neutral-100 p-1 sm:w-auto"
          >
            {(
              [
                { value: "product", label: "Product-wise", icon: Package },
                { value: "item", label: "Item/Variant-wise", icon: Layers },
              ] as const
            ).map((option) => {
              const Icon = option.icon;
              const selected = level === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setLevel(option.value)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors cursor-pointer",
                    selected
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-600 hover:text-neutral-900"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-neutral-500">
            {level === "product"
              ? "Applies to every item and pack size under the selected products."
              : "Applies only to the exact pack sizes you select."}
          </p>
        </section>

        {/* Basics ------------------------------------------------------ */}
        <section className="grid gap-4 sm:grid-cols-2">
          <FormInput
            name="name"
            label="Offer Name"
            required
            placeholder="e.g. Diwali Festival Offer"
          />
          <FormInput
            name="code"
            label="Offer / Coupon Code"
            placeholder="Optional, e.g. DIWALI15"
            isSlug={false}
            description="Leave blank for an automatic offer that needs no code."
          />
        </section>

        {/* Targets ----------------------------------------------------- */}
        <section className="rounded-xl border border-neutral-200 p-4">
          <h3 className="mb-4 text-sm font-semibold text-neutral-900">
            {level === "product" ? "Products" : "Items / Variants"}
          </h3>
          <OfferTargetPicker
            level={level}
            categoryId={categoryId}
            onCategoryChange={setCategoryId}
            productId={productFilterId}
            onProductChange={setProductFilterId}
            selectedProductIds={productIds}
            onSelectedProductIdsChange={(ids) =>
              setValue("productIds", ids, {
                shouldValidate: formState.isSubmitted,
                shouldDirty: true,
              })
            }
            selectedItemIds={itemIds}
            onSelectedItemIdsChange={(ids) =>
              setValue("itemIds", ids, {
                shouldValidate: formState.isSubmitted,
                shouldDirty: true,
              })
            }
            preloadedItems={initialData?.items}
            preloadedProducts={initialData?.products}
            error={targetError}
          />
        </section>

        {/* Discount ---------------------------------------------------- */}
        <section className="grid gap-4 sm:grid-cols-2">
          <FormSelect
            name="type"
            label="Offer Type"
            required
            options={[...OFFER_TYPE_OPTIONS]}
          />

          {showValueField && (
            <FormInput
              name="value"
              type="number"
              step="0.01"
              min={0}
              label={offerValueFieldLabel(type)}
              required
              placeholder={type === "percentage" ? "e.g. 15" : "e.g. 50"}
            />
          )}

          {showBxgyFields && (
            <>
              <FormInput
                name="buyQuantity"
                type="number"
                min={1}
                label="Buy Quantity"
                required
                placeholder="e.g. 2"
              />
              <FormInput
                name="getQuantity"
                type="number"
                min={1}
                label="Get Quantity (free)"
                required
                placeholder="e.g. 1"
              />
            </>
          )}
        </section>

        {/* Limits ------------------------------------------------------ */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormInput
            name="minQuantity"
            type="number"
            min={1}
            label="Minimum Quantity"
            required
          />
          <FormInput
            name="maxQuantity"
            type="number"
            min={1}
            label="Maximum Quantity"
            placeholder="Optional"
            description="Units beyond this pay full price."
          />
          <FormInput
            name="minCartValue"
            type="number"
            step="0.01"
            min={0}
            label="Minimum Cart Value (₹)"
            placeholder="Optional"
          />
          {showMaxDiscount && (
            <FormInput
              name="maxDiscountAmount"
              type="number"
              step="0.01"
              min={0}
              label="Maximum Discount (₹)"
              placeholder="Optional"
            />
          )}
        </section>

        {/* Schedule & priority ----------------------------------------- */}
        <section className="grid gap-4 sm:grid-cols-3">
          <FormInput name="startsAt" type="date" label="Start Date" required />
          <FormInput name="endsAt" type="date" label="End Date" required />
          <FormInput
            name="priority"
            type="number"
            min={0}
            max={1000}
            label="Priority"
            required
            description="Higher wins when two offers of the same level compete."
          />
        </section>

        {/* Terms & status ---------------------------------------------- */}
        <section className="space-y-4">
          <FormTextarea
            name="terms"
            label="Terms & Conditions"
            rows={3}
            placeholder="Shown to customers on the product page. Optional."
          />

          <div className="flex items-center justify-between rounded-xl border border-neutral-200 p-4">
            <FormSwitch
              label="Offer Status"
              description={
                isActive
                  ? "Active - customers will see this offer inside its date window."
                  : "Inactive - saved but never applied."
              }
              checked={isActive}
              onCheckedChange={(checked) =>
                setValue("isActive", checked, { shouldValidate: false })
              }
            />
            <Badge variant={isActive ? "success" : "secondary"}>
              {isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </section>

        {/* Preview ------------------------------------------------------ */}
        <OfferPreview
          level={level}
          type={type}
          value={value}
          buyQuantity={buyQuantity}
          getQuantity={getQuantity}
          minQuantity={minQuantity}
          maxQuantity={maxQuantity}
          maxDiscountAmount={maxDiscountAmount}
          startsAt={startsAt}
          endsAt={endsAt}
          sampleItems={previewItems}
        />

        <div className="flex items-center justify-end gap-3 border-t border-neutral-200 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-xl"
          >
            Cancel
          </Button>
          <FormSubmitButton
            isLoading={isLoading}
            className="rounded-xl bg-[var(--color-secondary-600)] px-6 font-semibold text-white hover:bg-[var(--color-secondary-700)]"
          >
            {submitLabel}
          </FormSubmitButton>
        </div>
      </form>
    </FormProvider>
  );
}
