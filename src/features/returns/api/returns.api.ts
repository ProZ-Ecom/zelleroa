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
  shippedAt?: string | null;
  deliveredReplacementAt?: string | null;
  customer: { id: string; name: string; email: string | null; phone: string | null };
}

export interface SubmitReturnPayload {
  reason: string;
  description?: string;
  unboxingVideoUrl: string;
  items: { orderItemId: string; quantity: number }[];
}

export interface SubmitReplacementPayload extends Omit<SubmitReturnPayload, "items"> {
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
  pickupDate?: string;
}

export interface UploadedVideo {
  url: string;
  size: number;
  contentType: string;
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
    const res = await apiClient.post<AdminRequest>(`/api/admin/${kind}/${uuid}/${action}`, payload);
    return res.data!;
  },
};
