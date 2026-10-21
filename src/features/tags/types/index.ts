export interface AdminTagResponse {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  /** Active, non-deleted products currently carrying this tag. */
  productCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminTagProductRef {
  id: string; // Product public UUID
  name: string;
}

export interface AdminTagDetailResponse extends AdminTagResponse {
  products: AdminTagProductRef[];
}

export interface GetAdminTagsParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export type TagProductsAction = "add" | "remove" | "set";
