"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  Package,
  Layers,
  Tag,
  Pencil,
  Trash2,
  Eye,
  IndianRupee,
  Check,
  CheckCircle2,
  ExternalLink,
  Download,
  Plus,
  X,
  Clock,
  ArrowDownRight,
  Filter,
  MoreHorizontal,
  Power,
  PowerOff,
  Images as ImagesIcon,
  LayoutList,
  LayoutGrid,
  AlertCircle,
  Star,
} from "lucide-react";
import { toast } from "@/components/ui/Toast";
import { useAdminProduct, useProductImages } from "@/features/products/hooks";
import {
  useVariants,
  useVariantUnitPrices,
  useCreateVariant,
  useUpdateVariant,
  useDeleteVariant,
} from "@/features/variants/hooks";
import { useUpdateProduct } from "@/features/products/hooks/use-product-mutations";
import { useCategories } from "@/features/categories/hooks";
import { useBrands } from "@/features/brands/hooks";
import { QuickAddBrandModal } from "@/features/brands/components/QuickAddBrandModal";
import { useHsnCodes } from "@/features/hsn-codes/hooks";
import { useUnits } from "@/features/units/hooks";
import { ProductPriceEditModal } from "@/features/products/components/ProductPriceEditModal";
import { ProductForm, type ProductFormValues } from "@/features/products/components/ProductForm";
import { ProductAttributesPanel } from "@/features/products/components/ProductAttributesPanel";
import { ProductImageUploader } from "@/features/products/components/ProductImageUploader";
import {
  VariantForm,
  VariantImageUploader,
  VariantCard,
  VariantCustomerPreviewModal,
  VariantUnitPriceList,
  type VariantFormValues,
  type UnitFormItem,
} from "@/features/variants/components";
import { AdminDetailSkeleton } from "@/components/admin/AdminDetailSkeleton";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { ErrorState } from "@/components/ui/error-state";
import { FormModal } from "@/components/common/FormModal";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { AdminVariantResponse } from "@/features/variants/types";
import { useStyles, useCreateStyle, useUpdateStyle, useDeleteStyle } from "@/features/styles/hooks";
import { StyleForm, StyleCard, type StyleFormValues } from "@/features/styles/components";
import type { AdminStyleResponse } from "@/features/styles/types";
import { useItems, useCreateItem, useUpdateItem, useDeleteItem } from "@/features/items/hooks";
import { ItemForm, ItemColorsPanel, type ItemFormValues } from "@/features/items/components";
import type { AdminItemResponse } from "@/features/items/types";

type VariantFilter = "active" | "inactive";

function formatMeasurement(m: any): string {
  if (!m) return "—";
  if (typeof m === "string") return m;
  if (typeof m === "object" && "value" in m && "unit" in m) {
    return `${m.value} ${m.unit}`.trim() || "—";
  }
  return "—";
}

function renderColorBadge(colorName?: string | null, colorHex?: string | null) {
  if (!colorName && !colorHex) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cream-200 text-neutral-500 text-xs font-bold border border-cream-border-subtle">
        No Color
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cream-200 text-neutral-700 text-xs font-bold border border-cream-border-subtle">
      <span
        className="w-3 h-3 rounded-full border border-cream-border-subtle"
        style={{ backgroundColor: colorHex || "#d4d4d4" }}
      />
      <span>{colorName || colorHex}</span>
    </span>
  );
}

