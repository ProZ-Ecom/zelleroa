export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  /** Optional extras some lists add (e.g. own purchases total spend). */
  totalSpend?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface CommissionFilters {
  page?: number;
  limit?: number;
  /** Agent uuid / agent code / internal id - admin only; never trusted for agent-scoped calls. */
  agent?: string;
  /** Customer name / email / phone fragment or uuid. */
  customer?: string;
  status?: string;
  orderStatus?: string;
  /** Referral code used on the order (exact match). */
  referralCode?: string;
  /** Order number fragment or order uuid. */
  order?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CommissionRow {
  id: string;
  code: string;
  orderId: string;
  orderNumber: string;
  referralCode: string | null;
  customerName: string;
  customerContact: string | null;
  agentName: string;
  agentCode: string | null;
  productName: string;
  categoryName: string | null;
  quantity: number;
  productAmount: number;
  percentage: number;
  rateSource: string;
  amount: number;
  status: string;
  orderStatus: string;
  eligibleAt: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  clawbackDue: boolean;
  reversalReason: string | null;
  payoutCode: string | null;
}

export interface AgentSummary {
  totalReferredCustomers: number;
  /** Assigned customers whose account is active. */
  activeCustomers: number;
  totalOrders: number;
  customerDirectOrders: number;
  agentPlacedOrders: number;
  agentOwnOrders: number;
  /** Cancelled + reversed commission (not part of totalCommission). */
  cancelledCommission: number;
  totalSales: number;
  pendingCommission: number;
  approvedCommission: number;
  paidCommission: number;
  totalCommission: number;
}

export interface PayoutRow {
  id: string;
  code: string;
  agentId: string;
  agentName: string;
  agentCode: string | null;
  amount: number;
  method: string;
  /** UPI id or masked bank details - the full account number is never returned. */
  destination: string;
  bankName: string | null;
  accountHolderName: string | null;
  ifsc: string | null;
  status: string;
  requestedAt: string;
  reviewedAt: string | null;
  paidAt: string | null;
  transactionReference: string | null;
  rejectionReason: string | null;
  adminNote: string | null;
  commissionCount: number;
}
