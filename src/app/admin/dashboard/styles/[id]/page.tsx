"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Pencil } from "lucide-react";
import { AdminPageHeader, AdminContent } from "@/components/admin/AdminPageHeader";
import { AdminDetailSkeleton } from "@/components/admin/AdminDetailSkeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/common/FormModal";
import { useStyleByUuid, useUpdateStyle } from "@/features/styles/hooks";
import {
  StyleForm,
  StyleVariantsPanel,
  StyleVariantDetails,
  type StyleFormValues,
} from "@/features/styles/components";
import { useConfiguredAttributesForProduct } from "@/features/attributes/hooks";
import { useVariants } from "@/features/variants/hooks";
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

  // Everything about a color - the values it comes in, its images, its sizes,
  // prices and stock - lives in the one StyleVariantsPanel this opens, instead
  // of the four overlapping modals ("Attributes", "Manage Colors & Sizes",
  // "Bulk Generate", "Manage Images") that used to sit here.
  const [isManageColorsOpen, setIsManageColorsOpen] = useState(false);

  const updateStyleMutation = useUpdateStyle();

  // All the Product's variants, filtered client-side to this Style - same
  // pattern the Product detail page uses.
  const {
    data: productVariantsResponse,
    refetch: refetchProductVariants,
  } = useVariants(
    productUuid ? { productIds: [productUuid], pageSize: 100 } : undefined,
    { enabled: !!productUuid }
  );
  const styleVariants: AdminVariantResponse[] = (productVariantsResponse?.data ?? []).filter(
    (variant) => variant.styleId === styleUuid
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
        message={(error as any)?.message || "Failed to load style"}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <AdminPageHeader
        title={style.name}
        description={style.shortDescription || "Style details, colors and sizes"}
        actions={
          <Button variant="outline" onClick={() => router.push("/admin/dashboard/styles")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Styles
          </Button>
        }
      />

      <AdminContent className="flex-1 overflow-auto space-y-6">
        {/* Style Information */}
        <section className="bg-white border border-cream-border rounded-lg p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-neutral-900">Style Information</h2>
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
              <dt className="text-xs font-semibold text-neutral-400 uppercase">Style Name</dt>
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
              <dt className="text-xs font-semibold text-neutral-400 uppercase">Total Sizes</dt>
              <dd className="text-neutral-800 font-medium">
                {styleVariants.flatMap((variant) => variant.unitPrices ?? []).length}
              </dd>
            </div>
            {style.description && (
              <div className="sm:col-span-2 lg:col-span-4">
                <dt className="text-xs font-semibold text-neutral-400 uppercase">Description</dt>
                <dd className="text-neutral-700 mt-1">{style.description}</dd>
              </div>
            )}
          </dl>
        </section>

        {/* Colors & Sizes overview */}
        <div className="space-y-3">
          {productUuid && (
            <StyleVariantDetails
              styleName={style.name}
              variants={styleVariants}
              colorLabel={colorColumnLabel}
              sizeLabel={sizeColumnLabel}
              onManageColors={() => setIsManageColorsOpen(true)}
            />
          )}
        </div>
      </AdminContent>

      {/* Edit Style Modal */}
      <FormModal
        open={isEditStyleOpen}
        onClose={() => setIsEditStyleOpen(false)}
        title="Edit Style"
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
            isNewArrival: style.isNewArrival,
            newArrivalUntil: style.newArrivalUntil ?? "",
            isDefault: style.isDefault,
            isActive: style.isActive,
            outOfStock: style.outOfStock ?? false,
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
                  isNewArrival: formData.isNewArrival ?? false,
                  newArrivalUntil: formData.isNewArrival ? formData.newArrivalUntil || null : null,
                  isDefault: formData.isDefault ?? false,
                  isActive: formData.isActive,
                  outOfStock: formData.outOfStock ?? style.outOfStock ?? false,
                },
              });
              setIsEditStyleOpen(false);
              toast.success("Style updated", `"${formData.name}" was saved.`);
              refetch();
            } catch (err: any) {
              toast.error("Failed to update style", err?.message || "Please try again.");
            }
          }}
        />
      </FormModal>

      {/* Colors & Sizes - the one panel. Picking values, creating colors,
          uploading each color's images and setting its sizes/prices/stock all
          happen here; there is deliberately no second route to any of it. */}
      <FormModal
        open={isManageColorsOpen}
        onClose={() => {
          setIsManageColorsOpen(false);
          refetchProductVariants();
        }}
        title="Colors &amp; Sizes"
        description={`Everything "${style.name}" comes in`}
        size="xl"
      >
        {productUuid && (
          <StyleVariantsPanel
            productUuid={productUuid}
            styleUuid={style.id}
            styleName={style.name}
            categoryUuid={style.categoryId}
            onChanged={() => {
              refetch();
              refetchProductVariants();
            }}
          />
        )}
      </FormModal>
    </div>
  );
}
