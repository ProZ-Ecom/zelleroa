"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Plus, Pencil } from "lucide-react";
import { AdminPageHeader, AdminContent } from "@/components/admin/AdminPageHeader";
import { AdminDetailSkeleton } from "@/components/admin/AdminDetailSkeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormModal } from "@/components/common/FormModal";
import { useStyleByUuid, useUpdateStyle } from "@/features/styles/hooks";
import { StyleForm, type StyleFormValues } from "@/features/styles/components";
import {
  useItems,
  useCreateItem,
  useUpdateItem,
  useDeleteItem,
} from "@/features/items/hooks";
import {
  ItemForm,
  ItemColorsPanel,
  ItemVariantDetails,
  type ItemFormValues,
} from "@/features/items/components";
import type { AdminItemResponse } from "@/features/items/types";
import { useConfiguredAttributesForProduct } from "@/features/attributes/hooks";
import { useVariants } from "@/features/variants/hooks";
import { ProductPriceEditModal } from "@/features/products/components/ProductPriceEditModal";
import type { AdminVariantResponse } from "@/features/variants/types";
import { toast } from "@/components/ui/Toast";

export default function AdminStyleDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const styleUuid = params?.id ? decodeURIComponent(params.id) : "";

  const { data: styleResponse, isLoading, isError, error, refetch } = useStyleByUuid(
    styleUuid || null
  );
  const style = (styleResponse as any)?.data ?? styleResponse;
  const productUuid: string | null = style?.productId || null;

  const [isEditStyleOpen, setIsEditStyleOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [newlyCreatedItem, setNewlyCreatedItem] = useState<AdminItemResponse | null>(null);
  const [editingItem, setEditingItem] = useState<AdminItemResponse | null>(null);
  const [deletingItem, setDeletingItem] = useState<AdminItemResponse | null>(null);

  // The single Item whose colors are open. Everything about a color - the
  // values it comes in, its images, its sizes, prices and stock - lives in the
  // one ItemColorsPanel this opens, instead of the four overlapping modals
  // ("Attributes", "Manage Colors & Sizes", "Bulk Generate", "Manage Images")
  // that used to sit here.
  const [manageColorsItem, setManageColorsItem] = useState<AdminItemResponse | null>(null);
  // Bulk price editing lives at page level, not inside the colors panel: a
  // FormModal nested in a FormModal restores body scroll for the outer one
  // when the inner closes, so the outer is hidden while this is open instead.
  const [isBulkEditPricesOpen, setIsBulkEditPricesOpen] = useState(false);

  const { data: itemsResponse, isLoading: isLoadingItems, refetch: refetchItems } = useItems(
    productUuid,
    styleUuid || null,
    { pageSize: 100 }
  );
  const items = itemsResponse?.data ?? [];

  const updateStyleMutation = useUpdateStyle();
  const createItemMutation = useCreateItem();
  const updateItemMutation = useUpdateItem();
  const deleteItemMutation = useDeleteItem();

  // All the Product's variants, filtered client-side to whichever Item is
  // being managed - same pattern the Product detail page uses.
  const {
    data: productVariantsResponse,
    refetch: refetchProductVariants,
  } = useVariants(
    productUuid ? { productIds: [productUuid], pageSize: 100 } : undefined,
    { enabled: !!productUuid }
  );
  const itemVariants: AdminVariantResponse[] = (productVariantsResponse?.data ?? []).filter((variant) =>
    items.some((item) => item.id === variant.itemId)
  );

  // Column headings follow whatever the Product's own attributes are named
  // (e.g. "Colour" instead of a hardcoded "Colors") instead of assuming
  // every product speaks English the same way - falls back to the generic
  // label only when the product has no attributes configured yet.
  const { data: configuredAttributes = [] } = useConfiguredAttributesForProduct(
    productUuid || null
  );
  const colorColumnLabel =
    configuredAttributes.find((a) => a.type === "color")?.name || "Variant";
  const sizeColumnLabel =
    configuredAttributes.find((a) => a.type !== "color" && /size/i.test(a.name))?.name ||
    "Sizes";


  if (isLoading) return <AdminDetailSkeleton />;
  if (isError || !style) {
    return (
      <ErrorState
        message={(error as any)?.message || "Failed to load item"}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <AdminPageHeader
        title={style.name}
        description={style.shortDescription || "Item details, colors and sizes"}
        actions={
          <Button variant="outline" onClick={() => router.push("/admin/dashboard/styles")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Items
          </Button>
        }
      />

      <AdminContent className="flex-1 overflow-auto space-y-6">
        {/* Item Information */}
        <section className="bg-white border border-cream-border rounded-lg p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-neutral-900">Item Information</h2>
            <Button variant="outline" size="sm" onClick={() => setIsEditStyleOpen(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <dt className="text-xs font-semibold text-neutral-400 uppercase">Product</dt>
              <dd className="text-neutral-800 font-medium">{style.productName}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-neutral-400 uppercase">Brand</dt>
              <dd className="text-neutral-800 font-medium">{style.brandName || "Not Assigned"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-neutral-400 uppercase">Item Name</dt>
              <dd className="text-neutral-800 font-medium">{style.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-neutral-400 uppercase">Slug</dt>
              <dd className="text-neutral-800 font-mono">{style.slug}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-neutral-400 uppercase">Status</dt>
              <dd className="text-neutral-800 font-medium">{style.isActive ? "Active" : "Inactive"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-neutral-400 uppercase">Total Variants</dt>
              <dd className="text-neutral-800 font-medium">{itemVariants.flatMap((variant) => variant.unitPrices ?? []).length}</dd>
            </div>
            {style.description && (
              <div className="sm:col-span-2 lg:col-span-4">
                <dt className="text-xs font-semibold text-neutral-400 uppercase">Description</dt>
                <dd className="text-neutral-700 mt-1">{style.description}</dd>
              </div>
            )}
          </dl>
        </section>

        {/* Variant Details */}
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button
              onClick={() => setIsAddItemOpen(true)}
              className="h-9 rounded-lg bg-[var(--color-secondary-600)] px-4 text-xs font-semibold text-white hover:bg-[var(--color-secondary-700)]"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Model
            </Button>
          </div>
          {productUuid && (
            <ItemVariantDetails
              items={items}
              variants={itemVariants}
              colorLabel={colorColumnLabel}
              sizeLabel={sizeColumnLabel}
              onEditItem={setEditingItem}
              onDeleteItem={setDeletingItem}
              onManageColors={setManageColorsItem}
            />
          )}
        </div>
      </AdminContent>

      {/* Edit Style Modal */}
      <FormModal
        open={isEditStyleOpen}
        onClose={() => setIsEditStyleOpen(false)}
        title="Edit Item"
        description={`Update information for ${style.name}`}
        size="lg"
      >
        <StyleForm
          isEditing
          initialData={{
            brandId: style.brandId || "",
            name: style.name,
            slug: style.slug,
            sku: style.sku || "",
            shortDescription: style.shortDescription || "",
            description: style.description || "",
            cookingRecipe: style.cookingRecipe || "",
            basePrice: style.basePrice ?? 0,
            isFeatured: style.isFeatured,
            isDefault: style.isDefault,
            isActive: style.isActive,
          }}
          isLoading={updateStyleMutation.isPending}
          submitLabel="Save Changes"
          onSubmit={async (formData: StyleFormValues) => {
            try {
              await updateStyleMutation.mutateAsync({
                productUuid: style.productId,
                styleUuid: style.id,
                data: {
                  brandId: formData.brandId,
                  name: formData.name,
                  slug: formData.slug,
                  sku: formData.sku || null,
                  shortDescription: formData.shortDescription || null,
                  description: formData.description || null,
                  ingredients: style.ingredients || null,
                  isReadyToMix: style.isReadyToMix ?? false,
                  cookingRecipe: formData.cookingRecipe || null,
                  shelfLife: style.shelfLife || null,
                  vegType: style.vegType || "na",
                  basePrice: formData.basePrice ?? 0,
                  isFeatured: formData.isFeatured,
                  isDefault: formData.isDefault ?? false,
                  isActive: formData.isActive,
                },
              });
              setIsEditStyleOpen(false);
              toast.success("Item updated", `"${formData.name}" was saved.`);
              refetch();
            } catch (err: any) {
              toast.error("Failed to update item", err?.message || "Please try again.");
            }
          }}
        />
      </FormModal>

      {/* Add Item Modal - two steps: create the Item, then immediately pick
          which Colour/Size/etc. values it comes in, right here. */}
      <FormModal
        open={isAddItemOpen}
        onClose={() => {
          setIsAddItemOpen(false);
          setNewlyCreatedItem(null);
        }}
        title={newlyCreatedItem ? "Choose Attribute Values" : "Add Model"}
        description={
          newlyCreatedItem
            ? `Pick which ${colorColumnLabel}/${sizeColumnLabel}/etc. values "${newlyCreatedItem.name}" comes in`
            : `Create a new Model under "${style.name}" (e.g. "Regular Fit", "Slim Fit")`
        }
        size="lg"
      >
        {!newlyCreatedItem ? (
          <ItemForm
            isLoading={createItemMutation.isPending}
            submitLabel="Next: Attribute Values"
            onSubmit={async (formData: ItemFormValues) => {
              try {
                const res = await createItemMutation.mutateAsync({
                  productUuid: productUuid!,
                  styleUuid,
                  data: {
                    name: formData.name,
                    slug: formData.slug,
                    sku: formData.sku || null,
                    shortDescription: formData.shortDescription || null,
                    description: formData.description || null,
                    basePrice: formData.basePrice ?? 0,
                    isFeatured: formData.isFeatured,
                    isDefault: formData.isDefault ?? false,
                    isActive: formData.isActive,
                  },
                });
                const created = (res as any)?.data as AdminItemResponse | undefined;
                if (created) setNewlyCreatedItem(created);
                toast.success("Model created", `"${formData.name}" is ready for Colors & Sizes.`);
                refetchItems();
              } catch (err: any) {
                toast.error("Failed to create model", err?.message || "Please try again.");
              }
            }}
          />
        ) : (
          productUuid && (
            <div className="space-y-4">
              <ItemColorsPanel
                productUuid={productUuid}
                itemUuid={newlyCreatedItem.id}
                itemName={newlyCreatedItem.name}
                categoryUuid={style.categoryId}
                onChanged={() => {
                  refetchItems();
                  refetchProductVariants();
                }}
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => {
                    setIsAddItemOpen(false);
                    setNewlyCreatedItem(null);
                  }}
                  className="h-10 rounded-xl bg-neutral-100 text-neutral-800 border border-neutral-300 hover:bg-neutral-200 px-5 text-sm font-semibold cursor-pointer"
                >
                  Done
                </Button>
              </div>
            </div>
          )
        )}
      </FormModal>

      {/* Colors & Sizes - the one panel. Picking values, creating colors,
          uploading each color's images and setting its sizes/prices/stock all
          happen here; there is deliberately no second route to any of it. */}
      <FormModal
        open={Boolean(manageColorsItem) && !isBulkEditPricesOpen}
        onClose={() => {
          setManageColorsItem(null);
          refetchProductVariants();
          refetchItems();
        }}
        title={`Colors & Sizes`}
        description={`Everything "${manageColorsItem?.name || ""}" comes in`}
        size="xl"
      >
        {manageColorsItem && productUuid && (
          <ItemColorsPanel
            productUuid={productUuid}
            itemUuid={manageColorsItem.id}
            itemName={manageColorsItem.name}
            categoryUuid={style.categoryId}
            onChanged={() => {
              refetchItems();
              refetchProductVariants();
            }}
            onBulkEditPrices={() => setIsBulkEditPricesOpen(true)}
          />
        )}
      </FormModal>

      {manageColorsItem && productUuid && (
        <ProductPriceEditModal
          open={isBulkEditPricesOpen}
          onClose={() => setIsBulkEditPricesOpen(false)}
          productUuid={productUuid}
          productName={manageColorsItem.name}
          variants={(productVariantsResponse?.data ?? []).filter(
            (variant) => variant.itemId === manageColorsItem.id
          )}
          onSuccess={() => refetchProductVariants()}
        />
      )}

      {/* Edit Item Modal */}
      <FormModal
        open={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        title="Edit Model"
        description={`Update information for ${editingItem?.name || ""}`}
        size="lg"
      >
        {editingItem && (
          <ItemForm
            isEditing
            initialData={{
              name: editingItem.name,
              slug: editingItem.slug,
              sku: editingItem.sku || "",
              shortDescription: editingItem.shortDescription || "",
              description: editingItem.description || "",
              basePrice: editingItem.basePrice ?? 0,
              isFeatured: editingItem.isFeatured,
              isDefault: editingItem.isDefault,
              isActive: editingItem.isActive,
            }}
            isLoading={updateItemMutation.isPending}
            submitLabel="Save Changes"
            onSubmit={async (formData: ItemFormValues) => {
              if (!editingItem) return;
              try {
                await updateItemMutation.mutateAsync({
                  productUuid: productUuid!,
                  styleUuid,
                  itemUuid: editingItem.id,
                  data: {
                    name: formData.name,
                    slug: formData.slug,
                    sku: formData.sku || null,
                    shortDescription: formData.shortDescription || null,
                    description: formData.description || null,
                    basePrice: formData.basePrice ?? 0,
                    isFeatured: formData.isFeatured,
                    isDefault: formData.isDefault ?? false,
                    isActive: formData.isActive,
                  },
                });
                setEditingItem(null);
                toast.success("Model updated", `"${formData.name}" was saved.`);
                refetchItems();
              } catch (err: any) {
                toast.error("Failed to update model", err?.message || "Please try again.");
              }
            }}
          />
        )}

        {/* Colors, images, sizes and prices are not repeated here - "Manage
            colors" on the item row is the single place for all of it. */}
      </FormModal>

      {/* Delete Item Dialog */}
      <ConfirmDialog
        open={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        onConfirm={async () => {
          if (!deletingItem) return;
          const target = deletingItem;
          setDeletingItem(null);
          try {
            await deleteItemMutation.mutateAsync({
              productUuid: productUuid!,
              styleUuid,
              itemUuid: target.id,
            });
            toast.success("Model deleted", `"${target.name}" was removed.`);
            refetchItems();
          } catch (err: any) {
            toast.error("Failed to delete model", err?.message || "Please try again.");
          }
        }}
        confirmText="Delete"
        variant="destructive"
        isLoading={deleteItemMutation.isPending}
      />

    </div>
  );
}
