"use client";

import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "@/components/ui/Toast";
import { purchaseKeys, vendorKeys } from "@/lib/api/query-keys";
import * as api from "../api/purchases.api";
import type { GetPurchasesParams, GetVendorsParams } from "../types";

function clean<T extends object>(params?: T) {
  const out: Record<string, string | number | boolean> = {};
  if (!params) return out;
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") out[k] = v as string | number | boolean;
  }
  return out;
}

const errMessage = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

export function useVendors(params?: GetVendorsParams, options?: { enabled?: boolean }) {
  const q = clean(params);
  return useQuery({
    queryKey: vendorKeys.list(q),
    queryFn: () => api.getVendors(q),
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useVendorMutations() {
  const qc = useQueryClient();
  const done = (msg: string) => () => {
    qc.invalidateQueries({ queryKey: vendorKeys.all });
    toast.success(msg);
  };
  const onError = (e: unknown) => toast.error(errMessage(e));
  return {
    create: useMutation({
      mutationFn: (data: Record<string, unknown>) => api.createVendor(data),
      onSuccess: done("Vendor created"),
      onError,
    }),
    update: useMutation({
      mutationFn: ({ uuid, data }: { uuid: string; data: Record<string, unknown> }) =>
        api.updateVendor(uuid, data),
      onSuccess: done("Vendor updated"),
      onError,
    }),
    remove: useMutation({
      mutationFn: (uuid: string) => api.deleteVendor(uuid),
      onSuccess: done("Vendor deleted"),
      onError,
    }),
  };
}

export function usePurchaseOrders(params?: GetPurchasesParams) {
  const q = clean(params);
  return useQuery({
    queryKey: purchaseKeys.list(q),
    queryFn: () => api.getPurchaseOrders(q),
    placeholderData: keepPreviousData,
  });
}

export function usePurchaseOrder(uuid: string | null) {
  return useQuery({
    queryKey: purchaseKeys.detail(uuid ?? ""),
    queryFn: () => api.getPurchaseOrder(uuid!),
    enabled: !!uuid,
  });
}

export function usePurchaseProducts(search: string) {
  return useQuery({
    queryKey: [...purchaseKeys.all, "products", search],
    queryFn: () => api.searchPurchaseProducts(search),
    placeholderData: keepPreviousData,
  });
}

export function usePurchaseMutations() {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: purchaseKeys.all });
    // Receiving changes stock, so the inventory screens must refetch too.
    qc.invalidateQueries({ queryKey: ["inventory"] });
  };
  const onError = (e: unknown) => toast.error(errMessage(e));
  return {
    create: useMutation({
      mutationFn: (data: Record<string, unknown>) => api.createPurchaseOrder(data),
      onSuccess: () => {
        refresh();
        toast.success("Purchase order created");
      },
      onError,
    }),
    update: useMutation({
      mutationFn: ({ uuid, data }: { uuid: string; data: Record<string, unknown> }) =>
        api.updatePurchaseOrder(uuid, data),
      onSuccess: () => {
        refresh();
        toast.success("Purchase order updated");
      },
      onError,
    }),
    act: useMutation({
      mutationFn: ({ uuid, ...data }: { uuid: string; action: string; reason?: string }) =>
        api.actOnPurchaseOrder(uuid, data),
      onSuccess: (_r, v) => {
        refresh();
        toast.success(`Purchase order ${v.action === "order" ? "marked as ordered" : `${v.action}${v.action.endsWith("e") ? "d" : "ed"}`}`);
      },
      onError,
    }),
    receive: useMutation({
      mutationFn: ({ uuid, data }: { uuid: string; data: Record<string, unknown> }) =>
        api.receivePurchaseOrder(uuid, data),
      onSuccess: () => {
        refresh();
        toast.success("Goods received, stock updated");
      },
      onError,
    }),
  };
}
