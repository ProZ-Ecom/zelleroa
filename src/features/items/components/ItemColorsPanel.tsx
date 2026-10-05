"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ImageIcon,
  IndianRupee,
  Loader2,
  Ruler,
  Settings2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useItemAttributeValues, useSetAttributeValuesForItem } from "@/features/attributes/hooks";
import { AttributeValueQuickAdd } from "@/features/attributes/components/AttributeValueQuickAdd";
import { useUnits } from "@/features/units/hooks";
import {
  useVariants,
  useVariantImages,
  useGenerateVariantsFromItem,
  useDeleteVariant,
} from "@/features/variants/hooks";
import { VariantImageUploader, VariantUnitPriceList } from "@/features/variants/components";
import { toast } from "@/components/ui/Toast";
import type { AdminUnitResponse } from "@/features/units/types";
import type { ItemAttributeGroup } from "@/features/attributes/types";
import type { AdminVariantResponse, GenerateVariantsResponse } from "@/features/variants/types";

interface ItemColorsPanelProps {
  productUuid: string;
  itemUuid: string;
  /** Item name, used in headings and the bulk price modal title. */
  itemName?: string;
  /** The product's category - drives the Size options in each color's size table. */
  categoryUuid?: string | null;
  /** Called after anything here creates or removes a color so parents can refetch. */
  onChanged?: () => void;
  /** When given, shows an "Edit all prices" button that hands off to the host.
   * The panel never opens a modal of its own: it is itself rendered inside one
   * on the Style page, and nested FormModals restore body scroll for the outer
   * one when the inner closes. */
  onBulkEditPrices?: () => void;
}

// Stable reference so the memos below don't recompute every render while the
// query has no data yet.
const EMPTY_GROUPS: ItemAttributeGroup[] = [];

/**
 * The one place an admin manages an Item's colors.
 *
 * It replaces what used to be three disconnected steps spread over two modals:
 * pick attribute values -> Save Selection -> Generate Variants -> hunt for a
 * separate Color Images list (which quietly created colors through a second,
 * different code path) -> open yet another "Manage Colors & Sizes" modal for
 * sizes and prices. Now: tick the colors, press one button, and every color
 * that exists sits right below with its images and size/price rows inline.
 */
