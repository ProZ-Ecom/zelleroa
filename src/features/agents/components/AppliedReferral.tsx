"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck } from "lucide-react";
import { apiClient } from "@/lib/api/api-client";

interface CurrentReferral {
  applied: boolean;
  referralCode: string | null;
  agentName: string | null;
}

const KEY = ["current-referral"];

/**
 * Checkout note showing which agent referral this order will be credited to.
 * Renders nothing when there is no valid referral - checkout is unaffected.
 */
export function AppliedReferral() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: KEY,
    queryFn: async () => (await apiClient.get<CurrentReferral>("/api/referral/current")).data ?? null,
    staleTime: 30_000,
  });
  const remove = useMutation({
    mutationFn: () => apiClient.delete("/api/referral/current"),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  if (!data?.applied) return null;
  return (
    <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900">
      <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p>
          Referral applied: <span className="font-mono font-semibold">{data.referralCode}</span>
          {data.agentName ? <> ({data.agentName})</> : null}
        </p>
        <button
          type="button"
          onClick={() => remove.mutate()}
          disabled={remove.isPending}
          className="mt-0.5 font-semibold underline underline-offset-2 disabled:opacity-60"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
