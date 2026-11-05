import { apiClient, ApiClientError } from "@/lib/api/api-client";
import type { RequestSummary } from "../lib/summary";

export interface EligibilityItem {
  orderItemId: string;
  productName: string;
  variantName: string;
  size: string | null;
  color: string | null;
  image: string | null;
  quantity: number;
  unitPrice: number;
  canRequest: boolean;
  blockedReason: string | null;
  replacementSizes: {
    id: string;
    label: string;
    available: number;
    inStock: boolean;
    isCurrent: boolean;
  }[];
}

export interface ReturnEligibility {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  isCod?: boolean;
  paymentMethod?: string;
  window: {
    eligible: boolean;
    code: string;
    message: string;
    deliveredAt: string | null;
    deadline: string | null;
    daysLeft: number;
  };
  canReturn: boolean;
  canReplace: boolean;
  items: EligibilityItem[];
}

/** Request as returned to the admin lists / detail (summary + order + customer context). */
export interface AdminRequest extends RequestSummary {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  deliveredAt: string | null;
  returnDeadline: string | null;
  orderTotal?: number;
  /** Returns only: the customer's ship-back deadline and what is left of it. */
  shipDeadline?: string | null;
  shipDaysLeft?: number;
  shipWindowExpired?: boolean;
  deliveredReplacementAt?: string | null;
  customer: { id: string; name: string; email: string | null; phone: string | null };
  shippingAddress?: {
    id: string;
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string | null;
    landmark?: string | null;
    city: string;
    state: string;
    pincode: string;
    country: string;
  } | null;
  originalCourier?: {
    carrier: string | null;
    trackingNumber: string;
  } | null;
}

/** Outcome of the automatic gateway refund the `refund` action attempts. */
export interface GatewayRefundResult {
  attempted: boolean;
  ok: boolean;
  message: string;
  transactionRef?: string;
}

/** An action response: the updated request, plus any gateway refund it triggered. */
export interface AdminActionResult extends AdminRequest {
  gatewayRefund?: GatewayRefundResult;
}

export interface CodRefundDetailsPayload {
  method: "bank_transfer" | "upi";
  accountHolderName?: string;
  bankName?: string;
  accountNumber?: string;
  confirmAccountNumber?: string;
  ifscCode?: string;
  upiId?: string;
}

export interface SubmitReturnPayload {
  reason: string;
  description?: string;
  unboxingVideoUrl: string;
  items: { orderItemId: string; quantity: number }[];
  codRefundDetails?: CodRefundDetailsPayload;
}

export interface SubmitReplacementPayload extends Omit<SubmitReturnPayload, "items" | "codRefundDetails"> {
  items: { orderItemId: string; quantity: number; requestedVariantUnitPriceId?: string }[];
}

export interface RequestListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

export interface RequestActionPayload {
  comment?: string;
  rejectionReason?: string;
  qcFailureReason?: string;
  cancellationReason?: string;
  pickupDate?: string;
  shippedDate?: string;
  transactionRef?: string;
  courierName?: string;
  trackingNumber?: string;
  shippingSlipUrl?: string;
  pickupImageUrl?: string;
}

/** What the customer may send with their own `shipped` / `cancel` actions. */
export interface CustomerReturnActionPayload {
  courierName?: string;
  trackingNumber?: string;
  shippedDate?: string;
  shippingSlipUrl?: string;
  cancellationReason?: string;
}

/** A stored delivery slip photo. */
export interface UploadedSlip {
  url: string;
  size: number;
  contentType: string;
}

export interface UploadedVideo {
  url: string;
  size: number;
  contentType: string;
}

export interface VideoStorageUsage {
  totalBytes: number;
  totalMb: number;
  limitMb: number;
  thresholdMb: number;
  thresholdPercent: number;
  usedPercent: number;
  fileCount: number;
  isReached: boolean;
  storageType: "google_drive" | "local" | "both";
}

