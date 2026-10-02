"use client";

import { toast } from "@/components/ui/Toast";
import { FormModal } from "@/components/common/FormModal";
import { useCreateBrand } from "../hooks/use-brand-mutations";
import { BrandForm } from "./BrandForm";

interface QuickAddBrandModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with the new brand so the host can select it straight away. */
  onCreated: (brand: { value: string; label: string; slug?: string }) => void;
}

/**
 * Create a Brand without leaving the form that needs one (Add Item, Select Brand).
 * Render it outside any <form> element: a portal still bubbles React submit
 * events to ancestor forms.
 */
function QuickAddBrandModal({ open, onClose, onCreated }: QuickAddBrandModalProps) {
  const createMutation = useCreateBrand();

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="Add Brand"
      description="Create a new product brand"
    >
      <BrandForm
        isLoading={createMutation.isPending}
        submitLabel="Create Brand"
        onSubmit={async (data) => {
          try {
            const res = await createMutation.mutateAsync({
              name: data.name,
              slug: data.slug,
              description: data.description || null,
            });
            const brand = res?.data as { uuid?: string; id?: string; name?: string; slug?: string } | undefined;
            const value = brand?.uuid || brand?.id;
            if (value) {
              onCreated({ value, label: brand?.name || data.name, slug: brand?.slug || data.slug });
            }
            toast.success("Brand created");
            onClose();
          } catch (err) {
            toast.error(
              "Failed to create brand",
              err instanceof Error ? err.message : "Please try again."
            );
          }
        }}
      />
    </FormModal>
  );
}

export { QuickAddBrandModal };
