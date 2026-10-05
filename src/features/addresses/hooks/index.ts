"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addressKeys } from "@/lib/api/query-keys";
import {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from "../api/get-addresses";
import type { CreateAddressInput, UpdateAddressInput } from "../types";

export function useAddresses() {
  return useQuery({
    queryKey: addressKeys.all,
    queryFn: getAddresses,
  });
}

export function useCreateAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAddressInput) => createAddress(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addressKeys.all });
    },
  });
}

export function useUpdateAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateAddressInput }) =>
      updateAddress(id, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: addressKeys.all });
      queryClient.invalidateQueries({ queryKey: addressKeys.detail(variables.id) });
    },
  });
}

export function useDeleteAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteAddress(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addressKeys.all });
    },
  });
}

export function useSetDefaultAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => setDefaultAddress(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addressKeys.all });
    },
  });
}

export * from "./use-pincode-lookup";