export default function AdminProductDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const rawId = params?.id ? decodeURIComponent(params.id) : "";
  const productId = rawId && rawId !== "undefined" ? rawId : "";

  // 1. Main Product Query
  const {
    data: productResponse,
    isLoading: isLoadingProduct,
    isError: isProductError,
    error: productError,
    refetch: refetchProduct,
  } = useAdminProduct(productId);

  const product: any = (productResponse as any)?.data ?? productResponse;

  const isUuid = (val?: string): val is string =>
    typeof val === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

  // Safely determine the product UUID so we never send invalid non-UUID strings to the backend API
  const productUuid:string| null = isUuid(product?.id)
    ? product.id
    : isUuid(productId)
    ? productId
    : undefined;

  const canonicalProductId = productUuid || product?.id || productId;

  // Filter & Selection State (Active by default, Inactive for inactive tab)
  const [variantFilter, setVariantFilter] = React.useState<VariantFilter>("active");
  const [variantViewMode, setVariantViewMode] = React.useState<"table" | "cards">("table");
  const [previewVariant, setPreviewVariant] = React.useState<AdminVariantResponse | null>(null);

  // 2. Product Variants Query using the POST "Get All Variants" API (POST /api/admin/variants)
  // Queries variants for this product based on the active tab (isActive: true or false)
  const {
    data: variantsResponse,
    isLoading: isLoadingVariants,
    refetch: refetchVariants,
  } = useVariants(
    productUuid
      ? {
          productIds: [productUuid],
          isActive: variantFilter === "active",
          pageSize: 100,
          page: 1,
          
        }
      : undefined,
    { enabled: !!productUuid }
  );

  const allVariants = React.useMemo<AdminVariantResponse[]>(() => {
    return (variantsResponse?.data as AdminVariantResponse[]) ?? [];
  }, [variantsResponse]);

  // 2b. Styles under this Product - e.g. "V Neck T-Shirt" vs "Solo T-Shirt"
  // under Product "T-Shirt". Most products migrated from the old flat
  // catalog have exactly one, auto-selected below so nothing changes for
  // them; products with more than one let the admin switch between them.
  const { data: stylesResponse, isLoading: isLoadingStyles } = useStyles(
    productUuid || null,
    { pageSize: 100 }
  );
  const styles = React.useMemo<AdminStyleResponse[]>(
    () => stylesResponse?.data ?? [],
    [stylesResponse]
  );

  const [selectedStyleUuid, setSelectedStyleUuid] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (selectedStyleUuid && styles.some((s) => s.id === selectedStyleUuid)) return;
    const fallback = styles.find((s) => s.isDefault) ?? styles[0] ?? null;
    setSelectedStyleUuid(fallback?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styles]);

  const [isAddStyleOpen, setIsAddStyleOpen] = React.useState(false);
  const [editingStyle, setEditingStyle] = React.useState<AdminStyleResponse | null>(null);
  const [deletingStyle, setDeletingStyle] = React.useState<AdminStyleResponse | null>(null);

  const createStyleMutation = useCreateStyle();
  const updateStyleMutation = useUpdateStyle();
  const deleteStyleMutation = useDeleteStyle();

  // 2c. Items under the selected Style - the admin-only "Regular Fit / Slim
  // Fit / Oversized" sub-variants. Never shown to customers; only used here
  // to scope which Colors/Sizes show below.
  const { data: itemsResponse, isLoading: isLoadingItems } = useItems(
    productUuid || null,
    selectedStyleUuid || null,
    { pageSize: 100 }
  );
  const items = React.useMemo<AdminItemResponse[]>(
    () => itemsResponse?.data ?? [],
    [itemsResponse]
  );

  const [selectedItemUuid, setSelectedItemUuid] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (selectedItemUuid && items.some((i) => i.id === selectedItemUuid)) return;
    const fallback = items.find((i) => i.isDefault) ?? items[0] ?? null;
    setSelectedItemUuid(fallback?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const [isAddItemOpen, setIsAddItemOpen] = React.useState(false);
  const [isPickBrandOpen, setIsPickBrandOpen] = React.useState(false);
  const [pickedBrandId, setPickedBrandId] = React.useState("");
  const [isAddBrandOpen, setIsAddBrandOpen] = React.useState(false);
  const [createdBrandOptions, setCreatedBrandOptions] = React.useState<
    { value: string; label: string; slug?: string }[]
  >([]);
  const [newlyCreatedItem, setNewlyCreatedItem] = React.useState<AdminItemResponse | null>(null);
  const [editingItem, setEditingItem] = React.useState<AdminItemResponse | null>(null);
  const [deletingItem, setDeletingItem] = React.useState<AdminItemResponse | null>(null);
  const [isPreparingItemForm, setIsPreparingItemForm] = React.useState(false);

  const createItemMutation = useCreateItem();
  const updateItemMutation = useUpdateItem();
  const deleteItemMutation = useDeleteItem();

  // Items always need a parent Style in the database. Most products only
  // ever need one, so "Add Sub-variant" silently creates a hidden default Style
  // the first time it's needed - the admin only ever sees "Item".
  // Creates the hidden default Style (Items always need a parent Style) and
  // opens the Add Type form. `brandId` is the Product's brand when set, or
  // whatever the admin picked in the "Select Brand" step below.
  const createHiddenStyleAndOpenItemForm = async (brandId: string) => {
    setIsPreparingItemForm(true);
    try {
      const res = await createStyleMutation.mutateAsync({
        productUuid: canonicalProductId,
        data: {
          brandId,
          name: product.name,
          slug: `${product.slug}-default`,
          sku: null,
          shortDescription: null,
          description: null,
          ingredients: null,
          isReadyToMix: false,
          cookingRecipe: null,
          shelfLife: null,
          vegType: "na",
          basePrice: 0,
          isFeatured: false,
          isDefault: true,
          isActive: true,
        },
      });
      const created = (res as any)?.data as AdminStyleResponse | undefined;
      if (created) {
        setSelectedStyleUuid(created.id);
        setIsAddItemOpen(true);
      }
    } catch (err: any) {
      console.error("Failed to prepare product for Items", err);
      toast.error("Failed to add item", err?.message || "Please try again.");
    } finally {
      setIsPreparingItemForm(false);
    }
  };

  const handleAddItemClick = async () => {
    if (selectedStyleUuid) {
      setIsAddItemOpen(true);
      return;
    }
    // The hidden Style still needs a Brand; use the Product's if set,
    // otherwise ask the admin to pick one right here.
    if (!product.brandId) {
      setPickedBrandId("");
      setIsPickBrandOpen(true);
      return;
    }
    await createHiddenStyleAndOpenItemForm(product.brandId);
  };

  // The Colors/Sizes section below is scoped to whichever Item is selected
  // above - with only one Item under the Style (the common case) this is
  // every variant belonging to that Style, exactly as before.
  const itemIds = React.useMemo(() => new Set(items.map((i) => i.id)), [items]);
  const variants = React.useMemo<AdminVariantResponse[]>(() => {
    if (items.length <= 1) {
      return allVariants.filter((v) => itemIds.has(v.itemId));
    }
    if (!selectedItemUuid) return allVariants.filter((v) => itemIds.has(v.itemId));
    return allVariants.filter((v) => v.itemId === selectedItemUuid);
  }, [allVariants, items.length, itemIds, selectedItemUuid]);

  // Reference queries for modal form dropdowns (lazy-loaded when modals open)
  const [isEditProductOpen, setIsEditProductOpen] = React.useState(false);
  const [isAddVariantOpen, setIsAddVariantOpen] = React.useState(false);
  const [newlyCreatedVariant, setNewlyCreatedVariant] = React.useState<AdminVariantResponse | null>(null);
  const [editingVariant, setEditingVariant] = React.useState<AdminVariantResponse | null>(null);
  const [editVariantTab, setEditVariantTab] = React.useState<"details" | "pricing">("details");
  const [deletingVariant, setDeletingVariant] = React.useState<AdminVariantResponse | null>(null);
  const [variantToDeactivate, setVariantToDeactivate] = React.useState<AdminVariantResponse | null>(null);
  const [variantToActivate, setVariantToActivate] = React.useState<AdminVariantResponse | null>(null);
  const [managingImagesVariant, setManagingImagesVariant] = React.useState<AdminVariantResponse | null>(null);
  const [isManagingProductImages, setIsManagingProductImages] = React.useState(false);
  const [activeMenu, setActiveMenu] = React.useState<{
    variant: AdminVariantResponse;
    rect: DOMRect;
  } | null>(null);
  const [isStatusUpdating, setIsStatusUpdating] = React.useState(false);
  const [isPriceEditOpen, setIsPriceEditOpen] = React.useState(false);

  // Close action dropdown menu when clicking outside, scrolling, or pressing Escape
  React.useEffect(() => {
    if (!activeMenu) return;

    const handleClose = () => setActiveMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveMenu(null);
    };

    window.addEventListener("scroll", handleClose, true);
    window.addEventListener("resize", handleClose);
    window.addEventListener("mousedown", (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-action-portal]") && !target.closest("[data-action-trigger]")) {
        setActiveMenu(null);
      }
    });
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("resize", handleClose);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeMenu]);

  const isAnyFormOpen = isEditProductOpen || isAddVariantOpen || !!editingVariant;

  const { data: categoriesData } = useCategories(
    { pageSize: 100 },
    { enabled: isEditProductOpen }
  );
  const { data: brandsData } = useBrands(
    { limit: 100 },
    { enabled: isEditProductOpen || isAddItemOpen || Boolean(editingItem) || isPickBrandOpen }
  );
  const { data: hsnData } = useHsnCodes(
    { pageSize: 100 },
    { enabled: isEditProductOpen }
  );
  const { data: unitsData } = useUnits(
    { pageSize: 100 }
  );

  // Mutations
  const updateProductMutation = useUpdateProduct();
  const createVariantMutation = useCreateVariant();
  const updateVariantMutation = useUpdateVariant();
  const deleteVariantMutation = useDeleteVariant();

  // Product Images Query
  const { data: productImages = [] } = useProductImages(productUuid || null);

  // Unit prices for newly created variant in modal
  const { data: newlyCreatedPrices = [] } = useVariantUnitPrices(
    canonicalProductId || null,
    newlyCreatedVariant?.id || null
  );
  const hasNewlyCreatedPrices = newlyCreatedPrices.length > 0;

  // Selection State
  const [selectedVariants, setSelectedVariants] = React.useState<Record<string, boolean>>({});

  // Labels from product response
  const categoryName = product?.categoryName || product?.category?.name || null;
  const brandName = product?.brandName || product?.brand?.name || null;
  const hsnCodeInfo =
    product?.hsnCodeName ||
    (product?.product_hsn_codes?.code
      ? `${product.product_hsn_codes.code}${
          product.product_hsn_codes.description
            ? ` (${product.product_hsn_codes.description})`
            : ""
        }`
      : null) ||
    (product?.hsnCode?.code
      ? `${product.hsnCode.code}${
          product.hsnCode.description ? ` (${product.hsnCode.description})` : ""
        }`
      : null) ||
    (typeof product?.hsnCode === "string" ? product.hsnCode : null);

  const currentTabCount =
    items.length > 1 ? variants.length : (variantsResponse?.meta?.total ?? variants.length);

  // Selection helpers
  const selectedIds = React.useMemo(
    () => Object.keys(selectedVariants).filter((id) => selectedVariants[id]),
    [selectedVariants]
  );
  const hasSelection = selectedIds.length > 0;
  const isAllSelected =
    variants.length > 0 &&
    variants.every((v) => selectedVariants[v.id]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedVariants({});
    } else {
      const next: Record<string, boolean> = {};
      variants.forEach((v) => {
        next[v.id] = true;
      });
      setSelectedVariants(next);
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedVariants((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Export Variants to CSV
  const handleExportVariants = () => {
    if (variants.length === 0) {
      return;
    }

    const headers = [
      "Item ID",
      "Item Name",
      "Default SKU",
      "Default Pack Size",
      "Default Price",
      "Status",
      "Last Updated",
    ];

    const rows = variants.map((v) => [
      `"${v.id}"`,
      `"${v.variantName.replace(/"/g, '""')}"`,
      `"${v.sku ?? ""}"`,
      `"${formatMeasurement(v.measurement)}"`,
      v.basePrice ?? "",
      v.isActive ? "Active" : "Inactive",
      v.updatedAt ? new Date(v.updatedAt).toISOString() : "",
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${product?.slug || "product"}-variants.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Make Variant Inactive (from Active tab)
  const handleMakeInactive = async (variant: AdminVariantResponse) => {
    setIsStatusUpdating(true);
    try {
      await updateVariantMutation.mutateAsync({
        productUuid: canonicalProductId,
        variantUuid: variant.id,
        data: { isActive: false },
      });
      setVariantToDeactivate(null);
    } catch (err: any) {
      console.error("Failed to make item inactive", err);
    } finally {
      setIsStatusUpdating(false);
    }
  };

  // Make Variant Active (from Inactive tab)
  const handleMakeActive = async (variant: AdminVariantResponse) => {
    setIsStatusUpdating(true);
    try {
      await updateVariantMutation.mutateAsync({
        productUuid: canonicalProductId,
        variantUuid: variant.id,
        data: { isActive: true },
      });
      setVariantToActivate(null);
    } catch (err: any) {
      console.error("Failed to activate item", err);
    } finally {
      setIsStatusUpdating(false);
    }
  };

  // Bulk status update
  const handleBulkStatusChange = async (targetActive: boolean) => {
    if (!hasSelection) return;
    try {
      const selectedObjs = variants.filter((v) => selectedVariants[v.id]);
      await Promise.all(
        selectedObjs.map((obj) =>
          updateVariantMutation.mutateAsync({
            productUuid: canonicalProductId,
            variantUuid: obj.id,
            data: { isActive: targetActive },
          })
        )
      );
      setSelectedVariants({});
    } catch (err: any) {
      console.error("Bulk update failed", err);
    }
  };

  // Stats (Dummy data)
  const stats = React.useMemo(() => {
    const lastUpdatedDate = product?.updatedAt
      ? new Date(product.updatedAt).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—";

    const lastUpdatedTime = product?.updatedAt
      ? new Date(product.updatedAt).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      : "";

    return {
      priceRange: "₹100 – ₹500",
      priceRangeNote: "Across variants",
      avgDiscount: "10%",
      avgDiscountNote: "Standard discount",
      lastUpdatedDate,
      lastUpdatedTime,
    };
  }, [product]);

  // Options for Dropdowns
  const categoryOptions = React.useMemo(
    () => (categoriesData?.data ?? []).map((c: any) => ({ value: c.id || c.uuid, label: c.name, slug: c.slug })),
    [categoriesData]
  );
  const brandOptions = React.useMemo(
    () => (brandsData?.data ?? []).map((b: any) => ({ value: b.uuid || b.id, label: b.name, slug: b.slug })),
    [brandsData]
  );

  // Brand lives on the parent Item (style), not the Model, so a brand picked in
  // the Model form is saved onto the selected Item.
  const syncSelectedStyleBrand = async (brandId?: string) => {
    const style = styles.find((s) => s.id === selectedStyleUuid);
    if (!style || !brandId || style.brandId === brandId) return;
    await updateStyleMutation.mutateAsync({
      productUuid: canonicalProductId,
      styleUuid: style.id,
      data: {
        brandId,
        name: style.name,
        slug: style.slug,
        sku: style.sku || null,
        shortDescription: style.shortDescription || null,
        description: style.description || null,
        ingredients: style.ingredients || null,
        isReadyToMix: style.isReadyToMix ?? false,
        cookingRecipe: style.cookingRecipe || null,
        shelfLife: style.shelfLife || null,
        vegType: style.vegType || "na",
        basePrice: style.basePrice ?? 0,
        isFeatured: style.isFeatured,
        isDefault: style.isDefault,
        isActive: style.isActive,
      },
    });
  };

  const selectedStyleBrandId =
    styles.find((s) => s.id === selectedStyleUuid)?.brandId || product?.brandId || "";
  const hsnOptions = React.useMemo(
    () =>
      (hsnData?.data ?? []).map((h: any) => ({
        value: h.id,
        label: `${h.code}${h.description ? ` (${h.description})` : ""}`,
      })),
    [hsnData]
  );
  const unitOptions = React.useMemo<UnitFormItem[]>(
    () =>
      (unitsData?.data ?? []).map((u: any) => ({
        id: u.id,
        value: u.id,
        label: `${u.name} (${u.code})`,
        name: u.name,
        code: u.code,
        type: u.type,
        conversionFactor: u.conversionFactor ? Number(u.conversionFactor) : 1,
      })),
    [unitsData]
  );

  // Resolve product thumbnail
  const primaryProductImage =
    productImages.find((img) => img.isPrimary)?.imageUrl ||
    productImages[0]?.imageUrl ||
    variants.find((v) => v.primaryImage)?.primaryImage ||
    null;

  if (isLoadingProduct && !product) {
    return <AdminDetailSkeleton />;
  }

  if (isProductError || !product) {
    return (
      <ErrorState
        message={
          (productError as any)?.message ||
          "Failed to load product details. Product not found or inactive."
        }
        onRetry={() => refetchProduct()}
      />
    );
  }

  return (
    <div className="w-full space-y-4 text-neutral-900">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-neutral-400 pb-1">
        <Link
          href="/admin/dashboard/products"
          className="hover:text-secondary-800 transition-colors"
        >
          Products
        </Link>
        <span className="opacity-40">/</span>
        <span className="text-neutral-900 font-semibold truncate max-w-[200px] sm:max-w-md">
          {product.name}
        </span>
      </div>

      {/* Section 1: Hero Overview + Specifications Card */}
        <section className="bg-white border border-cream-border rounded-lg overflow-hidden">
          <div className="p-4 sm:p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex gap-4 items-center min-w-0">
            {/* Product Image Thumbnail */}
            <div className="w-[84px] h-[84px] rounded-lg flex-none bg-cream-100 border border-cream-border relative overflow-hidden flex items-center justify-center">
              {primaryProductImage ? (
                <Image
                  src={primaryProductImage}
                  alt={product.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="text-center">
                  <Package className="w-6 h-6 text-neutral-400 mx-auto mb-1 opacity-70" />
                  <span className="font-mono text-[9px] text-neutral-400 block leading-tight">
                    product<br />shot
                  </span>
                </div>
              )}
            </div>

            {/* Title & Badges */}
            <div className="min-w-0 flex flex-col gap-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
                  {product.name}
                </h1>
                {/* Active/Inactive badge */}
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${
                    product.isActive
                      ? "bg-success-50 text-success-700"
                      : "bg-cream-200 text-neutral-400"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      product.isActive ? "bg-success-600" : "bg-neutral-400"
                    }`}
                  />
                  {product.isActive ? "Active" : "Inactive"}
                </span>

              </div>

              {/* Category · Brand · Slug · HSN · Created subline */}
              <div className="flex items-center gap-2.5 flex-wrap text-xs sm:text-sm text-neutral-500">
                <span>{categoryName || "Not Assigned"}</span>
                <span className="opacity-40">·</span>
                <span>{brandName || "Not Assigned"}</span>
                <span className="opacity-40">·</span>
                <span className="font-mono text-xs text-neutral-700 bg-cream-100 px-1.5 py-0.5 rounded-sm border border-cream-border">
                  {product.slug || "NO_SLUG"}
                </span>
                <span className="opacity-40">·</span>
                <span>
                  <span className="text-neutral-400">HSN</span>{" "}
                  <span className="font-semibold text-neutral-700">
                    {hsnCodeInfo || "Not Assigned"}
                  </span>
                </span>
                <span className="opacity-40">·</span>
                <span>
                  <span className="text-neutral-400">Created</span>{" "}
                  <span className="font-semibold text-neutral-700">
                    {product.createdAt
                      ? new Date(product.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2.5 flex-none w-full md:w-auto justify-end">
            <button
              type="button"
              onClick={() => setIsManagingProductImages(true)}
              className="px-3.5 py-1.5 rounded-md border border-cream-border bg-white hover:bg-cream-100 text-neutral-800 text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ImagesIcon className="w-3.5 h-3.5" />
              <span>Manage Images</span>
            </button>
            <button
              type="button"
              onClick={() => setIsEditProductOpen(true)}
              className="px-3.5 py-1.5 rounded-md border border-secondary-700 bg-secondary-600 hover:bg-secondary-700 text-cream-white text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
          </div>
          </div>
        </section>

        {/* Section 2: Stats Cards Grid (3 Cards) */}
        {/* <section className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="bg-white border border-cream-border rounded-2xl p-4 sm:p-5 flex flex-col gap-1.5 shadow-xs">
            <div className="text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
              Price Range
            </div>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
              {stats.priceRange}
            </div>
            <div className="text-xs text-neutral-400">{stats.priceRangeNote}</div>
          </div>

          <div className="bg-white border border-cream-border rounded-2xl p-4 sm:p-5 flex flex-col gap-1.5 shadow-xs">
            <div className="text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
              Variants Status
            </div>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 flex items-center gap-2">
              <span className="text-success-700"> Active</span>
              <span className="text-neutral-400 text-base font-normal">/</span>
              <span className="text-neutral-500">Inactive</span>
            </div>
          </div>

          <div className="bg-white border border-cream-border rounded-2xl p-4 sm:p-5 flex flex-col gap-1.5 shadow-xs">
            <div className="text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
              Last Updated
            </div>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
              {stats.lastUpdatedDate}
            </div>
            <div className="text-xs text-neutral-400">{stats.lastUpdatedTime || "Recent"}</div>
          </div>
        </section> */}

        {/* Section 3.4: Product Attributes - which attributes (Color, Size,
            Material...) apply to this product. Items below only ever offer
            value-selection for whatever is checked here. */}
        <section className="bg-white border border-cream-border rounded-lg overflow-hidden">
          <div className="p-3.5 sm:p-4 border-b border-cream-border flex items-center gap-2.5">
            <h2 className="text-base font-bold text-neutral-900 tracking-tight">Attributes</h2>
          </div>
          <div className="p-4">
            <ProductAttributesPanel productUuid={canonicalProductId} />
          </div>
        </section>

        {/* Section 3.5: Product Styles - only shown once a product actually has
            more than one Style to manage (e.g. "V Neck T-Shirt" vs "Solo
            T-Shirt"). Single-style products (the common case) skip this
            entirely - Items below are added directly via a hidden default
            Style, created on demand by "Add Sub-variant". */}
        {styles.length > 1 && (
          <section className="bg-white border border-cream-border rounded-lg overflow-hidden">
            <div className="p-3.5 sm:p-4 border-b border-cream-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-neutral-900 tracking-tight">Step 1 &middot; Items</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-cream-200 border border-cream-border text-xs font-bold text-neutral-500">
                  {styles.length}
                </span>
                <span className="text-xs text-neutral-400 hidden sm:inline">
                  Each Item (e.g. &ldquo;V Neck&rdquo;, &ldquo;Solo&rdquo;) gets its own Models, Colors &amp; Sizes below.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddStyleOpen(true)}
                className="px-3.5 py-1.5 rounded-md border border-secondary-700 bg-secondary-600 hover:bg-secondary-700 text-cream-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="p-4">
              {isLoadingStyles ? (
                <AdminTableSkeleton bare rows={1} columns={4} />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {styles.map((style) => (
                    <StyleCard
                      key={style.id}
                      item={style}
                      isSelected={style.id === selectedStyleUuid}
                      onSelect={(s) => setSelectedStyleUuid(s.id)}
                      onEdit={(s) => setEditingStyle(s)}
                      onDelete={(s) => setDeletingStyle(s)}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Section 3.6: Items - admin-only sub-variant (e.g. "Regular Fit",
            "Slim Fit", "Oversized"). Never shown to customers; only used to
            scope which Colors/Sizes show below. Clicking "Add Sub-variant" with no
            Style yet creates a hidden default Style automatically. */}
        <section className="bg-white border border-cream-border rounded-lg overflow-hidden">
          <div className="p-3.5 sm:p-4 border-b border-cream-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-bold text-neutral-900 tracking-tight">Step 2 &middot; Models</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-cream-200 border border-cream-border text-xs font-bold text-neutral-500">
                {items.length}
              </span>
              <span className="text-xs text-neutral-400 hidden sm:inline">
                Admin-only Models (e.g. Regular/Slim/Oversized Fit) - never shown to customers.
              </span>
            </div>
            <button
              type="button"
              onClick={handleAddItemClick}
              disabled={isPreparingItemForm}
              className="px-3.5 py-1.5 rounded-md border border-secondary-700 bg-secondary-600 hover:bg-secondary-700 text-cream-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isPreparingItemForm ? "Preparing..." : "Add Model"}</span>
            </button>
          </div>

          <div className="px-4 pt-3 space-y-2">
            <p className="text-xs text-neutral-500">
              Setup order: <strong>1 Item</strong> &rarr; <strong>2 Model</strong> &rarr; <strong>3 Color</strong> &rarr; <strong>4 Size &amp; Price</strong>
            </p>
            {!isLoadingItems && items.length === 0 && (
              <p className="text-xs rounded-md border border-amber-300 bg-amber-50 text-amber-800 px-3 py-2">
                Not visible on the store yet: add a Model, then a Color with a priced Size.
              </p>
            )}
          </div>

          <div className="p-4">
            {isLoadingItems && selectedStyleUuid ? (
              <AdminTableSkeleton bare rows={1} columns={4} />
            ) : items.length === 0 ? (
              <div className="text-center py-10 px-4">
                <Layers className="mx-auto h-8 w-8 text-neutral-300" />
                <h3 className="mt-2 text-sm font-semibold text-neutral-900">No Models yet</h3>
                <p className="mt-1 text-xs text-neutral-500 max-w-sm mx-auto">
                  Add at least one Model before creating Colors and Sizes for this product.
                </p>
                <button
                  type="button"
                  onClick={handleAddItemClick}
                  disabled={isPreparingItemForm}
                  className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-secondary-600 text-cream-white text-xs font-semibold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isPreparingItemForm ? "Preparing..." : "Add first Model"}</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
                    <tr>
                      <th className="px-3.5 py-2.5 min-w-[200px] border-b border-cream-border">Type</th>
                      <th className="px-3.5 py-2.5 min-w-[220px] border-b border-cream-border">Attributes</th>
                      <th className="px-3.5 py-2.5 min-w-[110px] text-right border-b border-cream-border">Price</th>
                      <th className="px-3.5 py-2.5 min-w-[95px] text-center border-b border-cream-border">Status</th>
                      <th className="px-3.5 py-2.5 min-w-[90px] text-center border-b border-cream-border">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-border-subtle">
                    {items.map((item) => {
                      const isSelected = item.id === selectedItemUuid;
                      return (
                        <tr
                          key={item.id}
                          onClick={() => setSelectedItemUuid(item.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? "bg-secondary-50" : "hover:bg-cream-50"
                          }`}
                        >
                          <td className="px-3.5 py-2.5 min-w-[200px]">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-neutral-900">{item.name}</span>
                              {item.isDefault && (
                                <span title="Default Model">
                                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-[11px] text-neutral-400">{item.slug}</span>
                          </td>
                          <td className="px-3.5 py-2.5 min-w-[220px] text-neutral-700">
                            {item.selectedAttributes && item.selectedAttributes.length > 0 ? (
                              <div className="space-y-1.5">
                                {item.selectedAttributes.map((group) => (
                                  <div
                                    key={group.id}
                                    className="flex flex-wrap items-center gap-1.5"
                                  >
                                    <span className="text-[10px] font-semibold text-neutral-500 w-14 shrink-0 uppercase">
                                      {group.name}
                                    </span>
                                    <div className="flex flex-wrap gap-1">
                                      {group.values.map((value) => (
                                        <span
                                          key={value.id}
                                          className="inline-flex items-center gap-1 rounded-full bg-secondary-50 text-secondary-700 border border-secondary-200 px-2 py-0.5 text-[11px] font-semibold"
                                        >
                                          {group.type === "color" &&
                                            (value.imageUrl ? (
                                              <img
                                                src={value.imageUrl}
                                                alt=""
                                                className="h-3 w-3 rounded-full border border-white/60 object-cover"
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
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-neutral-400">—</span>
                            )}
                          </td>
                          <td className="px-3.5 py-2.5 min-w-[110px] text-right tabular-nums text-neutral-900 font-semibold">
                            {item.basePrice > 0 ? `₹${item.basePrice.toFixed(0)}` : "—"}
                          </td>
                          <td className="px-3.5 py-2.5 min-w-[95px] text-center">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                item.isActive
                                  ? "bg-success-50 text-success-700 border border-success-200"
                                  : "bg-cream-200 text-neutral-500 border border-cream-border"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  item.isActive ? "bg-success-600" : "bg-neutral-400"
                                }`}
                              />
                              {item.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 min-w-[90px]">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingItem(item);
                                }}
                                aria-label="Edit model"
                                title="Edit model"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                className="text-red-500 hover:text-red-600 border-red-200 hover:bg-red-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingItem(item);
                                }}
                                aria-label="Delete model"
                                title="Delete model"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Section 3.7: Attribute values for the selected Item - which Color/Size/etc.
            values (from the attributes configured on the product above) this specific
            Item comes in, plus the trigger to generate its Colors/Sizes from that selection. */}
        {selectedItemUuid && (
          <section className="bg-white border border-cream-border rounded-lg overflow-hidden">
            <div className="p-3.5 sm:p-4 border-b border-cream-border flex items-center gap-2.5">
              <h2 className="text-base font-bold text-neutral-900 tracking-tight">
                Step 3 &amp; 4 &middot; Colors &amp; Sizes
              </h2>
              <span className="text-xs text-neutral-400 hidden sm:inline">
                For &ldquo;{items.find((i) => i.id === selectedItemUuid)?.name || "this item"}&rdquo;
              </span>
            </div>
            <div className="p-4">
              <ItemColorsPanel
                productUuid={canonicalProductId}
                itemUuid={selectedItemUuid}
                itemName={items.find((i) => i.id === selectedItemUuid)?.name}
                categoryUuid={product?.categoryId ?? null}
                onChanged={() => refetchVariants()}
                onBulkEditPrices={() => setIsPriceEditOpen(true)}
              />
            </div>
          </section>
        )}

        {/* Section 4: Product Variants Section with FIXED ACTION COLUMN */}
        <section className="bg-white border border-cream-border rounded-lg overflow-hidden">
          {/* Header & Controls */}
          <div className="p-3.5 sm:p-4 border-b border-cream-border flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Left: Title, Counter Badge & Segmented Filter Tabs */}
            <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-neutral-900 tracking-tight">
                  Variants
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-cream-200 border border-cream-border text-xs font-bold text-neutral-500">
                  {currentTabCount}
                </span>
              </div>

              {/* Filter Tabs with Count Pills */}
              <div className="flex p-1 bg-cream-200 border border-cream-border rounded-md gap-1">
                <button
                  type="button"
                  onClick={() => setVariantFilter("active")}
                  className={`px-3 py-1.5 rounded-sm text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    variantFilter === "active"
                      ? "bg-secondary-600 text-cream-white"
                      : "text-neutral-500 hover:text-neutral-900 hover:bg-white"
                  }`}
                >
                  <span>Active</span>
                  {variantFilter === "active" && (
                    <span className="px-1.5 py-0.5 text-[10.5px] rounded-full font-bold leading-none bg-white/20 text-cream-white">
                      {currentTabCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setVariantFilter("inactive")}
                  className={`px-3 py-1.5 rounded-sm text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    variantFilter === "inactive"
                      ? "bg-secondary-600 text-cream-white"
                      : "text-neutral-500 hover:text-neutral-900 hover:bg-white"
                  }`}
                >
                  <span>Inactive</span>
                  {variantFilter === "inactive" && (
                    <span className="px-1.5 py-0.5 text-[10.5px] rounded-full font-bold leading-none bg-white/20 text-cream-white">
                      {currentTabCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Right: Actions (View Mode Switcher, Export, Edit prices, Add variant) */}
            <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap sm:flex-nowrap justify-end">
              {/* Table / Card View Mode Toggle */}
              <div className="flex items-center bg-cream-200 border border-cream-border p-1 rounded-md">
                <button
                  type="button"
                  onClick={() => setVariantViewMode("table")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-semibold transition-colors cursor-pointer ${
                    variantViewMode === "table"
                      ? "bg-secondary-600 text-cream-white"
                      : "text-neutral-500 hover:text-neutral-900 hover:bg-white"
                  }`}
                  title="Table View"
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  <span>Table</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVariantViewMode("cards")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-semibold transition-colors cursor-pointer ${
                    variantViewMode === "cards"
                      ? "bg-secondary-600 text-cream-white"
                      : "text-neutral-500 hover:text-neutral-900 hover:bg-white"
                  }`}
                  title="Customer Card View"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Card View</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsPriceEditOpen(true)}
                className="px-3.5 py-1.5 rounded-md border border-secondary-200 bg-secondary-50 hover:bg-secondary-100 text-secondary-600 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Bulk edit prices"
              >
                <IndianRupee className="w-3.5 h-3.5" />
                <span>Edit prices</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAddVariantOpen(true)}
                className="px-3.5 py-1.5 rounded-md border border-secondary-700 bg-secondary-600 hover:bg-secondary-700 text-cream-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Variant</span>
              </button>
            </div>
          </div>

          {/* Bulk Selection Action Bar */}
          {hasSelection && variantViewMode === "table" && (
            <div className="px-4 py-2.5 bg-secondary-50 border-b border-secondary-200 flex items-center justify-between gap-3 text-xs">
              <span className="font-bold text-secondary-600">
                {selectedIds.length} variant{selectedIds.length > 1 ? "s" : ""} selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedVariants({})}
                  className="px-2.5 py-1 rounded-md border border-secondary-200 bg-white hover:bg-secondary-100 text-secondary-600 font-semibold cursor-pointer"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkStatusChange(true)}
                  className="px-2.5 py-1 rounded-md border border-secondary-200 bg-white hover:bg-secondary-100 text-success-700 font-semibold cursor-pointer"
                >
                  Activate
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkStatusChange(false)}
                  className="px-2.5 py-1 rounded-md border border-secondary-200 bg-white hover:bg-secondary-100 text-neutral-400 font-semibold cursor-pointer"
                >
                  Deactivate
                </button>
              </div>
            </div>
          )}

          {/* Variants Rendering: Table vs Cards */}
          {isLoadingVariants ? (
            <AdminTableSkeleton bare rows={4} columns={4} />
          ) : variants.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Package className="mx-auto h-10 w-10 text-neutral-300" />
              <h3 className="mt-3 text-sm font-semibold text-neutral-900">
                No {variantFilter} variant found
              </h3>
              <p className="mt-1 text-xs text-neutral-500 max-w-sm mx-auto">
                {variantFilter === "active"
                  ? "This product currently has no active variants."
                  : "No variants are currently marked as inactive."}
              </p>
              <button
                type="button"
                onClick={() => setIsAddVariantOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-secondary-600 text-cream-white text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add first Variant</span>
              </button>
            </div>
          ) : variantViewMode === "cards" ? (
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {variants.map((variant) => (
                <VariantCard
                  key={variant.id}
                  variant={variant}
                  productUuid={canonicalProductId}
                  onEdit={(v) => setEditingVariant(v)}
                  onManageImages={(v) => setManagingImagesVariant(v)}
                  onDelete={(v) => setDeletingVariant(v)}
                  onPreview={(v) => setPreviewVariant(v)}
                  onToggleStatus={(v, nextActive) => {
                    if (nextActive) {
                      setVariantToActivate(v);
                    } else {
                      setVariantToDeactivate(v);
                    }
                  }}
                  onToggleStock={async (v, nextOutOfStock) => {
                    try {
                      await updateVariantMutation.mutateAsync({
                        productUuid: canonicalProductId,
                        variantUuid: v.id,
                        data: { outOfStock: nextOutOfStock },
                      });
                      toast.success(
                        nextOutOfStock ? "Marked Out of Stock" : "Marked In Stock",
                        `"${v.variantName}" is now ${nextOutOfStock ? "Out of Stock" : "In Stock"}.`
                      );
                      refetchVariants();
                    } catch (err: any) {
                      toast.error("Failed to update stock status", err?.message || "Please try again.");
                    }
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-auto max-h-[560px] relative scrollbar-thin">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="sticky top-0 z-30 bg-cream-50 text-[11px] font-bold tracking-wider text-neutral-400 uppercase shadow-[0_1px_0_var(--cream-border)]">
                  <tr>
                    {/* Checkbox */}
                    <th className="px-3.5 py-2.5 w-[44px] min-w-[44px] text-center border-b border-cream-border">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-cream-border-hover text-secondary-600 focus:ring-secondary-600 cursor-pointer"
                      />
                    </th>

                    <th className="px-4 py-2.5 min-w-[200px] border-b border-cream-border">Item</th>
                    <th className="px-4 py-2.5 min-w-[120px] border-b border-cream-border">SKU</th>
                    <th className="px-4 py-2.5 min-w-[150px] border-b border-cream-border">Sizes</th>
                    <th className="px-4 py-2.5 min-w-[140px] border-b border-cream-border">Color</th>
                    <th className="px-4 py-2.5 min-w-[120px] text-right border-b border-cream-border">Price</th>
                    <th className="px-3 py-2.5 min-w-[95px] text-center border-b border-cream-border">Status</th>

                    {/* FIXED ACTION COLUMN (Sticky top & right corner) */}
                    <th className="sticky top-0 right-0 z-40 bg-cream-50 text-center px-2 py-2.5 w-[72px] min-w-[72px] border-b border-cream-border shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05),0_1px_0_var(--cream-border)]">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-cream-border-subtle bg-white">
                  {variants.map((variant) => {
                    const isPicked = !!selectedVariants[variant.id];
                    const unitPrices = variant.unitPrices ?? [];
                    const priceValues = unitPrices.map((p) => p.basePrice);
                    const minPrice = priceValues.length ? Math.min(...priceValues) : 0;
                    const maxPrice = priceValues.length ? Math.max(...priceValues) : 0;
                    const extraSizes = unitPrices.length > 1 ? unitPrices.length - 1 : 0;

                    return (
                      <tr
                        key={variant.id}
                        className={`group transition-colors ${
                          isPicked ? "bg-cream-50" : "hover:bg-cream-50"
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="px-3.5 py-2.5 w-[44px] min-w-[44px] text-center">
                          <input
                            type="checkbox"
                            checked={isPicked}
                            onChange={() => toggleSelectOne(variant.id)}
                            className="w-4 h-4 rounded border-cream-border-hover text-secondary-600 focus:ring-secondary-600 cursor-pointer"
                          />
                        </td>

                        {/* Variant Name & Image */}
                        <td className="px-4 py-2.5 min-w-[200px]">
                          <Link
                            href={`/admin/dashboard/variants/${encodeURIComponent(variant.id)}?productId=${encodeURIComponent(canonicalProductId)}`}
                            className="group/variant flex items-center gap-3 min-w-0 hover:opacity-95"
                          >
                            <div className="w-[36px] h-[36px] rounded-md flex-none bg-cream-100 border border-cream-border relative overflow-hidden flex items-center justify-center">
                              {variant.primaryImage ? (
                                <Image
                                  src={variant.primaryImage}
                                  alt={variant.variantName}
                                  fill
                                  className="object-cover"
                                />
                              ) : (
                                <Package className="w-4 h-4 text-neutral-400 opacity-70" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <span className="font-semibold text-neutral-900 group-hover/variant:text-secondary-600 group-hover/variant:underline block leading-snug truncate transition-colors">
                                {variant.variantName}
                              </span>
                              <span className="font-mono text-[11px] text-neutral-400 block truncate">
                                {variant.id ? `ID: ${variant.id.slice(0, 8)}...` : "—"}
                              </span>
                            </div>
                          </Link>
                        </td>

                        {/* SKU */}
                        <td className="px-4 py-2.5 min-w-[120px] font-mono text-[11.5px] text-neutral-600 truncate">
                          {variant.sku}
                        </td>

                        {/* Pack Sizes */}
                        <td className="px-4 py-2.5 min-w-[150px] text-xs font-medium text-neutral-700 whitespace-nowrap">
                          {unitPrices.length === 0 ? (
                            <span className="text-neutral-400 italic">No sizes added</span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5">
                              <span>{formatMeasurement(variant.measurement)}</span>
                              {extraSizes > 0 && (
                                <span
                                  className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-600 border border-neutral-200"
                                  title={unitPrices
                                    .map((p) => `${p.measurement.value} ${p.measurement.unit}`)
                                    .join(", ")}
                                >
                                  +{extraSizes} more
                                </span>
                              )}
                            </span>
                          )}
                        </td>

                        {/* Color & Featured */}
                        <td className="px-4 py-2.5 min-w-[140px] whitespace-nowrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {renderColorBadge(variant.colorName, variant.colorHex)}
                            {variant.isFeatured && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10.5px] font-bold border border-amber-200">
                                Featured
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Price (range across pack sizes, if more than one) */}
                        <td className="px-4 py-2.5 min-w-[120px] text-right whitespace-nowrap tabular-nums">
                          {unitPrices.length === 0 ? (
                            <span className="text-neutral-400 italic text-xs">—</span>
                          ) : (
                            <span className="font-bold text-neutral-900 text-xs sm:text-sm">
                              {minPrice === maxPrice
                                ? `₹${minPrice.toLocaleString("en-IN")}`
                                : `₹${minPrice.toLocaleString("en-IN")} – ₹${maxPrice.toLocaleString("en-IN")}`}
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-3 py-2.5 min-w-[95px] text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              variant.isActive
                                ? "bg-success-50 text-success-700 border border-success-200"
                                : "bg-cream-200 text-neutral-500 border border-cream-border"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                variant.isActive ? "bg-success-600" : "bg-neutral-400"
                              }`}
                            />
                            {variant.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>

                        {/* FIXED ACTION COLUMN (Sticky right) */}
                        <td
                          className={`sticky right-0 transition-colors px-2 py-2.5 text-center shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)] z-20 ${
                            isPicked
                              ? "bg-cream-50"
                              : "bg-white group-hover:bg-cream-50"
                          }`}
                        >
                          <div className="flex items-center justify-center">
                            {variant.isActive ? (
                              <button
                                type="button"
                                data-action-trigger
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (activeMenu?.variant.id === variant.id) {
                                    setActiveMenu(null);
                                  } else {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setActiveMenu({ variant, rect });
                                  }
                                }}
                                className={`w-8 h-8 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
                                  activeMenu?.variant.id === variant.id
                                    ? "bg-secondary-600 text-cream-white border-secondary-600"
                                    : "border-cream-border bg-white hover:bg-secondary-50 text-neutral-700 hover:text-secondary-600"
                                }`}
                                title="More actions"
                                aria-label="More actions"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setVariantToActivate(variant)}
                                className="px-2.5 py-1 text-xs font-semibold rounded-md border border-success-200 bg-success-50 hover:bg-success-100 text-success-700 transition-colors flex items-center gap-1 cursor-pointer"
                                title="Make Active"
                              >
                                <Power className="w-3.5 h-3.5" />
                                <span>Active</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Variants Table Footer */}
          <div className="px-4 py-2.5 border-t border-cream-border bg-cream-50/50 flex items-center justify-between text-xs text-neutral-400 flex-wrap gap-2">
            <span>
              Showing <strong className="text-neutral-900">{variants.length}</strong> of{" "}
              <strong className="text-neutral-900">{currentTabCount}</strong>{" "}
              {variantFilter} variants
            </span>
          </div>
        </section>

      {/* Floating Portal Action Dropdown Menu (Guaranteed Zero Clipping & Viewport Clamping) */}
      {activeMenu &&
        typeof document !== "undefined" &&
        createPortal(
          (() => {
            const { variant, rect } = activeMenu;
            const menuWidth = 192; // 12rem = 192px
            const menuHeight = variant.isActive ? 220 : 60;

            // Position on the LEFT side of the button icon:
            let left = rect.left - menuWidth - 8;
            if (left < 10) {
              left = 10;
            }

            // Align vertically with the button icon:
            let top = rect.top;
            if (top + menuHeight > window.innerHeight - 12) {
              top = Math.max(12, window.innerHeight - menuHeight - 12);
            }

            return (
              <div
                data-action-portal
                style={{
                  position: "fixed",
                  top: `${top}px`,
                  left: `${left}px`,
                  width: `${menuWidth}px`,
                  zIndex: 9999,
                }}
                className="rounded-xl border border-cream-border bg-white p-1.5 shadow-2xl animate-in zoom-in-95 duration-100 select-none"
                onClick={(e) => e.stopPropagation()}
              >
                {variant.isActive ? (
                  <>
                    {/* 1. View Product Variant */}
                    <Link
                      href={`/admin/dashboard/variants/${encodeURIComponent(variant.id)}?productId=${encodeURIComponent(canonicalProductId)}`}
                      onClick={() => setActiveMenu(null)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold text-neutral-700 hover:text-secondary-600 hover:bg-secondary-50 rounded-lg transition-colors cursor-pointer text-left"
                    >
                      <Eye className="w-3.5 h-3.5 opacity-70" />
                      <span>View Variant</span>
                    </Link>

                    {/* 2. Price Change — same Units & Pricing flow as the Edit Item modal */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenu(null);
                        setEditingVariant(variant);
                        setEditVariantTab("pricing");
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold text-neutral-700 hover:text-secondary-600 hover:bg-secondary-50 rounded-lg transition-colors cursor-pointer text-left"
                    >
                      <IndianRupee className="w-3.5 h-3.5 opacity-70" />
                      <span>Price Change</span>
                    </button>

                    {/* 3. Edit */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenu(null);
                        setEditingVariant(variant);
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold text-neutral-700 hover:text-secondary-600 hover:bg-secondary-50 rounded-lg transition-colors cursor-pointer text-left"
                    >
                      <Pencil className="w-3.5 h-3.5 opacity-70" />
                      <span>Edit</span>
                    </button>

                    {/* Manage Images */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenu(null);
                        setManagingImagesVariant(variant);
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold text-neutral-700 hover:text-secondary-600 hover:bg-secondary-50 rounded-lg transition-colors cursor-pointer text-left"
                    >
                      <ImagesIcon className="w-3.5 h-3.5 opacity-70" />
                      <span>Manage Images</span>
                    </button>

                    <div className="my-1 border-t border-cream-border" />

                    {/* 4. Make Inactive */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenu(null);
                        setVariantToDeactivate(variant);
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold text-amber-700 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer text-left"
                    >
                      <PowerOff className="w-3.5 h-3.5" />
                      <span>Make Inactive</span>
                    </button>

                    {/* 5. Delete */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenu(null);
                        setDeletingVariant(variant);
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer text-left"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </>
                ) : (
                  /* INACTIVE: ONLY Make Active */
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenu(null);
                      setVariantToActivate(variant);
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold text-success-700 hover:text-success-800 hover:bg-success-50 rounded-lg transition-colors cursor-pointer text-left"
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>Make Active</span>
                  </button>
                )}
              </div>
            );
          })(),
          document.body
        )}

      {/* ========================================================================= */}
      {/* MODALS AND DIALOGS                                                       */}
      {/* ========================================================================= */}

      {/* 1. Bulk Price Edit Modal (Existing & Enhanced) */}
      <ProductPriceEditModal
        open={isPriceEditOpen}
        onClose={() => setIsPriceEditOpen(false)}
        productUuid={canonicalProductId}
        productName={product.name}
        variants={variants}
        onSuccess={() => {
          setIsPriceEditOpen(false);
          refetchVariants();
          refetchProduct();
        }}
      />

      {/* 4. Edit Product Modal */}
      <FormModal
        open={isEditProductOpen}
        onClose={() => setIsEditProductOpen(false)}
        title="Edit Product"
        description={`Update information for ${product.name}`}
        size="lg"
      >
        <ProductForm
          initialData={{
            name: product.name,
            slug: product.slug,
            categoryId: product.categoryId || "",
            brandId: product.brandId || "",
            hsnCodeId: product.hsnCodeId || "",
            gender: product.gender || "unisex",
          }}
          isEditing
          categories={categoryOptions}
          brands={brandOptions}
          hsnCodes={hsnOptions}
          isLoading={updateProductMutation.isPending}
          submitLabel="Save Changes"
          onSubmit={async (formData: ProductFormValues) => {
            try {
              await updateProductMutation.mutateAsync({
                uuid: canonicalProductId,
                data: formData as any,
              });
              setIsEditProductOpen(false);
            } catch (err: any) {
              console.error("Failed to update product", err);
            }
          }}
        />
      </FormModal>

      {/* 4b. Manage Product Images Modal */}
      <FormModal
        open={isManagingProductImages}
        onClose={() => setIsManagingProductImages(false)}
        title={`Manage Images: ${product.name}`}
        description="Upload, reorder, and manage images for this product."
        size="lg"
      >
        <ProductImageUploader
          productUuid={canonicalProductId}
          productName={product.name}
          onFinish={() => setIsManagingProductImages(false)}
        />
      </FormModal>

      {/* 5. Add Variant Modal */}
      <FormModal
        open={isAddVariantOpen}
        onClose={() => {
          setIsAddVariantOpen(false);
          setNewlyCreatedVariant(null);
        }}
        title={newlyCreatedVariant ? "Add Units & Pricing" : "Add Variant"}
        description={
          newlyCreatedVariant
            ? `Add at least one unit + price combination for ${newlyCreatedVariant.variantName}`
            : `Create a new Variant (Color/Size) for ${product.name}`
        }
        size="lg"
      >
        {!newlyCreatedVariant ? (
          <VariantForm
            fixedProductId={canonicalProductId}
            fixedProductSlug={product.slug}
            categoryUuid={product.categoryId}
            productGender={product.gender}
            isLoading={createVariantMutation.isPending}
            submitLabel="Next: Units & Pricing"
            onSubmit={async (formData: VariantFormValues) => {
              try {
                const res = await createVariantMutation.mutateAsync({
                  productUuid: canonicalProductId,
                  itemUuid: items.length > 1 ? selectedItemUuid || undefined : undefined,
                  data: {
                    variantName: formData.variantName,
                    slug: formData.slug,
                    priceAdjustment: formData.priceAdjustment ?? 0,
                    isFeatured: formData.isFeatured,
                    isActive: formData.isActive,
                    attributeValueIds: formData.attributeValueIds || [],
                  },
                });
                if (res && (res as any).data) {
                  setNewlyCreatedVariant((res as any).data);
                }
              } catch (err: any) {
                console.error("Failed to create Item", err);
              }
            }}
          />
        ) : (
          <div className="space-y-4">


     

            <VariantUnitPriceList
              productUuid={canonicalProductId}
              variantUuid={newlyCreatedVariant.id}
              categoryUuid={product.categoryId || null}
              productGender={product.gender || null}
            />
            <div className="flex justify-end gap-2">
              {!hasNewlyCreatedPrices ? (
                <Button
                  type="button"
                  onClick={() => {
                    setIsAddVariantOpen(false);
                    setNewlyCreatedVariant(null);
                  }}
                  className="h-10 rounded-xl bg-neutral-100 text-neutral-800 border border-neutral-300 hover:bg-neutral-200 px-5 text-sm font-semibold cursor-pointer"
                >
                  Skip for now & Close
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={async () => {
                    try {
                      await updateVariantMutation.mutateAsync({
                        productUuid: canonicalProductId,
                        variantUuid: newlyCreatedVariant.id,
                        data: { isActive: true },
                      });
                      toast.success("Variant activated", "Variant is now active and ready for customers.");
                    } catch (e) {
                      console.error("Failed to activate variant:", e);
                    }
                    setIsAddVariantOpen(false);
                    setNewlyCreatedVariant(null);
                  }}
                  className="h-10 rounded-xl bg-[var(--color-secondary-600)] px-5 text-sm font-semibold text-white hover:bg-[var(--color-secondary-700)] cursor-pointer"
                >
                  Save & Activate
                </Button>
              )}
            </div>
          </div>
        )}
      </FormModal>

      {/* 6. Edit Full Variant Details Modal */}
      <FormModal
        open={!!editingVariant}
        onClose={() => {
          setEditingVariant(null);
          setEditVariantTab("details");
        }}
        title="Edit Variant"
        description={`Modify configuration for ${editingVariant?.variantName}`}
        size="lg"
      >
        {editingVariant && (
          <div>
            <div className="flex border-b border-[var(--color-neutral-200)] mb-6">
              <button
                type="button"
                onClick={() => setEditVariantTab("details")}
                className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                  editVariantTab === "details"
                    ? "border-[var(--color-secondary-600)] text-[var(--color-secondary-600)]"
                    : "border-transparent text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-800)]"
                }`}
              >
                Variant Details
              </button>
              <button
                type="button"
                onClick={() => setEditVariantTab("pricing")}
                className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                  editVariantTab === "pricing"
                    ? "border-[var(--color-secondary-600)] text-[var(--color-secondary-600)]"
                    : "border-transparent text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-800)]"
                }`}
              >
                Units & Pricing
              </button>
            </div>

            {editVariantTab === "details" ? (
              <VariantForm
                initialData={{
                  variantName: editingVariant.variantName,
                  slug: editingVariant.slug || "",
                  priceAdjustment: editingVariant.priceAdjustment ?? 0,
                  isFeatured: editingVariant.isFeatured ?? false,
                  isActive: editingVariant.isActive ?? false,
                  attributeValueIds: (editingVariant.attributeValues || []).map(
                    (av) => av.valueId
                  ),
                }}
                isEditing
                fixedProductId={canonicalProductId}
                fixedProductSlug={product.slug}
                categoryUuid={product.categoryId}
                productGender={product.gender}
                isLoading={updateVariantMutation.isPending}
                submitLabel="Update Variant"
                onSubmit={async (formData: VariantFormValues) => {
                  try {
                    await updateVariantMutation.mutateAsync({
                      productUuid: canonicalProductId,
                      variantUuid: editingVariant.id,
                      data: {
                        variantName: formData.variantName,
                        slug: formData.slug,
                        priceAdjustment: formData.priceAdjustment ?? 0,
                        isFeatured: formData.isFeatured,
                        isActive: formData.isActive,
                        attributeValueIds: formData.attributeValueIds || [],
                      },
                    });
                    setEditingVariant(null);
                  } catch (err: any) {
                    console.error("Failed to update Item", err);
                  }
                }}
              />
            ) : (
              <VariantUnitPriceList
                productUuid={canonicalProductId}
                variantUuid={editingVariant.id}
                categoryUuid={product.categoryId || null}
                productGender={product.gender || null}
              />
            )}
          </div>
        )}
      </FormModal>

      {/* 7. Make Variant Inactive Confirmation Dialog */}
      <ConfirmDialog
        open={!!variantToDeactivate}
        onClose={() => setVariantToDeactivate(null)}
        onConfirm={async () => {
          if (!variantToDeactivate) return;
          const target = variantToDeactivate;
          setVariantToDeactivate(null);
          await handleMakeInactive(target);
        }}
        title="Make Variant Inactive?"
        description="Are you sure you want to make this variant inactive?"
        confirmText="Make Inactive"
        cancelText="Cancel"
        variant="destructive"
        isLoading={isStatusUpdating}
      />

      {/* 8. Make Variant Active Confirmation Dialog */}
      <ConfirmDialog
        open={!!variantToActivate}
        onClose={() => setVariantToActivate(null)}
        onConfirm={async () => {
          if (!variantToActivate) return;
          const target = variantToActivate;
          setVariantToActivate(null);
          await handleMakeActive(target);
        }}
        title="Make Variant Active?"
        description="Are you sure you want to make this variant active?"
        confirmText="Make Active"
        cancelText="Cancel"
        variant="default"
        isLoading={isStatusUpdating}
      />

      {/* 9. Delete Variant Confirmation Dialog */}
      <ConfirmDialog
        open={!!deletingVariant}
        onClose={() => setDeletingVariant(null)}
        onConfirm={async () => {
          if (!deletingVariant) return;
          const target = deletingVariant;
          setDeletingVariant(null);
          try {
            await deleteVariantMutation.mutateAsync({
              productUuid: canonicalProductId,
              variantUuid: target.id,
            });
          } catch (err: any) {
            console.error("Failed to delete item", err);
          }
        }}
        title="Delete Variant"
        description={`Are you sure you want to delete the variant "${deletingVariant?.variantName}" (${deletingVariant?.sku})? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        isLoading={deleteVariantMutation.isPending}
      />

      {/* 10. Manage Variant Images Modal */}
      <FormModal
        open={Boolean(managingImagesVariant)}
        onClose={() => setManagingImagesVariant(null)}
        title={`Manage Images: ${managingImagesVariant?.variantName || ""}`}
        description="Upload and crop product item images (500 × 500 px)"
        size="lg"
      >
        {managingImagesVariant && (
          <VariantImageUploader
            productUuid={canonicalProductId}
            variantUuid={managingImagesVariant.id}
            variantName={managingImagesVariant.variantName}
            onFinish={() => {
              setManagingImagesVariant(null);
            }}
          />
        )}
      </FormModal>

      {/* 11. Customer View Live Card Preview Modal */}
      <VariantCustomerPreviewModal
        variant={previewVariant}
        isOpen={Boolean(previewVariant)}
        onClose={() => setPreviewVariant(null)}
      />

      {/* 12. Add Style Modal */}
      <FormModal
        open={isAddStyleOpen}
        onClose={() => setIsAddStyleOpen(false)}
        title="Add Item"
        description={`Create a new sellable item for ${product.name} (e.g. "V Neck", "Solo")`}
        size="lg"
      >
        <StyleForm
          isLoading={createStyleMutation.isPending}
          submitLabel="Create Item"
          onSubmit={async (formData: StyleFormValues) => {
            try {
              const res = await createStyleMutation.mutateAsync({
                productUuid: canonicalProductId,
                data: {
                  brandId: formData.brandId,
                  name: formData.name,
                  slug: formData.slug,
                  sku: formData.sku || null,
                  shortDescription: formData.shortDescription || null,
                  description: formData.description || null,
                  ingredients: null,
                  isReadyToMix: false,
                  cookingRecipe: formData.cookingRecipe || null,
                  shelfLife: null,
                  vegType: "na",
                  basePrice: formData.basePrice ?? 0,
                  isFeatured: formData.isFeatured,
                  isNewArrival: formData.isNewArrival ?? false,
                  newArrivalUntil: formData.isNewArrival ? formData.newArrivalUntil || null : null,
                  isDefault: formData.isDefault ?? false,
                  isActive: formData.isActive,
                },
              });
              const created = (res as any)?.data as AdminStyleResponse | undefined;
              if (created) {
                setSelectedStyleUuid(created.id);
              }
              setIsAddStyleOpen(false);
              toast.success("Item created", `"${formData.name}" is ready for Models, Colors & Sizes.`);
            } catch (err: any) {
              console.error("Failed to create style", err);
              toast.error("Failed to create item", err?.message || "Please try again.");
            }
          }}
        />
      </FormModal>

      {/* 13. Edit Style Modal */}
      <FormModal
        open={Boolean(editingStyle)}
        onClose={() => setEditingStyle(null)}
        title="Edit Item"
        description={`Update information for ${editingStyle?.name || ""}`}
        size="lg"
      >
        {editingStyle && (
          <StyleForm
            isEditing
            initialData={{
              brandId: editingStyle.brandId || "",
              name: editingStyle.name,
              slug: editingStyle.slug,
              sku: editingStyle.sku || "",
              shortDescription: editingStyle.shortDescription || "",
              description: editingStyle.description || "",
              cookingRecipe: editingStyle.cookingRecipe || "",
              basePrice: editingStyle.basePrice ?? 0,
              isFeatured: editingStyle.isFeatured,
              isNewArrival: editingStyle.isNewArrival,
              newArrivalUntil: editingStyle.newArrivalUntil ?? "",
              isDefault: editingStyle.isDefault,
              isActive: editingStyle.isActive,
            }}
            isLoading={updateStyleMutation.isPending}
            submitLabel="Save Changes"
            onSubmit={async (formData: StyleFormValues) => {
              if (!editingStyle) return;
              try {
                await updateStyleMutation.mutateAsync({
                  productUuid: canonicalProductId,
                  styleUuid: editingStyle.id,
                  data: {
                    brandId: formData.brandId,
                    name: formData.name,
                    slug: formData.slug,
                    sku: formData.sku || null,
                    shortDescription: formData.shortDescription || null,
                    description: formData.description || null,
                    ingredients: editingStyle.ingredients || null,
                    isReadyToMix: editingStyle.isReadyToMix ?? false,
                    cookingRecipe: formData.cookingRecipe || null,
                    shelfLife: editingStyle.shelfLife || null,
                    vegType: editingStyle.vegType || "na",
                    basePrice: formData.basePrice ?? 0,
                    isFeatured: formData.isFeatured,
                    isNewArrival: formData.isNewArrival ?? false,
                    newArrivalUntil: formData.isNewArrival ? formData.newArrivalUntil || null : null,
                    isDefault: formData.isDefault ?? false,
                    isActive: formData.isActive,
                  },
                });
                setEditingStyle(null);
                toast.success("Item updated", `"${formData.name}" was saved.`);
              } catch (err: any) {
                console.error("Failed to update style", err);
                toast.error("Failed to update item", err?.message || "Please try again.");
              }
            }}
          />
        )}
      </FormModal>

      {/* 14. Delete Style Confirmation Dialog */}
      <ConfirmDialog
        open={!!deletingStyle}
        onClose={() => setDeletingStyle(null)}
        onConfirm={async () => {
          if (!deletingStyle) return;
          const target = deletingStyle;
          setDeletingStyle(null);
          try {
            await deleteStyleMutation.mutateAsync({
              productUuid: canonicalProductId,
              styleUuid: target.id,
            });
            if (selectedStyleUuid === target.id) {
              setSelectedStyleUuid(null);
            }
            toast.success("Item deleted", `"${target.name}" was removed.`);
          } catch (err: any) {
            console.error("Failed to delete style", err);
            toast.error("Failed to delete item", err?.message || "Please try again.");
          }
        }}
        title="Delete Item"
        description={`Are you sure you want to delete the item "${deletingStyle?.name}"? Its Models, Colors and Sizes will no longer be manageable. This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        isLoading={deleteStyleMutation.isPending}
      />

      {/* 14b. Select Brand Modal - shown instead of a blocking toast when the
           Product has no Brand yet and the admin clicks "Add Model". The
           chosen Brand is used only for the hidden default Style. */}
      <FormModal
        open={isPickBrandOpen}
        onClose={() => setIsPickBrandOpen(false)}
        title="Select Brand"
        description={`This product has no Brand yet. Pick one to continue adding items to "${product.name}".`}
        size="sm"
      >
        <div className="space-y-4">
          <Select
            options={[
              ...brandOptions,
              ...createdBrandOptions.filter((c) => !brandOptions.some((b) => b.value === c.value)),
            ]}
            value={pickedBrandId}
            onValueChange={setPickedBrandId}
            placeholder="Select a brand"
            searchable
          />
          <button
            type="button"
            onClick={() => setIsAddBrandOpen(true)}
            className="text-xs font-semibold text-[var(--color-secondary-600)] hover:text-[var(--color-secondary-700)] cursor-pointer"
          >
            + Add brand
          </button>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              onClick={() => setIsPickBrandOpen(false)}
              className="h-10 rounded-xl bg-neutral-100 text-neutral-800 border border-neutral-300 hover:bg-neutral-200 px-5 text-sm font-semibold cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!pickedBrandId || isPreparingItemForm}
              onClick={async () => {
                setIsPickBrandOpen(false);
                await createHiddenStyleAndOpenItemForm(pickedBrandId);
              }}
              className="h-10 rounded-xl bg-primary-600 text-white hover:bg-primary-700 px-5 text-sm font-semibold cursor-pointer disabled:opacity-50"
            >
              {isPreparingItemForm ? "Preparing..." : "Continue"}
            </Button>
          </div>
        </div>
      </FormModal>

      <QuickAddBrandModal
        open={isAddBrandOpen}
        onClose={() => setIsAddBrandOpen(false)}
        onCreated={(brand) => {
          setCreatedBrandOptions((prev) => [...prev, brand]);
          setPickedBrandId(brand.value);
        }}
      />

      {/* 15. Add Item Modal (admin-only sub-variant under the selected Style).
           Two steps like the "Add Variant" flow: create the Item,
           then immediately pick which attribute values (Color, Size, etc.)
           it comes in, right here, instead of hunting for it below later. */}
      <FormModal
        open={isAddItemOpen}
        onClose={() => {
          setIsAddItemOpen(false);
          setNewlyCreatedItem(null);
        }}
        title={newlyCreatedItem ? "Choose Attribute Values" : "Add Model"}
        description={
          newlyCreatedItem
            ? `Pick which Color/Size/etc. values "${newlyCreatedItem.name}" comes in`
            : `Create a new Model under "${styles.find((s) => s.id === selectedStyleUuid)?.name || "this item"}" (e.g. "Regular Fit", "Slim Fit")`
        }
        size="lg"
      >
        {!newlyCreatedItem ? (
          selectedStyleUuid && (
            <ItemForm
              brandOptions={brandOptions}
              isLoading={createItemMutation.isPending}
              submitLabel="Next: Attribute Values"
              onSubmit={async (formData: ItemFormValues) => {
                try {
                  await syncSelectedStyleBrand(formData.brandId);
                  const res = await createItemMutation.mutateAsync({
                    productUuid: canonicalProductId,
                    styleUuid: selectedStyleUuid,
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
                  if (created) {
                    setSelectedItemUuid(created.id);
                    setNewlyCreatedItem(created);
                  }
                  toast.success("Model created", `"${formData.name}" is ready for Colors & Sizes.`);
                } catch (err: any) {
                  console.error("Failed to create item", err);
                  toast.error("Failed to create model", err?.message || "Please try again.");
                }
              }}
            />
          )
        ) : (
          <div className="space-y-4">
            <ItemColorsPanel
              productUuid={canonicalProductId}
              itemUuid={newlyCreatedItem.id}
              itemName={newlyCreatedItem.name}
              categoryUuid={product?.categoryId ?? null}
              onChanged={() => refetchVariants()}
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
        )}
      </FormModal>

      {/* 16. Edit Item Modal */}
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
            brandOptions={brandOptions}
            initialData={{
              brandId: selectedStyleBrandId,
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
              if (!editingItem || !selectedStyleUuid) return;
              try {
                await syncSelectedStyleBrand(formData.brandId);
                await updateItemMutation.mutateAsync({
                  productUuid: canonicalProductId,
                  styleUuid: selectedStyleUuid,
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
              } catch (err: any) {
                console.error("Failed to update item", err);
                toast.error("Failed to update model", err?.message || "Please try again.");
              }
            }}
          />
        )}
      </FormModal>

      {/* 17. Delete Item Confirmation Dialog */}
      <ConfirmDialog
        open={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        onConfirm={async () => {
          if (!deletingItem || !selectedStyleUuid) return;
          const target = deletingItem;
          setDeletingItem(null);
          try {
            await deleteItemMutation.mutateAsync({
              productUuid: canonicalProductId,
              styleUuid: selectedStyleUuid,
              itemUuid: target.id,
            });
            if (selectedItemUuid === target.id) {
              setSelectedItemUuid(null);
            }
            toast.success("Model deleted", `"${target.name}" was removed.`);
          } catch (err: any) {
            console.error("Failed to delete item", err);
            toast.error("Failed to delete model", err?.message || "Please try again.");
          }
        }}
        title="Delete Model"
        description={`Are you sure you want to delete the Model "${deletingItem?.name}"? Its Colors and Sizes will no longer be manageable. This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        isLoading={deleteItemMutation.isPending}
      />
    </div>
  );
}