export interface ClearStorageResult {
  clearedLocalCount: number;
  clearedDriveCount: number;
  totalCleared: number;
}

export const returnsApi = {
  async getEligibility(orderUuid: string) {
    const res = await apiClient.get<ReturnEligibility>(
      `/api/customer/orders/${orderUuid}/return-eligibility`
    );
    return res.data!;
  },

  async submitReturn(orderUuid: string, payload: SubmitReturnPayload) {
    const res = await apiClient.post<AdminRequest>(`/api/customer/orders/${orderUuid}/return`, payload);
    return res.data!;
  },

  async submitReplacement(orderUuid: string, payload: SubmitReplacementPayload) {
    const res = await apiClient.post<AdminRequest>(`/api/customer/orders/${orderUuid}/replacement`, payload);
    return res.data!;
  },

  /** XHR (not fetch) so the UI can show real upload progress. */
  uploadVideo(
    file: File,
    onProgress: (percent: number) => void,
    signal?: AbortSignal
  ): Promise<UploadedVideo> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/customer/returns/upload-video");
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onerror = () => reject(new Error("Network error while uploading the video"));
      xhr.onabort = () => reject(new Error("Upload cancelled"));
      xhr.onload = () => {
        let body: { data?: UploadedVideo; message?: string; errors?: string[] } = {};
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          /* non-JSON */
        }
        if (xhr.status >= 200 && xhr.status < 300 && body.data) {
          resolve(body.data);
        } else {
          reject(
            new ApiClientError(body.message || "Video upload failed", xhr.status, body.errors)
          );
        }
      };
      signal?.addEventListener("abort", () => xhr.abort());
      const form = new FormData();
      form.append("file", file);
      xhr.send(form);
    });
  },

  /** Stores the mandatory courier / delivery slip photo for a return. */
  async uploadShippingSlip(file: File): Promise<UploadedSlip> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/customer/returns/upload-slip", {
      method: "POST",
      body: form,
      credentials: "include",
    });
    const body = (await res.json().catch(() => ({}))) as {
      data?: UploadedSlip;
      message?: string;
      errors?: string[];
    };
    if (!res.ok || !body.data) {
      throw new ApiClientError(
        body.message || "Delivery slip upload failed",
        res.status,
        body.errors
      );
    }
    return body.data;
  },

  /** `shipped` (courier + tracking) or `cancel`, on the customer's own request. */
  async customerAction(
    uuid: string,
    action: "shipped" | "cancel",
    payload: CustomerReturnActionPayload = {}
  ) {
    const res = await apiClient.post<AdminRequest>(
      `/api/customer/returns/${uuid}/${action}`,
      payload
    );
    return res.data!;
  },

  // ── admin ────────────────────────────────────────────────────────────────
  async listAdmin(kind: "returns" | "replacements", params: RequestListParams) {
    const res = await apiClient.post<AdminRequest[]>(`/api/admin/${kind}/list`, params);
    return {
      data: res.data ?? [],
      meta: (res.meta as { page: number; limit: number; total: number; totalPages: number }) ?? {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 1,
      },
    };
  },

  async getAdmin(kind: "returns" | "replacements", uuid: string) {
    const res = await apiClient.get<AdminRequest>(`/api/admin/${kind}/${uuid}`);
    return res.data!;
  },

  async adminAction(
    kind: "returns" | "replacements",
    uuid: string,
    action: string,
    payload: RequestActionPayload = {}
  ) {
    const res = await apiClient.post<AdminActionResult>(
      `/api/admin/${kind}/${uuid}/${action}`,
      payload
    );
    return res.data!;
  },

  async getStorageUsage(): Promise<VideoStorageUsage> {
    const res = await apiClient.get<VideoStorageUsage>('/api/admin/returns/storage');
    return res.data!;
  },

  async clearStorage(): Promise<ClearStorageResult> {
    const res = await apiClient.post<ClearStorageResult>('/api/admin/returns/storage');
    return res.data!;
  },
};
