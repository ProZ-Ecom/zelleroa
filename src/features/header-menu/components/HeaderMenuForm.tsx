"use client";

import * as React from "react";
import Link from "next/link";
import { FolderTree, Link2, Tag } from "lucide-react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormInput } from "@/components/forms/form-input";
import { FormMultiSelect } from "@/components/forms/form-multi-select";
import { FormSelect } from "@/components/forms/form-select";
import { FormSwitch } from "@/components/forms/FormSwitch";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import { useCategories } from "@/features/categories/hooks";
import { useAdminTags } from "@/features/tags/hooks";
import type { HeaderMenuGender } from "../validations/admin-header-menu.schema";

const GENDER_OPTIONS = [
  { value: "unisex", label: "Unisex / Everyone" },
  { value: "men", label: "Men" },
  { value: "women", label: "Women" },
  { value: "kids", label: "Kids" },
  { value: "not_applicable", label: "NA (Not applicable)" },
];

type TargetMode = "category" | "tag" | "link";

const LINK_FORMAT_MESSAGE = "Link must start with / (e.g. /shop) or https://";

const TARGET_CARDS = [
  { value: "category", title: "Category wise", hint: "Link to one or more categories", Icon: FolderTree },
  { value: "tag", title: "Tag wise", hint: "Link to products carrying a tag", Icon: Tag },
] as const;

const LINK_EXAMPLES = ["/shop", "/products?sortBy=discount", "/offers"];

function isValidLink(link: string): boolean {
  return /^(\/(?!\/)|https?:\/\/)\S*$/i.test(link);
}

const headerMenuFormSchema = z
  .object({
    label: z.string().trim().min(1, "Label is required").max(150),
    mode: z.enum(["category", "tag", "link"]),
    categoryIds: z.array(z.string()).default([]),
    tagIds: z.array(z.string()).default([]),
    link: z.string().trim().max(500).optional().nullable(),
    gender: z
      .enum(["men", "women", "kids", "unisex", "not_applicable"])
      .optional()
      .nullable()
      .or(z.literal("")),
    sortOrder: z.union([z.number(), z.literal("")]).default(0),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "category" && data.categoryIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["categoryIds"], message: "Select at least one category" });
    }
    if (data.mode === "tag" && data.tagIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["tagIds"], message: "Select at least one tag" });
    }
    if (data.mode === "link") {
      const link = data.link?.trim() ?? "";
      if (!link) {
        ctx.addIssue({ code: "custom", path: ["link"], message: "Link is required" });
      } else if (!isValidLink(link)) {
        ctx.addIssue({ code: "custom", path: ["link"], message: LINK_FORMAT_MESSAGE });
      }
    }
  });

type HeaderMenuFormData = z.infer<typeof headerMenuFormSchema>;

export interface HeaderMenuFormPayload {
  label: string;
  categoryIds: string[];
  tagIds: string[];
  link: string | null;
  gender: HeaderMenuGender | null;
  sortOrder: number;
  isActive: boolean;
}

interface HeaderMenuFormProps {
  initialData?: {
    label?: string;
    categoryIds?: string[];
    categories?: { id: string; name: string }[];
    tagIds?: string[];
    tags?: { id: string; name: string }[];
    link?: string | null;
    gender?: HeaderMenuGender | null;
    sortOrder?: number;
    isActive?: boolean;
  };
  onSubmit: (data: HeaderMenuFormPayload) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
}

