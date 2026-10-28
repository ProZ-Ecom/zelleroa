export interface CategoryListItem {
  id: number;
  name: string;
  slug: string;
  icon?:string;
  description: string | null;
  image: string | null;
  parentId: number | null;
  isActive: boolean;
  sortOrder: number;
  _count: {
    products: number;
    children: number;
  };
}

export interface CategoryDetail extends CategoryListItem {
  metaTitle: string | null;
  metaDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
  
  parent: {
    id: number;
    name: string;
    slug: string;
  } | null;
  children: {
    id: number;
    name: string;
    slug: string;
    image: string | null;
    _count: { products: number };
  }[];
  products: {
    id: number;
    name: string;
    slug: string;
    price: number;
    comparePrice: number | null;
    discountPercent: number;
    isActive: boolean;
    images: { id: number; url: string; altText: string | null; isPrimary: boolean }[];
    brand: { id: number; name: string; slug: string } | null;
  }[];
}

export interface GetCategoriesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  parentId?: number | null;
}

export interface CreateCategoryInput {
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parentId?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  metaTitle?: string;
  metaDescription?: string;
}

export type UpdateCategoryInput = Partial<CreateCategoryInput>;

export interface AdminCategoryResponse {
  id: string; // Public UUID
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  status: boolean;
  isActive: boolean;
  sortOrder: number;
  parentId: string | null; // Public UUID of the parent category, if any
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryTreeNode {
  id: string; // Public UUID
  name: string;
  slug: string;
  icon: string | null;
  children: CategoryTreeNode[];
}

export interface GetAdminCategoriesParams {
  page?: number;
  pageSize?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  parentId?: string | null;
}

export interface CustomerCategoryDto {
  id: string;
  name: string;
  image: string | null;
}

export interface CustomerCategoryListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: "name" | "createdAt";
  sortOrder?: "asc" | "desc";
}

export interface AdminCategoriesCountResponse {
  active: number;
  inactive: number;
  all: number;
}

