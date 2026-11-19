"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  getDashboardStats,
  type DashboardStats,
  type DashboardRange,
  type DashboardChannel,
} from "../api/get-stats";

export function useDashboardStats(
  range: DashboardRange = 7,
  channel: DashboardChannel = "all"
) {
  return useQuery<DashboardStats>({
    queryKey: ["dashboard", "stats", range, channel],
    queryFn: () => getDashboardStats(range, channel),
    placeholderData: keepPreviousData,
  });
}
