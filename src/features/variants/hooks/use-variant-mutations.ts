"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { variantKeys } from "@/lib/api/query-keys";
import {
  createAdminVariant,
  updateAdminVariant,
  deleteAdminVariant,
  bulkEditVariants,
  generateAdminVariants,
  generateAdminVariantsFromItem,
} from "../api/get-variants";
import type { BulkEditVariantsInput, GenerateVariantsInput } from "../types";

export function useCreateVariant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      productUuid,
      data,
      itemUuid,
    }: {
      productUuid: string;
      data: Record<string, unknown>;
      /** Which Item (Product's style) the new Color variant belongs to; defaults to the Product's default Item when omitted. */
      itemUuid?: string;
    }) => createAdminVariant(productUuid, data, itemUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: variantKeys.all });
    },
    onError: (error: any) => {
      if (error?.message && /null constraint|violates not-null|cannot be null/i.test(error.message)) {
        error.message = "Please fill in all required variation details before proceeding";
      }
    },
  });
}

export function useUpdateVariant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      productUuid,
      variantUuid,
      data,
    }: {
      productUuid: string;
      variantUuid: string;
      data: Record<string, unknown>;
    }) => updateAdminVariant(productUuid, variantUuid, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: variantKeys.all });
      queryClient.invalidateQueries({
        queryKey: variantKeys.detail(variables.variantUuid),
      });
    },
    onError: (error: any) => {
      if (error?.message && /null constraint|violates not-null|cannot be null/i.test(error.message)) {
        error.message = "Please fill in all required variation details before proceeding";
      }
    },
  });
}

export function useGenerateVariants() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      productUuid,
      data,
      itemUuid,
    }: {
      productUuid: string;
      data: GenerateVariantsInput;
      itemUuid?: string;
    }) => generateAdminVariants(productUuid, data, itemUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: variantKeys.all });
    },
  });
}

export function useGenerateVariantsFromItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      productUuid,
      itemUuid,
      data,
    }: {
      productUuid: string;
      itemUuid: string;
      data: { unitId: string; defaultPrice?: number; defaultStock?: number; activate?: boolean };
    }) => generateAdminVariantsFromItem(productUuid, itemUuid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: variantKeys.all });
    },
  });
}

export function useBulkEditVariants() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BulkEditVariantsInput) => bulkEditVariants(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: variantKeys.all });
    },
  });
}

export function useDeleteVariant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      productUuid,
      variantUuid,
    }: {
      productUuid: string;
      variantUuid: string;
    }) => deleteAdminVariant(productUuid, variantUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: variantKeys.all });
    },
  });
}

export function useCreateVariantUnitPrice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productUuid,
      variantUuid,
      data,
    }: {
      productUuid: string;
      variantUuid: string;
      data: Record<string, unknown>;
    }) => {
      const { createVariantUnitPrice } = await import("../api/get-variants");
      return createVariantUnitPrice(
        productUuid,
        variantUuid,
        data as unknown as Parameters<typeof createVariantUnitPrice>[2]
      );
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: variantKeys.all });
      queryClient.invalidateQueries({
        queryKey: [...variantKeys.all, "unit-prices", variables.variantUuid],
      });
      queryClient.invalidateQueries({
        queryKey: variantKeys.detail(variables.variantUuid),
      });
    },
  });
}

export function useUpdateVariantUnitPrice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productUuid,
      variantUuid,
      unitPriceUuid,
      data,
    }: {
      productUuid: string;
      variantUuid: string;
      unitPriceUuid: string;
      data: Record<string, unknown>;
    }) => {
      const { updateVariantUnitPrice } = await import("../api/get-variants");
      return updateVariantUnitPrice(
        productUuid,
        variantUuid,
        unitPriceUuid,
        data as unknown as Parameters<typeof updateVariantUnitPrice>[3]
      );
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: variantKeys.all });
      queryClient.invalidateQueries({
        queryKey: [...variantKeys.all, "unit-prices", variables.variantUuid],
      });
      queryClient.invalidateQueries({
        queryKey: variantKeys.detail(variables.variantUuid),
      });
    },
  });
}

export function useDeleteVariantUnitPrice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productUuid,
      variantUuid,
      unitPriceUuid,
    }: {
      productUuid: string;
      variantUuid: string;
      unitPriceUuid: string;
    }) => {
      const { deleteVariantUnitPrice } = await import("../api/get-variants");
      return deleteVariantUnitPrice(productUuid, variantUuid, unitPriceUuid);
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: variantKeys.all });
      queryClient.invalidateQueries({
        queryKey: [...variantKeys.all, "unit-prices", variables.variantUuid],
      });
      queryClient.invalidateQueries({
        queryKey: variantKeys.detail(variables.variantUuid),
      });
    },
  });
}

export function useCreateVariantImages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productUuid,
      variantUuid,
      images,
    }: {
      productUuid: string;
      variantUuid: string;
      images: Array<{
        imageUrl: string;
        sortOrder?: number;
        isPrimary?: boolean;
      }>;
    }) => {
      const { createAdminVariantImages } = await import("../api/get-variants");
      return createAdminVariantImages(productUuid, variantUuid, images);
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: variantKeys.all });
      queryClient.invalidateQueries({
        queryKey: [...variantKeys.all, "images", variables.variantUuid],
      });
    },
  });
}

export function useUpdateVariantImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productUuid,
      variantUuid,
      imageUuid,
      data,
    }: {
      productUuid: string;
      variantUuid: string;
      imageUuid: string;
      data: { imageUrl?: string; sortOrder?: number };
    }) => {
      const { updateAdminVariantImage } = await import("../api/get-variants");
      return updateAdminVariantImage(productUuid, variantUuid, imageUuid, data);
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: variantKeys.all });
      queryClient.invalidateQueries({
        queryKey: [...variantKeys.all, "images", variables.variantUuid],
      });
    },
  });
}

export function useSetPrimaryVariantImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productUuid,
      variantUuid,
      imageUuid,
    }: {
      productUuid: string;
      variantUuid: string;
      imageUuid: string;
    }) => {
      const { setPrimaryAdminVariantImage } = await import("../api/get-variants");
      return setPrimaryAdminVariantImage(productUuid, variantUuid, imageUuid);
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: variantKeys.all });
      queryClient.invalidateQueries({
        queryKey: [...variantKeys.all, "images", variables.variantUuid],
      });
      queryClient.invalidateQueries({
        queryKey: variantKeys.detail(variables.variantUuid),
      });
    },
  });
}

export function useDeleteVariantImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productUuid,
      variantUuid,
      imageUuid,
    }: {
      productUuid: string;
      variantUuid: string;
      imageUuid: string;
    }) => {
      const { deleteAdminVariantImage } = await import("../api/get-variants");
      return deleteAdminVariantImage(productUuid, variantUuid, imageUuid);
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: variantKeys.all });
      queryClient.invalidateQueries({
        queryKey: [...variantKeys.all, "images", variables.variantUuid],
      });
    },
  });
}
