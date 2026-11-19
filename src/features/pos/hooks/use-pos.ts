"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/Toast";
import { adminOrderKeys } from "@/lib/api/query-keys";
import * as api from "../api/pos.api";
import type { PosPurchasesQueryInput, PosShiftListInput } from "../validations/pos.schema";

const KEY = "pos";

export function useShiftState() {
  return useQuery({ queryKey: [KEY, "shift"], queryFn: api.getShiftState });
}

export function useOpenShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.openShift,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      toast.success("Shift opened");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not open the shift"),
  });
}

export function useShiftSummary(sessionUuid?: string | null) {
  return useQuery({
    queryKey: [KEY, "summary", sessionUuid],
    queryFn: () => api.getShiftSummary(sessionUuid!),
    enabled: Boolean(sessionUuid),
  });
}

export function useCloseShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.closeShift,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      toast.success("Shift closed");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not close the shift"),
  });
}

export function useShifts(params: PosShiftListInput) {
  return useQuery({
    queryKey: [KEY, "shifts", params],
    queryFn: () => api.getShifts(params),
    placeholderData: keepPreviousData,
  });
}

export function useProductSearch(search: string) {
  return useQuery({
    queryKey: [KEY, "products", search],
    queryFn: () => api.searchProducts(search),
    enabled: search.trim().length >= 2,
    placeholderData: keepPreviousData,
  });
}

export function useRecentBills(enabled: boolean) {
  return useQuery({ queryKey: [KEY, "bills"], queryFn: api.getRecentBills, enabled });
}

export function useCreateBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createBill,
    onSuccess: () => {
      // The shift totals and the stock screens both move with every bill.
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: adminOrderKeys.all });
      qc.invalidateQueries({ queryKey: ["admin-orders", "count"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create the bill"),
  });
}

export function useVoidBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.voidBill,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: adminOrderKeys.all });
      qc.invalidateQueries({ queryKey: ["admin-orders", "count"] });
      toast.success(`Bill ${res?.invoiceNumber ?? res?.orderNumber ?? ""} voided`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not void the bill"),
  });
}

export function usePurchases(params: PosPurchasesQueryInput) {
  return useQuery({
    queryKey: [KEY, "purchases", params],
    queryFn: () => api.getPurchases(params),
    placeholderData: keepPreviousData,
  });
}

export function usePurchaseDetail(uuid: string | null) {
  return useQuery({
    queryKey: [KEY, "purchase", uuid],
    queryFn: () => (uuid ? api.getPurchaseDetail(uuid) : null),
    enabled: Boolean(uuid),
  });
}

export function useExecuteExchange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.executeExchange,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: adminOrderKeys.all });
      qc.invalidateQueries({ queryKey: ["admin-orders", "count"] });
      toast.success(`Exchange ${res.exchangeNumber} completed`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Exchange could not be completed"),
  });
}

