import type { PaginationMeta } from "@/lib/api/api-response";

export interface AdminStyleResponse {
  id: string; // Public Style UUID
  productId: string; // Public Product UUID
  productName: string;
  productSlug: string;
  categoryId: string | null;
  categoryName: string | null;
  brandId: string | null; // Public Brand UUID
  brandName: string | null;
  name: string;
  slug: string;
  sku: string | null;
  shortDescription: string | null;
  description: string | null;
  ingredients: string | null;
  isReadyToMix: boolean;
  cookingRecipe: string | null;
  shelfLife: string | null;
  vegType: "veg" | "nonveg" | "vegan" | "na";
  basePrice: number;
  isFeatured: boolean;
  isDefault: boolean;
  isActive: boolean;
  outOfStock: boolean;
  primaryImage: string | null;
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GetAdminStylesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
  productId?: string;
  categoryId?: string;
}

export interface GetAdminStylesResult {
  data: AdminStyleResponse[];
  meta?: PaginationMeta;
}

export type {
  CreateAdminStyleInput,
  UpdateAdminStyleInput,
  AdminStyleListQueryInput,
} from "../validations/admin-style.schema";
