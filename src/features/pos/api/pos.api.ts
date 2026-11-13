import { apiClient } from "@/lib/api/api-client";
import type {
  PosBillDto,
  PosCustomerLookupDto,
  PosProductOption,
  PosSessionDto,
  PosSessionSummary,
  PosStoreDto,
} from "../types";
import type {
  PosBillInput,
  PosShiftCloseInput,
  PosShiftListInput,
  PosShiftOpenInput,
  PosVoidInput,
} from "../validations/pos.schema";

type Params = Record<string, string | number | boolean | undefined | null>;

export interface PosShiftState {
  session: PosSessionDto | null;
  store: PosStoreDto;
}

export interface PosRecentBill {
  orderUuid: string | null;
  orderNumber: string;
  invoiceNumber: string | null;
  totalAmount: number;
  voided: boolean;
  billedAt: string | null;
  customerName: string | null;
}

export async function getShiftState() {
  const res = await apiClient.get<PosShiftState>("/api/admin/pos/shift");
  return res.data as PosShiftState;
}

export async function openShift(data: PosShiftOpenInput) {
  const res = await apiClient.post<PosSessionDto>("/api/admin/pos/shift/open", data);
  return res.data as PosSessionDto;
}

export async function getShiftSummary(sessionUuid: string) {
  const res = await apiClient.get<PosSessionSummary>("/api/admin/pos/shift/summary", {
    params: { sessionUuid },
  });
  return res.data as PosSessionSummary;
}

export async function closeShift(data: PosShiftCloseInput & { sessionUuid: string }) {
  const res = await apiClient.post<PosSessionSummary>("/api/admin/pos/shift/close", data);
  return res.data as PosSessionSummary;
}

export async function getShifts(params: PosShiftListInput) {
  const res = await apiClient.get<PosSessionSummary[]>("/api/admin/pos/shifts", {
    params: params as unknown as Params,
  });
  return { data: res.data ?? [], meta: res.meta };
}

/** Exact SKU hit, or null when nothing matches - the Enter-key path. */
export async function findBySku(sku: string) {
  const res = await apiClient.get<PosProductOption[]>("/api/admin/pos/products", {
    params: { sku },
  });
  return res.data?.[0] ?? null;
}

export async function searchProducts(search: string) {
  const res = await apiClient.get<PosProductOption[]>("/api/admin/pos/products", {
    params: { search: search || undefined },
  });
  return res.data ?? [];
}

export async function lookupCustomer(phone: string) {
  const res = await apiClient.get<PosCustomerLookupDto>("/api/admin/pos/customer", {
    params: { phone },
  });
  return res.data as PosCustomerLookupDto;
}

export async function createBill(data: PosBillInput) {
  const res = await apiClient.post<PosBillDto>("/api/admin/pos/bill", data);
  return res.data as PosBillDto;
}

export async function getRecentBills() {
  const res = await apiClient.get<PosRecentBill[]>("/api/admin/pos/bill");
  return res.data ?? [];
}

export async function voidBill(data: PosVoidInput) {
  const res = await apiClient.post<{ orderNumber: string; invoiceNumber: string | null }>(
    "/api/admin/pos/void",
    data
  );
  return res.data;
}
