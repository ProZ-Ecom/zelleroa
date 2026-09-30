"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  customerOrdersApi,
  type CustomerOrdersQueryParams,
  type CreateCustomerOrderPayload,
  type CreateGuestOrderPayload,
  type CancelCustomerOrderPayload,
} from "../api/customer-orders.api";

export const CUSTOMER_ORDERS_QUERY_KEY = ["customer", "orders"] as const;

export function useCustomerOrders(params: CustomerOrdersQueryParams = {}) {
  return useQuery({
    queryKey: [...CUSTOMER_ORDERS_QUERY_KEY, params],
    queryFn: () => customerOrdersApi.listOrders(params),
    staleTime: 1000 * 30, // 30 seconds
    placeholderData: keepPreviousData,
  });
}

export function useCustomerOrderDetail(uuid: string) {
  const isValid =
    Boolean(uuid) &&
    uuid !== "undefined" &&
    uuid !== "null" &&
    uuid.trim() !== "";

  return useQuery({
    queryKey: [...CUSTOMER_ORDERS_QUERY_KEY, "detail", uuid],
    queryFn: () => customerOrdersApi.getOrderByUuid(uuid),
    enabled: isValid,
  });
}

export function useCreateCustomerOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateCustomerOrderPayload) =>
      customerOrdersApi.createOrder(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOMER_ORDERS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["customer", "cart"] });
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
  });
}

export function useCreateGuestOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateGuestOrderPayload) =>
      customerOrdersApi.createGuestOrder(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOMER_ORDERS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["customer", "cart"] });
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
  });
}

export function useCancelCustomerOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      uuid,
      payload,
    }: {
      uuid: string;
      payload: CancelCustomerOrderPayload;
    }) => customerOrdersApi.cancelOrder(uuid, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: CUSTOMER_ORDERS_QUERY_KEY });
      queryClient.invalidateQueries({
        queryKey: [...CUSTOMER_ORDERS_QUERY_KEY, "detail", variables.uuid],
      });
    },
  });
}
