"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getDashboardStats, type DashboardStats, type DashboardRange } from "../api/get-stats";

export function useDashboardStats(range: DashboardRange = 7) {
  return useQuery<DashboardStats>({
    queryKey: ["dashboard", "stats", range],
    queryFn: () => getDashboardStats(range),
    placeholderData: keepPreviousData,
  });
}
