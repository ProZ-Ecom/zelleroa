"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminCustomerKeys } from "@/lib/api/query-keys";
import { toast } from "@/components/ui/Toast";
import { updateCustomerStatus } from "../api/admin-customers.api";
import type { AdminCustomerDetailDto } from "../types/admin-customer.types";

export interface UpdateCustomerStatusVariables {
  uuid: string;
  isActive: boolean;
  /** Required when blocking (isActive = false). */
  blockReason?: string;
}

export function useUpdateCustomerStatus() {
  const queryClient = useQueryClient();

  return useMutation<
    AdminCustomerDetailDto,
    Error,
    UpdateCustomerStatusVariables
  >({
    mutationFn: ({ uuid, isActive, blockReason }) =>
      updateCustomerStatus(uuid, isActive, blockReason),
    onSuccess: (data, variables) => {
      // Invalidate customer lists, detail, and count queries
      queryClient.invalidateQueries({
        queryKey: adminCustomerKeys.all,
      });
      queryClient.invalidateQueries({
        queryKey: adminCustomerKeys.detail(variables.uuid),
      });

      const message = variables.isActive
        ? "Customer account has been unblocked and reactivated."
        : "Customer account has been blocked and deactivated.";

      toast.success("Status Updated", message);
    },
    onError: (error) => {
      toast.error(
        "Update Failed",
        error.message || "Failed to update customer status. Please try again."
      );
    },
  });
}

// Alias for convenience
export const useBlockCustomer = useUpdateCustomerStatus;
