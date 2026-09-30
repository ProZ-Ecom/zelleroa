"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CUSTOMER_ORDERS_QUERY_KEY } from "@/features/customers/hooks/use-customer-orders";
import {
  returnsApi,
  type RequestActionPayload,
  type RequestListParams,
  type SubmitReplacementPayload,
  type SubmitReturnPayload,
} from "../api/returns.api";

export type RequestKind = "returns" | "replacements";

export const useReturnEligibility = (orderUuid: string, enabled = true) =>
  useQuery({
    queryKey: [...CUSTOMER_ORDERS_QUERY_KEY, "eligibility", orderUuid],
    queryFn: () => returnsApi.getEligibility(orderUuid),
    enabled: enabled && Boolean(orderUuid),
    staleTime: 0,
  });

export function useSubmitReturn(orderUuid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SubmitReturnPayload) => returnsApi.submitReturn(orderUuid, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: CUSTOMER_ORDERS_QUERY_KEY }),
  });
}

export function useSubmitReplacement(orderUuid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SubmitReplacementPayload) =>
      returnsApi.submitReplacement(orderUuid, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: CUSTOMER_ORDERS_QUERY_KEY }),
  });
}

export const ADMIN_REQUESTS_KEY = ["admin", "order-requests"] as const;

export const useAdminRequests = (kind: RequestKind, params: RequestListParams) =>
  useQuery({
    queryKey: [...ADMIN_REQUESTS_KEY, kind, params],
    queryFn: () => returnsApi.listAdmin(kind, params),
    placeholderData: keepPreviousData,
  });

export const useAdminRequest = (kind: RequestKind, uuid: string | null) =>
  useQuery({
    queryKey: [...ADMIN_REQUESTS_KEY, kind, "detail", uuid],
    queryFn: () => returnsApi.getAdmin(kind, uuid!),
    enabled: Boolean(uuid),
  });

export function useAdminRequestAction(kind: RequestKind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { uuid: string; action: string; payload?: RequestActionPayload }) =>
      returnsApi.adminAction(kind, v.uuid, v.action, v.payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_REQUESTS_KEY }),
  });
}
