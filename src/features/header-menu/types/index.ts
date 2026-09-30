import type { CategoryTreeNode } from "@/features/categories/types";
import type { HeaderMenuGender } from "../validations/admin-header-menu.schema";

export type { HeaderMenuGender };

export interface AdminHeaderMenuItemCategory {
  id: string; // Public UUID
  name: string;
  slug: string;
}

export interface AdminHeaderMenuItemResponse {
  id: string; // Public UUID
  label: string;
  categories: AdminHeaderMenuItemCategory[];
  link: string | null;
  gender: HeaderMenuGender | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GetAdminHeaderMenuParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface CreateHeaderMenuItemInput {
  label: string;
  categoryIds?: string[];
  link?: string | null;
  gender?: HeaderMenuGender | null;
  sortOrder?: number;
  isActive?: boolean;
}

export type UpdateHeaderMenuItemInput = Partial<CreateHeaderMenuItemInput>;

/**
 * One resolved storefront nav entry. `categories` is 0, 1, or many — 0 means a
 * plain link; 1 means "this category's own page/subtree"; 2+ means a grouped
 * dropdown of unrelated categories under one label, with `link` (or a
 * `/products` fallback) as the top-level click target. `gender`, when set,
 * is appended as `?gender=` to every link resolved under this item so its
 * audience filter survives into the category page even though the category
 * itself may also be shared with another nav item.
 */
export interface HeaderNavItem {
  id: string;
  label: string;
  link: string | null;
  gender: HeaderMenuGender | null;
  categories: CategoryTreeNode[];
}
