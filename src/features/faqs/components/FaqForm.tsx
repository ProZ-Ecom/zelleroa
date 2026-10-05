"use client";

import * as React from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/forms/form-input";
import { FormTextarea } from "@/components/forms/form-textarea";
import { FormSelect } from "@/components/forms/form-select";
import { FormSwitch } from "@/components/forms/FormSwitch";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import { FAQ_ICON_OPTIONS, type FaqIconKey } from "../constants/faq-icons";
import { FAQ_ICON_COMPONENTS } from "../constants/faq-icon-map";
import type { FaqDto, FaqStatus } from "../types/faq.types";

const faqFormSchema = z.object({
  question: z
    .string({ message: "Question is required" })
    .trim()
    .min(1, "Please enter the question.")
    .max(255, "Question cannot exceed 255 characters."),
  answer: z
    .string({ message: "Answer is required" })
    .trim()
    .min(1, "Please enter the answer.")
    .max(5000, "Answer cannot exceed 5000 characters."),
  category: z
    .string()
    .trim()
    .max(100, "Category cannot exceed 100 characters.")
    .optional(),
  // Kept as a number so the numeric input and the API agree, but an empty
  // field arrives as "" from the DOM and must fail rather than become 0.
  displayOrder: z
    .union([z.number(), z.literal("")])
    .refine((val) => val !== "", {
      message: "Please enter a display order.",
    })
    .refine((val) => typeof val === "number" && Number.isInteger(val), {
      message: "Display order must be a whole number.",
    })
    .refine((val) => typeof val === "number" && val >= 0, {
      message: "Display order cannot be negative.",
    })
    .refine((val) => typeof val === "number" && val <= 9999, {
      message: "Display order cannot exceed 9999.",
    }),
  icon: z.string().optional(),
  isActive: z.boolean(),
});

export type FaqFormData = z.input<typeof faqFormSchema>;

export interface FaqFormPayload {
  question: string;
  answer: string;
  category: string | null;
  icon: FaqIconKey | null;
  displayOrder: number;
  status: FaqStatus;
}

interface FaqFormProps {
  /** FAQ being edited; omit for the create flow. */
  initialData?: Partial<FaqDto> | null;
  /** Existing categories, offered as suggestions on the free-text field. */
  categories?: string[];
  /** Display order suggested for a new FAQ (last position + 1). */
  suggestedDisplayOrder?: number;
  isLoading?: boolean;
  submitLabel?: string;
  onCancel?: () => void;
  onSubmit: (data: FaqFormPayload) => Promise<void> | void;
}