function ItemColorsPanel({
  productUuid,
  itemUuid,
  itemName,
  categoryUuid,
  onChanged,
  onBulkEditPrices,
}: ItemColorsPanelProps) {
  const {
    data: groups = EMPTY_GROUPS,
    isLoading: isLoadingGroups,
    error: groupsError,
    refetch: refetchGroups,
  } = useItemAttributeValues(productUuid, itemUuid);

  const {
    data: variantsResponse,
    isLoading: isLoadingVariants,
    refetch: refetchVariants,
  } = useVariants({ productIds: [productUuid], pageSize: 100 }, { enabled: !!productUuid });

  const variants = useMemo<AdminVariantResponse[]>(
    () => (variantsResponse?.data ?? []).filter((variant) => variant.itemId === itemUuid),
    [variantsResponse, itemUuid]
  );

  const { data: unitsData } = useUnits({ pageSize: 100 });
  const units = useMemo<AdminUnitResponse[]>(() => unitsData?.data ?? [], [unitsData]);

  const setValuesMutation = useSetAttributeValuesForItem();
  const generateMutation = useGenerateVariantsFromItem();
  const deleteVariantMutation = useDeleteVariant();

  // null until the admin touches a chip: until then the panel simply shows
  // whatever the server has saved, so there is no state to keep in sync.
  const [draftSelection, setDraftSelection] = useState<Set<string> | null>(null);
  const [showDefaults, setShowDefaults] = useState(false);
  const [pickedUnitId, setPickedUnitId] = useState("");
  const [defaultStock, setDefaultStock] = useState("0");
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateVariantsResponse | null>(null);
  const [openVariantId, setOpenVariantId] = useState<string | null>(null);
  // Id of the color whose row is showing its inline "Delete?" confirmation.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // What the server currently has saved for this item.
  const savedSelection = useMemo(() => {
    const next = new Set<string>();
    for (const group of groups) {
      const groupSelected = group.values.filter((value) => value.selected);
      if (!group.multipleSelection && groupSelected.length > 1) {
        next.add(groupSelected[0].id);
      } else {
        for (const value of groupSelected) next.add(value.id);
      }
    }
    return next;
  }, [groups]);

  const selected = draftSelection ?? savedSelection;

  // One unit in the system is the common case - use it so the admin never has
  // to answer a question that has exactly one answer.
  const unitId = pickedUnitId || (units.length === 1 ? units[0].id : "");

  const colorGroups = useMemo(() => groups.filter((group) => group.type === "color"), [groups]);
  const otherGroups = useMemo(() => groups.filter((group) => group.type !== "color"), [groups]);

  // A color value counts as "already created" when a variant carries its name -
  // the same match the colors list below uses.
  const createdValueNames = useMemo(
    () =>
      new Set(
        variants.map((variant) =>
          (variant.colorName || variant.variantName || "").trim().toLowerCase()
        )
      ),
    [variants]
  );

  const isCreated = (valueName: string) => createdValueNames.has(valueName.trim().toLowerCase());

  // How many colors the button is about to create: the selected color values
  // that don't have a variant yet. Counted off the color groups rather than a
  // Cartesian total, because a variant here is one color - its sizes live in
  // that color's unit-price rows, not in separate variants.
  const pendingCount = useMemo(
    () =>
      colorGroups.reduce(
        (count, group) =>
          count +
          group.values.filter((value) => selected.has(value.id) && !isCreated(value.value)).length,
        0
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colorGroups, selected, createdValueNames]
  );

  const toggle = (group: ItemAttributeGroup, valueId: string) => {
    setResult(null);
    setFormError(null);
    setDraftSelection((current) => {
      const prev = current ?? savedSelection;
      const next = new Set(prev);
      if (!group.multipleSelection) {
        // Single-selection attribute: picking a value replaces the group's
        // other selection instead of adding to it.
        for (const value of group.values) next.delete(value.id);
        if (!prev.has(valueId)) next.add(valueId);
        return next;
      }
      if (next.has(valueId)) next.delete(valueId);
      else next.add(valueId);
      return next;
    });
  };

  /** Select every value of a pick-any group, or clear them all if already all selected. */
  const toggleAll = (group: ItemAttributeGroup) => {
    setResult(null);
    setFormError(null);
    setDraftSelection((current) => {
      const next = new Set(current ?? savedSelection);
      const allSelected = group.values.every((value) => next.has(value.id));
      for (const value of group.values) {
        if (allSelected) next.delete(value.id);
        else next.add(value.id);
      }
      return next;
    });
  };

  // A value created right here from the quick-add form is pre-selected, so the
  // admin doesn't have to hunt for the chip they just made.
  const selectNewValue = (group: ItemAttributeGroup, valueId: string) => {
    setResult(null);
    setDraftSelection((current) => {
      const next = new Set(current ?? savedSelection);
      if (!group.multipleSelection) {
        for (const value of group.values) next.delete(value.id);
      }
      next.add(valueId);
      return next;
    });
  };

  /** Save the selection and create the colors in one press. */
  const handleApply = async () => {
    setFormError(null);
    setResult(null);

    if (selected.size === 0) {
      setFormError("Pick at least one value above first.");
      return;
    }
    for (const group of groups) {
      if (group.multipleSelection) continue;
      if (group.values.filter((value) => selected.has(value.id)).length > 1) {
        setFormError(`Only one value can be selected for "${group.name}".`);
        return;
      }
    }
    if (!unitId) {
      setShowDefaults(true);
      setFormError("Choose a unit under Defaults before creating colors.");
      return;
    }
    const stock = Number(defaultStock);
    if (Number.isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
      setShowDefaults(true);
      setFormError("Starting stock must be a whole number, 0 or more.");
      return;
    }

    try {
      await setValuesMutation.mutateAsync({
        productUuid,
        itemUuid,
        attributeValueIds: [...selected],
      });
      const response = await generateMutation.mutateAsync({
        productUuid,
        itemUuid,
        data: {
          unitId,
          defaultStock: stock,
          activate: true,
        },
      });
      const data = ((response as { data?: GenerateVariantsResponse }).data ??
        response) as GenerateVariantsResponse;
      setDraftSelection(null);
      setResult(data);
      await Promise.all([refetchGroups(), refetchVariants()]);
      onChanged?.();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create the colors.");
    }
  };

  const isBusy = setValuesMutation.isPending || generateMutation.isPending;

  const handleDelete = async (variant: AdminVariantResponse) => {
    const label = variant.colorName || variant.variantName;
    setDeletingId(variant.id);
    try {
      await deleteVariantMutation.mutateAsync({ productUuid, variantUuid: variant.id });
      toast.success("Deleted", `"${label}" was removed.`);
      setConfirmDeleteId(null);
      await Promise.all([refetchGroups(), refetchVariants()]);
      onChanged?.();
    } catch (err) {
      toast.error("Failed to delete", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoadingGroups) {
    return (
      <div className="flex items-center justify-center p-6 text-neutral-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (groupsError) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-error-200 bg-error-50 p-4 text-xs text-error-700">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-1">
          <p className="font-semibold">
            {groupsError instanceof Error ? groupsError.message : "Failed to load attributes"}
          </p>
          <button
            type="button"
            onClick={() => refetchGroups()}
            className="font-medium underline hover:text-error-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <p className="p-4 text-xs italic text-neutral-400">
        This product has no attributes configured yet. Add Color, Size, etc. on the product first,
        then come back here.
      </p>
    );
  }

  const renderGroup = (group: ItemAttributeGroup) => (
    <div key={group.id}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label className="block text-xs font-semibold text-neutral-800">{group.name}</label>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            group.multipleSelection
              ? "bg-secondary-50 text-secondary-700"
              : "bg-neutral-100 text-neutral-500"
          }`}
        >
          {group.multipleSelection ? "Pick any" : "Pick one"}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {group.multipleSelection && group.values.length > 0 && (
          <button
            type="button"
            onClick={() => toggleAll(group)}
            disabled={isBusy}
            aria-pressed={group.values.every((value) => selected.has(value.id))}
            className={`inline-flex cursor-pointer select-none items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50 ${
              group.values.every((value) => selected.has(value.id))
                ? "border-secondary-600 bg-secondary-600 text-white shadow-xs"
                : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50"
            }`}
          >
            Select All
          </button>
        )}
        {group.values.map((value) => {
          const isChecked = selected.has(value.id);
          const alreadyCreated = group.type === "color" && isCreated(value.value);
          return (
            <button
              key={value.id}
              type="button"
              onClick={() => toggle(group, value.id)}
              disabled={isBusy}
              title={alreadyCreated ? `${value.value} already exists below` : undefined}
              className={`inline-flex cursor-pointer select-none items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50 ${
                isChecked
                  ? "border-secondary-600 bg-secondary-600 text-white shadow-xs"
                  : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50"
              }`}
            >
              {!group.multipleSelection && (
                <span
                  className={`flex h-3 w-3 items-center justify-center rounded-full border ${
                    isChecked ? "border-white" : "border-neutral-400"
                  }`}
                >
                  {isChecked && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
              )}
              {group.type === "color" &&
                (value.imageUrl ? (
                  <img
                    src={value.imageUrl}
                    alt=""
                    className="h-4 w-4 rounded-full border border-white/60 object-cover"
                  />
                ) : (
                  value.colorHex && (
                    <span
                      className="h-3 w-3 rounded-full border border-white/60"
                      style={{ backgroundColor: value.colorHex }}
                    />
                  )
                ))}
              {value.value}
              {alreadyCreated && (
                <CheckCircle2
                  className={`h-3 w-3 ${isChecked ? "text-white" : "text-emerald-600"}`}
                />
              )}
            </button>
          );
        })}
      </div>
      <AttributeValueQuickAdd
        attributeUuid={group.id}
        attributeName={group.name}
        type={group.type}
        disabled={isBusy}
        onAdded={(valueId) => {
          if (valueId) selectNewValue(group, valueId);
          refetchGroups();
        }}
      />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Step 1 - what this item comes in. */}
      <section className="rounded-xl border border-neutral-200 p-4">
        <div className="mb-3">
          <h3 className="text-sm font-bold text-neutral-900">
            1. Which colors does {itemName ? `"${itemName}"` : "this item"} come in?
          </h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            Tick the values, then press the button below. A
            <CheckCircle2 className="mx-1 inline h-3 w-3 text-emerald-600" />
            means that color already exists further down.
          </p>
        </div>

        <div className="space-y-4">
          {colorGroups.map(renderGroup)}
          {otherGroups.length > 0 && (
            <div className="space-y-4 border-t border-neutral-100 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                Other options
              </p>
              {otherGroups.map(renderGroup)}
            </div>
          )}
        </div>

        {/* Defaults stay folded away: the answers are nearly always the same,
            and a sensible default beats blocking on three fields. */}
        <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50/60">
          <button
            type="button"
            onClick={() => setShowDefaults((open) => !open)}
            className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left"
          >
            <span className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700">
              <Settings2 className="h-3.5 w-3.5 text-neutral-400" />
              Defaults for new colors
            </span>
            <span className="flex items-center gap-2">
              <span className="text-[11px] text-neutral-500">
                {units.find((unit) => unit.id === unitId)?.name || "No unit"}
                {` · ${defaultStock || 0} in stock`}
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-neutral-400 transition-transform ${
                  showDefaults ? "rotate-180" : ""
                }`}
              />
            </span>
          </button>
          {showDefaults && (
            <div className="grid grid-cols-1 gap-4 border-t border-neutral-200 p-3 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-neutral-800">
                  Unit <span className="text-red-500">*</span>
                </label>
                <select
                  value={unitId}
                  onChange={(e) => setPickedUnitId(e.target.value)}
                  disabled={isBusy}
                  className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm focus:border-secondary-600 focus:outline-none focus:ring-2 focus:ring-secondary-600/20 disabled:opacity-60"
                >
                  <option value="">Select unit</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name} ({unit.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-neutral-800">
                  Starting stock
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={defaultStock}
                  onChange={(e) => setDefaultStock(e.target.value)}
                  disabled={isBusy}
                  className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm focus:border-secondary-600 focus:outline-none focus:ring-2 focus:ring-secondary-600/20 disabled:opacity-60"
                />
              </div>
            </div>
          )}
        </div>

        {formError && (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-red-500">
            <AlertCircle className="h-3.5 w-3.5" /> {formError}
          </p>
        )}

        {result && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-bold">
                {result.created} color{result.created === 1 ? "" : "s"} created
              </p>
              <p className="mt-0.5">
                {result.skipped > 0
                  ? `${result.skipped} already existed and were left alone. `
                  : ""}
                Add images and sizes below.
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            onClick={handleApply}
            disabled={isBusy || selected.size === 0}
            className="h-10 cursor-pointer rounded-xl bg-[var(--color-secondary-600)] px-5 text-sm font-semibold text-white hover:bg-[var(--color-secondary-700)]"
          >
            {isBusy ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            {pendingCount > 0
              ? `Create ${pendingCount} color${pendingCount === 1 ? "" : "s"}`
              : "Save selection"}
          </Button>
        </div>
      </section>

      {/* Step 2 - everything that exists, with its images and sizes inline. */}
      <section className="rounded-xl border border-neutral-200">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-bold text-neutral-900">
              2. Colors on {itemName ? `"${itemName}"` : "this item"}
            </h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              Open a color to upload its images and set its sizes and stock. Every size sells at the Item&apos;s price unless you give that size its own.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-secondary-50 px-2.5 py-1 text-xs font-semibold text-secondary-700">
              {variants.length} color{variants.length === 1 ? "" : "s"}
            </span>
            {variants.length > 0 && onBulkEditPrices && (
              <Button
                type="button"
                variant="outline"
                onClick={onBulkEditPrices}
                className="h-9 rounded-lg border-neutral-200 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                <IndianRupee className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                Edit all prices
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-2 p-4">
          {isLoadingVariants ? (
            <p className="p-2 text-xs italic text-neutral-400">Loading colors...</p>
          ) : variants.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-200 px-4 py-8 text-center">
              <p className="text-sm font-semibold text-neutral-700">No colors yet</p>
              <p className="mt-1 text-xs text-neutral-500">
                Tick a color above and press the button - it appears here straight away.
              </p>
            </div>
          ) : (
            variants.map((variant) => (
              <ColorRow
                key={variant.id}
                productUuid={productUuid}
                categoryUuid={categoryUuid}
                variant={variant}
                isOpen={openVariantId === variant.id}
                onToggle={() =>
                  setOpenVariantId((current) => (current === variant.id ? null : variant.id))
                }
                isConfirmingDelete={confirmDeleteId === variant.id}
                isDeleting={deletingId === variant.id}
                onAskDelete={() => setConfirmDeleteId(variant.id)}
                onCancelDelete={() => setConfirmDeleteId(null)}
                onConfirmDelete={() => handleDelete(variant)}
              />
            ))
          )}
        </div>
      </section>

    </div>
  );
}

/** One color: a summary line that expands into its images and its size rows. */
function ColorRow({
  productUuid,
  categoryUuid,
  variant,
  isOpen,
  onToggle,
  isConfirmingDelete,
  isDeleting,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  productUuid: string;
  categoryUuid?: string | null;
  variant: AdminVariantResponse;
  isOpen: boolean;
  onToggle: () => void;
  isConfirmingDelete: boolean;
  isDeleting: boolean;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const { data: images = [] } = useVariantImages(productUuid, variant.id);
  const rows = variant.unitPrices ?? [];
  const label = variant.colorName || variant.variantName || "Color";
  const stock = rows.reduce((sum, row) => sum + (row.stock ?? 0), 0);

  return (
    <article className="overflow-hidden rounded-xl border border-neutral-200">
      <div className="flex items-center gap-2 bg-neutral-50 pr-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-100"
        >
          {variant.primaryImage ? (
            <img
              src={variant.primaryImage}
              alt=""
              className="h-8 w-8 shrink-0 rounded-lg border border-white object-cover shadow-sm"
            />
          ) : (
            <span
              className="h-8 w-8 shrink-0 rounded-lg border border-neutral-200 shadow-inner"
              style={variant.colorHex ? { backgroundColor: variant.colorHex } : undefined}
            />
          )}
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2">
              <span className="truncate text-sm font-semibold text-neutral-900">{label}</span>
              {!variant.isActive && (
                <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
                  Inactive
                </span>
              )}
            </span>
            <span className="mt-0.5 block text-xs text-neutral-500">
              {images.length} image{images.length === 1 ? "" : "s"} &middot; {rows.length} size
              {rows.length === 1 ? "" : "s"} &middot; {stock} in stock
            </span>
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>
        {isConfirmingDelete ? (
          <span className="flex shrink-0 items-center gap-1.5">
            <span className="hidden text-xs font-medium text-neutral-600 sm:inline">
              Delete this color, its images and all its sizes?
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancelDelete}
              disabled={isDeleting}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onConfirmDelete}
              disabled={isDeleting}
              className="h-8 bg-error-600 text-xs text-white hover:bg-error-700"
            >
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Delete"}
            </Button>
          </span>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onAskDelete}
            title={`Delete ${label}`}
            aria-label={`Delete ${label}`}
          >
            <Trash2 className="h-4 w-4 text-error-600" />
          </Button>
        )}
      </div>

      {isOpen && (
        <div className="space-y-5 border-t border-neutral-200 bg-white px-4 py-4">
          <section>
            <div className="mb-2 flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-secondary-600" />
              <h4 className="text-sm font-semibold text-neutral-900">{label} images</h4>
            </div>
            <VariantImageUploader
              productUuid={productUuid}
              variantUuid={variant.id}
              variantName={label}
            />
          </section>

          <section className="border-t border-neutral-100 pt-5">
            <div className="mb-2 flex items-center gap-2">
              <Ruler className="h-4 w-4 text-secondary-600" />
              <h4 className="text-sm font-semibold text-neutral-900">
                {label} sizes, price &amp; stock
              </h4>
            </div>
            <VariantUnitPriceList
              productUuid={productUuid}
              variantUuid={variant.id}
              categoryUuid={categoryUuid ?? null}
            />
          </section>
        </div>
      )}
    </article>
  );
}

export { ItemColorsPanel };
