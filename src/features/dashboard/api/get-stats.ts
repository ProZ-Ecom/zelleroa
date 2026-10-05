import { apiClient } from "@/lib/api/api-client";

export type DashboardRange = 7 | 30 | 90;

export interface DashboardMetrics {
  users: number;
  agents: number;
  orders: number;
  sales: number;
  revenue: number;
  cancelled: number;
  returned: number;
  pending: number;
}

export type MetricChanges = Record<keyof DashboardMetrics, number | null>;

export interface DashboardAgents {
  active: number;
  inactive: number;
  kycPending: number;
  bankPending: number;
  commissionOwed: number;
  commissionPaid: number;
  payoutRequested: number;
  topAgents: {
    id: string;
    name: string;
    code: string | null;
    orders: number;
    sales: number;
    commission: number;
  }[];
}

export interface DashboardStats {
  agents: DashboardAgents;
  overall: DashboardMetrics;
  today: DashboardMetrics;
  todayVsYesterday: MetricChanges;
  todayVsLastWeek: MetricChanges;
  range: number;
  totalProducts: number;
  totalCategories: number;
  totalCustomers: number;
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  lowStock: number;
  todayOrders: number;
  outOfStock: number;
  openReturns: number;
  period: {
    revenue: number;
    orders: number;
    avgOrderValue: number;
    newCustomers: number;
    revenueGrowth: number | null;
    ordersGrowth: number | null;
    aovGrowth: number | null;
    customersGrowth: number | null;
  };
  salesTrend: { label: string; value: number; orders: number }[];
  ordersByStatus: { status: string; count: number }[];
  paymentBreakdown: { status: string; count: number; amount: number }[];
  recentOrders: {
    id: string;
    uuid: string | null;
    customer: string;
    date: string;
    amount: number;
    status: string;
  }[];
  topProducts: { id: string; name: string; unitsSold: number; revenue: number }[];
  topCustomers: {
    id: string;
    name: string;
    email: string | null;
    orders: number;
    spent: number;
  }[];
  lowStockItems: { id: string; name: string; variant: string | null; sku: string; stock: number; reorderLevel: number }[];
}

export async function getDashboardStats(range: DashboardRange = 7): Promise<DashboardStats> {
  const response = await apiClient.get<DashboardStats>(`/api/dashboard/stats?range=${range}`);
  return response.data!;
}