export function FaqForm({
  initialData,
  categories = [],
  suggestedDisplayOrder = 0,
  isLoading,
  submitLabel = "Save FAQ",
  onCancel,
  onSubmit,
}: FaqFormProps) {
  const categoryListId = React.useId();

  const getFormDefaults = React.useCallback(
    (): FaqFormData => ({
      question: initialData?.question ?? "",
      answer: initialData?.answer ?? "",
      category: initialData?.category ?? "",
      icon: initialData?.icon ?? "",
      displayOrder: initialData?.displayOrder ?? suggestedDisplayOrder,
      isActive: initialData ? initialData.status === "ACTIVE" : true,
    }),
    [initialData, suggestedDisplayOrder]
  );

  const methods = useForm<FaqFormData>({
    resolver: zodResolver(faqFormSchema),
    defaultValues: getFormDefaults(),
    mode: "onChange",
  });

  const { control, setValue, reset, formState } = methods;
  const isActive = useWatch({ control, name: "isActive" });
  const answer = useWatch({ control, name: "answer" });
  const icon = useWatch({ control, name: "icon" });

  const resetToDefaults = React.useCallback(() => {
    reset(getFormDefaults());
  }, [getFormDefaults, reset]);

  React.useEffect(() => {
    resetToDefaults();
  }, [resetToDefaults]);

  const handleFormSubmit = async (values: FaqFormData) => {
    const category = values.category?.trim() ?? "";

    await onSubmit({
      question: values.question.trim(),
      answer: values.answer.trim(),
      category: category.length > 0 ? category : null,
      icon: (values.icon || null) as FaqIconKey | null,
      displayOrder: Number(values.displayOrder),
      status: values.isActive ? "ACTIVE" : "INACTIVE",
    });
  };

  const showSubmitBlockedNotice =
    formState.isSubmitted && !formState.isValid && !formState.isSubmitting;

  const answerLength = (answer ?? "").length;

  const IconPreview =
    icon && icon in FAQ_ICON_COMPONENTS
      ? FAQ_ICON_COMPONENTS[icon as FaqIconKey]
      : null;

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(handleFormSubmit)}
        className="space-y-5"
        noValidate
      >
        {/* SECTION - Content */}
        <section className="rounded-xl border border-theme-border bg-theme-surface p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-theme-text-primary">
            FAQ Content
          </h3>
          <p className="mt-0.5 text-xs text-theme-text-muted">
            Shown on the storefront FAQ page exactly as written here.
          </p>

          <div className="mt-4 space-y-4">
            <FormInput
              name="question"
              label="Question"
              required
              maxLength={255}
              placeholder="e.g. How long does delivery take across India?"
            />

            <div>
              <FormTextarea
                name="answer"
                label="Answer"
                required
                rows={6}
                maxLength={5000}
                placeholder="Write the full answer customers should see."
              />
              <p className="mt-1 text-right text-xs text-theme-text-muted">
                {answerLength}/5000
              </p>
            </div>
          </div>
        </section>

        {/* SECTION - Placement */}
        <section className="rounded-xl border border-theme-border bg-theme-surface p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-theme-text-primary">
            Placement &amp; Visibility
          </h3>
          <p className="mt-0.5 text-xs text-theme-text-muted">
            FAQs are grouped by category and listed from the lowest display
            order upwards.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <FormInput
                name="category"
                label="Category"
                maxLength={100}
                placeholder="e.g. Orders & Shipping"
                list={categoryListId}
                description="Optional. Leave empty to list this FAQ without a group."
              />
              <datalist id={categoryListId}>
                {categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </div>

            <FormInput
              name="displayOrder"
              label="Display Order"
              required
              type="number"
              min={0}
              max={9999}
              step={1}
              placeholder="0"
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <FormSelect
                name="icon"
                label="Category Icon"
                options={FAQ_ICON_OPTIONS}
                placeholder="Default (chosen automatically)"
                description="Shown beside the category heading on the FAQ page."
              />
            </div>

            {IconPreview && (
              <div className="flex items-end pb-1">
                <div className="flex items-center gap-2.5 rounded-xl border border-theme-border bg-theme-surface-muted px-3 py-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-secondary-100)]">
                    <IconPreview className="h-4 w-4 text-[var(--color-primary-500)]" />
                  </span>
                  <span className="text-xs text-theme-text-muted">
                    Preview
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between rounded-xl border border-theme-border bg-theme-surface-muted p-3">
            <div>
              <p className="text-sm font-medium text-theme-text-primary">
                {isActive ? "Active" : "Inactive"}
              </p>
              <p className="text-xs text-theme-text-muted">
                Only active FAQs appear on the storefront.
              </p>
            </div>
            <FormSwitch
              checked={Boolean(isActive)}
              onCheckedChange={(checked) =>
                setValue("isActive", checked, { shouldDirty: true })
              }
            />
          </div>
        </section>

        {showSubmitBlockedNotice && (
          <div className="flex items-start gap-2 rounded-xl border border-theme-status-can-fg/30 bg-theme-status-can-bg p-3">
            <AlertCircle className="mt-px h-4 w-4 shrink-0 text-theme-status-can-fg" />
            <p className="text-xs font-medium text-theme-status-can-fg">
              Please fix the highlighted fields before saving.
            </p>
          </div>
        )}

        {/* ACTIONS */}
        <div className="flex flex-col-reverse gap-2 border-t border-theme-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onCancel?.()}
            disabled={isLoading || formState.isSubmitting}
            className="sm:w-auto"
          >
            Cancel
          </Button>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              onClick={resetToDefaults}
              disabled={isLoading || formState.isSubmitting}
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Reset
            </Button>

            <FormSubmitButton isLoading={isLoading} variant="secondary">
              {submitLabel}
            </FormSubmitButton>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}

export default FaqForm;