export function HeaderMenuForm({
  initialData,
  onSubmit,
  isLoading = false,
  submitLabel = "Save Menu Item",
}: HeaderMenuFormProps) {
  const { data: categoriesData } = useCategories({ pageSize: 500 });
  const categoryOptions = React.useMemo(() => {
    const fromList = (categoriesData?.data ?? []).map((c) => ({
      value: String(c.id),
      label: c.name,
    }));
    // Categories already linked to this item (e.g. later deactivated/soft-deleted)
    // may have dropped out of the active category list — keep them selectable so
    // the picker still reflects what's actually saved on the item.
    const seen = new Set(fromList.map((o) => o.value));
    const fromInitial = (initialData?.categories ?? [])
      .filter((c) => !seen.has(c.id))
      .map((c) => ({ value: c.id, label: c.name }));
    return [...fromList, ...fromInitial];
  }, [categoriesData, initialData?.categories]);

  const { data: tagsData } = useAdminTags({ pageSize: 200 });
  const tagList = React.useMemo(() => tagsData?.data ?? [], [tagsData]);
  const tagOptions = React.useMemo(() => {
    const fromList = tagList.map((t) => ({
      value: t.id,
      label: `${t.name} (${t.productCount} product${t.productCount === 1 ? "" : "s"})${t.isActive ? "" : " - inactive"}`,
    }));
    const seen = new Set(fromList.map((o) => o.value));
    const fromInitial = (initialData?.tags ?? [])
      .filter((t) => !seen.has(t.id))
      .map((t) => ({ value: t.id, label: t.name }));
    return [...fromList, ...fromInitial];
  }, [tagList, initialData?.tags]);

  const initialMode: TargetMode =
    (initialData?.tagIds?.length ?? 0) > 0
      ? "tag"
      : initialData?.link?.trim()
        ? "link"
        : "category";

  const methods = useForm<HeaderMenuFormData>({
    resolver: zodResolver(headerMenuFormSchema) as any,
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      label: initialData?.label ?? "",
      mode: initialMode,
      categoryIds: initialData?.categoryIds ?? [],
      tagIds: initialData?.tagIds ?? [],
      link: initialData?.link ?? "",
      gender: (initialData?.gender ?? "") as HeaderMenuFormData["gender"],
      sortOrder: initialData?.sortOrder ?? "",
      isActive: initialData?.isActive ?? true,
    },
  });

  const { control, setValue, getValues } = methods;
  const mode = useWatch({ control, name: "mode" });
  const tagIds = useWatch({ control, name: "tagIds" });
  const link = useWatch({ control, name: "link" });
  const isActive = useWatch({ control, name: "isActive" });

  // An item points at one kind of target, so switching modes clears the other two.
  const switchMode = (next: TargetMode) => {
    if (next === mode) return;
    setValue("mode", next);
    if (next !== "category") setValue("categoryIds", []);
    if (next !== "tag") setValue("tagIds", []);
    if (next !== "link") setValue("link", "");
    methods.clearErrors(["categoryIds", "tagIds", "link"]);
  };

  const selectedTags = tagList.filter((t) => tagIds.includes(t.id));
  const emptyTags = selectedTags.filter((t) => t.productCount === 0);
  const tagLinkPreview =
    selectedTags.length > 0 ? `/products?tag=${selectedTags.map((t) => t.slug).join(",")}` : null;
  const trimmedLink = link?.trim() ?? "";

  // Drop any pre-selected category id that isn't a real category at all. Categories
  // still linked to this item are kept selectable via the initialData fallback above,
  // even if they've since been deactivated or soft-deleted.
  React.useEffect(() => {
    if (!categoriesData) return;
    const validValues = new Set(categoryOptions.map((o) => o.value));
    const current = getValues("categoryIds");
    const pruned = current.filter((id) => validValues.has(id));
    if (pruned.length !== current.length) {
      setValue("categoryIds", pruned, { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriesData]);

  const handleSubmit = async (values: HeaderMenuFormData) => {
    await onSubmit({
      label: values.label.trim(),
      categoryIds: values.mode === "category" ? values.categoryIds : [],
      tagIds: values.mode === "tag" ? values.tagIds : [],
      link: values.mode === "link" ? values.link?.trim() || null : null,
      gender: values.gender || null,
      sortOrder: values.sortOrder === "" ? 0 : Number(values.sortOrder),
      isActive: values.isActive,
    });
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(handleSubmit)} className="space-y-6">
        <FormInput name="label" label="Label" placeholder="e.g. Women, GenZ Store" required />

        <div className="space-y-3">
          <p className="text-sm font-medium text-theme-text-primary">Where should this menu item go?</p>
          <div className="grid grid-cols-2 gap-3">
            {TARGET_CARDS.map(({ value, title, hint, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => switchMode(value)}
                aria-pressed={mode === value}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                  mode === value
                    ? "border-theme-primary bg-theme-surface-alt"
                    : "border-theme-border hover:border-theme-primary"
                }`}
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-theme-primary" />
                <span>
                  <span className="block text-sm font-semibold text-theme-text-primary">{title}</span>
                  <span className="block text-xs text-theme-text-muted">{hint}</span>
                </span>
              </button>
            ))}
          </div>
          {mode !== "link" && (
            <button
              type="button"
              onClick={() => switchMode("link")}
              className="inline-flex items-center gap-1.5 text-xs text-theme-text-muted underline-offset-2 hover:underline"
            >
              <Link2 className="h-3.5 w-3.5" />
              Need a different page (offers, about...)? Use an other link
            </button>
          )}
        </div>

        {mode === "category" && (
          <FormMultiSelect
            name="categoryIds"
            label="Categories"
            options={categoryOptions}
            searchPlaceholder="Search categories..."
            description="Pick one for a normal category link, or several to group them under one dropdown."
          />
        )}

        {mode === "tag" && (
          <div className="space-y-2">
            <FormMultiSelect
              name="tagIds"
              label="Tags"
              options={tagOptions}
              searchPlaceholder="Search tags..."
              description="The menu item opens the products carrying any of the selected tags."
            />
            {tagsData && tagList.length === 0 && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                No tags exist yet.{" "}
                <Link href="/admin/dashboard/tags" className="font-semibold underline">
                  Create a tag and assign products
                </Link>{" "}
                first.
              </p>
            )}
            {tagList.length > 0 && (
              <p className="text-xs text-theme-text-muted">
                {tagList.length} tag{tagList.length === 1 ? "" : "s"} available.{" "}
                <Link href="/admin/dashboard/tags" className="underline">
                  Manage tags
                </Link>
              </p>
            )}
            {emptyTags.length > 0 && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {emptyTags.map((t) => t.name).join(", ")} has no products yet, so this menu item
                would open an empty page.
              </p>
            )}
            {tagLinkPreview && (
              <p className="text-xs text-theme-text-muted">
                Storefront link: <code>{tagLinkPreview}</code>
              </p>
            )}
          </div>
        )}

        {mode === "link" && (
          <div className="space-y-2">
            <FormInput
              name="link"
              label="Other link"
              placeholder="e.g. /offers or https://example.com"
              required
              description={`${LINK_FORMAT_MESSAGE}. Use this only for pages that are not a category or tag.`}
            />
            <div className="flex flex-wrap items-center gap-2 text-xs text-theme-text-muted">
              <span>Try:</span>
              {LINK_EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setValue("link", example, { shouldValidate: true })}
                  className="rounded-full border border-theme-border px-2.5 py-0.5 hover:border-theme-primary"
                >
                  {example}
                </button>
              ))}
            </div>
            {/^https?:\/\//i.test(trimmedLink) && (
              <p className="text-xs text-theme-text-muted">This is an external link.</p>
            )}
          </div>
        )}

        <FormSelect
          name="gender"
          label="Gender / Audience"
          placeholder="No audience filter (shows all genders)"
          options={GENDER_OPTIONS}
          description="When set, every link this nav item resolves to (including its categories) only shows products for this audience, even if a category is shared with another nav item."
        />

        <FormInput
          name="sortOrder"
          label="Sort Order"
          type="number"
          min="0"
          step="1"
          placeholder="0"
          onFocus={(e) => e.target.select()}
        />

        <div className="flex items-center justify-between gap-4 rounded-xl border border-theme-border bg-theme-surface-alt p-4">
          <div>
            <p className="text-sm font-semibold text-theme-text-primary">Status</p>
            <p className="text-xs text-theme-text-muted">
              {isActive ? "Active - visible on the storefront." : "Inactive - hidden from the storefront."}
            </p>
          </div>
          <FormSwitch
            checked={Boolean(isActive)}
            onCheckedChange={(checked) => setValue("isActive", checked, { shouldDirty: true })}
          />
        </div>

        <div className="flex justify-end pt-4">
          <FormSubmitButton
            isLoading={isLoading}
            className="h-11 rounded-xl bg-theme-primary hover:bg-theme-primary-hover px-6 text-sm font-semibold text-white transition-colors"
          >
            {submitLabel}
          </FormSubmitButton>
        </div>
      </form>
    </FormProvider>
  );
}

export default HeaderMenuForm;
