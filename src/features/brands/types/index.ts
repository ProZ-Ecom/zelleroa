export interface BrandListItem {
  id: string;
  uuid:string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  _count?: { products?: number };
}

export interface BrandDetail extends BrandListItem {
  products?: { id: number | bigint; name: string; slug: string; price?: number; base_price?: any; isActive: boolean }[];
}

export interface GetBrandsParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  categorySlug?: string;
}

export interface GetBrandsResult {
  data: BrandListItem[];
  meta: { page: number; limit: number; total: number; totalPages: number; pageSize?: number };
}

export interface CreateBrandInput {
  name: string;
  slug?: string;
  description?: string;
}

export interface UpdateBrandInput extends Partial<CreateBrandInput> {}

export interface AdminBrandResponse {
  id: string; // Public UUID
  name: string;
  slug: string;
  description: string | null;
  status: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GetAdminBrandsParams {
  page?: number;
  pageSize?: number;
  search?: string;
}
